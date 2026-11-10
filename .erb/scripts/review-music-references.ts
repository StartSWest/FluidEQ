/* FluidEQ — GPL-3.0-or-later */
/** Device-free validation of the two original recordings named for each genre. */
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import { parseArgs, promisify } from 'util';
import { DSP_DEFAULTS } from '../../src/common/dsp/chain';
import { DSP_PRESETS } from '../../src/common/dsp/presets';
import { GENRE_RACKS, genreChainId } from '../../src/common/dsp/genres';
import { GENRE_NOTES } from '../../src/common/dsp/genreNotes';
import {
  factoryMusicTone,
  musicConfigurationSha256,
  musicProcessingSources,
} from './music-dsp-evidence';
import {
  measureMusicFile,
  measureMusicInput,
  removeMusicRender,
  renderMusicReference,
  IMusicSource,
} from './music-reference-audio';
import policy from '../../docs/dsp/music-reference-policy.json';

interface IReference extends IMusicSource {
  sourceUrl: string;
  trackId: number;
  sourceKind?: string;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
}
const { values } = parseArgs({
  options: {
    engine: { type: 'string' },
    meter: { type: 'string' },
    output: { type: 'string' },
    manifest: { type: 'string' },
    only: { type: 'string' },
    jobs: { type: 'string', default: '2' },
  },
});
const required = (key: 'engine' | 'meter' | 'output' | 'manifest') => {
  const value = values[key];
  if (!value) throw new Error(`Missing --${key}`);
  return path.resolve(value);
};
const engine = required('engine');
const meter = required('meter');
const output = required('output');
const manifestFile = required('manifest');
const root = path.join(__dirname, '..', '..');
const policyFile = path.join(root, 'docs/dsp/music-reference-policy.json');
const fixture = path.join(
  root,
  'native/dsp-core/tests/fixtures/music-factory.txt',
);
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as IReference[];
const jobs = Number(values.jobs);
if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 8) {
  throw new Error('--jobs must be from 1 to 8');
}
const catalogue = GENRE_RACKS.filter(
  (rack) => !values.only || rack.id === values.only,
);
if (catalogue.length === 0) throw new Error('Unknown music genre');
const save = (file: string, value: unknown) => {
  writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(`${file}.tmp`, file);
};
const sha = (file: string) =>
  createHash('sha256').update(readFileSync(file)).digest('hex');
const runNative = promisify(execFile);
const shaText = (file: string) =>
  createHash('sha256')
    .update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))
    .digest('hex');
const spread = (points: number[]) => Math.max(...points) - Math.min(...points);
mkdirSync(output, { recursive: true });

