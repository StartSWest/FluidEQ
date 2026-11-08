/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The way back to the newest line (Ivan, 2026-11-07: "add a go back button
 * with typing animated dot click jump to last"): there only while the
 * member reads further up, with dots while Claude is still writing, and a
 * press glides to the end without the button coming back on the way.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IStudioChat } from '../../../common/studioChat';
import StudioChatThread from '../../../renderer/studio/chat/StudioChatThread';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const chat = (busy: boolean): IStudioChat => ({
  projectId: 'lake',
  busy,
  entries: [
    { kind: 'me', id: 'm', text: 'make it rain' },
    {
      kind: 'claude',
      id: 'r',
      text: 'Rain falls.',
      steps: [],
      state: busy ? 'working' : 'done',
    },
  ],
});

const scrollTo = jest.fn();

/** The thread scrolled to `top` of a 1000px conversation in a 400px box. */
const scrolled = (thread: HTMLElement, top: number) => {
  Object.defineProperty(thread, 'scrollHeight', {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(thread, 'clientHeight', {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(thread, 'scrollTop', {
    configurable: true,
    writable: true,
    value: top,
  });
  fireEvent.scroll(thread);
};

beforeEach(() => {
  scrollTo.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: scrollTo,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false }),
  });
});

const latest = () =>
  screen.queryByRole('button', { name: /^studioChat\.latest/ });

it('shows the way back only while reading further up, with dots while Claude writes', () => {
  render(
    <StudioChatThread
      chat={chat(true)}
      onIdea={() => undefined}
      onCarryOn={() => undefined}
      onRetry={() => undefined}
    />,
  );
  const thread = screen.getByRole('log');
  expect(latest()).toBeNull();
  scrolled(thread, 100);
  expect(latest()).toHaveAccessibleName('studioChat.latestWriting');
  expect(latest()?.querySelector('.studio-chat__dots')).not.toBeNull();
  // Back at the end by hand: it goes.
  scrolled(thread, 590);
  expect(latest()).toBeNull();
});

it('glides to the end on a press, and stays away on the way down', () => {
  render(
    <StudioChatThread
      chat={chat(false)}
      onIdea={() => undefined}
      onCarryOn={() => undefined}
      onRetry={() => undefined}
    />,
  );
  const thread = screen.getByRole('log');
  scrolled(thread, 0);
  expect(latest()).toHaveAccessibleName('studioChat.latest');
  expect(latest()?.querySelector('.studio-chat__dots')).toBeNull();
  fireEvent.click(latest() as HTMLElement);
  expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  // Halfway down the glide is still short of the end: no button.
  scrolled(thread, 300);
  expect(latest()).toBeNull();
  // A glide stopped short by the hand brings it back where it ended.
  act(() => {
    thread.dispatchEvent(new Event('scrollend'));
  });
  expect(latest()).not.toBeNull();
});
