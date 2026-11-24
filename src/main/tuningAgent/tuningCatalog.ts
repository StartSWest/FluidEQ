/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Pure read/query projections for the Tuning MCP Door: summarizes active DSP
 * stages, formats the current audio context, searches the OPRA headphone
 * database, and lists factory/user presets.
 */

import type {
  IFluidEngineMicrophone,
  TAudioEngine,
} from '../../common/audioEngine';
import {
  IAudioDevice,
  IOpraProduct,
  IState,
  isBandEnabled,
} from '../../common/constants';
import { DRIVER_PROFILES } from '../../common/driver';
import { DSP_DEFAULTS, IDspSettings } from '../../common/dsp/chain';
import { DSP_PRESETS } from '../../common/dsp/presets';
import { DEFAULT_EQ_CUTS } from '../../common/eqCuts';
import { MIC_PROFILE_IDS } from '../../common/mic/micProfiles';
import type { IMicSoundFile } from '../../common/micSound';
import type { ITuningSessionSummary } from '../../common/tuningAgent';
import type { IUserDspPreset } from '../../common/userPresetsFile';
import { VOICING_PROFILES } from '../../common/voicing';
import { evaluateEffectiveCurve } from './eqResponse';
import type { INowPlayingInfo } from './nowPlaying';

export const summarizeActiveStages = (dsp: IDspSettings): string[] => {
  const active: string[] = [];
  if (dsp.normalizer.mode !== 'off') {
    active.push('normalizer');
  }
  if (dsp.denoise.enabled) {
    active.push('denoise');
  }
  if (dsp.deEsser.enabled) {
    active.push('deEsser');
  }
  if (dsp.eq.enabled) {
    active.push('eq');
  }
  if (dsp.footsteps.enabled) {
    active.push('footsteps');
  }
  if (dsp.dynamics.enabled) {
    active.push('dynamics');
  }
  if (dsp.exciter.enabled) {
    active.push('exciter');
  }
  if (dsp.bassForge.enabled) {
    active.push('bassForge');
  }
  if (dsp.bassPunch.enabled) {
    active.push('bassPunch');
  }
  if (dsp.dimension.enabled) {
    active.push('dimension');
  }
  if (dsp.maximizer.enabled) {
    active.push('maximizer');
  }
  if (dsp.master.enabled) {
    active.push('master');
  }
  if (dsp.room.enabled) {
    active.push('room');
  }
  return active;
};

export interface IAudioContextInput {
  engine: TAudioEngine | null;
  state: IState;
  activeOutput?: IAudioDevice;
  playbackOutput?: IAudioDevice;
  outputs: readonly IAudioDevice[];
  microphones: readonly IFluidEngineMicrophone[];
  headphoneLabel: string;
  micFile: IMicSoundFile;
  session: ITuningSessionSummary;
  nowPlaying?: INowPlayingInfo;
}

