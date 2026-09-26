/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IWallpaperBootstrap,
  IWallpaperSurfaceState,
} from 'common/wallpaper';

/**
 * How a desktop background goes from one visualizer to the next.
 *
 * Every change used to be a new window with a desktop helper of its own, and
 * the old window was destroyed the moment the new one was shown — before
 * Chromium had composited a frame of it — so the monitor blinked to the
 * window's background colour and cut to the new scene. Now the page that is
 * on the desktop builds the new scene under the one it shows, keeps showing
 * that one until the new one has drawn a frame with something in it, then
 * fades the old one off the new one and lets it go when the fade has ended.
 * Two renderers are alive only from the new one's build to the fade's end;
 * a third change arriving meanwhile replaces the one still unseen, or waits
 * for the fade to end.
 *
 * With reduced motion the new one simply takes the old one's place once it
 * has drawn.
 */

/** One visualizer the page draws: main's scene for one render generation. */
export interface ISceneLayer {
  generation: number;
  /**
   * Main's answer for this generation — the scene and who made it, in
   * main's word — as one object for the layer's life: its scene runner's
   * source is made from it.
   */
  bootstrap: Pick<IWallpaperBootstrap, 'pack' | 'madeBy'>;
  /**
   * Its wave, motion and tuning as main last said them while it was the
   * current one. A layer on its way out keeps its own; the next visualizer's
   * band or controls are not its.
   */
  state: IWallpaperSurfaceState;
}

export interface ISceneCrossfade {
  /** What main last said: the phase and performance every layer draws by. */
  latest?: IWallpaperSurfaceState;
  /** On the desktop, whole. */
  shown?: ISceneLayer;
  /** Whether `shown` has drawn a frame with anything in it. */
  shownDrawn: boolean;
  /** Built under `shown`, out of sight, until its first frame; then crossing. */
  incoming?: ISceneLayer;
  /** `shown` is fading off `incoming`. */
  crossing: boolean;
  /** A scene has been asked of main and not answered yet. */
  asking: boolean;
  /** Main had no scene to give, and has been told this page cannot draw. */
  stopped: boolean;
}

export type TCrossfadeEvent =
  /** Main's word on the surface: its phase, performance and the current look's. */
  | { kind: 'state'; state: IWallpaperSurfaceState }
  | { kind: 'asking' }
  /** Main's answer to the ask; nothing when it has no scene for this page. */
  | { kind: 'answered'; bootstrap: IWallpaperBootstrap | undefined }
  /** A layer drew its first frame with anything in it. */
  | { kind: 'drawn'; generation: number; reducedMotion: boolean }
  /** The fade of the layer with this generation off its successor ended. */
  | { kind: 'crossed'; generation: number };

/** Where a layer stands: alone, over the one coming, fading off it, or under. */
export type TSceneLayerStage = 'alone' | 'over' | 'leaving' | 'under';

export const NO_CROSSFADE: ISceneCrossfade = {
  shownDrawn: false,
  crossing: false,
  asking: false,
  stopped: false,
};

const newestOf = (fade: ISceneCrossfade): ISceneLayer | undefined =>
  fade.incoming ?? fade.shown;

const withState = (
  layer: ISceneLayer | undefined,
  state: IWallpaperSurfaceState,
): ISceneLayer | undefined =>
  layer && layer.generation === state.renderGeneration
    ? { ...layer, state }
    : layer;

const arrive = (
  fade: ISceneCrossfade,
  bootstrap: IWallpaperBootstrap | undefined,
): ISceneCrossfade => {
  if (!bootstrap) {
    return { ...fade, stopped: true };
  }
  const { pack, madeBy, state } = bootstrap;
  const generation = state.renderGeneration;
  // Main answers with what is current when it answers, and its word and its
  // answers travel one channel in order: an answer is never older than a word
  // that came before it with the same generation.
  const latest =
    !fade.latest || generation >= fade.latest.renderGeneration
      ? state
      : fade.latest;
  const next: ISceneCrossfade = { ...fade, latest };
  const newest = newestOf(fade);
  if (newest && generation <= newest.generation) {
    return next;
  }
  const layer: ISceneLayer = {
    generation,
    bootstrap: { pack, madeBy },
    state,
  };
  // Nothing of the one there is on the desktop yet: nothing to fade from.
  if (!fade.shown || !fade.shownDrawn) {
    return { ...next, shown: layer, shownDrawn: false };
  }
  // Asked for before the fade began; asked for again once it has ended, so
  // no third renderer is started while two are crossing.
  if (fade.crossing) {
    return next;
  }
  // Replaces one still being built out of sight, which nobody has seen.
  return { ...next, incoming: layer };
};

const drawn = (
  fade: ISceneCrossfade,
  generation: number,
  reducedMotion: boolean,
): ISceneCrossfade => {
  if (fade.shown?.generation === generation) {
    return fade.shownDrawn ? fade : { ...fade, shownDrawn: true };
  }
  const { incoming } = fade;
  if (!incoming || incoming.generation !== generation || fade.crossing) {
    return fade;
  }
  if (reducedMotion) {
    return { ...fade, shown: incoming, shownDrawn: true, incoming: undefined };
  }
  return { ...fade, crossing: true };
};

export const stepCrossfade = (
  fade: ISceneCrossfade,
  event: TCrossfadeEvent,
): ISceneCrossfade => {
  switch (event.kind) {
    case 'state':
      return {
        ...fade,
        latest: event.state,
        shown: withState(fade.shown, event.state),
        incoming: withState(fade.incoming, event.state),
      };
    case 'asking':
      return { ...fade, asking: true };
    case 'answered':
      return arrive({ ...fade, asking: false }, event.bootstrap);
    case 'drawn':
      return drawn(fade, event.generation, event.reducedMotion);
    case 'crossed':
      if (
        !fade.crossing ||
        !fade.incoming ||
        fade.shown?.generation !== event.generation
      ) {
        return fade;
      }
      return {
        ...fade,
        shown: fade.incoming,
        shownDrawn: true,
        incoming: undefined,
        crossing: false,
      };
    default:
      return fade;
  }
};

/**
 * Whether to ask main for its scene: at the start, and whenever it has said
 * there is a newer one than any this page holds — except while two are
 * crossing, which ends first.
 */
export const needsScene = (fade: ISceneCrossfade): boolean => {
  if (fade.asking || fade.stopped) {
    return false;
  }
  const newest = newestOf(fade);
  if (!newest) {
    return true;
  }
  return (
    !fade.crossing &&
    fade.latest !== undefined &&
    fade.latest.renderGeneration > newest.generation
  );
};

/**
 * The layers to draw, oldest first, so a layer keeps its place in the page
 * as the one before it goes and is never moved: the one being replaced
 * stands over its successor (`wallpaper-scene--over`) rather than the
 * successor starting transparent over it, because a layer at opacity 0 is
 * one nobody can see, and a scene runner builds nothing for that
 * (`observeShown`).
 */
export const layersOf = (
  fade: ISceneCrossfade,
): { layer: ISceneLayer; stage: TSceneLayerStage }[] => {
  const { shown, incoming } = fade;
  if (!shown) {
    return [];
  }
  if (!incoming) {
    return [{ layer: shown, stage: 'alone' }];
  }
  return [
    { layer: shown, stage: fade.crossing ? 'leaving' : 'over' },
    { layer: incoming, stage: 'under' },
  ];
};
