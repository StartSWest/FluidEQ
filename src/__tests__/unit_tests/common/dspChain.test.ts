/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  EQ_MAX_BAND_COUNT,
  EQ_RACK_SIZES,
  IDspSettings,
  buildEqRack,
  clampDspSettings,
} from '../../../common/dsp/chain';
import { GENRE_CHAIN_STAGES } from '../../../common/dsp/genreChains';
import { maximizerPresetSettings } from '../../../common/dsp/maximizerPresets';
import { DSP_PRESETS, dspPresetSettings } from '../../../common/dsp/presets';
import { roomPresetSettings } from '../../../common/dsp/roomPresets';

describe('dsp chain settings', () => {
  it('defaults to every module bypassed', () => {
    expect(DSP_DEFAULTS.enabled).toBe(true);
    expect(DSP_DEFAULTS.exciter.enabled).toBe(false);
    expect(DSP_DEFAULTS.maximizer.enabled).toBe(false);
  });

  it('root bypass preserves every nested processor setting', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      enabled: false,
      eq: { ...DSP_DEFAULTS.eq, enabled: true },
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true },
    });
    expect(clamped.enabled).toBe(false);
    expect(clamped.eq.enabled).toBe(true);
    expect(clamped.exciter.enabled).toBe(true);
  });

  it('migrates settings written before root bypass to enabled', () => {
    const { enabled: _removed, ...legacy } = DSP_DEFAULTS;
    expect(clampDspSettings(legacy).enabled).toBe(true);
  });

  it('clamps out-of-range values rather than rejecting them', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: {
        ...DSP_DEFAULTS.exciter,
        bands: [
          { ...DSP_DEFAULTS.exciter.bands[0], drive: 999 },
          ...DSP_DEFAULTS.exciter.bands.slice(1),
        ],
      },
    });
    // 3.5, because that is where the curve stops being a colour and starts
    // being a clipper. It used to stop at 10, and everything above about 3.5
    // was intermodulation rather than harmonics — so two thirds of the dial
    // made distortion, and anybody turning it up to hear what it did found
    // exactly that.
    expect(clamped.exciter.bands[0].drive).toBe(3.5);
  });

  it('replaces an unreadable blob with the defaults', () => {
    expect(clampDspSettings('nonsense')).toEqual(DSP_DEFAULTS);
  });

  /**
   * One bad field costs one field.
   *
   * The wholesale version of this — reject the object, return the defaults —
   * looks safer and is worse: a preset written by a later build carrying a
   * single value this build has never heard of would silently reset every
   * other setting the user had made.
   */
  it('keeps the readable fields when one of them is not', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      maximizer: {
        ...DSP_DEFAULTS.maximizer,
        enabled: true,
        ceilingDb: 'loud',
      },
    });
    expect(clamped.maximizer.enabled).toBe(true);
    expect(clamped.maximizer.ceilingDb).toBe(DSP_DEFAULTS.maximizer.ceilingDb);
  });

  it('round-trips through JSON unchanged', () => {
    const parsed: IDspSettings = clampDspSettings(
      JSON.parse(JSON.stringify(DSP_DEFAULTS)),
    );
    expect(parsed).toEqual(DSP_DEFAULTS);
  });

  it('ships presets that all survive clamping unchanged', () => {
    DSP_PRESETS.forEach((preset) => {
      expect(clampDspSettings(preset.settings)).toEqual(preset.settings);
    });
  });

  it('ships the complete, uniquely named DSP preset catalog', () => {
    expect(DSP_PRESETS).toHaveLength(106);
    expect(new Set(DSP_PRESETS.map((preset) => preset.id)).size).toBe(
      DSP_PRESETS.length,
    );
    // Uniquely named on the page as well: a copy with the Room shares its
    // chain's label and is told apart by what follows it — the Room's title,
    // or the room itself where a chain has a second copy.
    expect(
      new Set(
        DSP_PRESETS.map(
          (preset) => `${preset.labelKey}|${preset.copyLabelKey}`,
        ),
      ).size,
    ).toBe(DSP_PRESETS.length);
    DSP_PRESETS.forEach((preset) => {
      expect(preset.settings.presetId).toBe(preset.id);
    });
  });

  /**
   * A style's stages are looked up by a plain string, and a misspelled one
   * fails the quiet way: that style keeps shipping as its curve alone — a
   * chain that sounds thinner than every one beside it, with nothing
   * anywhere saying why. The profile ids inside each row are typed and
   * cannot rot; the key is what needs watching.
   */
  it('names a real style in every row of the genre stage table', () => {
    const chains = new Set(DSP_PRESETS.map((preset) => preset.id));
    const unknown = Object.keys(GENRE_CHAIN_STAGES).filter(
      (style) => !chains.has(style),
    );
    expect(unknown).toEqual([]);
    Object.entries(GENRE_CHAIN_STAGES).forEach(([style, stages]) => {
      const chain = DSP_PRESETS.find((preset) => preset.id === style);
      expect({ style, group: chain?.group }).toEqual({
        style,
        group: 'genre',
      });
      // And the row reached the rack: whatever it names is switched on.
      expect({ style, on: chain?.settings.dimension.enabled ?? false }).toEqual(
        { style, on: stages?.dimension !== undefined },
      );
      expect({ style, on: chain?.settings.maximizer.enabled ?? false }).toEqual(
        { style, on: stages?.maximizer !== undefined },
      );
    });
  });

  it('never loads an audition-only isolate state', () => {
    DSP_PRESETS.forEach((preset) => {
      expect({
        id: preset.id,
        denoise: preset.settings.denoise.isolate,
        eq: preset.settings.eq.isolate,
        exciter: preset.settings.exciter.isolate,
        bassForge: preset.settings.bassForge.isolate,
        bassPunch: preset.settings.bassPunch.isolate,
      }).toEqual({
        id: preset.id,
        denoise: false,
        eq: false,
        exciter: false,
        bassForge: false,
        bassPunch: false,
      });
    });
  });

  /** Cleanup is source repair; ordinary voicings must leave clean audio alone. */
  it('uses Denoise only in explicitly repaired chains', () => {
    DSP_PRESETS.forEach((preset) => {
      expect(preset.settings.denoise.enabled).toBe(
        preset.group === 'repair' &&
          ['vinyl-restore', 'tape-restore', 'podcast', 'audiobook'].includes(
            preset.id,
          ),
      );
    });
  });

  it('does not stack two loudness drivers in one chain', () => {
    DSP_PRESETS.forEach((preset) => {
      const drivenMaximizer =
        preset.settings.maximizer.enabled &&
        preset.settings.maximizer.driveDb > 0;
      expect({
        id: preset.id,
        doubleDriven:
          drivenMaximizer && preset.settings.master.loudnessMaximize,
      }).toEqual({ id: preset.id, doubleDriven: false });
    });
  });

  /**
   * One stage owns the bottom octave, and the Exciter works above it.
   *
   * Bass Forge and Bass Punch both shape the same band — one generates
   * harmonics under the bass, the other re-times its hit — and together they
   * were the overdone low end reported in listening, so a chain has one or
   * neither. An Exciter may sit beside either (Ivan, 2026-09-19: "bass punch
   * or forge and exciter, only if clean"), and what makes that clean is that
   * the two never touch the same octave: the Exciter's low band, which adds
   * harmonics at 20-300 Hz, is off in any chain that also runs a bass stage.
   */
  it('lets one stage own the bass, and keeps the Exciter above it', () => {
    DSP_PRESETS.forEach((preset) => {
      const { exciter, bassForge, bassPunch } = preset.settings;
      expect({
        id: preset.id,
        bothBassStages: bassForge.enabled && bassPunch.enabled,
      }).toEqual({ id: preset.id, bothBassStages: false });
      const bassStage = bassForge.enabled || bassPunch.enabled;
      expect({
        id: preset.id,
        exciterInTheBass:
          bassStage && exciter.enabled && exciter.bands[0].enabled,
      }).toEqual({ id: preset.id, exciterInTheBass: false });
    });
  });

  /**
   * Six at most: tone, harmonics above the bass, the bass, glue, width and a
   * ceiling — each stage with its own job. Past that a chain is two stages
   * doing one job, which is what the catalogue measured before 2026-09-19.
   */
  it('keeps every chain to six intentional processors or fewer', () => {
    DSP_PRESETS.forEach((preset) => {
      const stages = [
        preset.settings.denoise.enabled,
        // The tone is one job wherever it plays: its curve in the main EQ,
        // and whatever of the rack's EQ stays on to support it.
        preset.settings.eq.enabled || preset.curve !== undefined,
        preset.settings.exciter.enabled,
        preset.settings.bassForge.enabled,
        preset.settings.bassPunch.enabled,
        preset.settings.dimension.enabled,
        preset.settings.maximizer.enabled,
        preset.settings.master.enabled,
      ].filter(Boolean).length;
      expect({ id: preset.id, tooMany: stages > 6 }).toEqual({
        id: preset.id,
        tooMany: false,
      });
    });
  });

  it('keeps Default free of fuzz and harmonic generators', () => {
    const balanced = DSP_PRESETS.find((preset) => preset.id === 'balanced');
    /**
     * A curve, but a quiet one, and no generator behind it.
     *
     * Flat until 2026-09-19, which made the default profile measure as doing
     * nothing at all outside the Library — the Master's loudness makeup is
     * zero system-wide and there was nothing else in the chain. What it must
     * not have is anything that invents harmonics, which is what turns a
     * default into a colour nobody asked for.
     */
    expect(balanced?.curve?.presetId).toBe('balanced');
    expect(balanced?.settings.eq.fuzzAmount).toBe(0);
    expect(balanced?.settings.exciter.enabled).toBe(false);
    expect(balanced?.settings.bassForge.enabled).toBe(false);
  });

  it('gives Punch one transient character stage instead of stacking them', () => {
    const punch = DSP_PRESETS.find((preset) => preset.id === 'punch');
    /**
     * Its EQ shapes the room around the hit and never the hit itself.
     *
     * Flat until 2026-09-19, which is why the chain measured as no punch at
     * all — nothing made the kick READ. What it must not do is lift the band
     * Bass Punch is working in: raising everything the hit stands out from is
     * the stacking this whole chain was rebuilt to stop.
     */
    expect(punch?.curve?.presetId).toBe('punch');
    const deepest = punch?.curve?.bands.slice(0, 3) ?? [];
    expect(deepest.map((band) => band.frequency)).toEqual([32, 50, 80]);
    expect(Math.max(...deepest.map((band) => band.gainDb))).toBeLessThanOrEqual(
      1.5,
    );
    expect(punch?.settings.bassForge.enabled).toBe(false);
    expect(punch?.settings.bassPunch.presetId).toBe('punch');
    expect(punch?.settings.maximizer).toEqual({
      ...maximizerPresetSettings('transparent', true),
      presetId: '',
      driveDb: 0,
    });
  });

  it('keeps Warm tonal instead of stacking harmonic generators', () => {
    const warm = DSP_PRESETS.find((preset) => preset.id === 'warm');
    expect(warm?.curve?.presetId).toBe('warm');
    expect(warm?.settings.eq.fuzzAmount).toBe(0);
    expect(warm?.settings.exciter.enabled).toBe(false);
    expect(warm?.settings.bassForge.enabled).toBe(false);
  });

  it('keeps Expansive to clean EQ and one controlled width stage', () => {
    const expansive = DSP_PRESETS.find((preset) => preset.id === 'expansive');
    expect(expansive?.curve?.presetId).toBe('ambient');
    expect(expansive?.settings.exciter.enabled).toBe(false);
    expect(expansive?.settings.dimension.presetId).toBe('expansive');
    expect(expansive?.settings.dimension.decorrelation).toBeLessThan(0.5);
    expect(expansive?.settings.maximizer.enabled).toBe(false);
  });

  it('uses Master only where a delivery target owns the final level', () => {
    const mastered = DSP_PRESETS.filter(
      (preset) => preset.settings.master.enabled,
    );
    /**
     * The spoken-word three joined the list on 2026-09-20, and they belong:
     * a podcast, an audiobook and whatever else is being listened to for the
     * words arrive at a different level from every other one, and the
     * listener cannot ride the volume through a car journey. A limiter
     * cannot fix that — only a target can.
     */
    expect(mastered.map((preset) => preset.id)).toEqual([
      'balanced',
      'reference',
      'speech',
      'vinyl-restore',
      'tape-restore',
      'podcast',
      'audiobook',
    ]);
    mastered.forEach((preset) => {
      expect(preset.settings.maximizer.enabled).toBe(false);
    });
    /**
     * Everything else ends in a ceiling, and the handful that do not are
     * named here rather than counted.
     *
     * A chain with no final stage at all can be pushed past full scale by its
     * own curve, and nothing is left to catch it. These five are deliberate:
     * None is nothing at all, Expansive and Lo-fi add no level to catch,
     * World is the plainest row in the catalogue, and Gaming gives up every
     * millisecond a look-ahead would cost. Its two Room copies do not: a
     * room leaves a full-scale record over full scale, so they carry the
     * `safety` ceiling as Music's Room copy does.
     */
    const open = DSP_PRESETS.filter(
      (preset) =>
        !preset.settings.maximizer.enabled && !preset.settings.master.enabled,
    ).map((preset) => preset.id);
    expect(open).toEqual(['empty', 'expansive', 'lofi', 'world', 'gaming']);
  });

  it('does not replace a named final profile with a generic Maximizer', () => {
    const expected = {
      'late-night': 'lateNight',
      pop: 'pop',
      rock: 'rock',
      hiphop: 'hiphop',
      electronic: 'electronic',
      jazz: 'jazz',
      classical: 'classical',
      acoustic: 'acoustic',
      metal: 'metal',
      reggae: 'reggae',
      movie: 'movie',
    } as const;
    Object.entries(expected).forEach(([chainId, maximizerId]) => {
      const chain = DSP_PRESETS.find((preset) => preset.id === chainId);
      expect({
        chainId,
        maximizerId: chain?.settings.maximizer.presetId,
      }).toEqual({ chainId, maximizerId });
    });
  });

  /**
   * A chain that calibrates a shared limiter keeps its timing and its ceiling
   * and only ever drives it LESS.
   *
   * The drive itself is a measured number — every chain in the catalogue is
   * levelled against DSP Off — so it is not written down twice; what is held
   * here is that calibrating a level cannot quietly change the limiter's
   * character, and cannot turn a shared profile into a louder one.
   */
  it.each([
    ['punch', 'transparent'],
    ['drum-bass', 'default'],
  ] as const)(
    '%s preserves limiter timing and ceiling with reduced drive',
    (id, profile) => {
      const chain = DSP_PRESETS.find((preset) => preset.id === id);
      const named = maximizerPresetSettings(profile, true);
      expect(chain?.settings.maximizer).toEqual({
        ...named,
        presetId: '',
        driveDb: chain?.settings.maximizer.driveDb,
      });
      expect(chain?.settings.maximizer.driveDb).toBeLessThanOrEqual(
        named.driveDb,
      );
    },
  );

  it('uses the purpose-built D&B transient profile', () => {
    const drumBass = DSP_PRESETS.find((preset) => preset.id === 'drum-bass');
    expect(drumBass?.settings.bassForge.enabled).toBe(false);
    expect(drumBass?.settings.bassPunch.presetId).toBe('dnb');
  });

  it('gain-matches Reference, and no other whole-chain preset', () => {
    DSP_PRESETS.forEach((preset) => {
      expect({
        id: preset.id,
        gainMatched: preset.settings.master.matchedBypass,
      }).toEqual({
        id: preset.id,
        gainMatched: preset.id === 'reference',
      });
    });
  });

  it('keeps Crossfade independent when a whole-chain preset is applied', () => {
    const current: IDspSettings = {
      ...DSP_DEFAULTS,
      crossfade: {
        ...DSP_DEFAULTS.crossfade,
        enabled: true,
        durationMs: 7_250,
        curve: 'smooth',
      },
    };
    const applied = dspPresetSettings('rock', current);
    expect(applied?.presetId).toBe('rock');
    expect(applied?.crossfade).toEqual(current.crossfade);
  });

  /**
   * Which channels of the output the rack runs on is the machine, not the
   * sound: every recipe is built from the defaults, so a listener who had
   * chosen the front pair got all six channels back from auditioning a
   * preset, with nothing on the page saying so.
   */
  it('keeps the surround switch when a whole-chain preset is applied', () => {
    const current: IDspSettings = {
      ...DSP_DEFAULTS,
      surround: { allChannels: false },
    };
    const applied = dspPresetSettings('rock', current);
    expect(applied?.surround).toEqual({ allChannels: false });
    // POSITIVE CONTROL: the preset does change the sound around it, and with
    // no current settings it brings its own switch.
    expect(applied?.eq).not.toEqual(current.eq);
    expect(dspPresetSettings('rock')?.surround).toEqual({
      allChannels: true,
    });
  });

  /**
   * GAME MODE IS THE GAMING CHAINS', AND NOBODY ELSE'S. Choosing one is the
   * whole switch — no limiter or input peak guard in the way, the engine told
   * to give up its comfort delays — and choosing anything else gives it back.
   */
  it('puts game mode on the Gaming chains and on no other', () => {
    DSP_PRESETS.forEach((preset) => {
      expect({ id: preset.id, gameMode: preset.settings.gameMode }).toEqual({
        id: preset.id,
        gameMode: ['gaming', 'gaming-room', 'gaming-competitive'].includes(
          preset.id,
        ),
      });
    });
    const gaming = DSP_PRESETS.find((preset) => preset.id === 'gaming');
    expect(gaming?.settings.maximizer.enabled).toBe(false);
    expect(gaming?.settings.normalizer.mode).toBe('off');
    expect(dspPresetSettings('rock', gaming?.settings)?.gameMode).toBe(false);
  });

  /**
   * The Room is a stage of the rack: a chain that does not use it switches it
   * off, and the ones that do are copies of a chain that also exists without
   * it, because the Room is for headphones alone. A chain with the Room sets
   * ALL of it — "fill the room" left on from before made "Gaming · Room" two
   * different sounds — except the head and the headphone switch, which are
   * the listener's anatomy and machine. A chain without it leaves the room
   * that was shaped as it was, for the next time it is switched on.
   */
  it('owns the whole Room like every other stage, and never the head', () => {
    const current: IDspSettings = {
      ...DSP_DEFAULTS,
      room: {
        ...DSP_DEFAULTS.room,
        enabled: true,
        presetId: 'custom',
        sizeM: 7,
        head: 'large',
        musicUpmix: true,
        upmixAmount: 1,
        bassManagement: false,
        crossoverHz: 120,
        mutes: [false, false, true, false, false, false, false, true],
      },
    };
    const without = dspPresetSettings('rock', current);
    expect(without?.room).toEqual({ ...current.room, enabled: false });
    const withRoom = dspPresetSettings('movie-room', current);
    expect(withRoom?.room).toEqual({
      ...roomPresetSettings(DSP_DEFAULTS.room, 'cinemaV2'),
      enabled: true,
      head: 'large',
    });
    // Said out loud, since it is what was reported: the fill left on from
    // before goes, and the room's own takes its place.
    expect(withRoom?.room.upmixAmount).toBe(
      roomPresetSettings(DSP_DEFAULTS.room, 'cinemaV2').upmixAmount,
    );
    expect(withRoom?.room.upmixAmount).not.toBe(current.room.upmixAmount);
    expect(withRoom?.room.mutes.every((mute) => !mute)).toBe(true);
    // The copies stand in the featured rooms, each named after its chain:
    // by the Room's title, and by the room where a chain has a second copy.
    expect(
      DSP_PRESETS.filter((preset) => preset.settings.room.enabled).map(
        (preset) => [
          preset.id,
          preset.settings.room.presetId,
          preset.copyLabelKey,
        ],
      ),
    ).toEqual([
      ['music-room', 'musicSpaceV2', 'dsp.room.title'],
      ['gaming-room', 'gameWorldV2', 'dsp.room.title'],
      ['gaming-competitive', 'competitiveV2', 'dsp.room.profile.competitiveV2'],
      ['movie-room', 'cinemaV2', 'dsp.room.title'],
    ]);
    expect(
      DSP_PRESETS.filter((preset) => !preset.settings.room.enabled).every(
        (preset) => preset.copyLabelKey === undefined,
      ),
    ).toBe(true);
    // Each copy stands beside the chain it copies, with no widening after
    // the Room has placed every speaker.
    expect(
      DSP_PRESETS.find((preset) => preset.id === 'movie-room')?.settings
        .dimension.enabled,
    ).toBe(false);
    expect(DSP_PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining(['gaming', 'movie']),
    );
  });

  /**
   * A chain saved before 2026-09-22 carries the multiband compressor that
   * was removed that day, and it is read as a chain without one — never as
   * a refusal, and never as a stage that comes back.
   */
  it('reads a stored chain that still carries the retired compressor', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      compressor: { enabled: true, crossoverHz: [180, 3200], bands: [] },
    });
    expect(clamped).toEqual(DSP_DEFAULTS);
    expect('compressor' in clamped).toBe(false);
  });
});

