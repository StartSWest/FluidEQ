/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  adoptApoFeatureText,
  describeApoFeatureText,
} from 'common/apoFeatureSync';
import {
  AutoEqFormat,
  FilterTypeEnum,
  IState,
  TApoFeature,
  getDefaultState,
} from 'common/constants';
import { fetchSettings, save, stateToApoFiles } from 'main/flush';

const FILTER = 'Filter 1: ON PK Fc 125 Hz Gain 2.34 dB Q 0.71';

const overrideFor = (state: IState, feature: TApoFeature) => {
  switch (feature) {
    case 'driver':
      return state.driver?.apoOverride;
    case 'headphone':
      return state.headphone?.apoOverride;
    case 'voicing':
      return state.voicing?.apoOverride;
    case 'smart':
      return state.smartEq?.apoOverride;
    case 'eq':
    default:
      return undefined;
  }
};

describe('live Equalizer APO feature-file adoption', () => {
  it('compares audible filters instead of comments, ids, or line order', () => {
    const reordered = [
      'Filter 2: ON HSC Fc 8000 Hz Gain -1.25 dB Q 0.8',
      FILTER,
    ].join('\n');
    const reformatted = [
      '# changed by a person',
      'Filter 99: ON PK Fc 125 Hz Gain 2.34 dB Q 0.71',
      'Filter 4: ON HS Fc 8000 Hz Gain -1.25 dB Q 0.8',
    ].join('\n');

    expect(describeApoFeatureText(reordered)).toBe(
      describeApoFeatureText(reformatted),
    );
    expect(describeApoFeatureText(FILTER)).not.toBe(
      describeApoFeatureText(FILTER.replace('2.34', '2.38')),
    );
  });

  it('replaces the main EQ with an external parametric file and clears attribution', () => {
    const state: IState = {
      ...getDefaultState(),
      headset: 'Old model',
      eqImport: {
        source: 'squiglink',
        sourceUrl: 'https://squig.link',
        label: 'Old import',
        eqFormat: AutoEqFormat.PARAMETRIC,
        filterCount: 1,
      },
    };

    expect(adoptApoFeatureText(state, 'eq', FILTER)).toEqual({
      changed: true,
      unsupported: 0,
    });
    expect(Object.values(state.filters)).toEqual([
      expect.objectContaining({
        frequency: 125,
        gain: 2.34,
        quality: 0.71,
        type: FilterTypeEnum.PK,
      }),
    ]);
    expect(state.eqImport).toBeUndefined();
    expect(state.isFlat).toBe(false);
  });

  it('keeps editable EQ bands but returns them to zero when the file is cleared', () => {
    const state = getDefaultState();
    const count = Object.keys(state.filters).length;
    Object.values(state.filters)[0].gain = 6;

    adoptApoFeatureText(state, 'eq', '# no filters remain');

    expect(Object.keys(state.filters)).toHaveLength(count);
    expect(Object.values(state.filters).every(({ gain }) => gain === 0)).toBe(
      true,
    );
    expect(state.isFlat).toBe(true);
  });

  it.each<TApoFeature>(['driver', 'headphone', 'voicing', 'smart'])(
    'keeps an external %s edit in that layer instead of flattening it into EQ',
    (feature) => {
      const state = getDefaultState();

      adoptApoFeatureText(state, feature, FILTER);

      const override = overrideFor(state, feature);
      expect(override).toBeDefined();
      expect(Object.values(override?.filters ?? {})).toEqual([
        expect.objectContaining({ frequency: 125, gain: 2.34 }),
      ]);
      expect(Object.values(state.filters).some(({ gain }) => gain !== 0)).toBe(
        false,
      );
    },
  );

  it('preserves a native GraphicEQ edit as a native curve', () => {
    const state = getDefaultState();

    adoptApoFeatureText(
      state,
      'voicing',
      'GraphicEQ: 20 -1.5; 1000 2.5; 20000 -0.5',
    );

    expect(state.voicing?.apoOverride?.graphicEq).toEqual([
      { frequency: 20, gain: -1.5 },
      { frequency: 1000, gain: 2.5 },
      { frequency: 20000, gain: -0.5 },
    ]);
    const written = stateToApoFiles(state)?.features.find(
      ({ feature }) => feature === 'voicing',
    );
    expect(written?.lines).toEqual([
      'GraphicEQ: 20 -1.5; 1000 2.5; 20000 -0.5',
    ]);
  });

  it('makes the canonical write compare equal, stopping the watcher loop', () => {
    const state = getDefaultState();
    adoptApoFeatureText(state, 'driver', FILTER);
    const written = stateToApoFiles(state)?.features.find(
      ({ feature }) => feature === 'driver',
    );

    expect(written).toBeDefined();
    expect(describeApoFeatureText(written?.lines.join('\n') ?? '')).toBe(
      describeApoFeatureText(FILTER),
    );
  });

  it('persists an adopted override across an app restart', () => {
    const settingsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fluideq-apo-sync-'),
    );
    try {
      const state = getDefaultState();
      adoptApoFeatureText(state, 'driver', FILTER);
      save(state, settingsDir);

      expect(fetchSettings(settingsDir).driver?.apoOverride).toEqual(
        state.driver?.apoOverride,
      );
    } finally {
      fs.rmSync(settingsDir, { recursive: true, force: true });
    }
  });

  it('refuses unsupported filters so a later write cannot erase them', () => {
    const state = getDefaultState();
    const before = state.driver;

    expect(
      adoptApoFeatureText(
        state,
        'driver',
        'Filter 1: ON AP Fc 1000 Hz Gain 0 dB Q 0.7',
      ),
    ).toEqual({ changed: false, unsupported: 1 });
    expect(state.driver).toBe(before);
  });
});
