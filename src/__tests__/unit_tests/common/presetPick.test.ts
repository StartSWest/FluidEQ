/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What putting a preset on does to an output, as every picker and the app's
 * core decide it: the rack, the Preset layer's curve, and the hold Equalizer
 * APO puts on a rack it cannot run — and what a switch of engine does to that
 * rack afterwards.
 */
import { DSP_DEFAULTS, IDspSettings } from 'common/dsp/chain';
import { DSP_PRESETS, dspPresetSettings } from 'common/dsp/presets';
import { dspPresetVoicing } from 'common/dsp/presetVoicing';
import {
  PRESET_ID_MAX,
  isPresetId,
  pickDspPreset,
  rackAtEngineSwitch,
} from 'common/dsp/presetPick';
import type { IUserDspPreset } from 'common/dsp/userPresets';
import type { IVoicingSettings } from 'common/constants';

const factory = (id: string): IDspSettings => {
  const settings = dspPresetSettings(id, DSP_DEFAULTS);
  if (!settings) {
    throw new Error(`${id} missing`);
  }
  return settings;
};
const curveOf = (id: string) => {
  const curve = DSP_PRESETS.find((preset) => preset.id === id)?.curve;
  if (!curve) {
    throw new Error(`${id} has no curve`);
  }
  return curve;
};

const OFF = { ...DSP_DEFAULTS, enabled: false };
const GAMING = factory('gaming');
const PLAYING_GAMING: IVoicingSettings = {
  profileId: 'dsp:gaming',
  intensity: 1,
};

const pick = (
  id: string,
  over: Partial<Parameters<typeof pickDspPreset>[0]> = {},
) =>
  pickDspPreset({
    id,
    rack: OFF,
    voicing: undefined,
    saved: [],
    engine: 'fluid',
    quick: true,
    ...over,
  });

describe('a pick', () => {
  it('puts the preset’s rack on and its curve in the Preset layer', () => {
    const picked = pick('gaming');
    expect(picked?.rack).toMatchObject({
      enabled: true,
      presetId: 'gaming',
      gameMode: true,
    });
    expect(picked?.voicing).toEqual(
      dspPresetVoicing('gaming', curveOf('gaming')),
    );
    expect(picked?.heldForApo).toBeUndefined();
  });

  it('under Equalizer APO, keeps a quick pick’s rack and Game mode off, holds its preset, and still plays its curve', () => {
    const picked = pick('gaming', { engine: 'apo' });
    expect(picked?.rack).toMatchObject({
      presetId: 'gaming',
      enabled: false,
      gameMode: false,
    });
    expect(picked?.heldForApo).toBe('gaming');
    expect(picked?.voicing?.profileId).toBe('dsp:gaming');
  });

  it('under Equalizer APO, the DSP page’s own pick sets the rack anyway: there it is the Library player’s', () => {
    const picked = pick('gaming', { engine: 'apo', quick: false });
    expect(picked?.rack).toMatchObject({ enabled: true, presetId: 'gaming' });
    expect(picked?.heldForApo).toBeUndefined();
  });

  /*
   * None here is None on the DSP page too (Ivan, 2026-09-22): the None chain
   * on the rack, so that page's picker names it rather than the chain that
   * was taken away, and the rack off, because an empty rack still delays the
   * sound.
   */
  it('None puts the None chain on with the rack and Game mode off, keeping the listener’s own', () => {
    const music = factory('music');
    const none = factory('empty');
    const picked = pick('none', {
      rack: { ...music, gameMode: true, surround: { allChannels: false } },
      voicing: { profileId: 'dsp:music', intensity: 1 },
      engine: 'apo',
    });
    expect(picked?.rack).toEqual({
      ...none,
      enabled: false,
      gameMode: false,
      surround: { allChannels: false },
    });
    // None is never held for the FluidEQ Engine, and takes the curve away.
    expect(picked?.heldForApo).toBeUndefined();
    expect(picked?.voicing).toEqual({ profileId: '', intensity: 1 });
    // POSITIVE CONTROL: Music's stages were on, there to be taken away.
    expect(music.dimension.enabled && music.maximizer.enabled).toBe(true);
  });

  it('replaces a voicing that is not a preset’s with the preset’s curve', () => {
    const picked = pick('gaming', {
      voicing: { profileId: 'games', intensity: 0.4 },
    });
    expect(picked?.voicing?.profileId).toBe('dsp:gaming');
  });

  it('takes away any voicing, an edit of Equalizer APO’s too, for a preset with no curve, and leaves none alone', () => {
    const plain = DSP_PRESETS.find(
      (preset) => preset.curve === undefined && preset.id !== 'empty',
    );
    if (!plain) {
      throw new Error('Every preset has a curve');
    }
    const edited: IVoicingSettings = {
      profileId: '',
      intensity: 1,
      apoOverride: { filters: {} },
    };
    expect(pick(plain.id, { voicing: edited })?.voicing).toEqual({
      profileId: '',
      intensity: 1,
    });
    expect(pick(plain.id)?.voicing).toBeUndefined();
  });

  it('puts on a saved chain with its own curve, and the listener’s crossfade, surround and Treble', () => {
    const music = factory('music');
    const saved: IUserDspPreset = {
      id: 'user-chain:mine',
      name: 'Mine',
      settings: { ...music, gameMode: true },
      curve: curveOf('metal'),
    };
    const rack = {
      ...OFF,
      surround: { allChannels: false },
      eq: { ...OFF.eq, treble: 'classic' as const },
    };
    const picked = pick(saved.id, { saved: [saved], rack });
    expect(picked?.rack).toMatchObject({
      enabled: true,
      presetId: saved.id,
      gameMode: true,
      surround: { allChannels: false },
      crossfade: rack.crossfade,
    });
    expect(picked?.rack.eq.treble).toBe('classic');
    expect(picked?.voicing).toEqual(
      dspPresetVoicing(saved.id, curveOf('metal')),
    );
  });

  /**
   * The surround switch and the crossfade belong to the machine, not to a
   * recipe: every recipe is built from the defaults, where the rack runs on
   * all channels and the crossfade is off, so without this a preset — the
   * rack's Reset to Default among them — flipped both back.
   */
  it.each(['rock', 'balanced'])(
    'keeps the listener’s surround switch and crossfade through %s',
    (id) => {
      const rack = {
        ...OFF,
        surround: { allChannels: false },
        crossfade: {
          ...OFF.crossfade,
          enabled: true,
          durationMs: 7_250,
          curve: 'smooth' as const,
        },
      };
      const picked = pick(id, { rack, quick: false });
      expect(picked?.rack.surround).toEqual({ allChannels: false });
      expect(picked?.rack.crossfade).toEqual(rack.crossfade);
      // POSITIVE CONTROL: the rest is the preset's own, and on.
      expect(picked?.rack).toMatchObject({ presetId: id, enabled: true });
    },
  );

  it('is nothing for a saved chain deleted since', () => {
    expect(pick('user-chain:gone')).toBeUndefined();
  });
});

