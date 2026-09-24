/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A preset's tone is its curve, played in the main EQ on either engine; its
 * rack's EQ keeps only what supports the other stages (`presetCurve.ts`).
 *
 * The tone used to sit in the rack's EQ, ahead of its compressor and limiter,
 * and on the FluidEQ Engine Pop against Metal was barely audible while
 * Equalizer APO — which plays the same filters as a layer with nothing after
 * them — made it plain. These hold the split: all of the tone in the curve,
 * none of it left in the rack to be played twice, and the support where it
 * was.
 */
import { FilterTypeEnum } from '../../../common/constants';
import {
  DSP_DEFAULTS,
  IEqBandSettings,
  IEqSettings,
} from '../../../common/dsp/chain';
import { presetCurve, presetSupport } from '../../../common/dsp/presetCurve';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import { isRoomPresetId } from '../../../common/dsp/roomPresets';
import { ROOM_TONE_SETS, roomToneSetOf } from '../../../common/dsp/roomTone';

const isFlatBell = (band: IEqBandSettings) =>
  band.type === FilterTypeEnum.PK && band.gainDb === 0 && !band.dynamic;

const band = (
  frequency: number,
  gainDb: number,
  extra: Partial<IEqBandSettings> = {},
): IEqBandSettings => ({
  enabled: true,
  type: FilterTypeEnum.PK,
  frequency,
  gainDb,
  quality: 1.4,
  dynamic: false,
  thresholdDb: -24,
  ...extra,
});

const eqOf = (
  bands: IEqBandSettings[],
  extra: Partial<IEqSettings> = {},
): IEqSettings => ({
  ...DSP_DEFAULTS.eq,
  enabled: true,
  bands,
  sourceBands: bands,
  ...extra,
});

describe('a preset’s tone and its rack’s support, split', () => {
  it('leaves no tone in any rack, and one high pass, in front of the Maximizer', () => {
    DSP_PRESETS.forEach((preset) => {
      const { eq } = preset.settings;
      const roomBands = preset.settings.room.enabled ? 5 : 0;
      const own = eq.bands.slice(0, eq.bands.length - roomBands);
      // The subsonic high pass stays in the rack: played after it, with the
      // curve, it turned the bottom's phase against the top and put back the
      // peaks the limiter had taken off (`presetSupport`). So the curve has
      // none, and there is never a second.
      expect({
        id: preset.id,
        tone: own.filter((one) => !one.dynamic && !isFlatBell(one)),
        curveSubsonicHz: preset.curve?.subsonicHz ?? 0,
      }).toEqual({ id: preset.id, tone: [], curveSubsonicHz: 0 });
    });
    // POSITIVE CONTROL: the high passes are still there, in the racks.
    expect(
      DSP_PRESETS.filter((preset) => preset.settings.eq.subsonicHz > 0).length,
    ).toBeGreaterThan(DSP_PRESETS.length / 2);
  });

  it('gives every preset that shapes the tone a curve, and the curve is all of it', () => {
    // Reference is a Master alone, None is nothing at all, and Expansive is
    // width alone (it borrowed Ambient's curve once): none has a tone to
    // carry.
    const shaped = DSP_PRESETS.filter(
      (preset) =>
        preset.id !== 'reference' &&
        preset.id !== 'empty' &&
        preset.id !== 'expansive',
    );
    shaped.forEach((preset) => {
      const curve = preset.curve as IEqSettings;
      expect({ id: preset.id, hasCurve: curve !== undefined }).toEqual({
        id: preset.id,
        hasCurve: true,
      });
      // The rack keeps the preset's band layout: every band the curve took
      // stands there flat, at its own frequency, in its own order.
      const own = preset.settings.eq.bands.filter((one) => !one.dynamic);
      const standIns = preset.settings.room.enabled
        ? own.slice(0, own.length - 5)
        : own;
      expect({
        id: preset.id,
        frequencies: standIns
          .filter((one) => one.enabled)
          .map((one) => one.frequency),
      }).toEqual({
        id: preset.id,
        frequencies: curve.bands.map((one) => one.frequency),
      });
      expect(curve.bands.some((one) => one.dynamic)).toBe(false);
    });
    // POSITIVE CONTROL: the split did not throw the tone away on its way
    // out of the rack. Metal is the curve Ivan compared, lifted in the
    // presence region and cut in the low mids.
    const metal = DSP_PRESETS.find((preset) => preset.id === 'metal');
    const at = (hz: number) =>
      metal?.curve?.bands.find((one) => one.frequency === hz)?.gainDb ?? 0;
    expect(at(5000)).toBeGreaterThan(2);
    expect(at(315)).toBeLessThan(-2);
    expect(metal?.settings.eq.subsonicHz).toBeGreaterThan(0);
  });

  it('keeps the rack’s EQ on only for what supports the rest of the rack', () => {
    const rackEq = (id: string) =>
      DSP_PRESETS.find((preset) => preset.id === id)?.settings.eq;
    // The de-essers and the late-night bass guard act only above their
    // threshold, which no curve can do.
    ['podcast', 'audiobook', 'late-night'].forEach((id) => {
      expect({
        id,
        dynamic: rackEq(id)?.bands.some((one) => one.dynamic),
      }).toEqual({ id, dynamic: true });
      expect(rackEq(id)?.enabled).toBe(true);
    });
    // Bass mono is processing, not tone.
    expect(rackEq('pop')?.monoBelowHz).toBeGreaterThan(0);
    expect(rackEq('pop')?.enabled).toBe(true);
    // Harmonic colour would be too (`splitting one EQ` below holds that),
    // but no factory chain adds any since 2026-09-23: every record already
    // carries its own, and the last two — Lo-fi's and the tape repair's —
    // were distortion laid over grit the record had.
    expect(
      DSP_PRESETS.filter((preset) => preset.settings.eq.fuzzAmount > 0).map(
        (preset) => preset.id,
      ),
    ).toEqual([]);
    // A preset with none of them has its rack's EQ off, free for the
    // listener's own corrections; one whose only support is its subsonic
    // high pass keeps the EQ on for that alone, every band flat.
    expect(rackEq('music')?.enabled).toBe(false);
    expect(rackEq('indiePop')?.enabled).toBe(true);
    expect(rackEq('indiePop')?.subsonicHz).toBeGreaterThan(0);
    expect(rackEq('indiePop')?.bands.every(isFlatBell)).toBe(true);
    // And a Room copy keeps what stands in front of its Room.
    const copy = DSP_PRESETS.find((preset) => preset.id === 'music-room');
    const room = copy?.settings.room.presetId ?? '';
    if (!isRoomPresetId(room)) {
      throw new Error('music-room stands in no room');
    }
    expect(copy?.settings.eq.enabled).toBe(true);
    expect(copy?.settings.eq.bands.slice(-5)).toEqual(
      ROOM_TONE_SETS[roomToneSetOf(room)].map((one) => ({ ...one })),
    );
  });
});

