/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every shipped DSP recipe over real music, through the native host.
 *
 * A catalogue can be numerically valid and still be unusable: several stages
 * can each add safe gain and leave their sum pinned to the final limiter, or a
 * cleanup recipe can remove enough clean programme to sound watery. These are
 * whole-chain failures, so this renders whole chains and measures their result.
 * It cannot decide whether a tonal choice is tasteful; that final judgement is
 * still a listening test in the real window.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
  BASS_FORGE_PRESET_BY_ID,
  bassForgePresetSettings,
} from '../../src/common/dsp/bassForgePresets';
import {
  BASS_PUNCH_PRESET_BY_ID,
  bassPunchPresetSettings,
} from '../../src/common/dsp/bassPunchPresets';
import { DSP_DEFAULTS, IDspSettings } from '../../src/common/dsp/chain';
import { encodeChainSettings } from '../../src/common/dsp/chainWire';
import {
  COMPRESSOR_PRESET_BY_ID,
  compressorPresetSettings,
} from '../../src/common/dsp/compressorPresets';
import {
  DENOISE_PRESET_BY_ID,
  denoisePresetSettings,
} from '../../src/common/dsp/denoisePresets';
import {
  DIMENSION_PRESET_BY_ID,
  dimensionPresetSettings,
} from '../../src/common/dsp/dimensionPresets';
import {
  EQ_PRESETS,
  eqSettingsForPreset,
} from '../../src/common/dsp/eqPresets';
import {
  EXCITER_PRESET_BY_ID,
  exciterPresetSettings,
} from '../../src/common/dsp/exciterPresets';
import {
  MASTER_PRESET_BY_ID,
  masterPresetSettings,
} from '../../src/common/dsp/masterPresets';
import {
  MAXIMIZER_PRESET_BY_ID,
  maximizerPresetSettings,
} from '../../src/common/dsp/maximizerPresets';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';
import { DSP_PRESETS } from '../../src/common/dsp/presets';
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';

interface IAudio {
  rate: number;
  channels: Float32Array[];
}

interface IMetrics {
  finite: boolean;
  peak: number;
  rms: number;
  dc: number;
  nearCeilingFraction: number;
  crestDb: number;
}

interface IFilterPresetCase {
  family: string;
  id: string;
  settings: IDspSettings;
}

let failures = 0;
const line = (message: string) => process.stdout.write(`${message}\n`);
const check = (condition: boolean, what: string) => {
  line(`  ${condition ? 'ok  ' : 'FAIL'} ${what}`);
  if (!condition) {
    failures += 1;
  }
};

/** The host writes float WAV, but walking chunks keeps the reader honest. */
const readWav = (file: string): IAudio => {
  const bytes = readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 12;
  let format = 0;
  let channelCount = 0;
  let rate = 0;
  let bits = 0;
  let dataAt = 0;
  let dataBytes = 0;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('ascii', at, at + 4);
    const size = view.getUint32(at + 4, true);
    if (id === 'fmt ') {
      format = view.getUint16(at + 8, true);
      channelCount = view.getUint16(at + 10, true);
      rate = view.getUint32(at + 12, true);
      bits = view.getUint16(at + 22, true);
    } else if (id === 'data') {
      dataAt = at + 8;
      dataBytes = size;
      break;
    }
    at += 8 + size + (size % 2);
  }
  if (format !== 3 || bits !== 32 || channelCount < 1 || dataAt === 0) {
    throw new Error(`preset smoke: unreadable float WAV ${file}`);
  }
  const frames = Math.floor(dataBytes / (4 * channelCount));
  const channels = Array.from(
    { length: channelCount },
    () => new Float32Array(frames),
  );
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      channels[channel][frame] = view.getFloat32(
        dataAt + (frame * channelCount + channel) * 4,
        true,
      );
    }
  }
  return { rate, channels };
};

