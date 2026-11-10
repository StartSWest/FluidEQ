/* FluidEQ — GPL-3.0-or-later */
/** Offline system-graph audit of the factory racks without a genre. */
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { IDspSettings } from '../../src/common/dsp/chain';
import {
  appendPresetTone,
  encodeChainSettings,
} from '../../src/common/dsp/chainWire';
import { DSP_PRESETS } from '../../src/common/dsp/presets';
import { factoryMusicTone, musicProcessingSources } from './music-dsp-evidence';
import {
  measureMusicFile,
  measureMusicInput,
  removeMusicRender,
} from './music-reference-audio';
import { readFloatWav } from './preset-hearing';

type Programme = 'music' | 'speech' | 'gaming' | 'cinema' | 'repair';
interface ISource {
  id: string;
  name: string;
  file: string;
  origin: string;
}
const { values } = parseArgs({
  options: {
    graph: { type: 'string' },
    meter: { type: 'string' },
    manifest: { type: 'string' },
    output: { type: 'string' },
    only: { type: 'string' },
  },
});
const required = (key: 'graph' | 'meter' | 'manifest' | 'output') => {
  if (!values[key]) throw new Error(`Missing --${key}`);
  return path.resolve(values[key]);
};
const graph = required('graph');
const meter = required('meter');
const manifestFile = required('manifest');
const output = required('output');
const root = path.resolve(__dirname, '..', '..');
const head = path.join(root, 'assets/room/heads/medium.txt');
const sha = (file: string) =>
  createHash('sha256').update(readFileSync(file)).digest('hex');
const shaWire = (wire: readonly number[]) =>
  createHash('sha256').update(wire.join(' ')).digest('hex');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<
  Programme,
  ISource[]
>;
const roomHeadSha256 = sha(head);
const processingSources = musicProcessingSources(root);
const graphSha256 = sha(graph);
const nativeMeterSha256 = sha(meter);
const manifestSha256 = sha(manifestFile);
mkdirSync(output, { recursive: true });

const renderable = new Map(
  Object.values(manifest)
    .flat()
    .map((source) => {
      if (!/^[a-z0-9-]+$/.test(source.id))
        throw new Error(`Invalid source id ${source.id}`);
      const audio = readFloatWav(source.file);
      if (
        audio.rate !== 48000 ||
        audio.channels.length !== 2 ||
        audio.channels[0].length < 480000
      ) {
        throw new Error(
          `Expected stereo float 48 kHz programme for ${source.id}`,
        );
      }
      const raw = Buffer.alloc(audio.channels[0].length * 8);
      for (let i = 0; i < audio.channels[0].length; i += 1) {
        raw.writeFloatLE(audio.channels[0][i], i * 8);
        raw.writeFloatLE(audio.channels[1][i], i * 8 + 4);
      }
      const file = path.join(output, `${source.id}.f32`);
      writeFileSync(file, raw);
      return [
        source.id,
        { raw: file, sourceSha256: sha(source.file) },
      ] as const;
    }),
);

