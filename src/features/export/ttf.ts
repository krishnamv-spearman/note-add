/**
 * A small TrueType toolkit for PDF export (phase 7, bundle budget D37). It replaces fontkit,
 * which was half of the export chunk and is not needed for Latin-only text (ADR 002):
 *
 * - reads the bundled WOFF files (zlib tables) or plain TrueType;
 * - subsets a font to the characters a page uses, **keeping glyph IDs** (unused glyphs become
 *   empty), so no glyph renumbering is needed;
 * - exposes the small "fontkit-like" object pdf-lib's non-subset embedder expects.
 *
 * No shaping or kerning: Latin text and amounts only. Pure functions, no DOM.
 */

export type Tables = Map<string, Uint8Array>;

const view = (b: Uint8Array): DataView => new DataView(b.buffer, b.byteOffset, b.byteLength);
const tagAt = (d: DataView, o: number): string =>
  String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3));

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readSfnt(bytes: Uint8Array): Tables {
  const d = view(bytes);
  const signature = d.getUint32(0);
  if (signature === 0x4f54544f) throw new Error('CFF (OpenType) fonts are not supported');
  if (signature !== 0x00010000 && signature !== 0x74727565) throw new Error('Not a TrueType font');
  const tables: Tables = new Map();
  const count = d.getUint16(4);
  for (let i = 0; i < count; i++) {
    const o = 12 + i * 16;
    const offset = d.getUint32(o + 8);
    tables.set(tagAt(d, o), bytes.subarray(offset, offset + d.getUint32(o + 12)));
  }
  return tables;
}

async function readWoff(bytes: Uint8Array): Promise<Tables> {
  const d = view(bytes);
  if (d.getUint32(4) === 0x4f54544f) throw new Error('CFF (OpenType) fonts are not supported');
  const tables: Tables = new Map();
  const count = d.getUint16(12);
  for (let i = 0; i < count; i++) {
    const o = 44 + i * 20;
    const offset = d.getUint32(o + 4);
    const compressed = d.getUint32(o + 8);
    const original = d.getUint32(o + 12);
    const raw = bytes.subarray(offset, offset + compressed);
    tables.set(tagAt(d, o), compressed < original ? await inflate(raw) : raw);
  }
  return tables;
}

/** Reads the tables of a WOFF or TrueType file. */
export async function readFontTables(bytes: Uint8Array): Promise<Tables> {
  return view(bytes).getUint32(0) === 0x774f4646 ? readWoff(bytes) : readSfnt(bytes);
}

function checksum(bytes: Uint8Array): number {
  const d = view(bytes);
  let sum = 0;
  const whole = bytes.length - (bytes.length % 4);
  for (let i = 0; i < whole; i += 4) sum = (sum + d.getUint32(i)) >>> 0;
  if (whole < bytes.length) {
    let last = 0;
    for (let i = whole; i < bytes.length; i++)
      last |= (bytes[i] as number) << (24 - 8 * (i - whole));
    sum = (sum + (last >>> 0)) >>> 0;
  }
  return sum;
}

