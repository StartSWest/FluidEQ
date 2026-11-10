/* FluidEQ — GPL-3.0-or-later */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import type { IDspSettings } from '../../src/common/dsp/chain';
import {
  appendPresetTone,
  encodeChainSettings,
} from '../../src/common/dsp/chainWire';
import { NATIVE_DSP_PARAMETERS } from '../../src/common/dsp/nativeParameters';
import { DspHostSupervisor } from '../../src/main/dspHost/supervisor';
import {
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from '../../src/renderer/dsp/biquad';
import { readFloatWav, writeFloatWav } from './preset-hearing';
import { factoryMusicTone } from './music-dsp-evidence';

export interface IMusicSource {
  id: string;
  genreId: string;
  reference: string;
  file: string;
  seconds: number;
  startSeconds?: number;
}
export interface IMusicMeasurement {
  integratedLufs: number;
  maxShortTermLufs: number;
  truePeakDbtp: number;
  crestDb: number;
  blockRmsRangeDb: number;
}
export interface IMusicRender extends IMusicMeasurement {
  file: string;
  outputDeviceOpened: false;
  processingLatencyFrames: number;
  rawMeasurement?: IMusicMeasurement;
}

export const removeMusicRender = (directory: string, file: string) => {
  if (
    path.dirname(path.resolve(file)) !== path.resolve(directory) ||
    !file.endsWith('.wav')
  ) {
    throw new Error(
      'Refusing to remove a file outside the private render directory',
    );
  }
  unlinkSync(file);
};

const numeric = (value: unknown, key: string): number => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Music meter returned no measurement');
  }
  const one: unknown = Reflect.get(value, key);
  if (typeof one !== 'number' || !Number.isFinite(one)) {
    throw new Error(`Music meter returned invalid ${key}`);
  }
  return one;
};

export const musicMeasurement = (value: unknown): IMusicMeasurement => ({
  integratedLufs: numeric(value, 'integratedLufs'),
  maxShortTermLufs: numeric(value, 'maxShortTermLufs'),
  truePeakDbtp: numeric(value, 'truePeakDbtp'),
  crestDb: numeric(value, 'crestDb'),
  blockRmsRangeDb: numeric(value, 'blockRmsRangeDb'),
});

/** An explicitly built native meter, never the installed/running application. */
export const measureMusicFile = (
  meter: string,
  file: string,
  fixedGainDb = 0,
): IMusicMeasurement => {
  const args = ['--measure', file];
  if (fixedGainDb !== 0) args.push(String(fixedGainDb));
  const result = spawnSync(meter, args, {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `Music measurement failed: ${result.stderr || result.status}`,
    );
  }
  const value: unknown = JSON.parse(result.stdout);
  return musicMeasurement(value);
};

/** Match source time before comparing fixed-grid foreground windows. The
 * native check also verifies the COMPLETE readback is the expected linked
 * gain, below -100 dB residual; alignment cannot hide limiting or other FX. */
export const measureMusicInput = (
  meter: string,
  dryFile: string,
  inputFile: string,
  expectedGainDb: number,
): IMusicMeasurement & {
  measuredGainDb: number;
  residualDb: number;
  alignmentFrames: number;
} => {
  const result = spawnSync(
    meter,
    ['--input-reference', dryFile, inputFile, String(expectedGainDb)],
    { encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error(`Source input readback failed: ${result.stderr}`);
  const value: unknown = JSON.parse(result.stdout);
  const alignmentFrames = numeric(value, 'alignmentFrames');
  if (!Number.isSafeInteger(alignmentFrames))
    throw new Error('Invalid input alignment');
  return {
    ...musicMeasurement(value),
    measuredGainDb: numeric(value, 'measuredGainDb'),
    residualDb: numeric(value, 'residualDb'),
    alignmentFrames,
  };
};

/** No endpoint, headset curve, live switch or user configuration is consulted. */
export const renderMusicReference = async (
  engine: string,
  meter: string,
  source: IMusicSource,
  settings: IDspSettings,
  tone: ReturnType<typeof factoryMusicTone>,
  scratch: string,
  label: string,
  measureUntrimmed = false,
): Promise<IMusicRender> => {
  const safe = (text: string) => text.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const directory = path.resolve(scratch);
  mkdirSync(directory, { recursive: true });
  const basename = `${safe(source.id)}-${safe(label)}`;
  const rackFile = path.join(directory, `${basename}-rack.wav`);
  const file = path.join(directory, `${basename}.wav`);
  let opened = false;
  const host = new DspHostSupervisor({
    executablePath: engine,
    expectedParameterCount: NATIVE_DSP_PARAMETERS.length,
    onLifecycle: (event) => {
      if (event.event === 'device-open-requested') opened = true;
    },
  });
  const requireApplied = (applied: boolean, action: string) => {
    if (!applied) throw new Error(`Offline music render failed: ${action}`);
  };
  try {
    const line = appendPresetTone(
      encodeChainSettings(settings),
      settings.enabled ? tone : undefined,
    );
    const latencyResult = spawnSync(meter, ['--latency', line.join(' ')], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (latencyResult.status !== 0)
      throw new Error('Cannot measure the configured native latency');
    const processingLatencyFrames = Number(
      JSON.parse(latencyResult.stdout).totalLatencyFrames,
    );
    if (
      !Number.isSafeInteger(processingLatencyFrames) ||
      processingLatencyFrames < 0 ||
      processingLatencyFrames > 48_000
    )
      throw new Error('Invalid native processing latency');
    requireApplied(await host.start(), 'start native host');
    requireApplied(
      await host.applyChain(line),
      'apply complete factory configuration',
    );
    requireApplied(
      await host.loadDeck(0, source.file),
      'load original recording',
    );
    if (source.startSeconds) {
      requireApplied(
        await host.seekDeck(0, source.startSeconds),
        'seek reference excerpt',
      );
    }
    requireApplied(await host.setPlaying(true), 'start offline transport');
    requireApplied(
      await host.renderToFile(
        Math.ceil(source.seconds * 48_000) + processingLatencyFrames,
        rackFile,
      ),
      'render floating-point audio',
    );
    const audio = readFloatWav(rackFile);
    if (audio.rate !== 48_000 || audio.channels.length !== 2) {
      throw new Error('Music calibration requires a 48 kHz stereo render');
    }
    if (settings.enabled && tone) {
      audio.channels.forEach((channel) => {
        tone.bands.forEach((band) => {
          processBiquad(
            createBiquadState(),
            channel,
            biquadCoefficients(
              {
                type: band.type,
                frequency: band.frequency,
                gainDb: band.gain,
                quality: band.quality,
              },
              audio.rate,
              'clean',
              1,
              tone.matched,
            ),
          );
        });
      });
    }
    let rawMeasurement;
    if (measureUntrimmed) {
      writeFloatWav(file, audio);
      rawMeasurement = measureMusicFile(meter, file);
    }
    const wantedFrames = Math.ceil(source.seconds * audio.rate);
    writeFloatWav(file, {
      rate: audio.rate,
      channels: audio.channels.map((channel) =>
        channel.slice(
          processingLatencyFrames,
          processingLatencyFrames + wantedFrames,
        ),
      ),
    });
    if (opened)
      throw new Error('Offline music measurement opened an output device');
    return {
      file,
      outputDeviceOpened: false,
      processingLatencyFrames,
      rawMeasurement,
      ...measureMusicFile(meter, file),
    };
  } finally {
    await host.stop();
    if (existsSync(rackFile)) unlinkSync(rackFile);
  }
};