/** Ignore filter warm-up, then measure both channels as one programme. */
const measure = (audio: IAudio): IMetrics => {
  const frames = audio.channels[0]?.length ?? 0;
  const skip = Math.min(Math.floor(audio.rate / 4), Math.floor(frames / 4));
  let finite = true;
  let peak = 0;
  let sum = 0;
  let sumSquared = 0;
  let nearCeiling = 0;
  let count = 0;
  audio.channels.forEach((channel) => {
    for (let at = skip; at < channel.length; at += 1) {
      const sample = channel[at];
      if (!Number.isFinite(sample)) {
        finite = false;
      }
      const absolute = Math.abs(sample);
      peak = Math.max(peak, absolute);
      sum += sample;
      sumSquared += sample * sample;
      nearCeiling += absolute >= 0.999 ? 1 : 0;
      count += 1;
    }
  });
  const rms = Math.sqrt(sumSquared / Math.max(1, count));
  return {
    finite,
    peak,
    rms,
    dc: Math.abs(sum / Math.max(1, count)),
    nearCeilingFraction: nearCeiling / Math.max(1, count),
    crestDb: 20 * Math.log10(Math.max(peak, 1e-12) / Math.max(rms, 1e-12)),
  };
};

const passesShapeSafety = (metrics: IMetrics): boolean =>
  metrics.finite &&
  metrics.peak <= 1.0001 &&
  metrics.rms > 0.003 &&
  metrics.nearCeilingFraction < 0.0001 &&
  metrics.crestDb > 2 &&
  metrics.dc < 0.02;

const dbRatio = (value: number, reference: number): number =>
  20 * Math.log10(Math.max(value, 1e-12) / Math.max(reference, 1e-12));

/**
 * Every option exposed by every filter picker, materialised in isolation.
 *
 * Full chains catch interactions; these cases catch a profile that is broken
 * even before another stage touches it. Normalizer has modes rather than a
 * preset catalogue, and Crossfade is playback behaviour, so neither belongs
 * in this profile matrix.
 */
const filterPresetCases = (): readonly IFilterPresetCase[] => [
  ...Object.values(DENOISE_PRESET_BY_ID).map((preset) => ({
    family: 'denoise',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      denoise: denoisePresetSettings(preset.id, true),
    },
  })),
  ...EQ_PRESETS.map((preset) => ({
    family: 'equaliser',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      eq: eqSettingsForPreset({ ...DSP_DEFAULTS.eq, enabled: true }, preset),
    },
  })),
  ...Object.values(EXCITER_PRESET_BY_ID).map((preset) => ({
    family: 'exciter',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      exciter: exciterPresetSettings(preset.id, true),
    },
  })),
  ...Object.values(BASS_FORGE_PRESET_BY_ID).map((preset) => ({
    family: 'bass-forge',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      bassForge: bassForgePresetSettings(preset.id, true),
    },
  })),
  ...Object.values(BASS_PUNCH_PRESET_BY_ID).map((preset) => ({
    family: 'bass-punch',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      bassPunch: bassPunchPresetSettings(preset.id, true),
    },
  })),
  ...Object.values(COMPRESSOR_PRESET_BY_ID).map((preset) => ({
    family: 'compressor',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      compressor: compressorPresetSettings(preset.id, true),
    },
  })),
  ...Object.values(DIMENSION_PRESET_BY_ID).map((preset) => ({
    family: 'dimension',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      dimension: dimensionPresetSettings(preset.id, true),
    },
  })),
  ...Object.values(MAXIMIZER_PRESET_BY_ID).map((preset) => ({
    family: 'maximizer',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      maximizer: maximizerPresetSettings(preset.id, true),
    },
  })),
  ...Object.values(MASTER_PRESET_BY_ID).map((preset) => ({
    family: 'master',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      master: {
        ...masterPresetSettings(preset.id, DSP_DEFAULTS.master),
        enabled: true,
        loudnessMaximize: true,
      },
    },
  })),
];

