/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Both bass catalogues, held to what they actually ship.
 *
 * A shipped preset that gets clamped on load does not sound like its own
 * name, and it fails silently — the picker still shows the name, the numbers
 * underneath have quietly changed. `dspProcessorPresets.test.ts` holds the
 * Exciter, Maximizer and Dimension catalogues to the same standard; this is
 * that test for the two stages this feature added.
 */
import { DSP_DEFAULTS, clampDspSettings } from '../../../common/dsp/chain';
import {
  BASS_FORGE_PRESET_BY_ID,
  BASS_FORGE_PRESETS,
  IBassForgePresetSettings,
  bassForgePresetSettings,
  isBassForgePresetId,
} from '../../../common/dsp/bassForgePresets';
import {
  BASS_PUNCH_PRESET_BY_ID,
  BASS_PUNCH_PRESETS,
  bassPunchPresetSettings,
  isBassPunchPresetId,
} from '../../../common/dsp/bassPunchPresets';
import { GENRE_RACKS } from '../../../common/dsp/genres';
import { inGenreChain } from '../../../common/dsp/genreRack';
import {
  BASS_FORGE_CATALOGUE,
  BASS_PUNCH_CATALOGUE,
} from '../../../common/dsp/stageCatalogues';

describe('bass forge profiles', () => {
  it('every one survives the engine clamp unchanged', () => {
    BASS_FORGE_PRESETS.forEach((preset) => {
      expect(isBassForgePresetId(preset.id)).toBe(true);
      const live = bassForgePresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        bassForge: live,
      }).bassForge;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  /**
   * That speaker radiates nothing at the octave below at any drive level, so
   * headroom spent on a real sub there buys nothing — the whole effect has to
   * come from the harmonics of the octave instead.
   */
  it('laptop leans on presence rather than a sub it cannot play', () => {
    expect(BASS_FORGE_PRESET_BY_ID.laptop.settings.subAmount).toBe(0);
    expect(
      BASS_FORGE_PRESET_BY_ID.laptop.settings.presenceAmount,
    ).toBeGreaterThan(0.5);
  });

  /**
   * A cabin lifts the note itself, so an octave below it lands in that lift,
   * and the grit Drive added came with no reason given for it: what carries
   * the bass over road noise is its harmonics, and that is all this makes.
   */
  it('car builds the harmonics and neither an octave below nor grit', () => {
    const car = BASS_FORGE_PRESET_BY_ID.car.settings;
    expect(car.subAmount).toBe(0);
    expect(car.driveDb).toBe(0);
    expect(car.presenceAmount).toBeGreaterThan(0.5);
  });

  /**
   * Forge's octave divider leaves the note's fifth beside the octave, and its
   * presence is a harmonic generator: 13 to 16% of a 60 Hz note in the ten
   * genres that played it (2026-09-23), whose research says their records
   * carry their own sub and saturation. So a genre chain plays Forge only
   * where its research asks for generated bass — Trap's overtones for small
   * speakers — and makes no octave even there; every other genre offers its
   * profile under its name and leaves it off.
   */
  it('plays Forge in no genre chain but Trap, and no octave there', () => {
    const playing = GENRE_RACKS.filter((rack) =>
      inGenreChain(rack, 'bassForge'),
    );
    expect(playing.map((rack) => rack.id)).toEqual(['trap']);
    playing.forEach((rack) => {
      expect({ id: rack.id, octave: rack.bassForge?.subAmount }).toEqual({
        id: rack.id,
        octave: 0,
      });
    });
    // Positive control: the profiles left off are still offered.
    const offered = GENRE_RACKS.filter(
      (rack) =>
        rack.bassForge !== undefined && !inGenreChain(rack, 'bassForge'),
    );
    expect(offered.length).toBeGreaterThanOrEqual(10);
  });

  /**
   * No profile may be quiet enough to be indistinguishable from bypass.
   *
   * Both amounts are multiplied by `mix` before they reach the band, so depth
   * is their sum against it and not either one alone — which is how `subtle`
   * and `dry` came to ship at 0.09 by this measure. Measured through the
   * engine's own Isolate against a 55 Hz bass note, that was a contribution
   * 30 dB under the programme: below where anything can be told from nothing,
   * on a stage whose whole difficulty is that it changes timbre rather than
   * level. The floor here is 0.2, which the quietest two now clear at 0.22 and
   * measure at -22 dB — quiet, which is what they are named for, but present.
   *
   * A proxy rather than the measurement: the dB figure needs the C++ engine,
   * and `bassForgePresets.ts` carries the whole table it was solved against.
   */
  it('ships no profile that cannot be told apart from bypass', () => {
    BASS_FORGE_PRESETS.forEach((preset) => {
      const { subAmount, presenceAmount, mix } = preset.settings;
      const depth = (subAmount + presenceAmount) * mix;
      expect({ id: preset.id, tooQuiet: depth < 0.2 }).toEqual({
        id: preset.id,
        tooQuiet: false,
      });
    });
  });

  /**
   * The ordering claims the profiles make, over everything the picker lists.
   *
   * `laptop` says it pushes presence hardest of anything in the catalogue,
   * which is the reason it exists and one careless edit from becoming false
   * while its comment still asserts it. And no genre's own profile carries
   * more real sub than the stage's deepest table profile: the genre research
   * advises against synthesising sub under records that already have their
   * own (`genres/*.ts`), so the deepest octave is somebody's deliberate pick,
   * never a genre's default. Dub's profile made that claim once, from the
   * table; it is Dub's rack's now, and no deeper than the table's.
   */
  it('keeps laptop the deepest phantom and no genre deeper than the table', () => {
    const { profiles } = BASS_FORGE_CATALOGUE;
    const highest = (pick: (of: IBassForgePresetSettings) => number) =>
      profiles.reduce((best, preset) =>
        pick(preset.settings) > pick(best.settings) ? preset : best,
      ).id;
    expect(highest((of) => of.presenceAmount)).toBe('laptop');
    const deepestTable = Math.max(
      ...BASS_FORGE_PRESETS.map((preset) => preset.settings.subAmount),
    );
    const genres = profiles.filter(
      (preset) => !BASS_FORGE_PRESETS.includes(preset),
    );
    // Positive control: the genres are in the list this reads.
    expect(genres.length).toBeGreaterThan(0);
    genres.forEach((preset) => {
      expect({
        id: preset.id,
        deeper: preset.settings.subAmount > deepestTable,
      }).toEqual({ id: preset.id, deeper: false });
    });
  });

  /**
   * The positive control. An empty diff above is also what a broken catalogue
   * returns if every profile were quietly identical to the defaults, so this
   * proves `hot` is a different shape from `solid` rather than the same
   * numbers scaled up.
   */
  it('POSITIVE CONTROL: hot is a different shape from solid, not louder', () => {
    const solid = BASS_FORGE_PRESET_BY_ID.solid.settings;
    const hot = BASS_FORGE_PRESET_BY_ID.hot.settings;
    expect(hot.driveDb).toBeGreaterThan(solid.driveDb);
    expect(hot.texture).toBeLessThan(solid.texture);
    expect(hot.subAmount).toBeLessThan(solid.subAmount);
  });
});

describe('bass punch profiles', () => {
  it.each([0, 0.5, 1, 1.5, 2])(
    'preserves Mix %s for every shipped profile',
    (mix) => {
      // The table's own twelve, and one per genre rack with a Punch profile
      // of its own: every profile the picker lists.
      const genreProfiles = GENRE_RACKS.filter(
        (rack) => rack.bassPunch !== undefined,
      ).length;
      expect(BASS_PUNCH_PRESETS).toHaveLength(12);
      expect(genreProfiles).toBeGreaterThan(0);
      expect(BASS_PUNCH_CATALOGUE.profiles).toHaveLength(12 + genreProfiles);
      BASS_PUNCH_CATALOGUE.profiles.forEach((preset) => {
        expect(preset.settings.mix).toBe(1);
        const bassPunch = {
          ...DSP_DEFAULTS.bassPunch,
          ...preset.settings,
          mix,
        };
        expect(
          clampDspSettings({ ...DSP_DEFAULTS, bassPunch }).bassPunch,
        ).toEqual(bassPunch);
      });
    },
  );

  it('loads old saved profiles at full Mix and bounds malformed values', () => {
    const { mix: _mix, ...old } = DSP_DEFAULTS.bassPunch;
    expect(clampDspSettings({ bassPunch: old }).bassPunch.mix).toBe(1);
    [
      [-1, 0],
      [3, 2],
      [NaN, 1],
      [Infinity, 1],
    ].forEach(([mix, expected]) => {
      expect(
        clampDspSettings({ bassPunch: { ...old, mix } }).bassPunch.mix,
      ).toBe(expected);
    });
  });

  it('keeps hit-focused profiles dry and limits the Hip Hop and Club tails', () => {
    (['default', 'tight', 'punch', 'slam'] as const).forEach((id) => {
      const profile = BASS_PUNCH_PRESET_BY_ID[id].settings;
      expect(profile.attack).toBeGreaterThanOrEqual(0.5);
      expect(profile.sustain).toBeLessThan(0);
      expect(profile.bloomAmount).toBe(0);
    });
    // Hip Hop's is a genre's own profile now (`genres/urban.ts`), listed
    // in the picker with the table's.
    ['hiphop', 'club'].forEach((id) => {
      const profile = BASS_PUNCH_CATALOGUE.profiles.find(
        (one) => one.id === id,
      )?.settings;
      expect(profile?.bloomAmount).toBeGreaterThan(0);
      expect(profile?.bloomAmount).toBeLessThanOrEqual(0.15);
      expect(profile?.bloomDecayMs).toBeLessThanOrEqual(100);
    });
  });

  it('every one survives the engine clamp unchanged', () => {
    BASS_PUNCH_PRESETS.forEach((preset) => {
      expect(isBassPunchPresetId(preset.id)).toBe(true);
      const live = bassPunchPresetSettings(preset.id as never, true);
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        bassPunch: live,
      }).bassPunch;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  /** A long decay is what wakes the room next door. */
  it('lateNight has no bloom', () => {
    expect(BASS_PUNCH_PRESET_BY_ID.lateNight.settings.bloomAmount).toBe(0);
  });

  it('dry is negative sustain with no bloom; wet is positive with real bloom', () => {
    expect(BASS_PUNCH_PRESET_BY_ID.dry.settings.sustain).toBeLessThan(0);
    expect(BASS_PUNCH_PRESET_BY_ID.dry.settings.bloomAmount).toBe(0);
    expect(BASS_PUNCH_PRESET_BY_ID.wet.settings.sustain).toBeGreaterThan(0);
    expect(BASS_PUNCH_PRESET_BY_ID.wet.settings.bloomAmount).toBeGreaterThan(0);
  });
});
