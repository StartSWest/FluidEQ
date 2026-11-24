/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * MCP tool definitions exposed over the Tuning Agent Door (`tuningAgentDoor.ts`).
 *
 * Every tool speaks English for the model, validates arguments strictly before
 * calling `ITuningController`, and returns compact JSON payloads so assistants
 * can measure, reason, adjust, and verify without flooding their context.
 */

import { APO_LAYERS, TApoLayer } from '../../common/constants';
import { isTrebleDesign, type TTrebleDesign } from '../../common/filterDesign';
import type { TTuningAbMode } from '../../common/tuningAgent';
import type { IMcpTool, IMcpToolResult } from '../studioAgent/mcpProtocol';
import type { TPresetCatalogKind } from './tuningCatalog';
import type { ITuningController, TTuningOutcome } from './tuningController';
import { DSP_STAGE_NAMES, isRecord } from './tuningSafety';
import TUNING_TOOL_SCHEMAS from './tuningToolSchemas';

const okJson = (payload: unknown): IMcpToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
});

const fail = (message: string): IMcpToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
});

const fromOutcome = (outcome: TTuningOutcome): IMcpToolResult =>
  outcome.ok ? okJson(outcome) : fail(outcome.error);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const asRecordArray = (
  value: unknown,
): Record<string, unknown>[] | undefined =>
  Array.isArray(value) ? value.filter(isRecord) : undefined;

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;

const VALID_PRESET_KINDS: readonly TPresetCatalogKind[] = [
  'all',
  'dsp',
  'voicing',
  'driver',
  'mic',
  'user',
];