/** Serialises tables as a TrueType file with correct checksums (head.checkSumAdjustment too). */
export function writeSfnt(tables: Tables): Uint8Array {
  const tags = [...tables.keys()].sort();
  const n = tags.length;
  let offset = 12 + 16 * n;
  const placed = tags.map((tag) => {
    const data = tables.get(tag) as Uint8Array;
    const entry = { tag, data, offset };
    offset += Math.ceil(data.length / 4) * 4;
    return entry;
  });
  const out = new Uint8Array(offset);
  const d = view(out);
  const entrySelector = Math.floor(Math.log2(n));
  const searchRange = 2 ** entrySelector * 16;
  d.setUint32(0, 0x00010000);
  d.setUint16(4, n);
  d.setUint16(6, searchRange);
  d.setUint16(8, entrySelector);
  d.setUint16(10, n * 16 - searchRange);
  let headOffset = -1;
  placed.forEach((p, i) => {
    out.set(p.data, p.offset);
    if (p.tag === 'head') {
      headOffset = p.offset;
      d.setUint32(p.offset + 8, 0); // checkSumAdjustment is zero while summing
    }
    const r = 12 + i * 16;
    for (let k = 0; k < 4; k++) d.setUint8(r + k, p.tag.charCodeAt(k));
    d.setUint32(
      r + 4,
      checksum(out.subarray(p.offset, p.offset + Math.ceil(p.data.length / 4) * 4)),
    );
    d.setUint32(r + 8, p.offset);
    d.setUint32(r + 12, p.data.length);
  });
  if (headOffset >= 0) d.setUint32(headOffset + 8, (0xb1b0afba - checksum(out)) >>> 0);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Parsing

export interface ParsedFont {
  tables: Tables;
  unitsPerEm: number;
  numGlyphs: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  ascent: number;
  descent: number;
  italicAngle: number;
  capHeight: number;
  xHeight: number;
  italic: boolean;
  fixedPitch: boolean;
  familyClass: number;
  postscriptName: string;
  /** Unicode code point → glyph ID. */
  cmap: Map<number, number>;
  advance: (gid: number) => number;
}

function need(tables: Tables, tag: string): Uint8Array {
  const t = tables.get(tag);
  if (!t) throw new Error(`Font has no ${tag} table`);
  return t;
}

function parseCmap(cmap: Uint8Array): Map<number, number> {
  const d = view(cmap);
  const records: { platform: number; encoding: number; offset: number }[] = [];
  for (let i = 0; i < d.getUint16(2); i++) {
    const o = 4 + i * 8;
    records.push({
      platform: d.getUint16(o),
      encoding: d.getUint16(o + 2),
      offset: d.getUint32(o + 4),
    });
  }
  const rank = (r: { platform: number; encoding: number }): number =>
    r.platform === 3 && r.encoding === 10
      ? 0
      : r.platform === 3 && r.encoding === 1
        ? 1
        : r.platform === 0
          ? 2
          : 9;
  const chosen = records.filter((r) => rank(r) < 9).sort((a, b) => rank(a) - rank(b));
  const map = new Map<number, number>();
  for (const r of chosen) {
    const format = d.getUint16(r.offset);
    if (format === 4) {
      const segX2 = d.getUint16(r.offset + 6);
      const endCodes = r.offset + 14;
      const startCodes = endCodes + segX2 + 2;
      const deltas = startCodes + segX2;
      const rangeOffsets = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = d.getUint16(endCodes + 2 * s);
        const start = d.getUint16(startCodes + 2 * s);
        const delta = d.getInt16(deltas + 2 * s);
        const ro = d.getUint16(rangeOffsets + 2 * s);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let gid: number;
          if (ro === 0) gid = (c + delta) & 0xffff;
          else {
            const g = d.getUint16(rangeOffsets + 2 * s + ro + 2 * (c - start));
            gid = g === 0 ? 0 : (g + delta) & 0xffff;
          }
          if (gid !== 0 && !map.has(c)) map.set(c, gid);
        }
      }
    } else if (format === 12) {
      const groups = d.getUint32(r.offset + 12);
      for (let g = 0; g < groups; g++) {
        const o = r.offset + 16 + g * 12;
        const start = d.getUint32(o);
        const end = d.getUint32(o + 4);
        const first = d.getUint32(o + 8);
        for (let c = start; c <= end; c++) if (!map.has(c)) map.set(c, first + (c - start));
      }
    }
    if (map.size > 0 && rank(r) < 2) break;
  }
  return map;
}

function parseName(name: Uint8Array | undefined, id: number): string {
  if (!name) return '';
  const d = view(name);
  const count = d.getUint16(2);
  const base = d.getUint16(4);
  for (const wantUnicode of [true, false]) {
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 12;
      const platform = d.getUint16(o);
      if (d.getUint16(o + 6) !== id || (platform === 3 || platform === 0) !== wantUnicode) continue;
      const len = d.getUint16(o + 8);
      const start = base + d.getUint16(o + 10);
      let s = '';
      if (wantUnicode)
        for (let k = 0; k < len; k += 2) s += String.fromCharCode(d.getUint16(start + k));
      else for (let k = 0; k < len; k++) s += String.fromCharCode(d.getUint8(start + k));
      return s;
    }
  }
  return '';
}

