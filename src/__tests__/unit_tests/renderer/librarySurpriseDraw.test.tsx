/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';
import type { MutableRefObject } from 'react';
import {
  DRAW_LEAD,
  DRAW_SPIN_MS,
  DRAW_TRAVEL,
  dealRow,
  easeOutQuart,
  spinPosition,
} from '../../../renderer/library/surpriseDraw/drawTiming';
import type { ILastSurprise } from '../../../renderer/library/player/useSurprise';
import SurpriseDrawLayer from '../../../renderer/library/surpriseDraw/SurpriseDrawLayer';
import type {
  ISurpriseDraw,
  ISurpriseStage,
} from '../../../renderer/library/surpriseDraw/surpriseStage';
import useCoverFlowSurprise from '../../../renderer/library/coverFlow/useCoverFlowSurprise';
import type {
  ICoverFlowScene,
  ICoverFlowSource,
  ICoverFlowSpin,
} from '../../../renderer/library/coverFlow/coverFlowScene';

/**
 * Surprise me's draw is Cover Flow's own scene in every view (Ivan,
 * 2026-11-14: "remove the surprise me cover art component and use the new
 * cover art, same component, not loading two"): over Cover Flow the row on
 * screen spins, anywhere else the same scene is built over the shelf for the
 * spin. The scene needs a GPU, so it is stood in for; what is held here is
 * which scene is used, what it is asked to do, and the caption.
 */
let mockLastSurprise: ILastSurprise | undefined;
jest.mock('../../../renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayerSession: () => ({ lastSurprise: mockLastSurprise }),
}));

/** A scene that records what it is asked and spins only when told. */
const makeScene = () => {
  let spinRequest: ICoverFlowSpin | undefined;
  let finishSpin: () => void = () => undefined;
  const scene = {
    setSource: jest.fn<void, [ICoverFlowSource]>(),
    setCentre: jest.fn(),
    setDrag: jest.fn(),
    setHovered: jest.fn(),
    setExpanded: jest.fn<void, [boolean]>(),
    setReducedMotion: jest.fn(),
    coverAt: jest.fn(),
    jumpTo: jest.fn<void, [number]>(),
    spin: jest.fn(
      (request: ICoverFlowSpin) =>
        new Promise<void>((resolve) => {
          spinRequest = request;
          finishSpin = resolve;
          request.signal.addEventListener('abort', () => resolve());
        }),
    ),
    dispose: jest.fn(),
  };
  return {
    scene,
    spinRequest: () => spinRequest,
    land: () => spinRequest?.onLanded(),
    finish: () => finishSpin(),
  };
};

let mockMade: ReturnType<typeof makeScene>[] = [];
jest.mock('../../../renderer/library/coverFlow/coverFlowScene', () => ({
  createCoverFlowScene: () => {
    const made = makeScene();
    mockMade.push(made);
    return made.scene;
  },
}));

const queryLibrary = jest.fn();
const TRACK = {
  id: 'z',
  title: 'Otra Vez',
  artist: 'Nico Duende',
  album: 'Azotea',
  genre: 'Reggaeton',
  artId: 'feed01',
};
const DECK = Array.from({ length: 25 }, (_, index) => `art${index}`);

const emptyStage = (): MutableRefObject<ISurpriseStage | undefined> => ({
  current: undefined,
});

/** The layer, then a surprise arriving after it is on screen. */
const pressSurprise = (stageRef = emptyStage(), isShelfShown = true) => {
  const view = render(
    <SurpriseDrawLayer isShelfShown={isShelfShown} stageRef={stageRef} />,
  );
  mockLastSurprise = { trackId: 'z', serial: 1 };
  view.rerender(
    <SurpriseDrawLayer isShelfShown={isShelfShown} stageRef={stageRef} />,
  );
  return view;
};

beforeEach(() => {
  mockLastSurprise = undefined;
  mockMade = [];
  queryLibrary.mockReset();
  const answers: Record<string, unknown> = {
    tracks: [TRACK],
    coverDeck: DECK,
  };
  queryLibrary.mockImplementation(
    async (request: { type: string }) => answers[request.type] ?? [],
  );
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { queryLibrary },
  };
});

