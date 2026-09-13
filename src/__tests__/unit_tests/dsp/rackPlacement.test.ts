/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the DSP rack runs. Under the FluidEQ Engine it used to run twice on
 * everything the Library played — once in the player and again in the engine
 * — and kept running on everything with FluidEQ switched off.
 */

import { DSP_DEFAULTS } from 'common/dsp/chain';
import {
  OPEN_GATE,
  engineRunsRack,
  playerRunsRack,
  rackFor,
  rackSuspension,
  readRackGate,
  resetRackGate,
  updateRackGate,
  type IRackGate,
} from 'renderer/dsp/rackPlacement';

const gate = (fields: Partial<IRackGate>): IRackGate => ({
  ...OPEN_GATE,
  engine: 'fluid',
  eqLoaded: true,
  ...fields,
});

describe('where the rack runs under the FluidEQ Engine', () => {
  it('runs in the engine, on everything, while the Library is quiet', () => {
    const quiet = gate({});
    expect(engineRunsRack(quiet)).toBe(true);
    expect(playerRunsRack(quiet)).toBe(true);
    expect(rackSuspension(quiet)).toBeUndefined();
  });

  it('runs in the player alone while the Library plays', () => {
    // The player's copy has the track's own analysis and feeds the meters;
    // the engine's would run it a second time on the player's output.
    const playing = gate({ libraryAudible: true });
    expect(engineRunsRack(playing)).toBe(false);
    expect(playerRunsRack(playing)).toBe(true);
  });

  it('runs nowhere while FluidEQ is switched off', () => {
    const off = gate({ eqEnabled: false, libraryAudible: true });
    expect(rackSuspension(off)).toBe('switched-off');
    expect(engineRunsRack(off)).toBe(false);
    expect(playerRunsRack(off)).toBe(false);
  });

  it('runs nowhere while the engine is not running', () => {
    const down = gate({ engineOff: true, libraryAudible: true });
    expect(rackSuspension(down)).toBe('engine-off');
    expect(engineRunsRack(down)).toBe(false);
    expect(playerRunsRack(down)).toBe(false);
  });

  it('says switched off before engine off when both are true', () => {
    expect(rackSuspension(gate({ eqEnabled: false, engineOff: true }))).toBe(
      'switched-off',
    );
  });
});

describe('where the rack runs under Equalizer APO', () => {
  it('keeps the Library player’s rack whatever FluidEQ’s switch says', () => {
    // APO's switch is about APO's EQ; the rack only ever lived in the player.
    const apo = gate({ engine: 'apo', eqEnabled: false, libraryAudible: true });
    expect(rackSuspension(apo)).toBeUndefined();
    expect(playerRunsRack(apo)).toBe(true);
  });
});

describe('where the rack runs before the window knows enough', () => {
  it('sends the engine no rack before FluidEQ’s switch has been read', () => {
    // The default says on; a launch that believed it played the rack for a
    // moment on a machine whose FluidEQ was saved off.
    expect(engineRunsRack(OPEN_GATE)).toBe(false);
    // Positive control: the same gate once the saved switch is in.
    expect(engineRunsRack({ ...OPEN_GATE, eqLoaded: true })).toBe(true);
  });

  it('honours FluidEQ’s switch even when the engine never became known', () => {
    // Main writes the rack only under the FluidEQ Engine, so under Equalizer
    // APO this copy goes nowhere; with the status read failed it must still
    // not send a rack FluidEQ is switched off for.
    expect(
      engineRunsRack({ ...OPEN_GATE, eqLoaded: true, eqEnabled: false }),
    ).toBe(false);
  });
});

describe('rackFor', () => {
  const on = { ...DSP_DEFAULTS, enabled: true };

  it('leaves the settings alone where the rack runs', () => {
    expect(rackFor(on, true)).toBe(on);
  });

  it('switches only the root off where it does not', () => {
    const off = rackFor(on, false);
    expect(off.enabled).toBe(false);
    // Every stage keeps what the page shows, so the rack comes back as it was.
    expect({ ...off, enabled: true }).toEqual(on);
  });

  it('leaves a rack already switched off by its own switch as it is', () => {
    const bypassed = { ...DSP_DEFAULTS, enabled: false };
    expect(rackFor(bypassed, false)).toBe(bypassed);
  });
});

describe('the gate', () => {
  beforeEach(() => resetRackGate());

  it('reports a change only when something moved', () => {
    expect(updateRackGate({ libraryAudible: true })).toBe(true);
    expect(updateRackGate({ libraryAudible: true })).toBe(false);
    expect(readRackGate().libraryAudible).toBe(true);
    expect(updateRackGate({ eqLoaded: true })).toBe(true);
    expect(updateRackGate({ eqLoaded: true })).toBe(false);
  });
});