export function parseFont(tables: Tables): ParsedFont {
  const head = view(need(tables, 'head'));
  const hhea = view(need(tables, 'hhea'));
  const hmtxBytes = need(tables, 'hmtx');
  const hmtx = view(hmtxBytes);
  const metrics = hhea.getUint16(34);
  const post = tables.get('post');
  const os2 = tables.get('OS/2');
  const os2v = os2 ? view(os2) : null;
  return {
    tables,
    unitsPerEm: head.getUint16(18),
    numGlyphs: view(need(tables, 'maxp')).getUint16(4),
    bbox: {
      minX: head.getInt16(36),
      minY: head.getInt16(38),
      maxX: head.getInt16(40),
      maxY: head.getInt16(42),
    },
    ascent: hhea.getInt16(4),
    descent: hhea.getInt16(6),
    italicAngle: post ? view(post).getInt32(4) / 65536 : 0,
    capHeight: os2v && os2v.byteLength >= 90 ? os2v.getInt16(88) : 0,
    xHeight: os2v && os2v.byteLength >= 90 ? os2v.getInt16(86) : 0,
    italic: (head.getUint16(44) & 2) !== 0,
    fixedPitch: post ? view(post).getUint32(12) !== 0 : false,
    familyClass: os2v ? os2v.getInt16(30) : 0,
    postscriptName: parseName(tables.get('name'), 6),
    cmap: parseCmap(need(tables, 'cmap')),
    advance: (gid) => hmtx.getUint16(4 * Math.min(gid, metrics - 1)),
  };
}

// ---------------------------------------------------------------------------------------------
// Subsetting

function glyphRanges(font: ParsedFont): number[] {
  const loca = view(need(font.tables, 'loca'));
  const long = view(need(font.tables, 'head')).getInt16(50) === 1;
  return Array.from({ length: font.numGlyphs + 1 }, (_, i) =>
    long ? loca.getUint32(4 * i) : loca.getUint16(2 * i) * 2,
  );
}

function componentsOf(glyph: Uint8Array): number[] {
  if (glyph.length < 10) return [];
  const d = view(glyph);
  if (d.getInt16(0) >= 0) return [];
  const out: number[] = [];
  let o = 10;
  for (;;) {
    const flags = d.getUint16(o);
    out.push(d.getUint16(o + 2));
    o += 4 + (flags & 0x1 ? 4 : 2);
    if (flags & 0x8) o += 2;
    else if (flags & 0x40) o += 4;
    else if (flags & 0x80) o += 8;
    if (!(flags & 0x20)) return out;
  }
}

function utf16(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  const d = view(out);
  [...s].forEach((ch, i) => d.setUint16(2 * i, ch.charCodeAt(0)));
  return out;
}

function nameTable(psName: string): Uint8Array {
  const str = utf16(psName || 'Font');
  const out = new Uint8Array(18 + str.length);
  const d = view(out);
  d.setUint16(2, 1); // one record
  d.setUint16(4, 18); // string storage offset
  d.setUint16(6, 3); // platform: Windows
  d.setUint16(8, 1); // encoding: Unicode BMP
  d.setUint16(10, 0x409);
  d.setUint16(12, 6); // name ID 6: PostScript name
  d.setUint16(14, str.length);
  out.set(str, 18);
  return out;
}

function cmapTable(entries: [number, number][]): Uint8Array {
  const groups: [number, number, number][] = [];
  for (const [cp, gid] of entries) {
    const last = groups.at(-1);
    if (last && cp === last[1] + 1 && gid === last[2] + (cp - last[0])) last[1] = cp;
    else groups.push([cp, cp, gid]);
  }
  const out = new Uint8Array(12 + 16 + groups.length * 12);
  const d = view(out);
  d.setUint16(2, 1);
  d.setUint16(4, 3);
  d.setUint16(6, 10);
  d.setUint32(8, 12);
  d.setUint16(12, 12); // format 12
  d.setUint32(16, 16 + groups.length * 12);
  d.setUint32(24, groups.length);
  groups.forEach(([start, end, gid], i) => {
    const o = 28 + i * 12;
    d.setUint32(o, start);
    d.setUint32(o + 4, end);
    d.setUint32(o + 8, gid);
  });
  return out;
}

/**
 * A valid TrueType file holding only the glyphs for `codePoints` (plus .notdef and composite
 * components). Glyph IDs are unchanged. Tables: the six PDF requires, the hinting tables when
 * present, and tiny cmap, name, post and OS/2 tables so the file stands alone.
 */
