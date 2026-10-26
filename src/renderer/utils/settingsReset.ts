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
 * player's and the Library's layout, the karaoke screen, and where each page
 * was left. Kept, because none of it is a setting: the sound (the EQ, its
 * presets, curves and corrections, the DSP rack and Smart EQ), the outputs
 * and the engine, what the listener made or saved (presets, rooms, fades,
 * looks, game profiles, the Library, karaoke, the Studio), what is playing
 * and where in it, the language, search histories, what they already agreed
 * to or saw, and caches. Ivan chose each from a checklist of every one of
 * them on 2026-10-26.
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
  // The window: colours, Colourful mode, Brightness, Transparency, the Tint, a
  // scene's own time of day, sparks, sliders, and how it is divided. Not the
  // language (Ivan, 2026-10-26, from the reset checklist): put back to
  // Windows' own, somebody who chose another one would be facing a language
  // they may not read.
  'fluideq.sceneTintMode',
  'fluideq-rainbow',
  'fluideq.theme',
  'fluideq.backdropVeil',
  'fluideq.windowTint',
  'fluideq.sceneDaylight',
  'fluideq.pointerSparks',
  'fluideq.sliderHandle',
  'fluideq.plusRailPinned',
  'fluideq.editorShareByTab',
  'fluideq.soundPaneFolded',
  'fluideq.eqModePinned',
  'fluideq.singlePlayer',
  'fluideq.songSound',
  'fluideq.dsp.phaseView',
  // The amp.
  'fluideq.player.decks',
  'fluideq.player.eqFace',
  'fluideq.player.queuePage',
  'fluideq.player.sheet',
  'fluideq.player.shelfOpen',
  'fluideq.player.soundOpen',
  'fluideq.player.timeLeft',
  'fluideq.player.unfoldedHeight',
  'fluideq.player.visHeight',
  'fluideq.player.well',
  // The Studio's page.
  'fluideq.studioGrid',
  'fluideq.studioGroupFold',
  'fluideq.studio.stageRatio',
  // Whether a new project's starter has its parts labelled on the stage.
  'fluideq.studio.starterLabels',
  // Its chat: folded or not, its width and zoom, the model and effort asked.
  'fluideq.studio.chatFolded',
  'fluideq.studio.chatWidth',
  'fluideq.studio.chatZoom',
  'fluideq.studio.chatModel',
  'fluideq.studio.chatEffort',
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
  // Where each page was left (Ivan, 2026-10-26, from the reset checklist):
  // the page the window opens on, the DSP page's open section, the
  // Visualizers and Studio places, the Library's open folder, album, artist,
  // genre or playlist and its folder tree, and the Karaoke Maker's panels.
  // Each page opens at its start after a reset; what is in them — the songs,
  // playlists, queue and projects — is never touched.
  'fluideq.workspaceTab',
  'fluideq.dsp.openSection',
  'fluideq.plusPlace',
  'fluideq.studio.workTab',
  'fluideq.library.openAlbum',
  'fluideq.library.openArtist',
  'fluideq.library.openFolder',
  'fluideq.library.openGenre',
  'fluideq.library.openPlaylist',
  'fluideq.library.folderTree',
  'fluideq.karaoke.maker-open',
  'fluideq.karaoke.maker-preview-open',
  'fluideq.karaoke.maker-editor-views.v1',
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
 * measured for each visualizer (`.skies`), a cache that stays; and whether Help's
 * button hides the Forum's count (`forumNewsPref.ts`), beside what has been
 * read, which stays; and the Games page's own switch (`gameProfiles.ts`),
 * beside the game presets somebody made, which stay.
 */
export const SETTING_KEYS: readonly string[] = [
  'fluideq.sceneTint',
  'fluideq.forum.newsHidden.v1',
  'fluideq.games.enabled.v1',
];

export const isSettingKey = (key: string) =>
  SETTING_KEYS.includes(key) ||
  SETTING_STEMS.some((stem) => key === stem || key.startsWith(`${stem}.`));

/**
 * What a reset sets rather than forgets: the few settings whose fresh install
 * answer is not the one a reset should give. Automatic visualizer switching
 * and Rainbow mode both start on for a new user, to show what the graph can
 * do; somebody resetting their settings has seen it and gets them off (Ivan,
 * 2026-10-25: "on reset setting auto change viz off by default", "also
 * rainbow mode off by default too"). Written as each store writes them
 * (`graphAutoCycle.ts`, `euphoriaMode.ts`).
 */
export const RESET_CHOICES: Readonly<Record<string, string>> = {
  'fluideq-graph-auto-cycle-seconds': '0',
  'fluideq-rainbow': 'off',
};

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

/** Reset settings: every setting forgotten, then `RESET_CHOICES` written. */
export const resetSettings = (storage: Storage) => {
  forgetSettings(storage);
  Object.entries(RESET_CHOICES).forEach(([key, value]) =>
    storage.setItem(key, value),
  );
};
