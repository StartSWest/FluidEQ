/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each chat keeps its own model and effort (Ivan, 2026-11-09: "each chat
 * needs to have its own model select and effort, I cannot change in one and
 * get it changed on all other").
 */
import '@testing-library/jest-dom';
import { screen, within } from '@testing-library/react';
import { animatorChatKey } from '../../../common/studioChat';
import { sendToAnimator } from '../../../renderer/studio/chat/animatorChatStore';
import {
  chatPicksOf,
  resetChatPicksForTesting,
  setChatEffort,
  setChatModel,
} from '../../../renderer/studio/chat/chatPicks';
import StudioChatEffortDots from '../../../renderer/studio/chat/StudioChatEffortDots';
import { setup } from '../../utils/userEventUtils';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

const send = jest.fn((_message: Record<string, unknown>) => Promise.resolve());

beforeEach(() => {
  window.localStorage.clear();
  resetChatPicksForTesting();
  send.mockClear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { studioAnimatorSend: send } },
  });
});

describe("a chat's model and effort", () => {
  it('stay as they were in one chat when another changes its own', () => {
    setChatModel('scene-a', 'opus');
    setChatEffort('scene-a', 'high');
    setChatModel('scene-b', 'sonnet');
    setChatEffort('scene-b', 'low');
    setChatModel('scene-a', 'haiku');
    setChatEffort('scene-a', 'max');
    expect(chatPicksOf('scene-a')).toEqual({ model: 'haiku', effort: 'max' });
    expect(chatPicksOf('scene-b')).toEqual({ model: 'sonnet', effort: 'low' });
  });

  it('start, in a chat with none of its own, from the last pick made in any chat', () => {
    // The control: nothing picked anywhere is Default at Medium.
    expect(chatPicksOf('new-scene')).toEqual({
      model: 'default',
      effort: 'medium',
    });
    setChatModel('scene-a', 'opus');
    setChatEffort('scene-a', 'high');
    expect(chatPicksOf('new-scene')).toEqual({ model: 'opus', effort: 'high' });
  });

  it('are kept with each chat for the next visit', () => {
    setChatModel('scene-a', 'opus');
    setChatModel('scene-b', 'sonnet');
    setChatEffort('scene-b', 'low');
    resetChatPicksForTesting();
    expect(chatPicksOf('scene-a').model).toBe('opus');
    expect(chatPicksOf('scene-b')).toEqual({ model: 'sonnet', effort: 'low' });
  });

  it("go with each animator's messages, its own and not another's", async () => {
    setChatModel(animatorChatKey('p1', 'wolf-walk'), 'opus');
    setChatEffort(animatorChatKey('p1', 'wolf-walk'), 'high');
    setChatModel(animatorChatKey('p1', 'fox-trot'), 'haiku');
    setChatEffort(animatorChatKey('p1', 'fox-trot'), 'low');
    await sendToAnimator('p1', 'wolf-walk', 'smoother legs');
    await sendToAnimator('p1', 'fox-trot', 'a longer tail');
    expect(send.mock.calls.map(([message]) => message)).toEqual([
      expect.objectContaining({
        animation: 'wolf-walk',
        model: 'opus',
        effort: 'high',
      }),
      expect.objectContaining({
        animation: 'fox-trot',
        model: 'haiku',
        effort: 'low',
      }),
    ]);
  });
});

describe('the effort dots of two chats', () => {
  it('move one chat and leave the other where it was', async () => {
    setChatEffort('scene-a', 'low');
    setChatEffort('scene-b', 'high');
    const { user } = setup(
      <>
        <div data-testid="a">
          <StudioChatEffortDots chatKey="scene-a" disabled={false} />
        </div>
        <div data-testid="b">
          <StudioChatEffortDots chatKey="scene-b" disabled={false} />
        </div>
      </>,
    );
    const radios = (id: string) =>
      within(screen.getByTestId(id)).getAllByRole('radio');
    await user.click(radios('a')[4]);
    expect(chatPicksOf('scene-a').effort).toBe('max');
    expect(chatPicksOf('scene-b').effort).toBe('high');
    // low, medium, high, xhigh, max: the other chat's third dot still lit.
    expect(radios('b')[2]).toHaveAttribute('aria-checked', 'true');
    expect(radios('a')[4]).toHaveAttribute('aria-checked', 'true');
  });
});
