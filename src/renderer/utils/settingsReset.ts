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
  'fluideq.graphAnalyserSlope',
  'fluideq.graphBandLabelsHidden',
  'fluideq.graphCoverageHidden',
  'fluideq.graphFrequencyRange',
  'fluideq.graphGridHidden',
  'fluideq.graphHiddenCurves',
  // The curves' names in the graph's corner, per view.
  'fluideq.graphLegendHidden',
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
  'fluideq.sceneCameraControl',
  'fluideq.scenePerformance',
  'fluideq.standardPerformance',
  'fluideq.sceneResponse',
  'fluideq.sceneWaves',
  // How much of a scene comes through the EQ page's panels, and how blurred.
  'fluideq.scenePanelsBlur',
  'fluideq.scenePanelsSeeThrough',
  // The window: colours, Brightness, Transparency, the Tint, a scene's own
  // time of day, sparks, sliders, and how it is divided. Not the
  // language (Ivan, 2026-10-26, from the reset checklist): put back to
  // Windows' own, somebody who chose another one would be facing a language
  // they may not read.
  'fluideq.sceneTintMode',
  // The window colours chosen for a scene, as its sliders are its own
  // (`sceneWindowColourStore.ts`): a reset wears each scene's colours again.
  'fluideq.sceneWindowColours',
  'fluideq.theme',
  'fluideq.backdropVeil',
  'fluideq.windowTint',
  // The colours picked for the Tint beside its slider, the first and the
  // second its gradient runs to (`windowTint.ts`).
  'fluideq.windowTintColour',
  'fluideq.windowTintSecondary',
  'fluideq.sceneDaylight',
  'fluideq.pointerSparks',
  // "Tint app icon": cleared is off, the installed icon (`appIconTint.ts`).
  'fluideq.appIconTint',
  'fluideq.sliderHandle',
  'fluideq.plusRailPinned',
  // The Scenes rail's dragged width, as the Library's rail's.
  'fluideq.plusRailWidth',
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
  // Its chat: folded or not, its width and zoom, and the model and effort
  // older chats stood on before each chat kept its own (`chatPicks.ts`,
  // only read now). A chat's own model and effort are in the chat, with its
  // messages, and are no setting.
  'fluideq.studio.chatFolded',
  'fluideq.studio.chatWidth',
  'fluideq.studio.fullscreenChatWidth',
  'fluideq.studio.chatZoom',
  'fluideq.studio.chatModel',
  'fluideq.studio.chatEffort',
  'fluideq.studio.chatPicks',
  // Video.
  'fluideq.video.matchColours',
  // Online Media's rail: its dragged width and whether it is pinned open or
  // folded to the sites' marks.
  'fluideq.video.railWidth',
  'fluideq.video.railPinned',
  'fluideq.videoAdBlock',
  'fluideq.videoAdBlockRevealed',
  // The Library.
  'fluideq.library.browseMode',
  // The details table's columns, and which tab the right pane stands on.
  'fluideq.library.columns',
  'fluideq.library.paneTab',
  // The shelf rail's dragged width, and whether it is pinned open or folded
  // to its glyphs.
  'fluideq.library.railWidth',
  'fluideq.library.railPinned',
  // The look picker's dragged window size (`LookPickerWindow`).
  'fluideq.lookPicker.size',
  'fluideq.library.keepPlaying',
  'fluideq.library.sort',
  'fluideq.library.sortDirection',
  'fluideq.library.upNextWidth',
  'fluideq.library.upNextCollapsed',
  'fluideq.library.viewMode',
  // A video's captions: how they look and where they stand, and the
  // language the next film opens in.
  'fluideq.library.subtitleStyle',
  'fluideq.library.subtitleLanguage',
  // The subtitle file each video was last watched with.
  'fluideq.library.subtitleByVideo',
  // The Gaming Lab's rail: its dragged width and whether it is pinned open,
  // separate from saved game profiles; and the list's layout from before the
  // rail, which the page carries over once and removes.
  'fluideq.gaming.railWidth',
  'fluideq.gaming.railPinned',
  'fluideq.gaming.gamesLayout',
  // The DSP page's rail: its dragged width and whether it is pinned open
  // (Ivan, 2026-11-19: "make sure Reset settings resets all those pane
  // widths too on all pages").
  'fluideq.dsp.railWidth',
  'fluideq.dsp.railPinned',
  // Share Audio's rail: its dragged width; and the pin it had for one day
  // before it stayed open (2026-11-19), read by nothing now, so a reset
  // leaves no trace of it.
  'fluideq.shareRailWidth',
  'fluideq.shareRailPinned',
  // The rails' widths in Help's drawings of Share Audio and Scenes, each the
  // drawing's own.
  'fluideq.help.shareRailWidth',
  'fluideq.help.plusRailWidth',
  // Karaoke.
  'fluideq.karaokeLayout',
  'fluideq-karaoke-lyric-text-size',
  'fluideq-karaoke-pitch-guide-visible',
  'fluideq-karaoke-playlist-group-by-folder',
  'fluideq-karaoke-stage-art-visible',
  'fluideq-karaoke-stage-background',
  'fluideq-karaoke-stage-guides',
  'fluideq-karaoke-stage-guides-shown',
  'fluideq-karaoke-scene-opacity',
  'fluideq-karaoke-scene-blur',
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
  // The EQ page's open tab under its graph: the bands, the preset, the Tone.
  'fluideq.eqLayerTab',
  'fluideq.plusPlace',
  'fluideq.studio.workTab',
  // Which files the Code tab has open in each project: where a page was
  // left, like the tab itself.
  'fluideq.studio.codeOpenFiles',
  // Whether full screen shows the work pane and the chat, and the pane's
  // height: where full screen was left.
  'fluideq.studio.fullscreenPanes',
  'fluideq.library.openAlbum',
  'fluideq.library.openArtist',
  'fluideq.library.openFolder',
  'fluideq.library.openGenre',
  'fluideq.library.openPlaylist',
  'fluideq.library.folderTree',
  'fluideq.karaoke.maker-open',
  'fluideq.karaoke.maker-preview-open',
  // The Maker preview's dragged height, kept for every song alike.
  'fluideq.karaoke.maker-preview-height',
  'fluideq.karaoke.maker-editor-views.v1',
  // Where earlier versions kept some of the above. Each is read when the new
  // name is empty, so a reset that left one would bring back its old answer
  // instead of the new install's. The same for the marks that move an older
  // answer once: the Brightness onto its light-and-dark scale (`theme.ts`),
  // whose Brightness of each Window colours mode is the one before that, and
  // the top wave's style onto the recorder (`WaveformVisualizer.tsx`). Each
  // finds nothing left to move after a reset. And Colourful mode's switch and
  // unlock, read by nothing since the mode became always on (2026-11-18) and
  // forgotten at launch too (`euphoriaMode.ts`).
  'fluideq-rainbow',
  'fluideq-euphoria-reached',
  'fluideq-euphoria-enabled',
  'fluideq.editorHeight',
  'fluideq.editorShare',
  'fluideq.graphStretched',
  'fluideq.studioWindowMode',
  'fluideq.meterOffStateMigrated',
  'fluideq.waveOffStateMigrated',
  'fluideq.themeScale',
  'fluideq.sceneTintBrightness',
  'fluideq.waveRecorderIntroduced',
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
 * starts on for a new user, to show what the graph can do; somebody resetting
 * their settings has seen it and gets it off (Ivan, 2026-10-25: "on reset
 * setting auto change viz off by default"). Written as its store writes it
 * (`graphAutoCycle.ts`). Rainbow mode was the other until Colourful mode
 * became always on, with no switch to write (2026-11-18).
 */
export const RESET_CHOICES: Readonly<Record<string, string>> = {
  'fluideq-graph-auto-cycle-seconds': '0',
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
