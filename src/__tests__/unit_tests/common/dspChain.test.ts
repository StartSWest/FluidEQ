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
import { GENRE_STAGES, inGenreChain } from '../../../common/dsp/genreRack';
import { GENRE_RACKS, genreChainId } from '../../../common/dsp/genres';
import { maximizerPresetSettings } from '../../../common/dsp/maximizerPresets';
import { DSP_PRESETS, dspPresetSettings } from '../../../common/dsp/presets';
import { roomPresetSettings } from '../../../common/dsp/roomPresets';
import {
  EQ_PRESETS,
  eqPresetSetup,
  eqSettingsForPreset,
} from '../../../common/dsp/eqPresets';
import { MAXIMIZER_CATALOGUE } from '../../../common/dsp/stageCatalogues';
import {
  biquadCoefficients,
  biquadMagnitudeDb,
} from '../../../renderer/dsp/biquad';

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
    expect(DSP_PRESETS).toHaveLength(107);
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
   * A genre's rack is looked up by its id, and a misspelled one fails the
   * quiet way: that genre keeps shipping as its curve alone — a chain that
   * sounds thinner than every one beside it, with nothing anywhere saying
   * why.
   */
  it('builds a genre chain from every row of the genre racks', () => {
    GENRE_RACKS.forEach((rack) => {
      const style = genreChainId(rack);
      const chain = DSP_PRESETS.find((preset) => preset.id === style);
      expect({ style, group: chain?.group }).toEqual({
        style,
        group: 'genre',
      });
      // And the row reached the rack: what it plays is on, under the
      // genre's own profile, and what it only offers is off.
      GENRE_STAGES.forEach((stage) => {
        const on = inGenreChain(rack, stage);
        const settings = chain?.settings[stage];
        expect({
          style,
          stage,
          on: settings?.enabled ?? false,
          profile: settings?.presetId,
        }).toEqual({
          style,
          stage,
          on,
          profile: on ? rack.id : DSP_DEFAULTS[stage].presetId,
        });
      });
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
    // Its own limiter, whose 1.5 ms look-ahead lets a kick's first cycle
    // through: the one profile that is deliberately not transparent.
    expect(punch?.settings.maximizer).toEqual(
      maximizerPresetSettings('punch', true),
    );
  });

  /**
   * A repair repairs: no stage of it is borrowed from another purpose.
   *
   * Until 2026-09-23 the vinyl and tape repairs played the Character
   * group's Vinyl and Tape curves, fuzz and all, with a cutting lathe's and a
   * comparison tool's Master; the compressed-file repair played the Air
   * curve, lifting the octave where an encoder leaves its swirl. Each has
   * its own curve and limiter now, and the Character curves are
   * characters again.
   */
  it('builds every repair chain from repair and voice profiles alone', () => {
    const groupOfCurve = (id: string | undefined) =>
      EQ_PRESETS.find((preset) => preset.id === id)?.group;
    const repairs = DSP_PRESETS.filter((preset) => preset.group === 'repair');
    // POSITIVE CONTROL: the three instrument repairs and the two voices.
    expect(repairs.map((preset) => preset.id).sort()).toEqual(
      [
        'audiobook',
        'lossy-repair',
        'podcast',
        'tape-restore',
        'vinyl-restore',
      ].sort(),
    );
    repairs.forEach((preset) => {
      expect({
        id: preset.id,
        curve: ['repair', 'voice'].includes(
          groupOfCurve(preset.curve?.presetId) ?? '',
        ),
        maximizer:
          !preset.settings.maximizer.enabled ||
          MAXIMIZER_CATALOGUE.profiles.find(
            (profile) => profile.id === preset.settings.maximizer.presetId,
          )?.group === 'repair',
        fuzz: preset.settings.eq.fuzzAmount,
      }).toEqual({ id: preset.id, curve: true, maximizer: true, fuzz: 0 });
    });
    // And the Character curves they used to share keep their character.
    ['tape', 'vinyl'].forEach((id) => {
      const character = EQ_PRESETS.find((preset) => preset.id === id);
      expect(character?.group).toBe('character');
      expect(character?.setup?.fuzzAmount).toBeGreaterThan(0);
      expect(
        DSP_PRESETS.filter((preset) => preset.curve?.presetId === id),
      ).toEqual([]);
    });
  });

  /**
   * Default is a clean everyday chain, louder than DSP Off like every music
   * chain, and never a level target: its streaming target turned every loud
   * record down to -14 LUFS, as much as 5 LU under DSP Off.
   */
  it('gives Default its own gentle limiter and no loudness target', () => {
    const balanced = DSP_PRESETS.find((preset) => preset.id === 'balanced');
    expect(balanced?.settings.master.enabled).toBe(false);
    expect(balanced?.settings.maximizer).toEqual(
      maximizerPresetSettings('default', true),
    );
    expect(balanced?.settings.maximizer.driveDb).toBeLessThanOrEqual(1);
    expect(balanced?.curve?.presetId).toBe('balanced');
  });

  it('gives Air its own width, not the Speakers profile', () => {
    const air = DSP_PRESETS.find((preset) => preset.id === 'clarity');
    expect(air?.settings.dimension.presetId).toBe('air');
    // Only the top opened: the voice and the body stay as mixed.
    expect(air?.settings.dimension.lowWidth).toBe(1);
    expect(air?.settings.dimension.midWidth).toBe(1);
    expect(air?.settings.dimension.highWidth).toBeGreaterThan(1);
  });

  it('keeps Warm tonal instead of stacking harmonic generators', () => {
    const warm = DSP_PRESETS.find((preset) => preset.id === 'warm');
    expect(warm?.curve?.presetId).toBe('warm');
    expect(warm?.settings.eq.fuzzAmount).toBe(0);
    expect(warm?.settings.exciter.enabled).toBe(false);
    expect(warm?.settings.bassForge.enabled).toBe(false);
  });

  it('keeps Expansive to one controlled width stage and a bare ceiling', () => {
    const expansive = DSP_PRESETS.find((preset) => preset.id === 'expansive');
    // No curve: it borrowed Ambient's, which made it Ambient made wider.
    expect(expansive?.curve).toBeUndefined();
    expect(expansive?.settings.exciter.enabled).toBe(false);
    expect(expansive?.settings.dimension.presetId).toBe('expansive');
    expect(expansive?.settings.dimension.decorrelation).toBeLessThan(0.5);
    // The ceiling the widened side needs, adding no level of its own.
    expect(expansive?.settings.maximizer).toEqual(
      maximizerPresetSettings('safety', true),
    );
  });

  it('uses Master only where a delivery target owns the final level', () => {
    const mastered = DSP_PRESETS.filter(
      (preset) => preset.settings.master.enabled,
    );
    /**
     * Only where the name says the level is the point: Reference brings two
     * records to one level to compare them, and the spoken-word three put
     * every show at the level of every other, which a listener in a car
     * cannot ride by hand. Default and the two restorations carried targets
     * too until 2026-09-23 — a streaming target, a cutting lathe's, and
     * Reference's own — and played loud records 2 to 7 LU under DSP Off.
     */
    expect(mastered.map((preset) => preset.id)).toEqual([
      'reference',
      'speech',
      'podcast',
      'audiobook',
    ]);
    mastered.forEach((preset) => {
      expect(preset.settings.maximizer.enabled).toBe(false);
    });
    /**
     * Everything else ends in a ceiling: a chain with no final stage can be
     * pushed past full scale by its own curve, and then Auto normalize turns
     * the whole thing down. None is the one exception, being nothing at all.
     * Expansive, Lo-fi, World and Gaming were open until 2026-09-23, and
     * Gaming's curve put a game's loud moments 7 dB over full scale.
     */
    const open = DSP_PRESETS.filter(
      (preset) =>
        !preset.settings.maximizer.enabled && !preset.settings.master.enabled,
    ).map((preset) => preset.id);
    expect(open).toEqual(['empty']);
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
   * Every chain's limiter is a profile the picker lists, exactly as listed.
   *
   * Chains used to calibrate a shared profile's drive in place, which opened
   * the Maximizer's picker on Custom for every one of them and hid which
   * limiter a chain was actually playing. Each measured drive now lives in a
   * named profile of the chain's own purpose — a genre's in its rack, a
   * scene's, a repair's — so nothing is a borrowed profile tuned by a hidden
   * number (`maximizerPresets.ts`, `genres/*.ts`).
   */
  it('plays every limiter exactly as a named profile of the picker', () => {
    const limited = DSP_PRESETS.filter(
      (preset) => preset.settings.maximizer.enabled,
    );
    // POSITIVE CONTROL: this reads the chains that have one.
    expect(limited.length).toBeGreaterThan(DSP_PRESETS.length / 2);
    limited.forEach((preset) => {
      const { maximizer } = preset.settings;
      expect({
        id: preset.id,
        maximizer,
      }).toEqual({
        id: preset.id,
        maximizer: MAXIMIZER_CATALOGUE.settings(maximizer.presetId, true),
      });
    });
  });

  it('uses the purpose-built D&B transient profile', () => {
    const drumBass = DSP_PRESETS.find((preset) => preset.id === 'drum-bass');
    expect(drumBass?.settings.bassForge.enabled).toBe(false);
    // Its rack's own, with the D&B tempo's short release (`genres/`).
    expect(drumBass?.settings.bassPunch.presetId).toBe('drumBass');
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
   * The EQ's Treble choice is the listener's, like the main EQ's Treble row:
   * how every band plays near the top, and no chain's to take away. Every
   * recipe is built from the defaults, which say Precise.
   */
  it('keeps the EQ’s Treble choice when a whole-chain preset is applied', () => {
    const current: IDspSettings = {
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, treble: 'classic' },
    };
    expect(dspPresetSettings('rock', current)?.eq.treble).toBe('classic');
    expect(dspPresetSettings('podcast', current)?.eq.treble).toBe('classic');
    // POSITIVE CONTROL: with no current settings a chain brings the default.
    expect(dspPresetSettings('rock')?.eq.treble).toBe('precise');
  });

  it('reads a stored EQ without a Treble choice, or a wrong one, as Precise', () => {
    const { treble: _treble, ...older } = DSP_DEFAULTS.eq;
    expect(clampDspSettings({ eq: older }).eq.treble).toBe('precise');
    expect(
      clampDspSettings({ eq: { ...older, treble: 'CLASSIC' } }).eq.treble,
    ).toBe('precise');
    // POSITIVE CONTROL: Classic, stored, stays Classic.
    expect(
      clampDspSettings({ eq: { ...older, treble: 'classic' } }).eq.treble,
    ).toBe('classic');
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
    // A ceiling in game mode: a millisecond of look-ahead is all the delay
    // it adds, and without it the curve put loud moments over full scale.
    expect(gaming?.settings.maximizer.presetId).toBe('gaming');
    expect(gaming?.settings.maximizer.lookAheadMs).toBeLessThanOrEqual(1);
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

/**
 * Pop Rock's research, held: records mastered as finished as pop's (DR 4-7)
 * and bright already, a vocal that is bright and guitars that make their own
 * harmonics, doubled hard left and right. So no stage that adds harmonics,
 * nothing wider than the mix, a ceiling that only catches — and a curve that
 * is neither of its parents: the voice further forward than Rock's, the sub
 * well under Pop's 808, and a gentler low-mid clean-up than Rock's, because
 * piano and clean guitars do not turn to mud the way a wall of distortion
 * does.
 */
it('keeps Pop Rock clean, unwidened and between its parents', () => {
  const chain = DSP_PRESETS.find((preset) => preset.id === 'popRock');
  expect(chain?.group).toBe('genre');
  const settings = chain?.settings;
  expect({
    exciter: settings?.exciter.enabled,
    bassForge: settings?.bassForge.enabled,
    midWidth: settings?.dimension.midWidth,
    highWidth: settings?.dimension.highWidth,
  }).toEqual({ exciter: false, bassForge: false, midWidth: 1, highWidth: 1 });
  expect(settings?.maximizer.driveDb).toBeLessThanOrEqual(1.25);

  // Each curve as the Preset layer plays it: its bands through its model.
  const heardAt = (id: string, hz: number): number => {
    const preset = EQ_PRESETS.find((one) => one.id === id);
    if (preset === undefined) {
      throw new Error(`no curve ${id}`);
    }
    const setup = eqPresetSetup(preset);
    return eqSettingsForPreset(DSP_DEFAULTS.eq, preset).bands.reduce(
      (total, band) =>
        band.enabled
          ? total +
            biquadMagnitudeDb(
              biquadCoefficients(
                {
                  type: band.type as never,
                  frequency: band.frequency,
                  gainDb: band.gainDb,
                  quality: band.quality,
                },
                48_000,
                setup.model,
                setup.modelAmount,
              ),
              hz,
              48_000,
            )
          : total,
      0,
    );
  };
  const centres = [32, 50, 80, 125, 200, 315, 500, 800, 1_250, 2_000, 3_150];
  const widestGap = (a: string, b: string) =>
    Math.max(...centres.map((hz) => Math.abs(heardAt(a, hz) - heardAt(b, hz))));

  expect(heardAt('popRock', 3_150)).toBeGreaterThan(heardAt('rock', 3_150));
  expect(heardAt('popRock', 32)).toBeLessThan(heardAt('pop', 32) - 1);
  expect(heardAt('popRock', 315)).toBeGreaterThan(heardAt('rock', 315) + 1);
  // Audibly its own curve, not either parent's; and the measure can say
  // "the same", or a gap that is always large would pass this too.
  expect(widestGap('popRock', 'rock')).toBeGreaterThan(1.2);
  expect(widestGap('popRock', 'pop')).toBeGreaterThan(1.2);
  expect(widestGap('popRock', 'popRock')).toBe(0);
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
