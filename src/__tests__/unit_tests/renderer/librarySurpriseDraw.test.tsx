/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, fireEvent, render, waitFor } from '@testing-library/react';
import {
  DRAW_LAND_MS,
  DRAW_SPIN_MS,
  dealDeck,
  drawFrameAt,
  easeOutQuart,
  stopRotation,
} from '../../../renderer/library/surpriseDraw/drawTiming';
import type { ILastSurprise } from '../../../renderer/library/player/useSurprise';
import SurpriseDrawLayer from '../../../renderer/library/surpriseDraw/SurpriseDrawLayer';

/**
 * Surprise me's draw (Ivan, 2026-11-13: "a nice random drawing animation
 * with the cover art, but make sure it's performant"): its timing as pure
 * numbers, and the layer that plays it, with the three.js scene, the cover
 * decoding and the player stood in for — the scene itself needs a GPU.
 */
let mockLastSurprise: ILastSurprise | undefined;
jest.mock('../../../renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayerSession: () => ({ lastSurprise: mockLastSurprise }),
}));

const mockPlaySurpriseDraw = jest.fn();
jest.mock('../../../renderer/library/surpriseDraw/drawScene', () => ({
  playSurpriseDraw: (scene: unknown) => mockPlaySurpriseDraw(scene),
}));

