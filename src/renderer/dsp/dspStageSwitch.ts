/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A stage's own on/off, said once for every switch that turns it: the
 * stage card's power switch (`DspStageCards`) and the row's switch on the
 * DSP page's and the Gaming Lab's rails (Ivan, 2026-11-25: "put toggles also
 * on the DSP and Gaming Lab, so we can toggle on and off the filters right
 * there"). Two copies of this would let the rail turn a stage off one way
 * and the card another — an Isolate left armed under bypass by one of them
 * plays only the stage's residue the moment it is switched back on.
 */

import type { IDspSettings } from '../../common/dsp/chain';
import type { TDspSection } from './sections';

/** Whether a stage of a rack is switched on, as its card's switch reads it. */
export const dspStageIsOn = (
  section: TDspSection,
  rack: IDspSettings,
): boolean =>
  section === 'normalizer'
    ? rack.normalizer.mode !== 'off'
    : rack[section].enabled;

/** Every stage's own on/off at once, for a rail of all of them. */
export const dspStagesOn = (
  rack: IDspSettings,
): Record<TDspSection, boolean> => ({
  normalizer: dspStageIsOn('normalizer', rack),
  denoise: dspStageIsOn('denoise', rack),
  deEsser: dspStageIsOn('deEsser', rack),
  crossfade: dspStageIsOn('crossfade', rack),
  eq: dspStageIsOn('eq', rack),
  footsteps: dspStageIsOn('footsteps', rack),
  exciter: dspStageIsOn('exciter', rack),
  bassForge: dspStageIsOn('bassForge', rack),
  bassPunch: dspStageIsOn('bassPunch', rack),
  dimension: dspStageIsOn('dimension', rack),
  room: dspStageIsOn('room', rack),
  dynamics: dspStageIsOn('dynamics', rack),
  maximizer: dspStageIsOn('maximizer', rack),
  master: dspStageIsOn('master', rack),
});

export interface IDspStageSwitch {
  /** What turning the stage over changes in the rack. */
  patch: Partial<IDspSettings>;
  /**
   * Whether the rack keeps its preset's name: the source level and the
   * playback transition are no part of a preset (`DspStageCards`).
   */
  preservePreset: boolean;
}

/** The rack's edit that turns one stage off, or back on as it was. */
export const dspStageSwitch = (
  section: TDspSection,
  rack: IDspSettings,
): IDspStageSwitch => {
  const on = dspStageIsOn(section, rack);
  const plain = (patch: Partial<IDspSettings>): IDspStageSwitch => ({
    patch,
    preservePreset: false,
  });
  switch (section) {
    case 'normalizer':
      // Back on in True Peak, the mode the card's own switch has always
      // chosen: Loudness is a choice made on the card, never by a switch.
      return {
        patch: {
          normalizer: { ...rack.normalizer, mode: on ? 'off' : 'truePeak' },
        },
        preservePreset: true,
      };
    case 'crossfade':
      return {
        patch: { crossfade: { ...rack.crossfade, enabled: !on } },
        preservePreset: true,
      };
    // Each stage with a monitor is disarmed on the way past. Left armed under
    // bypass, the next enable plays only the stage's contribution, with the
    // switch that did it out of sight - which sounds like the filter has
    // destroyed the audio.
    case 'denoise':
      return plain({
        denoise: { ...rack.denoise, enabled: !on, isolate: false },
      });
    case 'deEsser':
      return plain({
        deEsser: { ...rack.deEsser, enabled: !on, isolate: false },
      });
    case 'eq':
      return plain({ eq: { ...rack.eq, enabled: !on, isolate: false } });
    case 'footsteps':
      return plain({
        footsteps: { ...rack.footsteps, enabled: !on, isolate: false },
      });
    case 'exciter':
      return plain({
        exciter: { ...rack.exciter, enabled: !on, isolate: false },
      });
    case 'bassForge':
      return plain({
        bassForge: { ...rack.bassForge, enabled: !on, isolate: false },
      });
    case 'bassPunch':
      return plain({
        bassPunch: { ...rack.bassPunch, enabled: !on, isolate: false },
      });
    case 'dimension':
      return plain({ dimension: { ...rack.dimension, enabled: !on } });
    case 'room':
      return plain({ room: { ...rack.room, enabled: !on } });
    case 'dynamics':
      return plain({ dynamics: { ...rack.dynamics, enabled: !on } });
    case 'maximizer':
      return plain({ maximizer: { ...rack.maximizer, enabled: !on } });
    // The listener's output level, beside the presets like the Normalizer
    // (Ivan, 2026-11-26): switching it keeps the preset's name.
    case 'master':
      return {
        patch: { master: { ...rack.master, enabled: !on } },
        preservePreset: true,
      };
    default: {
      const unknown: never = section;
      throw new Error(`No switch for the stage ${String(unknown)}.`);
    }
  }
};

/**
 * Turns a stage over through a host's own edit of its rack and saves it, the
 * way a control let go is saved: what every one of the stage's switches runs.
 */
export const turnDspStage = (
  section: TDspSection,
  rack: IDspSettings,
  onPatch: (next: Partial<IDspSettings>, preservePreset: boolean) => void,
  onCommit: () => void,
) => {
  const { patch, preservePreset } = dspStageSwitch(section, rack);
  onPatch(patch, preservePreset);
  onCommit();
};
