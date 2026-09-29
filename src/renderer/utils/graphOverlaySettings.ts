/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useSyncExternalStore } from 'react';
import { MIN_SCENE_WAVE_HEIGHT } from 'common/sceneWave';
import {
  VIEW_KEYS,
  createFlagSetting,
  readStored,
  removeStored,
  writeStored,
} from './graphStorage';
import {
  GRAPH_VIEWS,
  cleanSetting,
  createPerViewSetting,
  parseFlag,
  serializeFlag,
} from './graphViewSettings';

// What the graph shows over its plot, per view: the grid, the coverage
// shade, the side meter, the titlebar wave, and the wave's height and
// position. Built on the per-view settings in graphViewSettings.ts.

/**
 * Whether the grid, the axes and their labels are drawn.
 *
 * Separate from solo, which hides the *curves* — the EQ response, the voicing,
 * the driver. This hides the paper they are drawn on: the decibel scale down
 * the side, the frequency marks along the bottom, the lines between them.
 *
 * Two switches because they are two different things to want. Solo is for
 * reading the live trace without four other curves across it, and the grid is
 * exactly what you keep for that — a spectrum with no scale is a pretty shape
 * rather than a measurement. Turning the grid off is for when it has stopped
 * being a measurement on purpose: a visualiser, over a video, with the graph
 * pared back to nothing but the wave.
 *
 * Which is the whole argument for it being per mode. That last sentence
 * describes full screen and nothing else, and the same person editing bands in
 * the normal view wants every label they can get.
 */
/*
 * Hidden in full screen out of the box, drawn everywhere else.
 *
 * The paragraph above already argues that hiding the grid is what somebody does
 * on the way into full screen and undoes on the way out. If that is the move
 * almost everyone makes, making them find the menu to make it is a default
 * chosen the wrong way round — so full screen simply starts without it, and the
 * pane and the expanded card, where the graph is still a measurement, keep
 * every label they can get.
 */
const gridSetting = createPerViewSetting(
  VIEW_KEYS.grid,
  { normal: false, expanded: false, fullscreen: true },
  parseFlag,
  serializeFlag,
);

export const toggleGraphGrid = () => {
  if (cleanSetting.get()) {
    cleanSetting.set(false);
    gridSetting.set(false);
    return;
  }
  gridSetting.set(!gridSetting.get());
};

/**
 * The same answer outside a render, for the same reason `getGraphView` exists
 * beside `useGraphView`: not everything that needs to know is a component.
 */
export const getGraphGridHidden = () => gridSetting.get();

export const useGraphGridHidden = () =>
  useSyncExternalStore(gridSetting.subscribe, gridSetting.get, () => false);

/**
 * Whether the shaded columns behind the Smart EQ regions are drawn.
 *
 * They are the loudest thing on the plot that is not a curve — nine tinted
 * blocks the full height of the drawing, brightening as each range is heard —
 * and while a measurement is running that is exactly what they are for. Over a
 * video, or on a graph somebody is using as a visualiser, they are nine grey
 * rectangles across the picture.
 *
 * This remains independent from the Ctrl+W states. Hiding listening bands is a
 * useful graph arrangement of its own; it must not accidentally become the
 * completely blank Clean mode.
 *
 * The progress bars along the foot are not covered by this. They are two pixels
 * of the plot's height and they are the part that answers "is it still working",
 * so taking the wash away and leaving them is a clearer measurement rather than
 * a hidden one — and somebody who has switched the columns off is usually
 * watching something else and still wants to know when the correction lands.
 *
 * Per view mode, like the grid, and for the same reason: the arrangement wanted
 * over a video is not the arrangement wanted while editing bands.
 */
const coverageSetting = createPerViewSetting(
  VIEW_KEYS.coverage,
  false,
  parseFlag,
  serializeFlag,
);

/**
 * Declared rather than assigned, so `setGraphContents` — which sits up the file
 * with the rest of the cycle — can reach it.
 */
function setCoverageHidden(next: boolean) {
  coverageSetting.set(next);
}

/**
 * The menu switch: the one control that moves a value in the machine without
 * naming a state.
 *
 * Deliberately not routed through `setGraphContents`: coverage is an
 * independent preference and no longer names the Clean state. From Clean, the
 * effective control says "show", so that one press leaves Clean and restores
 * the columns without disturbing the other remembered graph preferences.
 */