describe('the spin’s timing', () => {
  it('runs from the start to the pick, slowing into the stop, never past it', () => {
    expect(spinPosition(6, 18, 0, DRAW_SPIN_MS)).toBe(6);
    expect(spinPosition(6, 18, DRAW_SPIN_MS, DRAW_SPIN_MS)).toBe(18);
    expect(spinPosition(6, 18, DRAW_SPIN_MS * 3, DRAW_SPIN_MS)).toBe(18);
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map(easeOutQuart);
    const steps = samples.slice(1).map((value, at) => value - samples[at]);
    expect(steps.every((step) => step > 0)).toBe(true);
    expect(steps.slice(1).every((step, at) => step < steps[at])).toBe(true);
  });

  it('stands on the pick at once with no spin time, for reduced motion', () => {
    expect(spinPosition(6, 18, 0, 0)).toBe(18);
  });

  it('deals a full row: a lead, the travel, the pick, then the rest', () => {
    const others = Array.from({ length: 25 }, (_, index) => String(index));
    const { row, startIndex, pickIndex } = dealRow(others, 'P');
    expect(row).toHaveLength(26);
    expect(startIndex).toBe(DRAW_LEAD);
    expect(pickIndex).toBe(DRAW_LEAD + DRAW_TRAVEL);
    expect(row[pickIndex]).toBe('P');
  });

  it('gives up the lead, then the travel, in a small library', () => {
    expect(dealRow('abcdefghijklmn'.split(''), 'P')).toMatchObject({
      startIndex: 2,
      pickIndex: 14,
    });
    const tiny = dealRow(['a', 'b', 'c'], 'P');
    expect(tiny).toMatchObject({ startIndex: 0, pickIndex: 3 });
    expect(tiny.row).toEqual(['a', 'b', 'c', 'P']);
  });
});

describe('the draw over the list or the grid', () => {
  it('builds one Cover Flow scene over the shelf, spins it to the pick, and gives it back', async () => {
    const view = pressSurprise();
    await waitFor(() => expect(mockMade).toHaveLength(1));
    const [made] = mockMade;
    await waitFor(() => expect(made.spinRequest()).toBeDefined());
    const source = made.scene.setSource.mock.calls[0][0];
    expect(source.count).toBe(26);
    const pickIndex = DRAW_LEAD + DRAW_TRAVEL;
    // Labelled as the player labels it, so a song with no cover lands as
    // the tile it lands on.
    expect(source.itemAt(pickIndex)).toMatchObject({
      artId: 'feed01',
      label: 'Otra Vez',
    });
    expect(made.scene.jumpTo).toHaveBeenCalledWith(DRAW_LEAD);
    expect(made.spinRequest()).toMatchObject({ to: pickIndex });
    // The deck never holds the pick twice.
    expect(queryLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'coverDeck', exclude: ['feed01'] }),
    );
    const layer = view.container.querySelector('.library-surprise-draw');
    expect(layer).toHaveClass('is-playing');
    expect(layer).not.toHaveClass('is-over-flow');
    // No name until the row has stopped on the pick.
    expect(
      view.container.querySelector('.library-surprise-draw__caption'),
    ).toBeNull();
    act(() => made.land());
    const caption = view.container.querySelector(
      '.library-surprise-draw__caption',
    );
    expect(caption?.textContent).toBe('Otra VezReggaeton');
    await act(async () => made.finish());
    await waitFor(() => expect(made.scene.dispose).toHaveBeenCalledTimes(1));
    expect(layer).not.toHaveClass('is-playing');
    expect(
      view.container.querySelector('.library-surprise-draw__caption'),
    ).toBeNull();
  });

  it('skips on a press, and on Escape, and gives the scene back', async () => {
    const view = pressSurprise();
    await waitFor(() => expect(mockMade[0]?.spinRequest()).toBeDefined());
    const layer = view.container.querySelector('.library-surprise-draw');
    fireEvent.pointerDown(layer as Element);
    expect(mockMade[0].spinRequest()?.signal.aborted).toBe(true);
    await waitFor(() => expect(mockMade[0].scene.dispose).toHaveBeenCalled());
    expect(layer).not.toHaveClass('is-playing');

    mockLastSurprise = { trackId: 'z', serial: 2 };
    const stageRef = emptyStage();
    view.rerender(<SurpriseDrawLayer isShelfShown stageRef={stageRef} />);
    await waitFor(() => expect(mockMade[1]?.spinRequest()).toBeDefined());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockMade[1].spinRequest()?.signal.aborted).toBe(true);
    await waitFor(() => expect(mockMade[1].scene.dispose).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        view.container.querySelector('.library-surprise-draw'),
      ).not.toHaveClass('is-playing'),
    );
  });

  it('never replays a surprise from before the shelf was on screen', async () => {
    mockLastSurprise = { trackId: 'z', serial: 3 };
    render(<SurpriseDrawLayer isShelfShown stageRef={emptyStage()} />);
    await act(async () => undefined);
    expect(queryLibrary).not.toHaveBeenCalled();
    expect(mockMade).toHaveLength(0);
  });

  it('plays nothing over a video', async () => {
    pressSurprise(emptyStage(), false);
    await act(async () => undefined);
    expect(queryLibrary).not.toHaveBeenCalled();
    expect(mockMade).toHaveLength(0);
  });
});