const main = async (): Promise<void> => {
  const executablePath = findDspHostExecutable();
  if (!executablePath) {
    throw new Error('preset smoke: no host executable; run pnpm build first');
  }
  // An optional fixture keeps catalogue tuning honest across more than the
  // one song this script originally hard-coded. CI still gets its stable
  // default; a full audit runs the second repository fixture as another pass.
  const argumentsAfterScript = process.argv.slice(2);
  const chainsOnly = argumentsAfterScript.includes('--chains-only');
  const fixture = argumentsAfterScript.find(
    (argument) => argument !== '--chains-only',
  );
  const source = fixture
    ? path.resolve(fixture)
    : path.resolve(__dirname, '../..', 'karaoke_instrumental.mp3');
  if (!existsSync(source)) {
    throw new Error(`preset smoke: missing fixture ${source}`);
  }
  const scratch = mkdtempSync(path.join(tmpdir(), 'fluideq-presets-'));
  const host = new DspHostSupervisor({
    executablePath,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
  });

  const render = async (
    settings: IDspSettings,
    name: string,
    inputGainDb = 0,
  ): Promise<IMetrics> => {
    const target = path.join(scratch, `${name}.wav`);
    check(
      await host.applyChain(encodeChainSettings(settings)),
      `${name}: applies`,
    );
    check(await host.seekDeck(0, 12), `${name}: seeks`);
    check(
      await host.setTrackGains(
        inputGainDb,
        settings.master.enabled &&
          settings.master.loudnessMaximize &&
          !settings.master.matchedBypass
          ? 4
          : 0,
        true,
      ),
      `${name}: gains apply`,
    );
    // Warm the decoder and every stateful stage by processing actual blocks.
    // This waits on completed engine work rather than guessing with a timer.
    check(await host.runOfflineBlocks(96), `${name}: pre-rolls`);
    check(await host.renderToFile(96_000, target), `${name}: renders`);
    return measure(readWav(target));
  };

  try {
    line('preset chains, through the native host');
    check(await host.start(), 'the host starts');
    check(await host.loadDeck(0, source), 'the music fixture loads');
    check(await host.setPlaying(true), 'the transport starts');

    const dry = await render(DSP_DEFAULTS, 'dry-reference');
    check(passesShapeSafety(dry), 'the reference is valid real music');

    // Positive control: a flat-topped constant must fail the same predicate.
    const clipped = measure({
      rate: 48_000,
      channels: [new Float32Array(48_000).fill(1)],
    });
    check(
      !passesShapeSafety(clipped),
      'the safety check rejects clipped audio',
    );

    for (const preset of DSP_PRESETS) {
      // eslint-disable-next-line no-await-in-loop -- one native chain owns one deck.
      const result = await render(preset.settings, `chain-${preset.id}`);
      const levelDb = dbRatio(result.rms, dry.rms);
      line(
        `       ${preset.id.padEnd(16)} peak ${result.peak.toFixed(4)} · RMS ${levelDb.toFixed(1).padStart(5)} dB vs dry · crest ${result.crestDb.toFixed(1)} dB`,
      );
      check(
        passesShapeSafety(result),
        `${preset.id}: no clip, silence, DC, or crushing`,
      );
      check(
        levelDb > -1.5 && levelDb < 1.6,
        `${preset.id}: stays within -1.5/+1.6 dB of DSP Off`,
      );
      if (preset.id === 'reference') {
        check(
          Math.abs(levelDb) < 0.5,
          'reference: gain-matched level stays within 0.5 dB of DSP Off',
        );
      }
    }

    if (!chainsOnly) {
      line('every filter profile, alone over real music');
      const standaloneDry = await render(
        DSP_DEFAULTS,
        'filter-dry-reference',
        -6,
      );
      for (const preset of filterPresetCases()) {
        // eslint-disable-next-line no-await-in-loop -- one native chain owns one deck.
        const result = await render(
          preset.settings,
          `${preset.family}-${preset.id}`,
          -6,
        );
        const levelDb = dbRatio(result.rms, standaloneDry.rms);
        line(
          `       ${preset.family.padEnd(12)} ${preset.id.padEnd(16)} level ${levelDb.toFixed(2).padStart(6)} dB vs dry`,
        );
        check(
          passesShapeSafety(result),
          `${preset.family}/${preset.id}: no clip, silence, DC, or crushing`,
        );
        check(
          levelDb > -12 && levelDb < 9,
          `${preset.family}/${preset.id}: level remains bounded`,
        );
        if (preset.family === 'denoise') {
          check(
            levelDb > -2 && levelDb < 0.5,
            `${preset.id}: does not hollow out clean music`,
          );
        }
      }
    }

    if (failures > 0) {
      throw new Error(`preset smoke: ${failures} check(s) failed`);
    }
    line('all preset checks passed');
  } finally {
    await host.stop();
    rmSync(scratch, { recursive: true, force: true });
  }
  process.exit(0);
};

main().catch((error: unknown) => {
  console.error('preset smoke failed', error);
  process.exit(1);
});