/**
 * The sanitiser must not eat the exciter's monitoring flag.
 *
 * Isolate is not meant to survive a restart, and the first attempt implemented
 * that by forcing it false inside `clampDspSettings`. That looked like the
 * right place and was not: this function runs on every patch AND on every
 * settings message the worklet receives, so the flag was stripped between the
 * button and the audio. The button lit, the settings object said true one line
 * earlier, and the mode did nothing whatsoever.
 *
 * Not persisting is a fact about STORAGE, so `readStored` drops it and nothing
 * else does. This is the test that tells those two apart.
 */
describe('exciter isolate survives sanitising', () => {
  it('keeps a true isolate flag', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, isolate: true },
    });
    expect(clamped.exciter.isolate).toBe(true);
  });

  it('still defaults it off, and rejects a non-boolean', () => {
    expect(clampDspSettings(DSP_DEFAULTS).exciter.isolate).toBe(false);
    const nonsense = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, isolate: 'yes' },
    });
    expect(nonsense.exciter.isolate).toBe(false);
  });
});

/**
 * The rack sizes, and the guarantee that moving between them is lossless.
 *
 * Reported as "switching bands loses the imported curve", and it was: each
 * change resampled the live rack, so every trip through a smaller size threw
 * away detail that the next larger size could not invent again.
 */