const mockReleased: unknown[] = [];
jest.mock('../../../renderer/library/surpriseDraw/drawCovers', () => ({
  DRAW_COVER_EDGE: 256,
  loadDrawCover: async (artId: string | undefined, label: string) => ({
    artId,
    label,
  }),
  releaseDrawCover: (cover: unknown) => mockReleased.push(cover),
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

beforeEach(() => {
  mockLastSurprise = undefined;
  mockReleased.length = 0;
  mockPlaySurpriseDraw.mockReset();
  mockPlaySurpriseDraw.mockResolvedValue(undefined);
  queryLibrary.mockReset();
  const answers: Record<string, unknown> = {
    tracks: [TRACK],
    coverDeck: ['aa01', 'bb02', 'cc03'],
  };
  queryLibrary.mockImplementation(
    async (request: { type: string }) => answers[request.type] ?? [],
  );
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { queryLibrary },
  };
  document.documentElement.removeAttribute('data-motion');
  // jsdom draws nothing and animates nothing; the fade only needs both to
  // answer.
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => null);
  Element.prototype.animate = jest.fn(() => ({
    finished: Promise.resolve(),
  })) as unknown as typeof Element.prototype.animate;
});

describe('the draw’s timing', () => {
  it('runs from the press to a stop with the pick in front, then lands', () => {
    const stop = stopRotation(1.2);
    const pressed = drawFrameAt(0, stop);
    expect(pressed.rotation).toBeCloseTo(0);
    expect(pressed).toMatchObject({ speed: 1, landing: 0, isLanded: false });
    const stopped = drawFrameAt(DRAW_SPIN_MS, stop);
    expect(stopped.rotation).toBeCloseTo(stop);
    expect(stopped.speed).toBe(0);
    expect(drawFrameAt(DRAW_SPIN_MS + DRAW_LAND_MS / 2, stop).landing).toBe(
      0.5,
    );
    expect(drawFrameAt(DRAW_SPIN_MS + DRAW_LAND_MS, stop).isLanded).toBe(true);
    // The pick's own angle plus the stop leaves it facing front.
    expect(Math.cos(1.2 + stop)).toBeCloseTo(1);
  });

  it('slows into the stop and never runs past it', () => {
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map(easeOutQuart);
    const steps = samples.slice(1).map((value, at) => value - samples[at]);
    expect(steps.every((step) => step > 0)).toBe(true);
    // Each step smaller than the last: slowing, not speeding up.
    expect(steps.slice(1).every((step, at) => step < steps[at])).toBe(true);
    expect(easeOutQuart(2)).toBe(1);
  });

  it('puts the pick at a place drawn among the others', () => {
    expect(dealDeck(['a', 'b', 'c'], 'P', () => 0.5)).toEqual({
      deck: ['a', 'b', 'P', 'c'],
      pickIndex: 2,
    });
    expect(dealDeck(['a', 'b'], 'P', () => 0).pickIndex).toBe(0);
  });
});

describe('the layer over the shelf', () => {
  it('plays the draw for a new surprise, the pick among the covers, captioned', async () => {
    const view = render(<SurpriseDrawLayer isShelfShown />);
    mockLastSurprise = { trackId: 'z', serial: 1 };
    view.rerender(<SurpriseDrawLayer isShelfShown />);
    await waitFor(() => expect(mockPlaySurpriseDraw).toHaveBeenCalledTimes(1));
    const scene = mockPlaySurpriseDraw.mock.calls[0][0];
    expect(scene.covers).toHaveLength(4);
    // Labelled as the player labels it (the song's title), so a song with no
    // cover lands as the tile it lands on.
    expect(scene.covers[scene.pickIndex]).toEqual({
      artId: 'feed01',
      label: 'Otra Vez',
    });
    expect(scene.caption).toEqual({ title: 'Otra Vez', detail: 'Reggaeton' });
    // The deck never holds the pick twice.
    expect(queryLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'coverDeck', exclude: ['feed01'] }),
    );
    await waitFor(() => expect(mockReleased).toHaveLength(4));
  });

  it('lands on the player’s cover inside its reveal button, and on nothing without one', async () => {
    const view = render(<SurpriseDrawLayer isShelfShown />);
    mockLastSurprise = { trackId: 'z', serial: 1 };
    view.rerender(<SurpriseDrawLayer isShelfShown />);
    await waitFor(() => expect(mockPlaySurpriseDraw).toHaveBeenCalledTimes(1));
    const { landing } = mockPlaySurpriseDraw.mock.calls[0][0] as {
      landing: () => DOMRect | undefined;
    };
    // No player on screen: nothing to fly to, so the pick lets go in place.
    expect(landing()).toBeUndefined();
    // The bar as `NowPlayingBar` draws it: the cover inside the reveal
    // button, not a child of the track block.
    const bar = document.createElement('div');
    bar.innerHTML =
      '<div class="now-playing-bar__track"><button class="now-playing-bar__reveal"><span class="library-cover-art"></span></button></div>';
    document.body.append(bar);
    expect(landing()).toBeDefined();
    bar.remove();
  });

  it('never replays a surprise from before the shelf was on screen', async () => {
    mockLastSurprise = { trackId: 'z', serial: 3 };
    render(<SurpriseDrawLayer isShelfShown />);
    await act(async () => undefined);
    expect(queryLibrary).not.toHaveBeenCalled();
    expect(mockPlaySurpriseDraw).not.toHaveBeenCalled();
  });

  it('fades the pick alone with motion reduced, and never loads the scene', async () => {
    document.documentElement.setAttribute('data-motion', 'reduced');
    const view = render(<SurpriseDrawLayer isShelfShown />);
    mockLastSurprise = { trackId: 'z', serial: 1 };
    view.rerender(<SurpriseDrawLayer isShelfShown />);
    await waitFor(() => expect(mockReleased).toHaveLength(1));
    expect(mockPlaySurpriseDraw).not.toHaveBeenCalled();
    expect(queryLibrary).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'coverDeck' }),
    );
  });

  it('plays nothing over a video', async () => {
    const view = render(<SurpriseDrawLayer isShelfShown={false} />);
    mockLastSurprise = { trackId: 'z', serial: 1 };
    view.rerender(<SurpriseDrawLayer isShelfShown={false} />);
    await act(async () => undefined);
    expect(queryLibrary).not.toHaveBeenCalled();
  });

  it('skips on a press', async () => {
    let scene: { signal: AbortSignal } | undefined;
    mockPlaySurpriseDraw.mockImplementation(
      (given: { signal: AbortSignal }) =>
        new Promise<void>((resolve) => {
          scene = given;
          given.signal.addEventListener('abort', () => resolve());
        }),
    );
    const view = render(<SurpriseDrawLayer isShelfShown />);
    mockLastSurprise = { trackId: 'z', serial: 1 };
    view.rerender(<SurpriseDrawLayer isShelfShown />);
    await waitFor(() => expect(scene).toBeDefined());
    const layer = view.container.querySelector('.library-surprise-draw');
    expect(layer?.classList.contains('is-playing')).toBe(true);
    fireEvent.pointerDown(layer as Element);
    expect(scene?.signal.aborted).toBe(true);
    await waitFor(() =>
      expect(layer?.classList.contains('is-playing')).toBe(false),
    );
  });
});