describe('the playing rack at a switch of engine', () => {
  const at = (
    engine: 'apo' | 'fluid',
    rack: IDspSettings,
    voicing: IVoicingSettings | undefined,
    held?: string,
  ) => rackAtEngineSwitch({ engine, rack, voicing, held, saved: [] });

  it('holds a picked preset’s rack off at a switch to APO, and puts it back whole at the switch home', () => {
    const away = at('apo', GAMING, PLAYING_GAMING);
    expect(away.rack).toMatchObject({
      presetId: 'gaming',
      enabled: false,
      gameMode: false,
    });
    expect(away.heldForApo).toBe('gaming');

    const home = at('fluid', away.rack, PLAYING_GAMING, away.heldForApo);
    // The whole rack again, Game mode and all.
    expect(home.rack).toEqual(GAMING);
    expect(home.heldForApo).toBeUndefined();
  });

  it('leaves a rack switched off by hand off through both switches', () => {
    const offByHand = { ...GAMING, enabled: false };
    const away = at('apo', offByHand, PLAYING_GAMING);
    expect(away.rack).toBe(offByHand);
    expect(away.heldForApo).toBeUndefined();
    expect(at('fluid', away.rack, PLAYING_GAMING).rack.enabled).toBe(false);
  });

  it.each([
    ['a voicing of its own', { profileId: 'music', intensity: 1 }],
    ['another preset’s curve', { profileId: 'dsp:music', intensity: 1 }],
  ])(
    'leaves a rack alone at a switch to APO when the curve playing is not its preset but %s',
    (_what, voicing) => {
      const away = at('apo', GAMING, voicing);
      expect(away.rack).toBe(GAMING);
      expect(away.heldForApo).toBeUndefined();
    },
  );

  it('keeps a hold it did not make at a switch to APO', () => {
    expect(at('apo', OFF, undefined, 'movie').heldForApo).toBe('movie');
  });

  it('puts a held rack back only for the preset it held, and the switch home ends the hold either way', () => {
    const home = at(
      'fluid',
      { ...GAMING, enabled: false },
      PLAYING_GAMING,
      'movie',
    );
    expect(home.rack.enabled).toBe(false);
    expect(home.heldForApo).toBeUndefined();
  });

  /*
   * Switched back on by hand under APO — for the Library player — and tuned
   * there: the switch home keeps it as it is rather than putting the preset
   * back over the listener's own changes.
   */
  it('keeps a held preset’s rack switched back on by hand as it is', () => {
    const tuned = {
      ...GAMING,
      maximizer: { ...GAMING.maximizer, enabled: !GAMING.maximizer.enabled },
    };
    const home = at('fluid', tuned, PLAYING_GAMING, 'gaming');
    expect(home.rack).toBe(tuned);
    expect(home.heldForApo).toBeUndefined();
  });
});

describe('a preset id from outside the core', () => {
  it('is some text no longer than the Preset layer can be named', () => {
    expect(isPresetId('gaming')).toBe(true);
    expect(isPresetId('x'.repeat(PRESET_ID_MAX))).toBe(true);
    expect(isPresetId('x'.repeat(PRESET_ID_MAX + 1))).toBe(false);
    expect(isPresetId('')).toBe(false);
    expect(isPresetId(7)).toBe(false);
  });
});