describe('EQ rack sizes', () => {
  it('offers the four sizes at their ISO centres', () => {
    expect(EQ_RACK_SIZES).toEqual([6, 10, 15, 31]);
    EQ_RACK_SIZES.forEach((size) => {
      expect(buildEqRack(size)).toHaveLength(size);
    });
  });

  /**
   * A shelf at 16 kHz delivers 3-6 dB of a requested 6, and one at 20 kHz
   * against a 44.1 kHz rate delivers almost nothing — the cookbook forces the
   * response flat at Nyquist. The graphic racks are bells throughout so no
   * control on them is a dial that moves and does nothing.
   */
  it('puts no shelf at the top of a graphic rack', () => {
    [6, 10, 31].forEach((size) => {
      expect(buildEqRack(size).every((band) => band.type === 'PK')).toBe(true);
    });
  });

  it('gives a denser rack a higher Q, as the spacing demands', () => {
    const ten = buildEqRack(10)[5].quality;
    const thirtyOne = buildEqRack(31)[15].quality;
    expect(thirtyOne).toBeGreaterThan(ten);
    // The standard octave relation: Q = 1 / (2^(n/2) - 2^(-n/2)).
    expect(ten).toBeCloseTo(1.41, 1);
    expect(thirtyOne).toBeCloseTo(4.32, 1);
  });

  it('keeps a stored rack at whatever length it was saved with', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, bands: buildEqRack(31) },
    });
    expect(clamped.eq.bands).toHaveLength(31);
  });

  it('refuses to allocate past the CPU ceiling', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      eq: {
        ...DSP_DEFAULTS.eq,
        bands: Array.from({ length: EQ_MAX_BAND_COUNT + 40 }, () => ({
          enabled: true,
          type: 'PK',
          frequency: 1000,
          gainDb: 0,
          quality: 1,
        })),
      },
    });
    expect(clamped.eq.bands).toHaveLength(EQ_MAX_BAND_COUNT);
  });
});

