/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ForumPanel from '../../../renderer/forum/ForumPanel';
import {
  READING_SIZE_STEPS,
  getReadingSize,
  largerReadingText,
  nearestStep,
  reloadReadingSize,
  resetReadingText,
  smallerReadingText,
} from '../../../renderer/reading/readingSize';
import { resetForumStore } from '../../../renderer/forum/forumStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/**
 * The reading text's size for readers with low sight, shared by the Forum
 * and Help: a ladder of sizes, kept on this machine, and Ctrl with +, − and
 * 0 or the wheel while either has the keyboard. Every case stands beside the one that must leave the size
 * alone: the same key with the keyboard elsewhere, the same wheel without
 * Ctrl, the last step pressed again.
 */

const KEY = 'fluideq.reading.textSize.v1';

const installBridge = () => {
  const bridge = {
    sendMessage: jest.fn(),
    forumState: jest.fn(() => Promise.resolve({ status: 'signed-out' })),
    onForumState: jest.fn(() => () => undefined),
    forumBoards: jest.fn(() =>
      Promise.resolve({ ok: true, value: { boards: [], canStartIn: [] } }),
    ),
    forumTopics: jest.fn(() =>
      Promise.resolve({ ok: true, value: { topics: [], total: 0 } }),
    ),
  };
  Object.defineProperty(window, 'electron', {
    value: { ipcRenderer: bridge, platform: 'win32' },
    configurable: true,
  });
  return bridge;
};

const scaleOf = (container: HTMLElement) =>
  (container.querySelector('.forum') as HTMLElement).style.getPropertyValue(
    '--reading-scale',
  );

beforeEach(() => {
  window.localStorage.clear();
  reloadReadingSize();
  resetForumStore();
});

describe('the ladder of sizes', () => {
  it('climbs a step at a time and stays at the largest', () => {
    READING_SIZE_STEPS.slice(1).forEach((step) => {
      largerReadingText();
      expect(getReadingSize()).toBe(step);
    });
    largerReadingText();
    expect(getReadingSize()).toBe(2);
  });

  it('comes down the same way and stays at 100%', () => {
    largerReadingText();
    largerReadingText();
    smallerReadingText();
    expect(getReadingSize()).toBe(1.15);
    smallerReadingText();
    smallerReadingText();
    expect(getReadingSize()).toBe(1);
  });

  it('lands anything else on the nearest step, and the unreadable on 100%', () => {
    expect(nearestStep(1.4)).toBe(1.5);
    expect(nearestStep(9)).toBe(2);
    expect(nearestStep(0.2)).toBe(1);
    expect(nearestStep(Number.NaN)).toBe(1);
    expect(nearestStep('1.5')).toBe(1);
  });
});

describe('remembered on this machine', () => {
  it('takes the size the Forum kept before Help shared it, and clears it', () => {
    window.localStorage.setItem('fluideq.forum.textSize.v1', '1.5');
    reloadReadingSize();
    expect(getReadingSize()).toBe(1.5);
    largerReadingText();
    expect(window.localStorage.getItem('fluideq.forum.textSize.v1')).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBe('1.75');
  });

  it('reads back the size it kept, and keeps nothing at 100%', () => {
    largerReadingText();
    largerReadingText();
    expect(window.localStorage.getItem(KEY)).toBe('1.3');
    reloadReadingSize();
    expect(getReadingSize()).toBe(1.3);
    resetReadingText();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('reads an edited or broken value as the nearest step or 100%', () => {
    window.localStorage.setItem(KEY, '1.6');
    reloadReadingSize();
    expect(getReadingSize()).toBe(1.5);
    window.localStorage.setItem(KEY, 'huge');
    reloadReadingSize();
    expect(getReadingSize()).toBe(1);
  });
});

describe('in the Forum tab', () => {
  it('names its buttons, says the size, and sizes the reading text', () => {
    installBridge();
    const { container } = render(<ForumPanel />);
    expect(scaleOf(container)).toBe('1');
    const larger = screen.getByRole('button', {
      name: 'reading.textSize.larger',
    });
    expect(
      screen.getByRole('button', { name: 'reading.textSize.smaller' }),
    ).toBeDisabled();
    fireEvent.click(larger);
    fireEvent.click(larger);
    expect(scaleOf(container)).toBe('1.3');
    expect(screen.getByRole('status')).toHaveTextContent(
      'reading.textSize.now:130%',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'reading.textSize.reset:130%' }),
    );
    expect(scaleOf(container)).toBe('1');
  });

  it('takes Ctrl + and Ctrl 0 while it has the keyboard, and not otherwise', () => {
    const bridge = installBridge();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const { container } = render(<ForumPanel />);

    // The keyboard elsewhere: the window's zoom, not the Forum's.
    act(() => outside.focus());
    fireEvent.keyDown(window, { key: '=', ctrlKey: true });
    expect(scaleOf(container)).toBe('1');

    act(() =>
      screen.getByRole('button', { name: 'reading.textSize.larger' }).focus(),
    );
    expect(bridge.sendMessage).toHaveBeenLastCalledWith('reading-zoom-keys', [
      true,
    ]);
    fireEvent.keyDown(window, { key: '=', ctrlKey: true });
    fireEvent.keyDown(window, { key: '+', ctrlKey: true });
    expect(scaleOf(container)).toBe('1.3');
    fireEvent.keyDown(window, { key: '0', ctrlKey: true });
    expect(scaleOf(container)).toBe('1');

    act(() => outside.focus());
    expect(bridge.sendMessage).toHaveBeenLastCalledWith('reading-zoom-keys', [
      false,
    ]);
    outside.remove();
  });

  it('takes Ctrl with the wheel over it, and leaves a plain wheel to scroll', () => {
    installBridge();
    const { container } = render(<ForumPanel />);
    const forum = container.querySelector('.forum') as HTMLElement;
    fireEvent.wheel(forum, { deltaY: -100 });
    expect(scaleOf(container)).toBe('1');
    fireEvent.wheel(forum, { deltaY: -100, ctrlKey: true });
    expect(scaleOf(container)).toBe('1.15');
    fireEvent.wheel(forum, { deltaY: 100, ctrlKey: true });
    expect(scaleOf(container)).toBe('1');
  });

  it('gives the keys back to the window when it closes', () => {
    const bridge = installBridge();
    const { unmount } = render(<ForumPanel />);
    act(() =>
      screen.getByRole('button', { name: 'reading.textSize.larger' }).focus(),
    );
    unmount();
    expect(bridge.sendMessage).toHaveBeenLastCalledWith('reading-zoom-keys', [
      false,
    ]);
  });
});