export const toggleGraphCoverage = () => {
  if (cleanSetting.get()) {
    cleanSetting.set(false);
    setCoverageHidden(false);
    return;
  }
  setCoverageHidden(!coverageSetting.get());
};

export const getGraphCoverageHidden = () => coverageSetting.get();

export const useGraphCoverageHidden = () =>
  useSyncExternalStore(
    coverageSetting.subscribe,
    coverageSetting.get,
    () => false,
  );

/**
 * Whether the output level meter is drawn at all.
 *
 * It lives in the sidebar rather than on the plot, so hiding it is not a
 * statement about the graph — but the graph's View menu is where every other
 * "show me less" switch already is, and a second menu somewhere else for one
 * more toggle is worse than a slightly broad one here.
 *
 * NOT per view mode, unlike the grid and the coverage wash. Those are about how
 * busy the drawing should be in a given mode, and the answer genuinely differs
 * over a video. The sidebar is the same sidebar in every mode, so a meter that
 * appeared and vanished as the view changed would only ever be surprising.
 */
const meterSetting = createFlagSetting(VIEW_KEYS.meter, false);

export const toggleGraphMeter = () => {
  meterSetting.set(!meterSetting.get());
};

export const getGraphMeterHidden = () => meterSetting.get();

export const useGraphMeterHidden = () =>
  useSyncExternalStore(meterSetting.subscribe, meterSetting.get, () => false);

/**
 * Whether the titlebar keeps its waveform.
 *
 * The strip across the top is the one piece of this app that is decoration
 * before it is instrumentation — it says the audio is alive and little else,
 * and somebody working on a curve for an hour may reasonably want the top of
 * the window to stop moving.
 *
 * Hidden by CSS rather than by unmounting, which is the same rule the full
 * screen path already follows: tearing the component down takes its analyser
 * hook with it and builds a new one on every toggle, for a component nobody can
 * see. The bar stops being drawn; the capture behind it is untouched.
 */
const titlebarWaveSetting = createFlagSetting(VIEW_KEYS.titlebarWave, false);

export const toggleTitlebarWave = () => {
  titlebarWaveSetting.set(!titlebarWaveSetting.get());
};

export const getTitlebarWaveHidden = () => titlebarWaveSetting.get();

export const useTitlebarWaveHidden = () =>
  useSyncExternalStore(
    titlebarWaveSetting.subscribe,
    titlebarWaveSetting.get,
    () => false,
  );

/**
 * The wave never disappears completely under its own height control. The
 * scene's own copy of this setting lives in `common/sceneWave.ts` — a scene
 * is published with the wave its author built it around — and there is one
 * bottom end for both.
 */
export const MIN_GRAPH_WAVE_HEIGHT = MIN_SCENE_WAVE_HEIGHT;

const clampWaveHeight = (value: number) =>
  Math.max(MIN_GRAPH_WAVE_HEIGHT, Math.min(1, value));

const clampWavePosition = (value: number) => Math.max(0, Math.min(1, value));

const parseWaveHeight = (raw: string) => {
  const value = Number(raw);
  return Number.isFinite(value) ? clampWaveHeight(value) : 1;
};

const parseWavePosition = (raw: string) => {
  const value = Number(raw);
  return Number.isFinite(value) ? clampWavePosition(value) : 0;
};

const serializeWaveControl = (value: number) =>
  String(Math.round(value * 100) / 100);

/**
 * Carry the only distinct old size forward before removing its three-step
 * state. `compact` was a half-height wave; `normal` and `stretched` differed by
 * the plot's margins rather than by the wave, so both become full height. The
 * plot now decides its margins from whether the measurement grid is present,
 * while these two controls describe only the wave they name.
 */
const migrateLegacyWaveSize = () => {
  const legacyStem = 'fluideq.graphStretched';
  const flat = readStored(legacyStem);
  GRAPH_VIEWS.forEach((mode) => {
    const legacyKey = `${legacyStem}.${mode}`;
    const legacy = flat ?? readStored(legacyKey);
    const heightKey = `${VIEW_KEYS.waveHeight}.${mode}`;
    if (legacy !== null && readStored(heightKey) === null) {
      writeStored(heightKey, legacy === 'compact' ? '0.5' : '1');
    }
    removeStored(legacyKey);
  });
  removeStored(legacyStem);
};

