/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { translate } from 'common/i18n';
import type { TranslationKey } from 'common/i18n/en';
import {
  dspPresetCatalog,
  dspPresetStages,
} from 'renderer/dsp/dspPresetCatalog';
import { genreHookKey } from 'renderer/dsp/genreNotesModel';
import { isStarKey } from 'renderer/shell/wavePreset/presetMenuKeys';
import {
  findsInOrder,
  searchPresets,
  searchablePresets,
} from 'renderer/shell/wavePreset/presetSearch';

/* What the titlebar plate's search reaches and how it files what it finds. */

const t = (key: TranslationKey, vars?: Record<string, string | number>) =>
  translate('en', key, vars);
const catalog = dspPresetCatalog(t);
const wordsOf = (preset: (typeof catalog)[number]) => {
  const hook = genreHookKey(preset.id);
  return {
    hook: hook ? t(hook) : undefined,
    stages: dspPresetStages(preset, t),
  };
};
const ids = (query: string, isApo = false) => {
  const search = searchPresets(
    searchablePresets(catalog, isApo),
    query,
    wordsOf,
  );
  return search ? findsInOrder(search).map(({ preset }) => preset.id) : [];
};

it('reaches every preset but the Gaming tab’s chains and None', () => {
  const reached = searchablePresets(catalog, false);
  expect(reached.length).toBeGreaterThan(100);
  expect(reached.some((preset) => preset.group === 'gaming')).toBe(false);
  expect(reached.some((preset) => preset.id === 'empty')).toBe(false);
  // The control: the catalogue holds both, so leaving them out is a choice.
  expect(catalog.some((preset) => preset.group === 'gaming')).toBe(true);
  expect(catalog.some((preset) => preset.id === 'empty')).toBe(true);
});

it('is nothing while nothing is typed', () => {
  expect(searchPresets(catalog, '   ', wordsOf)).toBeUndefined();
});

it('files names first, by group, and then what the others do', () => {
  const search = searchPresets(
    searchablePresets(catalog, false),
    'bass',
    wordsOf,
  );
  if (!search) {
    throw new Error('no search');
  }
  expect(
    search.byName.flatMap(({ finds }) => finds).map(({ preset }) => preset.id),
  ).toContain('drum-bass');
  const lateNight = search.byWhat.find(
    ({ preset }) => preset.id === 'late-night',
  );
  expect(lateNight?.because).toEqual({ kind: 'stage', text: 'Bass Forge' });
  // A genre whose own line names the word is found by that line.
  expect(search.byWhat.some(({ because }) => because?.kind === 'hook')).toBe(
    true,
  );
  expect(search.count).toBe(findsInOrder(search).length);
});

it('folds case, accents and punctuation, and takes the words in any order', () => {
  expect(ids('synthpop')).toContain('synthPop');
  expect(ids('BASS drum')).toContain('drum-bass');
  expect(ids('regge')).toEqual([]);
});

it('leaves the Room copies out under Equalizer APO, which plays no room', () => {
  expect(ids('room')).toContain('music-room');
  expect(ids('room', true)).not.toContain('music-room');
});

it('stars on Ctrl+D, and on Cmd+D on a Mac', () => {
  const key = {
    key: 'd',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  };
  expect(isStarKey({ ...key, ctrlKey: true }, false)).toBe(true);
  expect(isStarKey({ ...key, metaKey: true }, false)).toBe(false);
  expect(isStarKey({ ...key, metaKey: true }, true)).toBe(true);
  expect(isStarKey({ ...key, ctrlKey: true }, true)).toBe(false);
  expect(
    isStarKey({ ...key, key: 'D', ctrlKey: true, shiftKey: true }, false),
  ).toBe(false);
  expect(isStarKey(key, false)).toBe(false);
});
