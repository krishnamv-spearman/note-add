import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginBusy,
  markNeedRefresh,
  markOfflineReady,
  registerFlush,
  resetPwaForTests,
  setUpdater,
} from '@/platform/pwa';
import { UpdatePrompt } from './UpdatePrompt';

beforeEach(() => resetPwaForTests());

describe('UpdatePrompt', () => {
  it('shows nothing until there is something to say', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('P7.2: "New version available — Reload"; the page is not reloaded by itself', () => {
    const updater = vi.fn(() => Promise.resolve());
    setUpdater(updater);
    render(<UpdatePrompt />);
    act(() => markNeedRefresh());
    expect(screen.getByRole('status')).toHaveTextContent('New version available —');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled();
    expect(updater).not.toHaveBeenCalled();
  });

  it('PWA-03 / PWA-04: tapping Reload saves, waits for running work, then reloads', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    registerFlush(() => {
      calls.push('flush');
      return Promise.resolve();
    });
    setUpdater(() => {
      calls.push('reload');
      return Promise.resolve();
    });
    const done = beginBusy(); // an export is running
    render(<UpdatePrompt />);
    act(() => markNeedRefresh());
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(await screen.findByText('Finishing what is running…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDisabled();
    expect(calls).toEqual(['flush']);
    await act(async () => {
      done();
      await Promise.resolve();
    });
    expect(await screen.findByText('Reloading…')).toBeInTheDocument();
    expect(calls).toEqual(['flush', 'flush', 'reload']);
  });

  it('first install: "ready to work offline", dismissible', async () => {
    const user = userEvent.setup();
    render(<UpdatePrompt />);
    act(() => markOfflineReady());
    expect(screen.getByText('Note-Add is ready to work offline.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Note-Add is ready to work offline.')).toBeNull();
  });
});
