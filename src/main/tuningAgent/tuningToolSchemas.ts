/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * JSON Schema contracts for the 11 Tuning Agent MCP tools.
 */

import { APO_LAYERS, FilterTypeEnum } from '../../common/constants';
import { TUNING_GOAL_IDS } from './tuningGuide';
import { DSP_STAGE_NAMES } from './tuningSafety';

const FILTER_TYPE_ENUM = Object.values(FilterTypeEnum);

const BAND_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Existing band id (omit to add a new band).',
    },
    type: { type: 'string', enum: FILTER_TYPE_ENUM },
    frequency: {
      type: 'number',
      description: 'Center frequency in Hz (10..24000).',
    },
    gain: {
      type: 'number',
      description: 'Gain in dB (ear-safe AI clamp: -18..+12).',
    },
    quality: { type: 'number', description: 'Q factor (0.05..20).' },
    isEnabled: { type: 'boolean' },
    channel: { type: 'string', enum: ['both', 'left', 'right'] },
  },
};

const TUNING_TOOL_SCHEMAS = {
  get_audio_context: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  measure_live_audio: {
    type: 'object',
    properties: {
      frames: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        description: 'Number of live engine frames to average (default 6).',
      },
    },
    additionalProperties: false,
  },
  get_tuning_guide: {
    type: 'object',
    properties: {
      goal: {
        type: 'string',
        enum: ['all', ...TUNING_GOAL_IDS],
        description:
          'Perceptual listening or mic goal recipe (omit or "all" for overview).',
      },
      stage: {
        type: 'string',
        enum: [...DSP_STAGE_NAMES],
        description:
          'Optional DSP stage name to inspect exact defaults, ranges, and audible behavior.',
      },
    },
    additionalProperties: false,
  },
  search_headphone_correction: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Brand/model search terms, e.g. "Sennheiser HD 650".',
      },
      limit: { type: 'integer', minimum: 1, maximum: 50 },
    },
    required: ['query'],
    additionalProperties: false,
  },
  list_presets: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['all', 'dsp', 'voicing', 'driver', 'mic', 'user'],
      },
      query: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
    additionalProperties: false,
  },
  apply_headphone_correction: {
    type: 'object',
    properties: {
      productId: { type: 'string' },
      curveId: { type: 'string' },
      intensity: { type: 'number', minimum: 0, maximum: 1 },
      clear: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  set_main_eq: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        description: 'Master FluidEQ power switch.',
      },
      clearBands: {
        type: 'boolean',
        description: 'Reset bands to flat default layout.',
      },
      replaceBands: { type: 'array', items: BAND_SCHEMA },
      upsertBands: { type: 'array', items: BAND_SCHEMA },
      removeBandIds: { type: 'array', items: { type: 'string' } },
      tone: {
        oneOf: [
          { type: 'null' },
          {
            type: 'object',
            properties: {
              bass: { type: 'number', minimum: -12, maximum: 12 },
              mid: { type: 'number', minimum: -12, maximum: 12 },
              treble: { type: 'number', minimum: -12, maximum: 12 },
            },
          },
        ],
      },
      eqCuts: {
        type: 'object',
        properties: {
          low: { type: 'integer', enum: [0, 12, 24] },
          high: { type: 'integer', enum: [0, 12, 24] },
        },
      },
      eqMode: { type: 'string', enum: ['normal', 'double', 'studio'] },
      mainBandQ: {
        type: 'string',
        enum: ['off', 'proportional', 'asymmetric'],
      },
      trebleDesign: {
        type: 'object',
        properties: {
          eq: { type: 'string', enum: ['precise', 'classic'] },
          curves: { type: 'string', enum: ['precise', 'classic'] },
        },
      },
      bypassLayers: {
        type: 'object',
        description: `Map of layer (${APO_LAYERS.join(', ')}) to boolean bypass state.`,
        additionalProperties: { type: 'boolean' },
      },
    },
    additionalProperties: false,
  },
  set_preamp: {
    type: 'object',
    properties: {
      autoNormalize: { type: 'boolean' },
      manualPreAmpDb: { type: 'number', minimum: -60, maximum: 0 },
    },
    additionalProperties: false,
  },
  apply_preset: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['dsp', 'voicing', 'driver', 'user', 'none'],
      },
      id: { type: 'string' },
      intensity: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['kind'],
    additionalProperties: false,
  },
  configure_dsp_stage: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        description: 'Root DSP rack power switch.',
      },
      gameMode: {
        type: 'boolean',
        description: 'Low-latency gaming mode switch.',
      },
      stage: { type: 'string', enum: [...DSP_STAGE_NAMES] },
      patch: {
        type: 'object',
        description: 'Partial settings object for the named stage.',
      },
      resetStage: {
        type: 'boolean',
        description: 'Reset the named stage to factory defaults.',
      },
    },
    additionalProperties: false,
  },
  configure_mic_rack: {
    type: 'object',
    properties: {
      guid: {
        type: 'string',
        description: 'Microphone endpoint GUID (omit to target selected mic).',
      },
      profileId: {
        type: 'string',
        description: 'Optional mic profile id from list_presets(kind="mic").',
      },
      patch: {
        type: 'object',
        description:
          'Partial mic rack patch (enabled, voice, denoise, deEsser, dynamics, eq, etc.).',
      },
    },
    additionalProperties: false,
  },
  tuning_session: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'snapshot', 'ab_compare', 'revert', 'save_preset'],
      },
      mode: {
        type: 'string',
        enum: ['original', 'tuned'],
        description: 'Target side for ab_compare (omit to toggle).',
      },
      presetName: {
        type: 'string',
        description: 'Preset name for save_preset.',
      },
    },
    required: ['action'],
    additionalProperties: false,
  },
} as const;

export default TUNING_TOOL_SCHEMAS;