describe('the draw over Cover Flow', () => {
  it('spins the row on screen and never builds a second scene', async () => {
    let played: ISurpriseDraw | undefined;
    const stageRef: MutableRefObject<ISurpriseStage | undefined> = {
      current: {
        play: jest.fn(async (draw: ISurpriseDraw) => {
          played = draw;
          return true;
        }),
      },
    };
    const view = pressSurprise(stageRef);
    await waitFor(() => expect(played).toBeDefined());
    expect(played).toMatchObject({
      startIndex: DRAW_LEAD,
      pickIndex: DRAW_LEAD + DRAW_TRAVEL,
      caption: { title: 'Otra Vez', detail: 'Reggaeton' },
    });
    expect(played?.row[DRAW_LEAD + DRAW_TRAVEL]).toMatchObject({
      artId: 'feed01',
    });
    await act(async () => undefined);
    expect(mockMade).toHaveLength(0);
    expect(
      view.container.querySelector('.library-surprise-draw'),
    ).not.toHaveClass('is-playing');
  });

  it('builds no scene of its own either when Cover Flow has none to lend', async () => {
    const stageRef: MutableRefObject<ISurpriseStage | undefined> = {
      current: { play: jest.fn(async () => false) },
    };
    pressSurprise(stageRef);
    await waitFor(() => expect(stageRef.current?.play).toHaveBeenCalled());
    await act(async () => undefined);
    expect(mockMade).toHaveLength(0);
  });
});

describe('Cover Flow lending its row', () => {
  const draw = (signal: AbortSignal): ISurpriseDraw => ({
    row: [
      { id: 'a', artId: 'a1', label: '', isFolder: false, isPending: false },
      {
        id: 'p',
        artId: 'p1',
        label: 'Otra Vez',
        isFolder: false,
        isPending: false,
      },
    ],
    startIndex: 0,
    pickIndex: 1,
    caption: { title: 'Otra Vez', detail: 'Reggaeton' },
    signal,
  });

  it('folds the panel, spins its own scene, captions the pick, and gives the row back', async () => {
    const made = makeScene();
    const giveBack = jest.fn();
    const stageRef: MutableRefObject<ISurpriseStage | undefined> = {
      current: undefined,
    };
    const sceneRef = {
      current: made.scene as unknown as ICoverFlowScene,
    };
    const hook = renderHook(() =>
      useCoverFlowSurprise({ stageRef, sceneRef, borrow: () => giveBack }),
    );
    expect(hook.result.current).toBeUndefined();
    let playing: Promise<boolean> | undefined;
    act(() => {
      playing = stageRef.current?.play(draw(new AbortController().signal));
    });
    // Spinning: the panel folds (the view reads `null` as drawing) and no
    // caption yet.
    expect(hook.result.current).toBeNull();
    expect(made.scene.setExpanded).toHaveBeenCalledWith(false);
    expect(made.scene.setSource.mock.calls[0][0].count).toBe(2);
    expect(made.scene.jumpTo).toHaveBeenCalledWith(0);
    act(() => made.land());
    expect(hook.result.current).toMatchObject({
      title: 'Otra Vez',
      detail: 'Reggaeton',
    });
    await act(async () => {
      made.finish();
      await playing;
    });
    expect(giveBack).toHaveBeenCalledTimes(1);
    // The draw is over: the panel that was open opens again.
    expect(hook.result.current).toBeUndefined();
    await expect(playing).resolves.toBe(true);
  });

  it('answers false and spins nothing when it has no scene to lend', async () => {
    const stageRef: MutableRefObject<ISurpriseStage | undefined> = {
      current: undefined,
    };
    renderHook(() =>
      useCoverFlowSurprise({
        stageRef,
        sceneRef: { current: undefined },
        borrow: () => undefined,
      }),
    );
    await expect(
      stageRef.current?.play(draw(new AbortController().signal)),
    ).resolves.toBe(false);
  });

  it('leaves the slot empty once the view is gone', () => {
    const stageRef: MutableRefObject<ISurpriseStage | undefined> = {
      current: undefined,
    };
    const hook = renderHook(() =>
      useCoverFlowSurprise({
        stageRef,
        sceneRef: { current: undefined },
        borrow: () => undefined,
      }),
    );
    expect(stageRef.current).toBeDefined();
    hook.unmount();
    expect(stageRef.current).toBeUndefined();
  });
});

describe('the pick shown where the reader is browsing', () => {
  it('hands the pick to the shelf as soon as it is known, before the spin', async () => {
    const onPick = jest.fn();
    const stageRef = emptyStage();
    const view = render(
      <SurpriseDrawLayer isShelfShown stageRef={stageRef} onPick={onPick} />,
    );
    mockLastSurprise = { trackId: 'z', serial: 1 };
    view.rerender(
      <SurpriseDrawLayer isShelfShown stageRef={stageRef} onPick={onPick} />,
    );
    await waitFor(() => expect(mockMade[0]?.spinRequest()).toBeDefined());
    // Asked while the row still spins, so Cover Flow is given back standing
    // on it and the panel under it names the song now playing.
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0]).toMatchObject({ id: 'z', artId: 'feed01' });
    act(() => mockMade[0].land());
    await act(async () => mockMade[0].finish());
    await waitFor(() => expect(mockMade[0].scene.dispose).toHaveBeenCalled());
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