const stages = [
  'denoise',
  'deEsser',
  'exciter',
  'bassForge',
  'eq',
  'footsteps',
  'bassPunch',
  'room',
  'dimension',
  'dynamics',
] as const;
interface IStageEffect {
  stage: (typeof stages)[number] | 'curve';
  loudnessDeltaLu: number;
  peakDeltaDb: number;
  crestDeltaDb: number;
  phraseDeltaDb: number;
}
const catalogue = DSP_PRESETS.filter(
  (preset) =>
    preset.group !== 'genre' && (!values.only || preset.id === values.only),
);
if (catalogue.length === 0) throw new Error('No matching factory rack');
const sourceGroup = (id: string, group: string, game: boolean): Programme => {
  if (game) return 'gaming';
  if (id === 'movie' || id === 'movie-room') return 'cinema';
  if (['speech', 'podcast', 'audiobook'].includes(id)) return 'speech';
  return group === 'repair' ? 'repair' : 'music';
};
const failures: string[] = [];
const presets = catalogue.map((preset) => {
  const tone = preset.curve ? factoryMusicTone(preset) : undefined;
  const wire = appendPresetTone(encodeChainSettings(preset.settings), tone);
  const group = sourceGroup(preset.id, preset.group, preset.settings.gameMode);
  const sources = manifest[group];
  if (sources.length < 2)
    throw new Error(`Two distinct inputs required for ${group}`);
  const render = (
    source: ISource,
    label: string,
    settings: IDspSettings,
    useTone = true,
  ) => {
    const input = renderable.get(source.id);
    if (!input) throw new Error(`Missing decoded source ${source.id}`);
    const key = `${preset.id}-${source.id}-${label}`;
    const row = appendPresetTone(
      encodeChainSettings(settings),
      useTone ? tone : undefined,
    );
    const fixture = path.join(output, `${key}.txt`);
    const wav = path.join(output, `${key}.wav`);
    writeFileSync(fixture, `${preset.id} ${row.length} ${row.join(' ')}\n`);
    const args = ['--render', fixture, input.raw, preset.id, wav];
    if (settings.room.enabled) args.push(head);
    const result = spawnSync(graph, args, {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0)
      throw new Error(
        `Graph render failed for ${key}\n${result.stdout}\n${result.stderr}`,
      );
    const match = /aligned ([0-9]+) frames/.exec(result.stdout);
    if (!match) throw new Error(`No graph latency for ${key}`);
    unlinkSync(fixture);
    return {
      file: wav,
      latencyFrames: Number(match[1]),
      ...measureMusicFile(meter, wav),
    };
  };
  const references = sources.map((source) => {
    const dry = measureMusicFile(meter, source.file);
    const { file, latencyFrames, ...after } = render(
      source,
      'final',
      preset.settings,
    );
    const max = preset.settings.maximizer;
    const stagesUsed = stages.filter((stage) => preset.settings[stage].enabled);
    const effects = stagesUsed.map<IStageEffect>((stage) => {
      const off = render(source, stage, {
        ...preset.settings,
        [stage]: { ...preset.settings[stage], enabled: false },
      });
      removeMusicRender(output, off.file);
      return {
        stage,
        loudnessDeltaLu: after.integratedLufs - off.integratedLufs,
        peakDeltaDb: after.truePeakDbtp - off.truePeakDbtp,
        crestDeltaDb: after.crestDb - off.crestDb,
        phraseDeltaDb: after.blockRmsRangeDb - off.blockRmsRangeDb,
      };
    });
    if (tone) {
      const off = render(source, 'curve', preset.settings, false);
      removeMusicRender(output, off.file);
      effects.push({
        stage: 'curve',
        loudnessDeltaLu: after.integratedLufs - off.integratedLufs,
        peakDeltaDb: after.truePeakDbtp - off.truePeakDbtp,
        crestDeltaDb: after.crestDb - off.crestDb,
        phraseDeltaDb: after.blockRmsRangeDb - off.blockRmsRangeDb,
      });
    }
    const before = max.enabled
      ? render(source, 'before-max', {
          ...preset.settings,
          maximizer: { ...max, enabled: false },
        })
      : undefined;
    const linear = before
      ? measureMusicFile(meter, before.file, max.driveDb)
      : dry;
    if (before) removeMusicRender(output, before.file);
    const loss = linear.integratedLufs - after.integratedLufs;
    const crestLoss = linear.crestDb - after.crestDb;
    const phraseLoss = linear.blockRmsRangeDb - after.blockRmsRangeDb;
    const budget =
      preset.id === 'late-night' || preset.id === 'game-night' ? 1.6 : 1.25;
    if (max.enabled && after.truePeakDbtp > max.ceilingDb + 0.03) {
      failures.push(
        `${preset.id} / ${source.id} reached ${after.truePeakDbtp.toFixed(3)} dBTP`,
      );
    }
    if (max.enabled && (loss > budget || crestLoss > 4 || phraseLoss > 1.5)) {
      failures.push(
        `${preset.id} / ${source.id} exceeded a dynamics budget (${loss.toFixed(3)} LU loss, ${crestLoss.toFixed(3)} dB crest, ${phraseLoss.toFixed(3)} dB phrase)`,
      );
    }
    if (!max.enabled) {
      const input = measureMusicInput(meter, source.file, file, 0);
      if (input.alignmentFrames !== 0 || input.residualDb > -100) {
        failures.push(`${preset.id} altered the bypass signal`);
      }
    }
    removeMusicRender(output, file);
    return {
      id: source.id,
      name: source.name,
      origin: source.origin,
      sourceSha256: renderable.get(source.id)?.sourceSha256,
      latencyFrames,
      dry,
      output: after,
      loudnessDeltaLu: after.integratedLufs - dry.integratedLufs,
      limiterLossLu: loss,
      limiterCrestLossDb: crestLoss,
      limiterPhraseLossDb: phraseLoss,
      effects,
    };
  });
  const entry = {
    id: preset.id,
    group: preset.group,
    sourceGroup: group,
    configurationSha256: shaWire(wire),
    normalizerMode: preset.settings.normalizer.mode,
    adaptiveMaster:
      preset.settings.master.enabled && preset.settings.master.loudnessMaximize,
    gameMode: preset.settings.gameMode,
    room: preset.settings.room.enabled,
    maximizer: preset.settings.maximizer,
    references,
  };
  process.stdout.write(
    `${JSON.stringify({
      id: entry.id,
      refs: references.map((reference) => [
        reference.loudnessDeltaLu.toFixed(2),
        reference.output.truePeakDbtp.toFixed(2),
        reference.limiterLossLu.toFixed(2),
        reference.latencyFrames,
      ]),
    })}\n`,
  );
  return entry;
});
const receipt = {
  schema: 1,
  sampleRateHz: 48000,
  method:
    'Offline live Graph at original levels with no level facts. Room examples use the bundled medium head.',
  headphoneCorrection: false,
  outputDevicesOpened: false,
  processingSha256: processingSources.sha256,
  graphSha256,
  nativeMeterSha256,
  roomHeadSha256,
  manifestSha256,
  completeCatalogue:
    presets.length ===
    DSP_PRESETS.filter((preset) => preset.group !== 'genre').length,
  presets,
  failures,
};
if (
  sha(graph) !== graphSha256 ||
  sha(meter) !== nativeMeterSha256 ||
  sha(head) !== roomHeadSha256 ||
  sha(manifestFile) !== manifestSha256 ||
  musicProcessingSources(root).sha256 !== processingSources.sha256 ||
  Object.values(manifest)
    .flat()
    .some(
      (source) => sha(source.file) !== renderable.get(source.id)?.sourceSha256,
    )
) {
  throw new Error('Frozen factory audit inputs changed.');
}
const report = path.join(
  output,
  failures.length ? 'incomplete.json' : 'review.json',
);
writeFileSync(`${report}.tmp`, `${JSON.stringify(receipt, null, 2)}\n`);
renameSync(`${report}.tmp`, report);
if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
}