describe('bass stages clamp', () => {
  it('defaults both stages off', () => {
    expect(DSP_DEFAULTS.bassForge.enabled).toBe(false);
    expect(DSP_DEFAULTS.bassPunch.enabled).toBe(false);
  });

  it('pulls out-of-range values back to the dial', () => {
    const clamped = clampDspSettings({
      bassForge: { splitHz: 5_000, texture: 4, mix: -2, driveDb: 99 },
      bassPunch: { attack: 9, sustain: -9, bloomDecayMs: 5, duck: 3 },
    });
    expect(clamped.bassForge.splitHz).toBe(200);
    expect(clamped.bassForge.texture).toBe(1);
    expect(clamped.bassForge.mix).toBe(0);
    expect(clamped.bassForge.driveDb).toBe(12);
    expect(clamped.bassPunch.attack).toBe(1);
    expect(clamped.bassPunch.sustain).toBe(-1);
    expect(clamped.bassPunch.bloomDecayMs).toBe(40);
    expect(clamped.bassPunch.duck).toBe(1);
  });

  /**
   * Forge's two generators reach two; everything shaped like a blend does not.
   *
   * The generators make new content and are multiplied by `mix` on the way in,
   * so their ceiling is not the same number as a fraction's. `mix` itself,
   * Punch's `bloomAmount` and its `duck` are all fractions of something that
   * already exists, and a fraction above one has stopped meaning what it says
   * — which is why widening the shared `bassAmount` range would have been the
   * wrong fix.
   */
  it('lets Sub and Presence reach two while every blend stops at one', () => {
    const clamped = clampDspSettings({
      bassForge: { subAmount: 2, presenceAmount: 1.5, mix: 2 },
      bassPunch: { bloomAmount: 2 },
    });
    expect(clamped.bassForge.subAmount).toBe(2);
    expect(clamped.bassForge.presenceAmount).toBe(1.5);
    expect(clamped.bassForge.mix).toBe(1);
    expect(clamped.bassPunch.bloomAmount).toBe(1);

    const over = clampDspSettings({
      bassForge: { subAmount: 9, presenceAmount: -3 },
    });
    expect(over.bassForge.subAmount).toBe(2);
    expect(over.bassForge.presenceAmount).toBe(0);
  });

  /**
   * Settings stored before these stages existed must load, and must load with
   * both stages off. A stage that arrives switched on after an update is a
   * user's sound changing while they were not looking.
   */
  it('loads settings saved before the stages existed', () => {
    const { bassForge, bassPunch } = clampDspSettings({ eq: DSP_DEFAULTS.eq });
    expect(bassForge).toEqual(DSP_DEFAULTS.bassForge);
    expect(bassPunch).toEqual(DSP_DEFAULTS.bassPunch);
  });
});
it('orders the basic presets None, Default, Reference, Music before the remaining sounds', () => {
  expect(
    DSP_PRESETS.filter((preset) => preset.group === 'basic')
      .slice(0, 4)
      .map((preset) => preset.id),
  ).toEqual(['empty', 'balanced', 'reference', 'music']);
});

it('keeps traditional Country and modern pop-rock Country as distinct DSP curves', () => {
  const traditional = DSP_PRESETS.find(
    (preset) => preset.labelKey === 'dsp.eqPreset.country',
  );
  const modern = DSP_PRESETS.find(
    (preset) => preset.labelKey === 'dsp.eqPreset.modernCountry',
  );
  expect(traditional?.curve).toBeDefined();
  expect(modern?.curve).toBeDefined();
  expect(modern?.curve?.bands).not.toEqual(traditional?.curve?.bands);
});