const main = async () => {
  const provenance = {
    manifestSha256: sha(manifestFile),
    nativeEngineSha256: sha(engine),
    nativeMeterSha256: sha(meter),
    processingSources: musicProcessingSources(root),
    fixtureSha256: shaText(fixture),
    policySha256: shaText(policyFile),
    media: manifest.map((source) => ({
      id: source.id,
      sha256: sha(source.file),
    })),
  };
  const review = async (rack: (typeof GENRE_RACKS)[number]) => {
    const preset = DSP_PRESETS.find((one) => one.id === genreChainId(rack));
    if (!preset?.curve) throw new Error(`Missing factory genre ${rack.id}`);
    if (
      preset.settings.normalizer.mode !== 'off' ||
      preset.settings.master.enabled
    ) {
      throw new Error(
        `The factory input and output gains must be fixed for ${rack.id}`,
      );
    }
    const pinned: { limiterLossBudgetLu: number } | undefined = Reflect.get(
      policy.genres,
      rack.id,
    );
    if (!pinned)
      throw new Error(`Missing pinned dynamics policy for ${rack.id}`);
    const loss = pinned.limiterLossBudgetLu;
    const crest = loss < 0.2 ? 1.75 : loss < 0.5 ? 3 : 4;
    const phrase = loss < 0.2 ? 0.65 : loss < 0.5 ? 1 : 1.5;
    const sources = GENRE_NOTES[rack.id].listen.map((name) => {
      const hits = manifest.filter(
        (source) => source.genreId === rack.id && source.reference === name,
      );
      if (hits.length !== 1 || !(hits[0].seconds > 10)) {
        throw new Error(
          `One original excerpt longer than 10 seconds required for ${name}`,
        );
      }
      return hits[0];
    });
    if (sources.length !== 2)
      throw new Error(`Expected two named references for ${rack.id}`);
    const synthetic = await runNative(
      meter,
      ['--programme', rack.id, fixture],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    const controls = synthetic.stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
    const strengthControl = controls.find((one) => one.scene === 'strength');
    const liveOpening = controls.find((one) => one.scene === 'opening');
    if (!strengthControl || !liveOpening)
      throw new Error(`Missing raw-level controls for ${rack.id}`);
    const tone = factoryMusicTone(preset);
    const beforeMax = {
      ...preset.settings,
      maximizer: { ...preset.settings.maximizer, enabled: false },
    };
    const render = (
      source: IReference,
      label: string,
      settings = preset.settings,
      renderedTone = tone,
    ) =>
      renderMusicReference(
        engine,
        meter,
        source,
        settings,
        renderedTone,
        output,
        label,
        label === 'final',
      );
    const stages = (
      [
        'deEsser',
        'exciter',
        'bassForge',
        'bassPunch',
        'dimension',
        'eq',
      ] as const
    ).filter((stage) => preset.settings[stage].enabled);
    const stageEffects = [...stages, 'genreCurve'].map((stage) => ({
      stage,
      loudnessDeltaLu: [] as number[],
      foregroundDeltaLu: [] as number[],
      peakDeltaDb: [] as number[],
      crestDeltaDb: [] as number[],
      phraseDeltaDb: [] as number[],
    }));
    const references = [];
    const errors: string[] = [];
    for (const source of sources) {
      const dry = await renderMusicReference(
        engine,
        meter,
        source,
        { ...DSP_DEFAULTS, enabled: false },
        undefined,
        output,
        'dry',
      );
      const inputOnly = await renderMusicReference(
        engine,
        meter,
        source,
        { ...DSP_DEFAULTS, enabled: true },
        undefined,
        output,
        'input-readback',
      );
      const input = measureMusicInput(meter, dry.file, inputOnly.file, 0);
      if (
        input.alignmentFrames !== 0 ||
        Math.abs(input.maxShortTermLufs - dry.maxShortTermLufs) > 0.04 ||
        Math.abs(input.integratedLufs - dry.integratedLufs) > 0.04 ||
        Math.abs(input.truePeakDbtp - dry.truePeakDbtp) > 0.001
      ) {
        throw new Error(
          `Input-only readback differs from the decoded original for ${source.reference}`,
        );
      }
      const {
        file: beforeFile,
        rawMeasurement: _untrimmed,
        processingLatencyFrames: _latency,
        outputDeviceOpened: _opened,
        ...before
      } = await render(source, 'before-max', beforeMax);
      const after = await render(source, 'final');
      if (!after.rawMeasurement)
        throw new Error('Missing untrimmed peak readback');
      // Compare against the same fixed drive alone so it cannot move a quiet
      // window through the phrase meter's absolute gate on only one side.
      const driveOnly = measureMusicFile(
        meter,
        beforeFile,
        preset.settings.maximizer.driveDb,
      );
      const limiterLossLu = driveOnly.integratedLufs - after.integratedLufs;
      const crestLossDb = driveOnly.crestDb - after.crestDb;
      const blockRangeLossDb =
        driveOnly.blockRmsRangeDb - after.blockRmsRangeDb;
      if (
        Math.max(after.truePeakDbtp, after.rawMeasurement.truePeakDbtp) >
          -0.99 ||
        limiterLossLu > loss + 0.036 ||
        crestLossDb > crest + 0.055 ||
        blockRangeLossDb > phrase + 0.055
      ) {
        errors.push(`Peak or dynamics bounds exceeded on ${source.reference}`);
      }
      for (const [i, effect] of stageEffects.entries()) {
        const stage = stages[i];
        const off = stage
          ? await render(source, `${stage}-off`, {
              ...preset.settings,
              [stage]: { ...preset.settings[stage], enabled: false },
            })
          : await renderMusicReference(
              engine,
              meter,
              source,
              preset.settings,
              undefined,
              output,
              'curve-off',
            );
        const level = after.integratedLufs - off.integratedLufs;
        effect.loudnessDeltaLu.push(level);
        effect.foregroundDeltaLu.push(
          after.maxShortTermLufs - off.maxShortTermLufs,
        );
        effect.peakDeltaDb.push(after.truePeakDbtp - off.truePeakDbtp);
        effect.crestDeltaDb.push(after.crestDb - off.crestDb);
        effect.phraseDeltaDb.push(after.blockRmsRangeDb - off.blockRmsRangeDb);
        if (stage === 'deEsser' && Math.abs(level) > 0.15) {
          errors.push(
            `De-esser changes integrated level by ${level.toFixed(3)} LU on ${source.reference}`,
          );
        }
        removeMusicRender(output, off.file);
      }
      const ceilingAdjustment = Math.min(
        0,
        preset.settings.maximizer.ceilingDb - dry.truePeakDbtp,
      );
      references.push({
        reference: source.reference,
        sourceUrl: source.sourceUrl,
        sourceKind: source.sourceKind ?? 'Reference excerpt',
        trackName: source.trackName,
        artistName: source.artistName,
        collectionName: source.collectionName,
        trackId: source.trackId,
        mediaSha256: sha(source.file),
        decodedSha256: sha(dry.file),
        excerptSeconds: source.seconds,
        sourceLufs: dry.integratedLufs,
        sourceForegroundLufs: dry.maxShortTermLufs,
        sourceTruePeakDbtp: dry.truePeakDbtp,
        measuredInputGainDb: input.measuredGainDb,
        inputResidualDb: input.residualDb,
        inputAlignmentFrames: input.alignmentFrames,
        beforeMax: before,
        driveOnly,
        outputLufs: after.integratedLufs,
        outputForegroundLufs: after.maxShortTermLufs,
        outputTruePeakDbtp: after.truePeakDbtp,
        rawOutput: after.rawMeasurement,
        processingLatencyFrames: after.processingLatencyFrames,
        relativeLoudnessLu: after.integratedLufs - dry.integratedLufs,
        ceilingMatchedDryLufs: dry.integratedLufs + ceilingAdjustment,
        limiterLossLu,
        crestLossDb,
        blockRangeLossDb,
      });
      removeMusicRender(output, inputOnly.file);
      removeMusicRender(output, beforeFile);
      if (rack.id !== 'pop' && rack.id !== 'kPop') {
        removeMusicRender(output, dry.file);
        removeMusicRender(output, after.file);
      }
    }
    const integratedGainSpreadLu = spread(
      references.map((one) => one.relativeLoudnessLu),
    );
    const foregroundGainSpreadLu = spread(
      references.map(
        (one) => one.outputForegroundLufs - one.sourceForegroundLufs,
      ),
    );
    if (integratedGainSpreadLu > 1.5 || foregroundGainSpreadLu > 1.5) {
      errors.push(
        `Source-dependent gain spread ${integratedGainSpreadLu.toFixed(2)} LU integrated and ${foregroundGainSpreadLu.toFixed(2)} LU foreground`,
      );
    }
    const entry = {
      id: rack.id,
      chainId: preset.id,
      provenance: {
        nativeEngineSha256: provenance.nativeEngineSha256,
        nativeMeterSha256: provenance.nativeMeterSha256,
        processingSha256: provenance.processingSources.sha256,
        policySha256: provenance.policySha256,
        media: sources.map((source) => ({
          id: source.id,
          sha256: sha(source.file),
        })),
      },
      maximizerDriveDb: preset.settings.maximizer.driveDb,
      limiterLossBudgetLu: loss,
      gains: preset.curve.bands.map((band) => band.gainDb),
      configurationSha256: musicConfigurationSha256(preset),
      settings: preset.settings,
      references,
      stageEffects,
      renderedTone: tone,
      integratedGainSpreadLu,
      foregroundGainSpreadLu,
      rawIntegratedSpreadLu: spread(references.map((one) => one.outputLufs)),
      rawForegroundSpreadLu: spread(
        references.map((one) => one.outputForegroundLufs),
      ),
      strengthControl,
      liveOpening,
    };
    save(path.join(output, `${rack.id}-review.json`), { ...entry, errors });
    if (errors.length > 0) throw new Error(errors.join('\n'));
    return entry;
  };

  const failures: { id: string; error: string }[] = [];
  const entries = new Map<string, Awaited<ReturnType<typeof review>>>();
  let cursor = 0;
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      while (cursor < catalogue.length) {
        const rack = catalogue[cursor];
        cursor += 1;
        try {
          entries.set(rack.id, await review(rack));
          process.stdout.write(`${rack.id} measured\n`);
        } catch (error: unknown) {
          failures.push({ id: rack.id, error: String(error) });
          process.stderr.write(`${rack.id} ${String(error)}\n`);
        }
      }
    }),
  );
  if (failures.length) {
    save(path.join(output, 'incomplete.json'), {
      validationFailed: true,
      failures,
    });
    throw new Error(
      `${failures.length} genres failed. No verified audit was written.`,
    );
  }
  if (
    sha(manifestFile) !== provenance.manifestSha256 ||
    sha(engine) !== provenance.nativeEngineSha256 ||
    sha(meter) !== provenance.nativeMeterSha256 ||
    shaText(policyFile) !== provenance.policySha256 ||
    shaText(fixture) !== provenance.fixtureSha256 ||
    musicProcessingSources(root).sha256 !==
      provenance.processingSources.sha256 ||
    manifest.some(
      (source, i) => sha(source.file) !== provenance.media[i].sha256,
    )
  ) {
    throw new Error(
      'Frozen inputs changed during the run. No verified audit was written.',
    );
  }
  save(path.join(output, 'review.json'), {
    schema: 3,
    measuredAt: new Date().toISOString(),
    sampleRateHz: 48000,
    method:
      'Original-level offline renders of the factory rack and curve, with no source gain supplied.',
    headphoneCorrection: false,
    liveApplicationSettings: false,
    outputDevicesOpened: false,
    ...provenance,
    completeCatalogue: entries.size === GENRE_RACKS.length,
    genres: catalogue.map((rack) => entries.get(rack.id)),
  });
};
main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
