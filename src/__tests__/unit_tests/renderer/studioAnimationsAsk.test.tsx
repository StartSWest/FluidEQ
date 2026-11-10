/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Animations tab as a viewer (Ivan, 2026-11-10: "remove that second chat
 * and make the root chat work on animations and all"): a new animation is
 * asked of the scene's own chat, written into its box and never sent; an
 * empty tab says so in a card and a full one in a line; Import is a button
 * in the head, and files held over the tab say where they will land. Each
 * rule beside its control.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { readStudioAnimation } from '../../../common/studioAnimation';
import StudioAnimations from '../../../renderer/studio/animations/StudioAnimations';
import type { IViewedAnimation } from '../../../renderer/studio/animations/useStudioAnimations';
import { resetChatDrafts } from '../../../renderer/studio/chat/chatDraftStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

const viewed = (name: string): IViewedAnimation => {
  const animation = readStudioAnimation(name, {
    sheet: `art/${name}.png`,
    count: 4,
    columns: 4,
    fps: 8,
  });
  if (!animation) {
    throw new Error('the animation did not read');
  }
  return {
    animation,
    aspect: 1,
    bitmap: {
      width: 64,
      height: 16,
      close: jest.fn(),
    } as unknown as ImageBitmap,
  };
};

let kept: string;
const draftChange = jest.fn(async (_change: unknown) => undefined);
const send = jest.fn(async () => undefined);

beforeEach(() => {
  kept = '';
  draftChange.mockClear();
  send.mockClear();
  resetChatDrafts();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        studioChatDraft: jest.fn(async () => ({ text: kept })),
        studioChatDraftChange: draftChange,
        studioChatSend: send,
      },
    },
  });
});

const tab = () =>
  screen.getByRole('region', { name: 'studio.animation.title' });

const written = () =>
  draftChange.mock.calls.map(
    ([change]) => change as { projectId: string; text: string },
  );

describe('asking for an animation', () => {
  it('writes the ask into the scene chat’s box, and sends nothing', async () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'studio.animation.askChat' }),
      );
    });
    expect(written()).toEqual([
      { projectId: 'p1', text: 'studio.animation.askDraft' },
    ]);
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps what the member had written there, the ask after it', async () => {
    kept = 'make the lights warmer';
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'studio.animation.askChat' }),
      );
    });
    expect(written()).toEqual([
      {
        projectId: 'p1',
        text: 'make the lights warmer\n\nstudio.animation.askDraft',
      },
    ]);
  });
});

describe('the tab’s ask', () => {
  it('is a card of its own while the scene has no animation', () => {
    render(<StudioAnimations projectId="p1" animations={[]} />);
    expect(screen.getByText('studio.animation.emptyTitle')).toBeInTheDocument();
    expect(screen.queryByText('studio.animation.hint')).toBeNull();
  });

  it('control: is one line under the head once there are animations', () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    expect(screen.getByText('studio.animation.hint')).toBeInTheDocument();
    expect(screen.queryByText('studio.animation.emptyTitle')).toBeNull();
  });
});

describe('Import', () => {
  it('is a button in the head that opens the system’s picker', () => {
    const click = jest
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animationImport.button' }),
    );
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('shows where held files will land, and lets go when they leave', () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    const files = { dataTransfer: { types: ['Files'], files: [] } };
    fireEvent.dragEnter(tab(), files);
    // A child crossed on the way: its own enter and leave keep the mark.
    fireEvent.dragEnter(screen.getByText('fox'), files);
    fireEvent.dragLeave(screen.getByText('fox'), files);
    expect(screen.getByText('studio.animationImport.drop')).toBeInTheDocument();
    fireEvent.dragLeave(tab(), files);
    expect(screen.queryByText('studio.animationImport.drop')).toBeNull();
  });

  it('control: something that is not files held over the tab shows nothing', () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    fireEvent.dragEnter(tab(), {
      dataTransfer: { types: ['text/plain'], files: [] },
    });
    expect(screen.queryByText('studio.animationImport.drop')).toBeNull();
  });
});