migrateLegacyWaveSize();

/**
 * How tall the live wave is, continuously, from a low ripple to the complete
 * available height. Kept per view because a background wave under the editor
 * and a full-screen visualiser are different arrangements — and they start
 * differently: the pane's graph is a measurement and uses the whole plot,
 * while the expanded and full-screen views are for watching, where three
 * quarters leaves the scenes their sky and the curves their room.
 */
/**
 * ONE VALUE PER MODE, like every other setting in this file.
 *
 * The two big modes used to share a single value — wave height and position
 * describe the wave itself rather than the frame around it, so one answer
 * looked like it ought to serve both. On screen they are not one answer: the
 * pane is a band across a card, the expanded view has the workspace column and
 * full screen has the glass, and a wave set to fill one of them is a smear in
 * the next. Ivan, 2026-09-23: "make sure plus visualiser have different wave
 * height and position settings for the 3 standard, expanded and fullscreen
 * mode". A scene's own wave is kept the same way, per mode, in
 * `sceneWaveStore.ts`.
 *
 * The pane's other rule is still not here. The graph there shares its card
 * with the response curves, the band handles and the legends — it is a
 * measurement, it uses the whole plot — but with a Plus visualizer on it the
 * plot is a picture rather than a reading, and where its band stands is the
 * thing being looked at, so the rows ARE offered there. Knowing whether a
 * scene is on the plot means reading the graph's look, which is the layer
 * above this one, so that rule lives with the facts in
 * `FrequencyResponseChart` — and it has to live somewhere: it used to be a
 * constant returned from here, which meant the sliders the menu deliberately
 * offers in the pane wrote a value this getter then refused to hand back. The
 * thumb sprang home on release and the picture never moved.
 */
const waveHeightSetting = createPerViewSetting(
  VIEW_KEYS.waveHeight,
  { normal: 1, expanded: 0.75, fullscreen: 0.75 },
  parseWaveHeight,
  serializeWaveControl,
);

export const setGraphWaveHeight = (next: number) => {
  waveHeightSetting.set(clampWaveHeight(next));
};

export const getGraphWaveHeight = () => waveHeightSetting.get();

export const useGraphWaveHeight = () =>
  useSyncExternalStore(
    waveHeightSetting.subscribe,
    waveHeightSetting.get,
    () => 1,
  );

/**
 * Where the wave stands vertically. Zero is its orientation's outer edge and
 * one moves its baseline to the middle. For the ordinary upright wave that is
 * exactly bottom-to-centre; the inverted and mirrored forms make the symmetric
 * move from their own edges.
 */
const wavePositionSetting = createPerViewSetting(
  VIEW_KEYS.wavePosition,
  0,
  parseWavePosition,
  serializeWaveControl,
);

export const setGraphWavePosition = (next: number) => {
  wavePositionSetting.set(clampWavePosition(next));
};

export const getGraphWavePosition = () => wavePositionSetting.get();

/**
 * The wave's height and position as somebody set them for watching — full
 * screen's, whichever view the graph is in now. A desktop background is
 * watched the way full screen is and takes those; the pane's measuring height
 * is about a card it does not have.
 */
export const getWatchedGraphWave = () => ({
  height: waveHeightSetting.getFor('fullscreen'),
  position: wavePositionSetting.getFor('fullscreen'),
});

/**
 * The same two numbers, watched. One object until they actually move, because
 * a snapshot built afresh on every read would tell React it had changed on
 * every render.
 */
let watchedWave = getWatchedGraphWave();

const readWatchedWave = () => {
  const height = waveHeightSetting.getFor('fullscreen');
  const position = wavePositionSetting.getFor('fullscreen');
  if (height !== watchedWave.height || position !== watchedWave.position) {
    watchedWave = { height, position };
  }
  return watchedWave;
};

export const useWatchedGraphWave = () =>
  useSyncExternalStore(
    (listener: () => void) => {
      const stopHeight = waveHeightSetting.subscribe(listener);
      const stopPosition = wavePositionSetting.subscribe(listener);
      return () => {
        stopHeight();
        stopPosition();
      };
    },
    readWatchedWave,
    () => watchedWave,
  );

export const useGraphWavePosition = () =>
  useSyncExternalStore(
    wavePositionSetting.subscribe,
    wavePositionSetting.get,
    () => 0,
  );
