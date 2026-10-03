/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Reset all settings" in the main menu, for the settings this window keeps
 * in its storage (Ivan, 2026-09-28: "resets all settings for all things",
 * "except for installed engine or output", "or the graphs or eq", "just
 * settings"). Main resets its own first (`main/ipc/settingsReset.ts`); then
 * these are forgotten and the window reloads, and every store reads its new
 * install's value again.
 *
 * A setting is a choice about how FluidEQ looks and behaves: the graph's look
 * and views, the window's colours, brightness and sparks, the sliders, the
 * language, the player's and the Library's layout, the karaoke screen. Kept,
 * because none of it is a setting: the sound (the EQ, its presets, curves and
 * corrections, the DSP rack and Smart EQ), the outputs and the engine, what
 * the listener made or saved (presets, rooms, fades, looks, game profiles, the
 * Library, karaoke, the Studio), where they were (open tabs, folders and
 * songs), what they already agreed to or saw, and caches.
 *
 * `settingsReset.test.ts` fails on any stored name in the source that is in
 * neither this file nor its own list of what is kept, so a new setting cannot
 * be missed by the reset and a new saved thing cannot be swept up by it.
 */

/**
 * Each forgotten with every entry built from it by a dot: one per graph view
 * (`fluideq.graphGridHidden.fullscreen`), per karaoke screen, per Studio
 * group, or the amp's own copy (`.player`).
 */
export const SETTING_STEMS: readonly string[] = [
  // The graph: its look, its views and what each shows.
  'fluideq-graph-style',
  'fluideq-graph-auto-cycle-seconds',
  'fluideq-graph-palette-by-form',
  'fluideq-meter-style',
  'fluideq-waveform-style',
  'fluideq.graphClean',
  'fluideq.graphBandLabelsHidden',
  'fluideq.graphCoverageHidden',
  'fluideq.graphGridHidden',
  'fluideq.graphHiddenCurves',
  'fluideq.graphMenuFold',
  'fluideq.graphMeterHidden',
  'fluideq.graphOverlayBlur',
  'fluideq.graphOverlayOpacity',
  'fluideq.graphQuietEq',
  'fluideq.graphSolo',
  'fluideq.graphView',
  'fluideq.graphVisibilityByTab',
  'fluideq.graphWaveHeight',
  'fluideq.graphWaveHidden',
  'fluideq.graphWavePosition',
  'fluideq.titlebarWaveHidden',
  'fluideq.waveOrientation',
  // Visualizers: each one's own controls, its response and wave, and how
  // hard the graphics card works.
  'fluideq.sceneParams',
  'fluideq.scenePerformance',
  'fluideq.standardPerformance',
  'fluideq.sceneResponse',
  'fluideq.sceneWaves',
  // The window: colours, Rainbow, Brightness, Transparency, a scene's own
  // time of day, sparks, sliders, the language, and how it is divided.
  'fluideq.sceneTintMode',
  'fluideq-rainbow',
  'fluideq.theme',
  'fluideq.backdropVeil',
  'fluideq.sceneDaylight',
  'fluideq.pointerSparks',
  'fluideq.sliderHandle',
  'fluideq.locale',
  'fluideq.plusRailPinned',
  'fluideq.editorShareByTab',
  'fluideq.soundPaneFolded',
  'fluideq.singlePlayer',
  'fluideq.songSound',
  'fluideq.dsp.phaseView',
  // The amp.
  'fluideq.player.decks',
  'fluideq.player.eqFace',
  'fluideq.player.sheet',
  'fluideq.player.timeLeft',
  'fluideq.player.unfoldedHeight',
  'fluideq.player.visHeight',
  'fluideq.player.well',
  // The Studio's page.
  'fluideq.studioGrid',
  'fluideq.studioGroupFold',
  'fluideq.studio.stageRatio',
  // Video.
  'fluideq.video.matchColours',
  'fluideq.videoAdBlock',
  'fluideq.videoAdBlockRevealed',
  // The Library.
  'fluideq.library.browseMode',
  'fluideq.library.keepPlaying',
  'fluideq.library.sort',
  'fluideq.library.sortDirection',
  'fluideq.library.upNextWidth',
  'fluideq.library.viewMode',
  // Karaoke.
  'fluideq.karaokeLayout',
  'fluideq-karaoke-lyric-text-size',
  'fluideq-karaoke-pitch-guide-visible',
  'fluideq-karaoke-playlist-group-by-folder',
  'fluideq-karaoke-stage-art-visible',
  'fluideq.karaoke.melody-tone-volume',
  'fluideq.karaoke.microphoneGain',
  'fluideq.karaoke.whisperMemory.v1',
  // Where earlier versions kept some of the above. Each is read when the new
  // name is empty, so a reset that left one would bring back its old answer
  // instead of the new install's.
  'fluideq-euphoria-enabled',
  'fluideq.editorHeight',
  'fluideq.editorShare',
  'fluideq.graphStretched',
  'fluideq.studioWindowMode',
  'fluideq.meterOffStateMigrated',
  'fluideq.waveOffStateMigrated',
];

/**
 * Forgotten as named and nothing under it: the Window colours switch an
 * earlier version kept, read when the mode is empty, beside the sky colours
 * measured for each visualizer (`.skies`), a cache that stays.
 */
export const SETTING_KEYS: readonly string[] = ['fluideq.sceneTint'];

export const isSettingKey = (key: string) =>
  SETTING_KEYS.includes(key) ||
  SETTING_STEMS.some((stem) => key === stem || key.startsWith(`${stem}.`));

/** Every setting in `storage` forgotten, and nothing else. */
export const forgetSettings = (storage: Storage) => {
  // Read out whole first: removing while walking the indices skips entries.
  const keys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  );
  keys.forEach((key) => {
    if (key !== null && isSettingKey(key)) {
      storage.removeItem(key);
    }
  });
};
