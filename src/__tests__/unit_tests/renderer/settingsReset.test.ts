/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {
  forgetSettings,
  isSettingKey,
} from '../../../renderer/utils/settingsReset';

/**
 * "Reset all settings" forgets exactly the settings.
 *
 * The window keeps settings and the listener's own things side by side in
 * one storage, under names of one shape. A reset that missed a setting would
 * leave it showing the old answer after the app said it was new; one that
 * took a name it should not would delete somebody's presets, rooms or
 * Library. So every stored name the source writes out is either a setting
 * (`settingsReset.ts`), kept (below, with why), or not a stored name at all —
 * and a new one fails here until somebody decides which.
 */

const REPO = path.resolve(__dirname, '../../../..');
const ROOTS = ['src/renderer', 'src/common'];

/** Stored, and not a setting: the sound, the listener's things, where they were. */
const KEPT = [
  // The sound: the rack, Smart EQ and what it trusts.
  'fluideq.dsp.v1',
  'fluideq.continuousEq',
  'fluideq.correctionLimitDb',
  'fluideq.smartEqMode',
  'fluideq.presenceOffsets',
  // The engine and the outputs.
  'fluideq.apoRestartRecommended',
  'fluideq.dsp.rackHeldForApo.v1',
  'fluideq.engineNeverRanRepairs',
  'fluideq-mirror-target-guids',
  'fluideq-mirror-volumes',
  'fluideq.karaoke.microphoneId',
  // What the listener made or saved.
  'fluideq-custom-looks',
  'fluideq.lookDraft',
  'fluideq.dsp.crossfadeCurves.v1',
  'fluideq.dsp.favouritePresets.v1',
  'fluideq.dsp.savedRooms.v1',
  'fluideq.dsp.userChainPresets.v1',
  'fluideq.dsp.userPresets.v1',
  'fluideq.games.profiles.v1',
  'fluideq.karaoke.current-progress.v1',
  'fluideq.squiglink-import.text',
  'fluideq.studio.idea',
  'fluideq-rhythm-best-multiplier',
  'fluideq-rhythm-high-score',
  // Where they were.
  'fluideq.workspaceTab',
  'fluideq.plusPlace',
  'fluideq.dsp.openSection',
  'fluideq.studio.workTab',
  'fluideq.transport.lastOwner',
  'fluideq.transport.lastShown',
  'fluideq.library.folderTree',
  'fluideq.library.openAlbum',
  'fluideq.library.openArtist',
  'fluideq.library.openFolder',
  'fluideq.library.openGenre',
  'fluideq.library.openPlaylist',
  'fluideq.library.playback',
  'fluideq.library.videoPositions',
  'fluideq.videoLastUrl',
  'fluideq.videoResume',
  'fluideq.karaoke.maker-editor-views.v1',
  'fluideq.karaoke.maker-open',
  'fluideq.karaoke.maker-preview-open',
  // What they searched for.
  'fluideq.autoEqModelSearchHistory',
  'fluideq.convolutionSearchHistory',
  'fluideq.library.filterHistory',
  'fluideq.librarySearchHistory',
  'fluideq.videoSearchHistory',
  // What they agreed to, saw, won or gave.
  'fluideq.disclaimerAccepted',
  'fluideq.featureTourDismissed',
  'fluideq.seenSceneVersions',
  'fluideq.hasContributed',
  'fluideq-euphoria-reached',
  // The Studio's door for an AI: a member who shut it keeps it shut.
  'fluideq.studio.agentAssistant',
  // Downloads and caches: fetched or measured again, at a cost.
  'fluideq.karaoke.separationDownloaded.v1.melband-roformer',
  'fluideq.karaoke.whisperDownloaded.v4.large-v3-turbo',
  'fluideq.scene.prebuilt',
  'fluideq.sceneTint.skies',
];