export const buildAudioContext = ({
  engine,
  state,
  activeOutput,
  playbackOutput,
  outputs,
  microphones,
  headphoneLabel,
  micFile,
  session,
  nowPlaying,
}: IAudioContextInput) => {
  const dsp = state.dsp ?? DSP_DEFAULTS;
  const bands = Object.values(state.filters)
    .sort((a, b) => a.frequency - b.frequency)
    .map((band) => ({
      id: band.id,
      type: band.type,
      frequency: band.frequency,
      gain: band.gain,
      quality: band.quality,
      enabled: isBandEnabled(band),
      channel: band.channel ?? 'both',
    }));

  return {
    engine,
    isEnabled: state.isEnabled,
    nowPlaying: nowPlaying ?? { source: 'none', isPlaying: false },
    effectiveCurve: evaluateEffectiveCurve(state),
    activeOutput: activeOutput
      ? {
          id: activeOutput.id,
          name: activeOutput.name,
          guid: activeOutput.guid,
        }
      : null,
    playbackOutput: playbackOutput
      ? {
          id: playbackOutput.id,
          name: playbackOutput.name,
          guid: playbackOutput.guid,
        }
      : null,
    outputs: outputs.map((o) => ({
      id: o.id,
      name: o.name,
      guid: o.guid,
      isDefault: o.isDefault,
    })),
    microphones: microphones.map((m) => ({
      guid: m.guid,
      name: m.name,
      attached: m.attached,
    })),
    preAmp: {
      manualDb: state.preAmp,
      autoNormalize: state.isAutoPreAmpOn,
    },
    mainEq: {
      isFlat: Boolean(state.isFlat),
      eqMode: state.eqMode ?? 'normal',
      mainBandQ: state.mainBandQ ?? 'off',
      trebleDesigns: state.trebleDesigns ?? {
        eq: 'precise',
        curves: 'precise',
      },
      tone: state.tone ?? { bass: 0, mid: 0, treble: 0 },
      eqCuts: state.eqCuts ?? DEFAULT_EQ_CUTS,
      bandCount: bands.length,
      bands,
    },
    layers: {
      bypassed: state.bypassed ?? [],
      headphone: state.headphone
        ? {
            productId: state.headset ?? '',
            curveId: state.headsetTarget ?? '',
            label: headphoneLabel,
            intensity: state.headphone.intensity,
            bandCount: Object.keys(state.headphone.filters).length,
          }
        : null,
      voicing: state.voicing?.profileId
        ? {
            profileId: state.voicing.profileId,
            intensity: state.voicing.intensity,
          }
        : null,
      driver: state.driver?.profileId
        ? {
            profileId: state.driver.profileId,
            intensity: state.driver.intensity,
          }
        : null,
      smartEqActive: Boolean(
        state.smartEq && Object.keys(state.smartEq.filters).length > 0,
      ),
      convolutionActive: Boolean(state.convolution?.fileName),
    },
    dspRack: {
      enabled: dsp.enabled,
      presetId: dsp.presetId,
      gameMode: dsp.gameMode,
      activeStages: summarizeActiveStages(dsp),
      settings: dsp,
    },
    micRack: {
      selectedGuid: micFile.selected,
      configuredMics: Object.entries(micFile.mics).map(([guid, entry]) => ({
        guid,
        name: entry.name,
        profileId: entry.profileId,
        tuned: entry.tuned,
        enabled: entry.settings.enabled,
        voice: entry.settings.voice,
        activeStages: summarizeActiveStages(entry.settings),
      })),
    },
    session,
  };
};

export const searchOpraProducts = (
  products: readonly IOpraProduct[],
  query: string,
  limit = 15,
) => {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const max = Math.max(1, Math.min(50, Math.round(limit)));
  const matches = products
    .filter((product) => {
      if (tokens.length === 0) {
        return true;
      }
      const hay =
        `${product.vendor} ${product.name} ${product.id}`.toLowerCase();
      return tokens.every((token) => hay.includes(token));
    })
    .slice(0, max)
    .map((product) => ({
      productId: product.id,
      vendor: product.vendor,
      name: product.name,
      curves: product.curves.map((curve) => ({
        curveId: curve.id,
        details: curve.details,
        author: curve.author,
      })),
    }));
  return { query, totalMatches: matches.length, matches };
};

export type TPresetCatalogKind =
  'all' | 'dsp' | 'voicing' | 'driver' | 'mic' | 'user';

export const listCatalogPresets = (
  userPresets: readonly IUserDspPreset[],
  kind: TPresetCatalogKind = 'all',
  query = '',
  limit = 40,
) => {
  const needle = query.trim().toLowerCase();
  const max = Math.max(1, Math.min(100, Math.round(limit)));
  const keep = (text: string) => !needle || text.toLowerCase().includes(needle);

  return {
    ...(kind === 'all' || kind === 'dsp'
      ? {
          dsp: DSP_PRESETS.filter((p) => keep(`${p.id} ${p.group}`))
            .slice(0, max)
            .map((p) => ({
              id: p.id,
              group: p.group,
              hasCurve: Boolean(p.curve),
              gameMode: p.settings.gameMode,
              activeStages: summarizeActiveStages(p.settings),
            })),
        }
      : {}),
    ...(kind === 'all' || kind === 'voicing'
      ? {
          voicing: VOICING_PROFILES.filter((v) => keep(`${v.id} ${v.group}`))
            .slice(0, max)
            .map((v) => ({ id: v.id, group: v.group })),
        }
      : {}),
    ...(kind === 'all' || kind === 'driver'
      ? {
          driver: DRIVER_PROFILES.filter((d) => keep(`${d.id} ${d.category}`))
            .slice(0, max)
            .map((d) => ({ id: d.id, category: d.category })),
        }
      : {}),
    ...(kind === 'all' || kind === 'mic'
      ? { mic: MIC_PROFILE_IDS.filter((id) => keep(id)) }
      : {}),
    ...(kind === 'all' || kind === 'user'
      ? {
          user: userPresets
            .filter((p) => keep(`${p.id} ${p.name}`))
            .slice(0, max)
            .map((p) => ({
              id: p.id,
              name: p.name,
              hasCurve: Boolean(p.curve),
              activeStages: summarizeActiveStages(p.settings),
            })),
        }
      : {}),
  };
};
