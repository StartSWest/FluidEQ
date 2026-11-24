/** @jest-environment node */

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import {
  FilterTypeEnum,
  IAudioDevice,
  IFiltersMap,
  IOpraProduct,
  IPresetV2,
  IState,
  getDefaultState,
} from '../../../common/constants';
import {
  ANALYSIS_BINS,
  type IHostAnalysis,
} from '../../../common/dsp/analysisWire';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import { EMPTY_MIC_SOUND, type IMicSoundFile } from '../../../common/micSound';
import type { IUserDspPreset } from '../../../common/userPresetsFile';
import { createTuningAgentDoor } from '../../../main/tuningAgent/tuningAgentDoor';
import { createTuningController } from '../../../main/tuningAgent/tuningController';

const postMcp = (
  url: string,
  headers: Record<string, string>,
  body: unknown,
  method = 'POST',
): Promise<{ status: number; json: Record<string, unknown> | undefined }> =>
  new Promise((resolve, reject) => {
    const target = new URL(url);
    const raw = body === undefined ? '' : JSON.stringify(body);
    const req = http.request(
      {
        hostname: target.hostname,
        port: Number(target.port),
        path: target.pathname,
        method,
        headers: {
          ...(raw
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(raw),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: Record<string, unknown> | undefined;
          try {
            json = text
              ? (JSON.parse(text) as Record<string, unknown>)
              : undefined;
          } catch {
            json = undefined;
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on('error', reject);
    if (raw) {
      req.write(raw);
    }
    req.end();
  });

const FAKE_OUTPUT: IAudioDevice = {
  id: 'out-1',
  name: 'Studio Headphones',
  guid: '{11111111-2222-3333-4444-555555555555}',
  isDefault: true,
  isActive: true,
};

const FAKE_MIC_GUID = '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}';

const FAKE_OPRA_PRODUCTS: IOpraProduct[] = [
  {
    id: 'sennheiser::hd_650',
    vendor: 'Sennheiser',
    name: 'HD 650',
    subtype: 'over_ear',
    curves: [
      {
        id: 'oratory1990',
        details: 'Harman Over-Ear',
        author: 'oratory1990',
      },
    ],
  },
];

const FAKE_OPRA_PRESET: IPresetV2 = {
  preAmp: -4.2,
  filters: {
    hp1: {
      id: 'hp1',
      type: FilterTypeEnum.LSC,
      frequency: 105,
      gain: 5.5,
      quality: 0.71,
    },
  },
};

const makeSampleFrame = (): IHostAnalysis => ({
  sequence: 1,
  spectra: { eq: new Float32Array(ANALYSIS_BINS).fill(-22) },
  correlation: 0.92,
  peaks: [0.4, 0.38],
  bandAmounts: [],
  bandLevels: [],
  exciterBands: [0, 0, 0],
  exciterOrganic: 0,
  maximizerReductionDb: -0.8,
  dimensionGuard: 1,
  master: { autoHeadroomReductionDb: 0, autoHeadroomTruePeakDb: -2.1 },
  normalizer: {
    inputPeaks: [0.4, 0.38],
    outputPeaks: [0.4, 0.38],
    appliedGainDb: 0,
  },
  loudness: {
    momentaryLufs: -15.2,
    shortTermLufs: -15.0,
    integratedLufs: -15.4,
    rangeLu: 8.1,
  },
  denoise: {
    reductionDb: 0,
    noiseFloorDb: -70,
    clicksRepaired: 0,
    voiceUnderruns: 0,
    profileReady: false,
    voiceModelLoaded: false,
    floorBandsDb: [],
    hissReductionBandsDb: [],
  },
  bassForge: { inputDb: [], outputDb: [] },
  bassPunch: { transientGainDb: 0, sustainGainDb: 0, duckGainDb: 0 },
});

describe('Tuning Agent Door + Controller MCP end-to-end', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tuning-mcp-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serves all 11 MCP tools with transport auth, safety clamps, A/B compare, and full revert', async () => {
    const state: IState = getDefaultState();
    const initialFilterCount = Object.keys(state.filters).length;
    let micFile: IMicSoundFile = structuredClone(EMPTY_MIC_SOUND);
    let userPresets: IUserDspPreset[] = [];
    let outputNotifyCount = 0;
    let micNotifyCount = 0;
    let flushCount = 0;

    const controller = createTuningController({
      state,
      getEngine: () => 'fluid',
      getActiveOutput: () => FAKE_OUTPUT,
      getPlaybackOutput: () => FAKE_OUTPUT,
      getOutputs: () => [FAKE_OUTPUT],
      getMicrophones: async () => [
        {
          guid: FAKE_MIC_GUID,
          name: 'USB Mic',
          attached: true,
          backupExists: false,
        },
      ],
      getOpraProducts: () => FAKE_OPRA_PRODUCTS,
      getOpraPreset: () => FAKE_OPRA_PRESET,
      getOpraLabel: () => 'Sennheiser HD 650 · Harman Over-Ear',
      shieldReferenceBands: (filters: IFiltersMap) => filters,
      applyingLayer: (layer) => {
        state.bypassed = (state.bypassed ?? []).filter(
          (item) => item !== layer,
        );
      },
      switchToParametricEditing: () => {
        delete state.graphicEq;
      },
      flushAudioState: async () => {
        flushCount += 1;
        return { ok: true };
      },
      notifyOutputChanged: () => {
        outputNotifyCount += 1;
      },
      readMicSound: () => micFile,
      writeMicSound: async (guid, entry) => {
        micFile = { ...micFile, mics: { ...micFile.mics, [guid]: entry } };
        return 'written';
      },
      notifyMicChanged: () => {
        micNotifyCount += 1;
      },
      loadUserPresets: () => userPresets,
      saveUserPresets: (next) => {
        userPresets = next;
      },
      sampleEngineAudio: async () => ({
        frames: [{ sampleRate: 48_000, frame: makeSampleFrame() }],
        preamp: { gainDb: -2.5, enabled: true, active: true },
      }),
      readLibraryAudioFrames: () => [],
      getNowPlaying: async () => ({
        source: 'media-tab',
        isPlaying: true,
        app: 'YouTube Music',
        title: 'Hotel California',
        artist: 'Eagles',
      }),
    });

    const door = createTuningAgentDoor({
      userDataDir: tmpDir,
      getMainWindow: () => null,
      controller,
      appVersion: '2.5.2',
      preferredPort: 0,
      registerIpc: false,
    });

    try {
      expect(door.state().open).toBe(false);
      const opened = await door.setOpen(true);
      expect(opened.open).toBe(true);
      if (!opened.open) {
        return;
      }

      const auth = { Authorization: `Bearer ${opened.key}` };

      const unauth = await postMcp(
        opened.url,
        {},
        { jsonrpc: '2.0', id: 1, method: 'ping' },
      );
      expect(unauth.status).toBe(401);

      const badOrigin = await postMcp(
        opened.url,
        { ...auth, Origin: 'https://evil.example' },
        { jsonrpc: '2.0', id: 1, method: 'ping' },
      );
      expect(badOrigin.status).toBe(403);

      const getMethod = await postMcp(opened.url, auth, undefined, 'GET');
      expect(getMethod.status).toBe(405);

      const init = await postMcp(opened.url, auth, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25' },
      });
      expect(init.status).toBe(200);

      const list = await postMcp(opened.url, auth, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });
      const listedTools = (
        list.json?.result as { tools: Array<{ name: string }> }
      ).tools;
      expect(listedTools.map((t) => t.name)).toHaveLength(12);

      const call = async (name: string, args: Record<string, unknown> = {}) => {
        const res = await postMcp(opened.url, auth, {
          jsonrpc: '2.0',
          id: 99,
          method: 'tools/call',
          params: { name, arguments: args },
        });
        expect(res.status).toBe(200);
        const result = res.json?.result as {
          content: Array<{ text: string }>;
          isError?: boolean;
        };
        return {
          isError: result.isError === true,
          parsed: result.isError
            ? result.content[0].text
            : (JSON.parse(result.content[0].text) as Record<string, unknown>),
        };
      };

      const ctx = await call('get_audio_context');
      expect(ctx.isError).toBe(false);
      expect(
        (ctx.parsed as { nowPlaying: { title: string } }).nowPlaying.title,
      ).toBe('Hotel California');
      expect(
        (ctx.parsed as { effectiveCurve: { frequenciesHz: number[] } })
          .effectiveCurve.frequenciesHz,
      ).toHaveLength(15);

      const guide = await call('get_tuning_guide', {
        goal: 'small_speakers',
        stage: 'bassForge',
      });
      expect(guide.isError).toBe(false);
      expect(
        (guide.parsed as { recipes: Array<{ goal: string }> }).recipes[0].goal,
      ).toBe('small_speakers');
      expect(
        (guide.parsed as { stageDetail: { stage: string } }).stageDetail.stage,
      ).toBe('bassForge');

      const measured = await call('measure_live_audio', { frames: 2 });
      expect(measured.isError).toBe(false);
      expect((measured.parsed as { hasSignal: boolean }).hasSignal).toBe(true);
      expect(
        (measured.parsed as { isoBands: unknown[] }).isoBands,
      ).toHaveLength(15);
      expect(
        (measured.parsed as { nowPlaying: { app: string } }).nowPlaying.app,
      ).toBe('YouTube Music');

      const measuredAgain = await call('measure_live_audio', { frames: 2 });
      expect(measuredAgain.isError).toBe(false);
      expect(
        (measuredAgain.parsed as { deltaFromPrevious?: unknown })
          .deltaFromPrevious,
      ).toBeDefined();

      const opra = await call('search_headphone_correction', {
        query: 'HD 650',
      });
      expect((opra.parsed as { totalMatches: number }).totalMatches).toBe(1);

      const appliedHp = await call('apply_headphone_correction', {
        productId: 'sennheiser::hd_650',
        curveId: 'oratory1990',
        intensity: 0.85,
      });
      expect(appliedHp.isError).toBe(false);
      expect(state.headset).toBe('sennheiser::hd_650');
      expect(state.headphone?.intensity).toBe(0.85);
      expect(Object.keys(state.filters)).toHaveLength(initialFilterCount);

      const preampRes = await call('set_preamp', {
        autoNormalize: false,
        manualPreAmpDb: 8,
      });
      expect(preampRes.isError).toBe(false);
      expect(state.preAmp).toBe(0);
      expect(
        (preampRes.parsed as { warnings: string[] }).warnings.length,
      ).toBeGreaterThan(0);

      const eqRes = await call('set_main_eq', {
        replaceBands: [
          { type: FilterTypeEnum.LSC, frequency: 80, gain: 6, quality: 0.7 },
          {
            type: FilterTypeEnum.PK,
            frequency: 3200,
            gain: -2.5,
            quality: 1.5,
          },
        ],
        tone: { bass: 2, mid: 0, treble: -1 },
        eqCuts: { low: 12, high: 0 },
      });
      expect(eqRes.isError).toBe(false);
      expect(Object.keys(state.filters)).toHaveLength(2);
      expect(state.preAmp).toBeLessThanOrEqual(-6);
      expect(state.eqCuts?.low).toBe(12);

      const firstPreset = DSP_PRESETS[0];
      const presetRes = await call('apply_preset', {
        kind: 'dsp',
        id: firstPreset.id,
      });
      expect(presetRes.isError).toBe(false);
      expect(state.dsp?.enabled).toBe(firstPreset.settings.enabled);

      const stageRes = await call('configure_dsp_stage', {
        enabled: true,
        stage: 'deEsser',
        patch: { enabled: true, isolate: true },
      });
      expect(stageRes.isError).toBe(false);
      expect(state.dsp?.deEsser.enabled).toBe(true);
      expect(state.dsp?.deEsser.isolate).toBe(false);

      const micRes = await call('configure_mic_rack', {
        profileId: 'podcast',
        patch: { voice: { enabled: true, lowCutHz: 85 } },
      });
      expect(micRes.isError).toBe(false);
      expect(micFile.mics[FAKE_MIC_GUID]?.settings.voice?.lowCutHz).toBe(85);
      expect(micNotifyCount).toBe(1);

      const savedPreset = await call('tuning_session', {
        action: 'save_preset',
        presetName: 'AI Warm Studio',
      });
      expect(savedPreset.isError).toBe(false);
      expect(userPresets).toHaveLength(1);
      expect(userPresets[0].name).toBe('AI Warm Studio');

      const abOriginal = await call('tuning_session', {
        action: 'ab_compare',
        mode: 'original',
      });
      expect(abOriginal.isError).toBe(false);
      expect(state.headset).toBeUndefined();
      expect(Object.keys(state.filters)).toHaveLength(initialFilterCount);

      const abTuned = await call('tuning_session', {
        action: 'ab_compare',
        mode: 'tuned',
      });
      expect(abTuned.isError).toBe(false);
      expect(state.headset).toBe('sennheiser::hd_650');
      expect(Object.keys(state.filters)).toHaveLength(2);

      const reverted = await call('tuning_session', { action: 'revert' });
      expect(reverted.isError).toBe(false);
      expect(state.headset).toBeUndefined();
      expect(Object.keys(state.filters)).toHaveLength(initialFilterCount);
      expect(controller.getSession().hasSnapshot).toBe(false);
      expect(flushCount).toBeGreaterThan(0);
      expect(outputNotifyCount).toBeGreaterThan(0);

      const rotated = door.rotateKey();
      expect(rotated.open).toBe(true);
      if (!rotated.open) {
        throw new Error('Expected door to remain open after key rotation');
      }
      const oldDenied = await postMcp(opened.url, auth, {
        jsonrpc: '2.0',
        id: 5,
        method: 'ping',
      });
      expect(oldDenied.status).toBe(401);

      const newOk = await postMcp(
        rotated.url,
        { Authorization: `Bearer ${rotated.key}` },
        { jsonrpc: '2.0', id: 6, method: 'ping' },
      );
      expect(newOk.status).toBe(200);
    } finally {
      await door.dispose();
    }
  });
});