describe('splitting one EQ', () => {
  const eq = eqOf(
    [
      band(80, 3),
      band(5000, -9, { dynamic: true, thresholdDb: -26 }),
      band(120, 0, { type: FilterTypeEnum.HPQ }),
      band(8000, 2, { enabled: false }),
    ],
    { subsonicHz: 25, monoBelowHz: 60, oversample: 2 },
  );

  it('takes every static band into the curve, and leaves the subsonic filter', () => {
    const curve = presetCurve(eq);
    expect(curve?.bands.map((one) => [one.frequency, one.gainDb])).toEqual([
      [80, 3],
      [120, 0],
    ]);
    expect(curve?.subsonicHz).toBe(0);
  });

  it('leaves the dynamic band, a flat stand-in for each other, mono and the high pass', () => {
    const support = presetSupport(eq);
    expect(support.enabled).toBe(true);
    expect(support.subsonicHz).toBe(25);
    expect(support.monoBelowHz).toBe(60);
    expect(support.oversample).toBe(DSP_DEFAULTS.eq.oversample);
    expect(
      support.bands.map((one) => [
        one.frequency,
        one.type,
        one.gainDb,
        one.dynamic,
      ]),
    ).toEqual([
      [80, FilterTypeEnum.PK, 0, false],
      [5000, FilterTypeEnum.PK, -9, true],
      // A pass band at 0 dB still filters, so its stand-in is a bell.
      [120, FilterTypeEnum.PK, 0, false],
      [8000, FilterTypeEnum.PK, 0, false],
    ]);
    expect(support.sourceBands).toEqual(support.bands);
  });

  it('gives no curve for an EQ that is off or holds only dynamic bands', () => {
    expect(presetCurve({ ...eq, enabled: false })).toBeUndefined();
    expect(
      presetCurve(eqOf([band(5000, -9, { dynamic: true })])),
    ).toBeUndefined();
  });

  it('switches the rack’s EQ off when nothing in it supports anything', () => {
    expect(presetSupport(eqOf([band(80, 3)])).enabled).toBe(false);
    expect(
      presetSupport(eqOf([band(80, 3)], { fuzzAmount: 0.2 })).enabled,
    ).toBe(true);
    expect(presetSupport({ ...eq, enabled: false }).enabled).toBe(false);
  });
});