export function subsetFont(font: ParsedFont, codePoints: Iterable<number>): Uint8Array {
  const ranges = glyphRanges(font);
  const glyf = need(font.tables, 'glyf');
  const glyphAt = (gid: number): Uint8Array => glyf.subarray(ranges[gid], ranges[gid + 1]);
  const keep = new Set<number>([0]);
  const entries: [number, number][] = [];
  for (const cp of [...new Set(codePoints)].sort((a, b) => a - b)) {
    const gid = font.cmap.get(cp);
    if (gid === undefined) continue;
    entries.push([cp, gid]);
    keep.add(gid);
  }
  const queue = [...keep];
  while (queue.length > 0) {
    for (const c of componentsOf(glyphAt(queue.pop() as number))) {
      if (!keep.has(c) && c < font.numGlyphs) {
        keep.add(c);
        queue.push(c);
      }
    }
  }

  const pieces: Uint8Array[] = [];
  const loca = new Uint8Array(4 * (font.numGlyphs + 1));
  const lv = view(loca);
  let size = 0;
  for (let gid = 0; gid < font.numGlyphs; gid++) {
    lv.setUint32(4 * gid, size);
    if (!keep.has(gid)) continue;
    const g = glyphAt(gid);
    pieces.push(g);
    size += Math.ceil(g.length / 4) * 4;
  }
  lv.setUint32(4 * font.numGlyphs, size);
  const newGlyf = new Uint8Array(size);
  let at = 0;
  for (const g of pieces) {
    newGlyf.set(g, at);
    at += Math.ceil(g.length / 4) * 4;
  }

  const head = need(font.tables, 'head').slice();
  view(head).setInt16(50, 1); // long loca offsets

  const postSrc = font.tables.get('post');
  const post = new Uint8Array(32);
  const pv = view(post);
  pv.setUint32(0, 0x00030000);
  if (postSrc) {
    const sv = view(postSrc);
    pv.setInt32(4, sv.getInt32(4));
    pv.setInt16(8, sv.getInt16(8));
    pv.setInt16(10, sv.getInt16(10));
    pv.setUint32(12, sv.getUint32(12));
  }

  const out: Tables = new Map([
    ['head', head],
    ['hhea', need(font.tables, 'hhea')],
    ['maxp', need(font.tables, 'maxp')],
    ['hmtx', need(font.tables, 'hmtx')],
    ['loca', loca],
    ['glyf', newGlyf],
    ['cmap', cmapTable(entries)],
    ['name', nameTable(font.postscriptName)],
    ['post', post],
  ]);
  for (const t of ['OS/2', 'cvt ', 'fpgm', 'prep']) {
    const data = font.tables.get(t);
    if (data) out.set(t, data);
  }
  return writeSfnt(out);
}

// ---------------------------------------------------------------------------------------------
// The "fontkit-like" object for pdf-lib

export interface MiniGlyph {
  id: number;
  advanceWidth: number;
  codePoints: number[];
}

/** Just the members of fontkit's Font that pdf-lib's CustomFontEmbedder reads. */
export class MiniFont {
  readonly cff = false;
  readonly unitsPerEm: number;
  readonly postscriptName: string;
  readonly ascent: number;
  readonly descent: number;
  readonly bbox: ParsedFont['bbox'];
  readonly italicAngle: number;
  readonly capHeight: number;
  readonly xHeight: number;
  readonly characterSet: number[];
  readonly head: { macStyle: { italic: boolean } };
  readonly post: { isFixedPitch: boolean };
  readonly 'OS/2': { sFamilyClass: number };

  constructor(private readonly font: ParsedFont) {
    this.unitsPerEm = font.unitsPerEm;
    this.postscriptName = font.postscriptName;
    this.ascent = font.ascent;
    this.descent = font.descent;
    this.bbox = font.bbox;
    this.italicAngle = font.italicAngle;
    this.capHeight = font.capHeight;
    this.xHeight = font.xHeight;
    this.characterSet = [...font.cmap.keys()].sort((a, b) => a - b);
    this.head = { macStyle: { italic: font.italic } };
    this.post = { isFixedPitch: font.fixedPitch };
    this['OS/2'] = { sFamilyClass: font.familyClass };
  }

  glyphForCodePoint(cp: number): MiniGlyph {
    const id = this.font.cmap.get(cp) ?? 0;
    return { id, advanceWidth: this.font.advance(id), codePoints: [cp] };
  }

  layout(text: string): { glyphs: MiniGlyph[] } {
    return { glyphs: [...text].map((ch) => this.glyphForCodePoint(ch.codePointAt(0) as number)) };
  }
}

/** Pass to `PDFDocument.registerFontkit`; `create` receives the subset TrueType bytes. */
export const miniFontkit = {
  create: (bytes: Uint8Array): MiniFont => new MiniFont(parseFont(readSfnt(bytes))),
};
