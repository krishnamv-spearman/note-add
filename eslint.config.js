import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Money guards (arch §13.2, RND-09): no float parsing, rounding or toFixed in engine/data code.
const moneyGuards = {
  'no-restricted-globals': [
    'error',
    {
      name: 'parseFloat',
      message: 'Money is integer paise. Use parseAmount from src/engine/money.ts.',
    },
  ],
  'no-restricted-properties': [
    'error',
    {
      object: 'Number',
      property: 'parseFloat',
      message: 'Money is integer paise. Use parseAmount.',
    },
    {
      object: 'Math',
      property: 'round',
      message: 'Never round money. Disable inline with a comment for non-money maths only.',
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.property.name='toFixed']",
      message: 'Never use toFixed. Use formatPaise from src/engine/money.ts.',
    },
  ],
};

const outside = (dirs, why) =>
  dirs.flatMap((d) => [
    { group: [`@/${d}`, `@/${d}/*`], message: why },
    { group: [`**/${d}/*`, `../${d}`, `../../${d}`], message: why },
  ]);

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'blob-report',
      'node_modules',
      'docs',
      'public',
      'dev-dist',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs['recommended-latest'].rules,
  },
  { files: ['src/**/*.tsx'], ...jsxA11y.flatConfigs.recommended },
  {
    files: ['src/**/*.tsx'],
    rules: { 'jsx-a11y/label-has-associated-control': ['error', { depth: 3 }] },
  },
  // Architecture guard: the engine is pure (arch §3, §13.2).
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      ...moneyGuards,
      'no-restricted-globals': [
        ...moneyGuards['no-restricted-globals'],
        ...['window', 'document', 'navigator', 'localStorage', 'indexedDB'].map((name) => ({
          name,
          message: 'src/engine is pure: no DOM or browser APIs.',
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'dexie', 'dexie-react-hooks', 'react-router'].map(
            (name) => ({
              name,
              message: 'src/engine is pure: no UI or storage imports.',
            }),
          ),
          patterns: outside(
            ['ui', 'features', 'db', 'platform', 'theme'],
            'src/engine may not import anything outside itself.',
          ),
        },
      ],
    },
  },
  // Data layer: may use the engine only (arch §3 dependency direction).
  {
    files: ['src/db/**/*.ts'],
    rules: {
      ...moneyGuards,
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom'].map((name) => ({
            name,
            message: 'src/db has no UI code.',
          })),
          patterns: outside(['ui', 'features', 'platform'], 'src/db may import only the engine.'),
        },
      ],
    },
  },
  // Shared UI: may use engine and theme only.
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'dexie', message: 'src/ui does not touch storage.' }],
          patterns: outside(
            ['features', 'db', 'platform'],
            'src/ui may import only engine and theme.',
          ),
        },
      ],
    },
  },
  // Build and CI scripts report on the console.
  { files: ['scripts/**'], rules: { 'no-console': 'off' } },
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
);