/** Written out in the source, and never a stored name. */
const NOT_STORED = [
  // Events.
  'fluideq-band-menu',
  'fluideq-clear-autoeq-selection',
  'fluideq-dsp-presets-changed',
  'fluideq-game-profiles-changed',
  'fluideq-game-sounding-changed',
  'fluideq-opra-updated',
  'fluideq-output-changed',
  'fluideq-output-signal',
  'fluideq-presets-changed',
  'fluideq-video-ad-block-changed',
  'fluideq-video-ad-block-request',
  'fluideq-video-graph-fullscreen-request',
  'fluideq-video-guest-volume-changed',
  // Audio worklets.
  'fluideq-audio-clock',
  'fluideq-dsp',
  'fluideq-headroom-meter',
  'fluideq-karaoke-pitch',
  'fluideq-remote-audio',
  'fluideq-remote-audio-capture',
  // Files, formats and a scheme.
  'fluideq-curve-phase.txt',
  'fluideq-curve-treble.txt',
  'fluideq-cuts.txt',
  'fluideq-dsp.txt',
  'fluideq-eq-phase.txt',
  'fluideq-eq-treble.txt',
  'fluideq-programme.txt',
  'fluideq-karaoke.json',
  'fluideq-dsp-chain',
  'fluideq-preset',
  'fluideq-maker',
  'fluideq-maker-editor',
  'fluideq-media',
  // The feature tour's slide ids.
  'fluideq-engine',
  'fluideq-plus',
];

/** A name, not a sentence: "fluideq.com im Browser öffnen" is German. */
const NAME = /^fluideq[.:-][\w.:-]+$/;

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [full]
      : [];
  });

/** Every string the source writes out whole that looks like a stored name. */
const namesInSource = (): Map<string, string> => {
  const names = new Map<string, string>();
  ROOTS.flatMap((root) => sourceFiles(path.join(REPO, root))).forEach(
    (file) => {
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        false,
      );
      const visit = (node: ts.Node) => {
        if (
          (ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node)) &&
          NAME.test(node.text) &&
          !names.has(node.text)
        ) {
          names.set(node.text, path.relative(REPO, file));
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    },
  );
  return names;
};

describe('Reset all settings', () => {
  const names = namesInSource();

  it('finds the stored names it is meant to judge', () => {
    // The positive control: a scan that read nothing would pass the rest.
    expect(names.get('fluideq.pointerSparks')).toBe(
      path.join('src', 'renderer', 'utils', 'pointerSparksStore.ts'),
    );
    expect(names.has('fluideq.dsp.userPresets.v1')).toBe(true);
  });

  it('knows whether every stored name in the source is a setting', () => {
    const undecided = [...names.keys()].filter(
      (name) =>
        !isSettingKey(name) &&
        !KEPT.includes(name) &&
        !NOT_STORED.includes(name),
    );
    expect(undecided.map((name) => `${name} (${names.get(name)})`)).toEqual([]);
  });

  it('never counts what is kept as a setting', () => {
    expect(
      [...KEPT, ...NOT_STORED].filter((name) => isSettingKey(name)),
    ).toEqual([]);
  });

  it('lists nothing the source no longer names', () => {
    expect([...KEPT, ...NOT_STORED].filter((name) => !names.has(name))).toEqual(
      [],
    );
  });

  it('forgets every setting in storage and nothing else', () => {
    window.localStorage.clear();
    const settings = [
      'fluideq.pointerSparks',
      'fluideq.graphGridHidden.fullscreen',
      'fluideq.graphGridHidden.expanded',
      'fluideq.theme',
      'fluideq.theme.player',
      'fluideq.studioGroupFold.song',
      'fluideq.sceneTint',
      'fluideq.scenePerformance',
      'fluideq.standardPerformance',
      'fluideq-rainbow',
    ];
    const kept = [
      'fluideq.sceneTint.skies',
      'fluideq.dsp.userPresets.v1',
      'fluideq.disclaimerAccepted',
      'fluideq.library.sortDirectionless',
      'somebody-else',
    ];
    [...settings, ...kept].forEach((key) =>
      window.localStorage.setItem(key, 'stored'),
    );

    forgetSettings(window.localStorage);

    expect(settings.filter((key) => window.localStorage.getItem(key))).toEqual(
      [],
    );
    expect(kept.filter((key) => !window.localStorage.getItem(key))).toEqual([]);
    window.localStorage.clear();
  });
});
