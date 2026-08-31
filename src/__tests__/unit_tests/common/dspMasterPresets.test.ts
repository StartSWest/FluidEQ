/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Master destinations, held to the four numbers they claim to decide.
 *
 * They shipped deciding three. The release was left on whatever the stage
 * already had, so Club — nine decibels of limiting, which is the whole point of
 * it — and Cinema — two, chosen because that destination cannot forgive
 * limiting — asked the same limiter to let go at the same speed. A limiting
 * allowance without a release is half a specification: it says how much gain
 * may be spent and nothing about whether spending it sounds like density or
 * like pumping.
 */
import { DSP_DEFAULTS, clampDspSettings } from '../../../common/dsp/chain';
import {
  MASTER_PRESETS,
  MASTER_PRESET_BY_ID,
  isMasterPresetId,
  masterPresetSettings,
} from '../../../common/dsp/masterPresets';

describe('master profiles', () => {
  /**
   * The clamp is the range authority, so equality through it IS the range
   * check: a release outside 40-400ms comes back changed and this fails.
   */
  it('every one states a release the engine clamp leaves alone', () => {
    MASTER_PRESETS.forEach((preset) => {
      expect(isMasterPresetId(preset.id)).toBe(true);
      const live = masterPresetSettings(
        preset.id as never,
        DSP_DEFAULTS.master,
      );
      const clamped = clampDspSettings({
        ...DSP_DEFAULTS,
        master: live,
      }).master;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  /**
   * The bug, as a test. Choosing a destination has to MOVE the release.
   *
   * `masterPresetSettings` spreads the live master first and the profile
   * second, so a profile missing the field silently inherits it. That is
   * exactly how this went unnoticed: nothing threw, nothing looked wrong, and
   * every destination simply played at whatever release the last one left.
   */
  it('replaces a release the profile does not agree with', () => {
    const live = masterPresetSettings('club', {
      ...DSP_DEFAULTS.master,
      releaseMs: 333,
    });
    expect(live.releaseMs).toBe(MASTER_PRESET_BY_ID.club.settings.releaseMs);
    expect(live.releaseMs).not.toBe(333);
  });

  /** Output gain and matched listen are how you are listening, not where it is going. */
  it('leaves the settings a destination does not own', () => {
    const live = masterPresetSettings('cinema', {
      ...DSP_DEFAULTS.master,
      outputTrimDb: -4.5,
      matchedBypass: true,
    });
    expect(live.outputTrimDb).toBe(-4.5);
    expect(live.matchedBypass).toBe(true);
  });

  /**
   * The default profile is where Reset lands, so it has to BE the default.
   *
   * A release that differed here would make the profile named "default" a
   * place the stage could not be returned to.
   */
  it('the default profile is the shipped default', () => {
    const live = masterPresetSettings('default', DSP_DEFAULTS.master);
    expect({
      loudnessTargetLufs: live.loudnessTargetLufs,
      ceilingDb: live.ceilingDb,
      peakLimitingDb: live.peakLimitingDb,
      releaseMs: live.releaseMs,
    }).toEqual({
      loudnessTargetLufs: DSP_DEFAULTS.master.loudnessTargetLufs,
      ceilingDb: DSP_DEFAULTS.master.ceilingDb,
      peakLimitingDb: DSP_DEFAULTS.master.peakLimitingDb,
      releaseMs: DSP_DEFAULTS.master.releaseMs,
    });
  });

  /**
   * The catalogue says something, rather than saying one thing twelve times.
   *
   * This is the shape of the defect: twelve profiles that all read 200ms pass
   * every check above. The ends are asserted by name because they are the
   * design claim — the loudest, densest destination releases fastest, and the
   * one that exists to protect dynamic range releases slowest.
   */
  it('POSITIVE CONTROL: the releases are not all the same number', () => {
    const releases = MASTER_PRESETS.map((preset) => preset.settings.releaseMs);
    expect(new Set(releases).size).toBeGreaterThan(1);
    expect(Math.min(...releases)).toBe(
      MASTER_PRESET_BY_ID.club.settings.releaseMs,
    );
    expect(Math.max(...releases)).toBe(
      MASTER_PRESET_BY_ID.cinema.settings.releaseMs,
    );
  });
});
