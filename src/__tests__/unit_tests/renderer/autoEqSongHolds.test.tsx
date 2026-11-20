/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { FilterTypeEnum } from 'common/constants';
import { DSP_PRESETS } from 'common/dsp/presets';
import { type Translate, translate } from 'common/i18n';
import type { ISongSound } from 'common/songSound';
import {
  dspPresetName,
  resolveDspPresetCurve,
} from 'renderer/dsp/dspPresetCatalog';
import AutoEqSongHolds from 'renderer/eq/autoEq/AutoEqSongHolds';

/**
 * What a song's saved sound holds, as Auto EQ's panel lists it (Ivan,
 * 2026-11-20: "we can show what is recorded for the song, eq, tone, curves"):
 * the preset, Your EQ's bands, the Tone and the preset's curve.
 */

const band = (id: string, gain: number, isEnabled = true) => ({
  id,
  frequency: 1000,
  gain,
  quality: 1,
  type: FilterTypeEnum.PK,
  ...(isEnabled ? {} : { isEnabled: false }),
});
const en: Translate = (key, values) => translate('en', key, values);

it('lists the Tone dial by dial, signed, and counts only the bands that play', () => {
  const sound: ISongSound = {
    presetId: 'none',
    tone: { bass: 3, mid: 0, treble: -2.5 },
    filters: { a: band('a', 4), b: band('b', -2), c: band('c', 6, false) },
  };
  render(<AutoEqSongHolds sound={sound} />);

  expect(screen.getByText('Bass +3 · Mid 0 · Treble −2.5')).toBeVisible();
  expect(
    screen.getByText(en('autoEq.holds.bands', { count: 2 })),
  ).toBeVisible();
  // None is no preset, and has no curve.
  expect(screen.getAllByText(en('autoEq.holds.none'))).toHaveLength(2);
  expect(screen.getByText(en('autoEq.holds.correction'))).toBeVisible();
});

it('reads a Tone at zero, or none, as Flat, and one band as one band', () => {
  const flat: ISongSound = {
    presetId: 'none',
    tone: { bass: 0, mid: 0, treble: 0 },
    filters: { a: band('a', 2) },
  };
  const { rerender } = render(<AutoEqSongHolds sound={flat} />);
  expect(screen.getByText(en('autoEq.holds.flat'))).toBeVisible();
  expect(screen.getByText(en('autoEq.holds.bandsOne'))).toBeVisible();

  rerender(
    <AutoEqSongHolds sound={{ presetId: 'none', filters: flat.filters }} />,
  );
  expect(screen.getByText(en('autoEq.holds.flat'))).toBeVisible();
});

it('names a preset and its curve', () => {
  const withCurve = DSP_PRESETS.find(
    (preset) => resolveDspPresetCurve(preset.id) !== undefined,
  );
  if (!withCurve) {
    throw new Error('no factory preset carries a curve');
  }
  const name = dspPresetName(withCurve, en);
  render(
    <AutoEqSongHolds
      sound={{ presetId: withCurve.id, filters: { a: band('a', 2) } }}
    />,
  );
  expect(screen.getByText(name)).toBeVisible();
  expect(
    screen.getByText(en('autoEq.holds.curve', { preset: name })),
  ).toBeVisible();
});