const createTuningTools = (controller: ITuningController): IMcpTool[] => [
  {
    name: 'get_audio_context',
    title: 'Get audio context',
    description:
      'Read FluidEQ current audio engine, now-playing music (track/artist/app from Library, Media tab, or Windows SMTC), outputs, microphones, exact composite effectiveCurve across all active layers, main EQ bands/tone/cuts, preamp, active layers (OPRA headphone, voicing, driver, Smart EQ, convolution), full DSP rack settings, microphone rack summary, and active AI tuning A/B session state. Call this first before changing any audio setting.',
    inputSchema: TUNING_TOOL_SCHEMAS.get_audio_context,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: async () => okJson(await controller.getContext()),
  },
  {
    name: 'measure_live_audio',
    title: 'Measure live audio',
    description:
      'Sample live audio telemetry directly from the running FluidEQ Engine (or Library DSP host). Returns nowPlaying metadata, 7-band tonal balance and 15-band ISO detail with deviations from FluidEQ mastering reference slope, LUFS/LRA, crest factor, spectral tilt, true peak/clipping risk, Auto-Preamp gain, stereo correlation, automatic acoustic observations, stage telemetry, and deltaFromPrevious when re-measuring after edits. Call before and after tuning to verify real acoustic movement and headroom.',
    inputSchema: TUNING_TOOL_SCHEMAS.measure_live_audio,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    call: async (args) => {
      const result = await controller.measureLiveAudio(asNumber(args.frames));
      return result.ok ? okJson(result.report) : fail(result.message);
    },
  },
  {
    name: 'get_tuning_guide',
    title: 'Get perceptual tuning guide & stage specs',
    description:
      'Look up FluidEQ audio-engineering recipes mapping subjective listener requests (vocal_clarity, warm_relaxed, punchy_bass, airy_detail, remove_mud, tame_harshness, wide_soundstage, small_speakers, late_night, gaming_footsteps, movies_dialogue, podcast_mic) to concrete frequencies, DSP stages, safe step sizes, and pitfalls, or inspect exact defaults and parameter ranges for any DSP stage.',
    inputSchema: TUNING_TOOL_SCHEMAS.get_tuning_guide,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: async (args) =>
      okJson(
        controller.getTuningGuide({
          goal: asString(args.goal),
          stage: asString(args.stage),
        }),
      ),
  },
  {
    name: 'search_headphone_correction',
    title: 'Search OPRA headphone database',
    description:
      'Search FluidEQ built-in OPRA headphone measurement database (12,000+ curves) by brand or model name, returning productId and available curveIds.',
    inputSchema: TUNING_TOOL_SCHEMAS.search_headphone_correction,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: async (args) => {
      const query = asString(args.query);
      if (query === undefined) {
        return fail('query must be a string.');
      }
      return okJson(
        controller.searchHeadphoneCorrection(query, asNumber(args.limit)),
      );
    },
  },
  {
    name: 'list_presets',
    title: 'List audio presets',
    description:
      'List built-in DSP chains, voicing target curves, transducer driver corrections, microphone profiles, and user-saved presets.',
    inputSchema: TUNING_TOOL_SCHEMAS.list_presets,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: async (args) => {
      const rawKind = asString(args.kind);
      const kind: TPresetCatalogKind =
        rawKind && VALID_PRESET_KINDS.includes(rawKind as TPresetCatalogKind)
          ? (rawKind as TPresetCatalogKind)
          : 'all';
      return okJson(
        controller.listPresets(
          kind,
          asString(args.query) ?? '',
          asNumber(args.limit),
        ),
      );
    },
  },
  {
    name: 'apply_headphone_correction',
    title: 'Apply OPRA headphone correction',
    description:
      'Load an OPRA headphone correction curve into the dedicated headphone layer (leaving user EQ bands untouched), adjust its intensity (0..1), or clear it.',
    inputSchema: TUNING_TOOL_SCHEMAS.apply_headphone_correction,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: async (args) =>
      fromOutcome(
        await controller.applyHeadphoneCorrection({
          productId: asString(args.productId),
          curveId: asString(args.curveId),
          intensity: asNumber(args.intensity),
          clear: asBoolean(args.clear),
        }),
      ),
  },
  {
    name: 'set_main_eq',
    title: 'Edit main EQ, tone, cuts, and layers',
    description:
      'Batch-edit main parametric EQ bands (upsert, replace, remove, or flatten), Tone (bass/mid/treble), 20 Hz/20 kHz cuts (0/12/24 dB/oct), EQ mode, Band Q, Treble design (precise/classic), and layer bypasses in one smooth 20 ms crossfaded engine update. Enforces ear-safe gain limits (-18..+12 dB) and headroom protection.',
    inputSchema: TUNING_TOOL_SCHEMAS.set_main_eq,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    call: async (args) => {
      const toneRaw = args.tone;
      let tone:
        { bass?: number; mid?: number; treble?: number } | null | undefined;
      if (toneRaw === null) {
        tone = null;
      } else if (isRecord(toneRaw)) {
        tone = {
          bass: asNumber(toneRaw.bass),
          mid: asNumber(toneRaw.mid),
          treble: asNumber(toneRaw.treble),
        };
      }
      const cutsRaw = isRecord(args.eqCuts) ? args.eqCuts : undefined;
      const trebleRaw = isRecord(args.trebleDesign)
        ? args.trebleDesign
        : undefined;
      const bypassRaw = isRecord(args.bypassLayers)
        ? args.bypassLayers
        : undefined;
      const bypassLayers: Partial<Record<TApoLayer, boolean>> | undefined =
        bypassRaw
          ? Object.fromEntries(
              APO_LAYERS.filter(
                (layer) => typeof bypassRaw[layer] === 'boolean',
              ).map((layer) => [layer, bypassRaw[layer] as boolean]),
            )
          : undefined;
      const eqModeRaw = asString(args.eqMode);
      const eqMode =
        eqModeRaw === 'normal' ||
        eqModeRaw === 'double' ||
        eqModeRaw === 'studio'
          ? eqModeRaw
          : undefined;
      const qRaw = asString(args.mainBandQ);
      const mainBandQ =
        qRaw === 'off' || qRaw === 'proportional' || qRaw === 'asymmetric'
          ? qRaw
          : undefined;

      return fromOutcome(
        await controller.setMainEq({
          enabled: asBoolean(args.enabled),
          clearBands: asBoolean(args.clearBands),
          replaceBands: asRecordArray(args.replaceBands),
          upsertBands: asRecordArray(args.upsertBands),
          removeBandIds: asStringArray(args.removeBandIds),
          tone,
          eqCuts: cutsRaw
            ? { low: asNumber(cutsRaw.low), high: asNumber(cutsRaw.high) }
            : undefined,
          eqMode,
          mainBandQ,
          trebleDesign: trebleRaw
            ? {
                eq: isTrebleDesign(trebleRaw.eq)
                  ? (trebleRaw.eq as TTrebleDesign)
                  : undefined,
                curves: isTrebleDesign(trebleRaw.curves)
                  ? (trebleRaw.curves as TTrebleDesign)
                  : undefined,
              }
            : undefined,
          bypassLayers,
        }),
      );
    },
  },
  {
    name: 'set_preamp',
    title: 'Configure preamp and Auto Normalize',
    description:
      'Toggle Auto Normalize or set manual preamp gain. Manual preamp is hard-clamped at <= 0 dB for hearing safety.',
    inputSchema: TUNING_TOOL_SCHEMAS.set_preamp,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: async (args) =>
      fromOutcome(
        await controller.setPreamp({
          autoNormalize: asBoolean(args.autoNormalize),
          manualPreAmpDb: asNumber(args.manualPreAmpDb),
        }),
      ),
  },
  {
    name: 'apply_preset',
    title: 'Apply factory or user preset',
    description:
      'Apply a complete DSP chain preset (sets both Preset curve layer and DSP rack), a voicing target curve, a transducer driver profile, a user preset, or clear presets with kind="none".',
    inputSchema: TUNING_TOOL_SCHEMAS.apply_preset,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: async (args) => {
      const kind = asString(args.kind);
      if (
        kind !== 'dsp' &&
        kind !== 'voicing' &&
        kind !== 'driver' &&
        kind !== 'user' &&
        kind !== 'none'
      ) {
        return fail('kind must be one of dsp, voicing, driver, user, none.');
      }
      return fromOutcome(
        await controller.applyPreset({
          kind,
          id: asString(args.id),
          intensity: asNumber(args.intensity),
        }),
      );
    },
  },
  {
    name: 'configure_dsp_stage',
    title: 'Configure DSP rack stage',
    description: `Enable/disable the DSP rack or low-latency gameMode, or patch any DSP stage (${DSP_STAGE_NAMES.join(', ')}). Inspect current stage keys via get_audio_context before patching. Automatically strips isolate flags and enforces safe limiter/master ceilings.`,
    inputSchema: TUNING_TOOL_SCHEMAS.configure_dsp_stage,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    call: async (args) =>
      fromOutcome(
        await controller.configureDspStage({
          enabled: asBoolean(args.enabled),
          gameMode: asBoolean(args.gameMode),
          stage: asString(args.stage),
          patch: isRecord(args.patch) ? args.patch : undefined,
          resetStage: asBoolean(args.resetStage),
        }),
      ),
  },
  {
    name: 'configure_mic_rack',
    title: 'Configure microphone rack',
    description:
      'Pick a built-in microphone profile (e.g. stream, podcast, call) and/or patch microphone stages (enabled, voice low-cut/proximity/deplosive/gate, denoise, deEsser, dynamics, eq, maximizer). Always enforces low-latency mic processing and ear-safe limits.',
    inputSchema: TUNING_TOOL_SCHEMAS.configure_mic_rack,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    call: async (args) =>
      fromOutcome(
        await controller.configureMicRack({
          guid: asString(args.guid),
          profileId: asString(args.profileId),
          patch: isRecord(args.patch) ? args.patch : undefined,
        }),
      ),
  },
  {
    name: 'tuning_session',
    title: 'Manage A/B compare, snapshot, revert, and save',
    description:
      'Control the AI tuning session safety net: inspect status, take a fresh baseline snapshot, A/B switch between original and tuned sound, revert all AI edits back to the listener original state, or save the current DSP tuning as a named user preset.',
    inputSchema: TUNING_TOOL_SCHEMAS.tuning_session,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    call: async (args) => {
      const action = asString(args.action);
      if (
        action !== 'status' &&
        action !== 'snapshot' &&
        action !== 'ab_compare' &&
        action !== 'revert' &&
        action !== 'save_preset'
      ) {
        return fail(
          'action must be one of status, snapshot, ab_compare, revert, save_preset.',
        );
      }
      const modeRaw = asString(args.mode);
      const mode: TTuningAbMode | undefined =
        modeRaw === 'original' || modeRaw === 'tuned' ? modeRaw : undefined;
      return fromOutcome(
        await controller.sessionAction({
          action,
          mode,
          presetName: asString(args.presetName),
        }),
      );
    },
  },
];

export default createTuningTools;
