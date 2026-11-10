/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An animation's card menu and its versions (Ivan, 2026-11-10): Open,
 * Rename, Show in folder and Delete on every card, Undo, Redo and the
 * original on an opened one, all through main. Delete on an animation the
 * scene may use SENDS the scene's chat the request and the card says it is
 * handled ("si dice se está usando, ask agent to delete it and fix holes").
 * Each rule beside its control.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { drawnBoxOf } from '../../../common/animationFrames';
import { readStudioAnimation } from '../../../common/studioAnimation';
import { resetRemovalsAsked } from '../../../renderer/studio/animations/animationActions';
import StudioAnimations from '../../../renderer/studio/animations/StudioAnimations';
import type { IViewedAnimation } from '../../../renderer/studio/animations/useStudioAnimations';

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

const history = (over: Record<string, unknown> = {}) => ({
  ok: true,
  history: {
    current: 2,
    versions: [],
    canUndo: true,
    canRedo: false,
    originalFiles: [],
    deleted: false,
    ...over,
  },
});

const historyCall = jest.fn(async (_request: unknown): Promise<unknown> =>
  history(),
);
const show = jest.fn(async (_name: string) => 'shown');
const send = jest.fn(async (_message: unknown) => undefined);

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  historyCall.mockClear();
  historyCall.mockImplementation(async () => history());
  show.mockClear();
  send.mockClear();
  resetRemovalsAsked();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        studioAnimationHistory: historyCall,
        showStudioAnimation: show,
        studioChatSend: send,
      },
    },
  });
});

const openMenu = (name: string) =>
  fireEvent.click(
    screen.getByRole('button', {
      name: `studio.animation.menu {"name":"${name}"}`,
    }),
  );

const requests = () => historyCall.mock.calls.map(([request]) => request);

describe('an animation’s card menu', () => {
  it('shows its file in the file manager, by its name alone', () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    openMenu('fox');
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'studio.animation.menuShow' }),
    );
    expect(show).toHaveBeenCalledWith('fox');
  });

  it('renames it through its history, file, sheet and versions together', async () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    openMenu('fox');
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'studio.animation.menuRename' }),
    );
    fireEvent.change(screen.getByLabelText('studio.new.name'), {
      target: { value: 'fox-run' },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'studio.rename.save' }),
      );
    });
    expect(requests()).toContainEqual({
      action: 'rename',
      name: 'fox',
      to: 'fox-run',
    });
    expect(screen.queryByLabelText('studio.new.name')).toBeNull();
  });

  it('control: refuses a name the files cannot carry, and asks main nothing', async () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    openMenu('fox');
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'studio.animation.menuRename' }),
    );
    fireEvent.change(screen.getByLabelText('studio.new.name'), {
      target: { value: 'Fox Run' },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'studio.rename.save' }),
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.animation.renameRule',
    );
    expect(requests()).not.toContainEqual(
      expect.objectContaining({ action: 'rename' }),
    );
  });

  it('says so when another animation already has the name', async () => {
    historyCall.mockImplementation(async () => ({
      ok: false,
      reason: 'taken',
    }));
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    openMenu('fox');
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'studio.animation.menuRename' }),
    );
    fireEvent.change(screen.getByLabelText('studio.new.name'), {
      target: { value: 'wolf' },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'studio.rename.save' }),
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.animation.renameTaken',
    );
  });
});

describe('deleting an animation the scene may use', () => {
  it('sends the scene’s chat the request, and the card says it is handled', async () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    openMenu('fox');
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'studio.animation.menuDelete' }),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'studio.animation.deleteAsk' }),
      );
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        text: 'studio.animation.deleteRequest {"name":"fox","file":"animations/fox.json"}',
      }),
    );
    expect(screen.getByText('studio.animation.removing')).toBeInTheDocument();
    // Nothing is deleted from here: the chat removes it and fixes the scene.
    expect(requests()).not.toContainEqual(
      expect.objectContaining({ action: 'delete' }),
    );
  });

  it('control: cancelled, sends nothing and marks nothing', () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    openMenu('fox');
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'studio.animation.menuDelete' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'studio.new.cancel' }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByText('studio.animation.removing')).toBeNull();
  });
});

describe('an opened animation’s versions', () => {
  const openFox = async () => {
    render(<StudioAnimations projectId="p1" animations={[viewed('fox')]} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /studio\.animation\.open/ }),
      );
    });
  };

  it('undoes the last change, and goes back to the original', async () => {
    await openFox();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'studio.animation.undo' }),
      );
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'studio.animation.original' }),
      );
    });
    expect(requests()).toEqual([
      { action: 'list', name: 'fox' },
      { action: 'undo', name: 'fox' },
      { action: 'restore-original', name: 'fox' },
    ]);
    // Nothing to redo: the history said so.
    expect(
      screen.getByRole('button', { name: 'studio.animation.redo' }),
    ).toBeDisabled();
  });

  it('control: shows nothing while there is no version to move to', async () => {
    historyCall.mockImplementation(async () =>
      history({ current: 'original', canUndo: false }),
    );
    await openFox();
    expect(
      screen.queryByRole('button', { name: 'studio.animation.undo' }),
    ).toBeNull();
  });
});

describe('a card’s picture', () => {
  it('is cropped to what every frame draws, one box for all, with a margin', () => {
    const cell = { x: 0, y: 0, width: 100, height: 100 };
    const shape = (
      left: number,
      top: number,
      right: number,
      bottom: number,
    ) => ({
      left,
      top,
      right,
      bottom,
      ink: 1,
    });
    const box = drawnBoxOf({
      cells: [cell, { ...cell, x: 100 }],
      shapes: [shape(40, 30, 59, 49), shape(30, 40, 49, 69)],
      change: [0, 0],
    });
    // Drawn from 30 to 60 across and 30 to 70 down; 40 tall, so a margin of 3.
    expect(box).toEqual({ x: 27, y: 27, width: 36, height: 46 });
  });

  it('control: nothing drawn crops nothing', () => {
    const empty = { left: -1, top: -1, right: -1, bottom: -1, ink: 0 };
    expect(
      drawnBoxOf({
        cells: [{ x: 0, y: 0, width: 10, height: 10 }],
        shapes: [empty],
        change: [0],
      }),
    ).toBeUndefined();
  });
});
