/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Mute and solo on the Room's speakers, and what Reset puts back.
 *
 * One state, the mutes: a solo is the other six muted and its own speaker
 * open. The wire marks a solo's six apart from plain mutes, because only the
 * engine knows whether what is playing reaches the soloed speaker — the text
 * of that contract is `room_test.cpp`'s, on the other side.
 */

import { DSP_DEFAULTS, IRoomSettings } from '../../../common/dsp/chain';
import { encodeChainSettings } from '../../../common/dsp/chainWire';
import { resetRoom, roomPresetSettings } from '../../../common/dsp/roomPresets';
import {
  roomMuteWire,
  roomSolo,
  withSolo,
  withSoloWhileFed,
  withoutSolo,
} from '../../../common/dsp/roomSpeakers';

const OPEN = [false, false, false, false, false, false, false, false];

describe('mute and solo on the room speakers', () => {
  it('reads a solo off the mutes: exactly one of the seven open', () => {
    expect(roomSolo(OPEN)).toBeNull();
    expect(roomSolo([true, false, true, true, true, true, true, false])).toBe(
      1,
    );
    // Two open is two speakers playing, not a solo; none open is silence.
    expect(
      roomSolo([false, false, true, true, true, true, true, false]),
    ).toBeNull();
    expect(
      roomSolo([true, true, true, true, true, true, true, false]),
    ).toBeNull();
    // The sub is never part of it, muted or not.
    expect(roomSolo([true, false, true, true, true, true, true, true])).toBe(1);
  });

  it('solos a speaker whatever it was, moves there, and leaves the sub alone', () => {
    const muted = [false, true, false, false, false, false, false, true];
    // Soloing the muted front right opens it.
    const right = withSolo(muted, 1);
    expect(right).toEqual([true, false, true, true, true, true, true, true]);
    // Soloing the front left then moves the solo: right goes with the rest.
    const left = withSolo(right, 0);
    expect(left).toEqual([false, true, true, true, true, true, true, true]);
    expect(roomSolo(left)).toBe(0);
    // Letting go opens all seven; the sub's own mute stays.
    expect(withoutSolo(left)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('lets go of a solo on a speaker nothing reaches, and only then', () => {
    const frontOnly = [true, true, false, false, false, false, false];
    const sideSolo = withSolo(OPEN, 4);
    expect(withSoloWhileFed(sideSolo, frontOnly)).toEqual(OPEN);
    // The same array back is how the card knows there was nothing to do.
    const frontSolo = withSolo(OPEN, 0);
    expect(withSoloWhileFed(frontSolo, frontOnly)).toBe(frontSolo);
    const twoMuted = [false, false, true, true, false, false, false, false];
    expect(withSoloWhileFed(twoMuted, frontOnly)).toBe(twoMuted);
  });

  it("sends a solo's six apart from plain mutes, for the engine to drop", () => {
    expect(roomMuteWire(OPEN)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    // Plain mutes are 1, the sub's included.
    expect(
      roomMuteWire([false, true, true, false, false, false, false, true]),
    ).toEqual([0, 1, 1, 0, 0, 0, 0, 1]);
    // A solo: the six are 2 — the engine drops them where nothing reaches
    // the soloed speaker — and the sub's mute is still its own 1.
    expect(roomMuteWire(withSolo(OPEN, 4))).toEqual([2, 2, 2, 2, 0, 2, 2, 0]);
    expect(
      roomMuteWire([true, true, true, true, false, true, true, true]),
    ).toEqual([2, 2, 2, 2, 0, 2, 2, 1]);
    // And it is what goes on the wire: the eight values before the surround
    // switch and the band count.
    const room: IRoomSettings = {
      ...DSP_DEFAULTS.room,
      enabled: true,
      mutes: withSolo(OPEN, 4),
    };
    const wire = encodeChainSettings({ ...DSP_DEFAULTS, room });
    const lead = wire.indexOf(DSP_DEFAULTS.eq.bands.length, 150);
    expect(Array.from(wire.slice(lead - 9, lead - 1))).toEqual([
      2, 2, 2, 2, 0, 2, 2, 0,
    ]);
  });
});

describe("the room's Reset and presets", () => {
  const shaped: IRoomSettings = {
    ...DSP_DEFAULTS.room,
    enabled: true,
    presetId: 'custom',
    sizeM: 9,
    head: 'large',
    bassManagement: false,
    crossoverHz: 120,
    musicUpmix: true,
    upmixAmount: 1,
    levels: [0, 0, -6, 0, 0, 3, 3],
    distances: [1.8, 1.8, 2.5, 1.8, 1.8, 1.8, 1.8],
    mutes: [false, false, true, false, false, false, false, true],
  };

  it('puts the Reference room in with every option on the card, and keeps only the power switch', () => {
    const reference = roomPresetSettings(DSP_DEFAULTS.room, 'referenceV2');
    expect(resetRoom(shaped)).toEqual({ ...reference, enabled: true });
    // Said out loud: the listener's own go back too, and nothing per speaker
    // outlives it.
    expect(resetRoom(shaped)).toMatchObject({
      presetId: 'referenceV2',
      rendererVersion: 2,
      head: DSP_DEFAULTS.room.head,
      musicUpmix: false,
    });
    expect(resetRoom(shaped).mutes.every((mute) => !mute)).toBe(true);
    expect(resetRoom({ ...shaped, enabled: false }).enabled).toBe(false);
    // Copies, never the defaults' own arrays: a later edit must not reach them.
    expect(resetRoom(shaped).mutes).not.toBe(DSP_DEFAULTS.room.mutes);
    expect(resetRoom(shaped).mutes).not.toBe(resetRoom(shaped).mutes);
  });

  /**
   * A room preset sets ALL of the room. "Fill the room" switched on in one
   * room used to follow the listener into every other, so a preset was a
   * different sound depending on what came before it. What it leaves is the
   * head and the headphone switch — anatomy and machine — and the power.
   */
  it('a preset sets all of the room, fill the room included, and leaves the head', () => {
    const studio = roomPresetSettings(shaped, 'studio');
    expect(studio).toEqual({
      ...DSP_DEFAULTS.room,
      ...roomPresetSettings(DSP_DEFAULTS.room, 'studio'),
      enabled: true,
      head: 'large',
    });
    expect(studio.musicUpmix).toBe(false);
    expect(studio.bassManagement).toBe(true);
    expect(studio.mutes).toEqual(OPEN);
    // POSITIVE CONTROL: it is the studio, not the defaults' living room.
    expect(studio.sizeM).toBe(3.2);
    expect(studio.presetId).toBe('studio');
  });
});
