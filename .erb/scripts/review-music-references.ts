/* FluidEQ — GPL-3.0-or-later */
/**
 * Reproducible, device-free reference calibration.
 * --engine <built host> --meter <built music-factory-test> --manifest <JSON>
 * --output <private directory> [--calibrate] [--only <genreId>]
 * Media stays outside git. The manifest supplies two original reference files
 * per genre and their exact excerpt lengths; raw waveforms are decoded afresh.
 */
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import { DSP_PRESETS } from '../../src/common/dsp/presets';
import { GENRE_RACKS, genreChainId } from '../../src/common/dsp/genres';
import { GENRE_NOTES } from '../../src/common/dsp/genreNotes';
import { normalizerGainBreakdown } from '../../src/renderer/dsp/inputNormalizer';
import {
  factoryMusicLine,
  factoryMusicTone,
  musicConfigurationSha256,
  musicProcessingSources,
} from './music-dsp-evidence';
import {
  measureMusicFile,
  measureMusicInput,
  musicMeasurement,
  renderMusicReference,
  IMusicSource,
} from './music-reference-audio';
import policy from '../../docs/dsp/music-reference-policy.json';
import { DSP_DEFAULTS } from '../../src/common/dsp/chain';

interface IReference extends IMusicSource {
  sourceUrl: string;
  trackId: number;
  sourceKind?: string;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
}
const options = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (
    [
      '--calibrate',
      '--resume-calibration',
      '--refine',
      '--keep-going',
    ].includes(key)
  )
    options.set(key, 'true');
  else {
    const value = process.argv[i + 1];
    if (!key.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(`Invalid music review option: ${key}`);
    }
    if (
      !['--engine', '--meter', '--output', '--manifest', '--only'].includes(key)
    ) {
      throw new Error(`Unknown music review option: ${key}`);
    }
    options.set(key, value);
    i += 1;
  }
}
const required = (key: string) => {
  const value = options.get(key);
  if (!value) throw new Error(`Missing ${key}`);
  return path.resolve(value);
};
const engine = required('--engine');
const meter = required('--meter');
const output = required('--output');
const root = path.join(__dirname, '..', '..');
const manifestFile = required('--manifest');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as IReference[];
if (options.has('--resume-calibration') && !options.has('--calibrate')) {
  throw new Error('Final evidence never resumes old renders');
}
if (options.has('--refine') && !options.has('--calibrate')) {
  throw new Error('Refinement is parameter planning, not final evidence');
}
if (
  options.has('--only') &&
  !GENRE_RACKS.some((rack) => rack.id === options.get('--only'))
) {
  throw new Error('Unknown music genre');
}
const save = (file: string, value: unknown) => {
  writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(`${file}.tmp`, file);
};
const sha = (file: string) =>
  createHash('sha256').update(readFileSync(file)).digest('hex');
const removeRender = (file: string) => {
  if (path.dirname(path.resolve(file)) !== output || !file.endsWith('.wav')) {
    throw new Error(
      'Refuse cleanup outside the private music render directory',
    );
  }
  unlinkSync(file);
};
const quarter = (value: number) => Math.round(value * 4) / 4;
const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;
const sourceFacts = (reference: { dryFile: string }) => ({
  version: 3 as const,
  ...measureMusicFile(meter, reference.dryFile),
});
mkdirSync(output, { recursive: true });

const main = async () => {
  const provenance = {
    manifestSha256: sha(manifestFile),
    nativeEngineSha256: sha(engine),
    nativeMeterSha256: sha(meter),
    processingSources: musicProcessingSources(root),
    policySha256: sha(path.join(root, 'docs/dsp/music-reference-policy.json')),
    media: manifest.map((source) => ({
      id: source.id,
      sha256: sha(source.file),
    })),
  };
  const summaries = [];
  const failures: { id: string; error: string }[] = [];
  for (const rack of GENRE_RACKS) {
    if (options.has('--only') && options.get('--only') !== rack.id) continue;
    try {
      const preset = DSP_PRESETS.find((one) => one.id === genreChainId(rack));
      if (!preset?.curve) throw new Error(`Missing factory genre: ${rack.id}`);
      const pinned:
        { limiterLossBudgetLu: number; outputAimLufs: number } | undefined =
        Reflect.get(policy.genres, rack.id);
      if (!pinned) throw new Error(`Missing pinned music policy: ${rack.id}`);
      const savedFile = path.join(output, `${rack.id}-review.json`);
      if (
        options.has('--calibrate') &&
        options.has('--resume-calibration') &&
        existsSync(savedFile)
      ) {
        const saved = JSON.parse(readFileSync(savedFile, 'utf8'));
        const candidate = structuredClone(preset);
        candidate.settings.normalizer = saved.settings.normalizer;
        candidate.settings.maximizer.driveDb = saved.settings.maximizer.driveDb;
        const expectedAim = pinned.outputAimLufs;
        if (
          musicConfigurationSha256(candidate) === saved.configurationSha256 &&
          saved.outputAimLufs === expectedAim
        ) {
          // Reuse PARAMETERS for planning only. No past measurements are
          // restamped with the current implementation's provenance.
          summaries.push({
            id: saved.id,
            settings: saved.settings,
            configurationSha256: saved.configurationSha256,
            calibrationOnly: true,
            attempts: [],
          });
          continue;
        }
      }
      const named: readonly string[] = GENRE_NOTES[rack.id].listen;
      const sources = manifest
        .filter((one) => one.genreId === rack.id)
        .sort(
          (a, b) => named.indexOf(a.reference) - named.indexOf(b.reference),
        );
      if (
        sources.length !== 2 ||
        sources.some(
          (one, i) =>
            one.reference !== GENRE_NOTES[rack.id].listen[i] ||
            !(one.seconds > 10),
        )
      ) {
        throw new Error(
          `Two exact named reference excerpts required: ${rack.id}`,
        );
      }
      const lossBudget = pinned.limiterLossBudgetLu;
      const crestBudget = lossBudget < 0.2 ? 1.75 : lossBudget < 0.5 ? 3 : 4;
      const phraseBudget = lossBudget < 0.2 ? 0.65 : lossBudget < 0.5 ? 1 : 1.5;
      const aim = pinned.outputAimLufs;
      // Decode the ORIGINAL media through a genuinely transparent rack, flush
      // its known latency and use this fresh source-time waveform for facts.
      // A formerly rendered "dry" file may itself contain untrimmed delay.
      const drySettings = structuredClone(DSP_DEFAULTS);
      drySettings.enabled = false;
      const dry = await Promise.all(
        sources.map((source) =>
          renderMusicReference(
            engine,
            meter,
            source,
            drySettings,
            undefined,
            0,
            output,
            'dry-source',
          ),
        ),
      );
      const measuredSources = sources.map((source, i) => ({
        ...source,
        dryFile: dry[i].file,
      }));
      const facts = measuredSources.map(sourceFacts);
      const current = structuredClone(preset);
      if (options.has('--calibrate')) {
        current.settings.normalizer.targetLufs = -18;
        if (!options.has('--refine'))
          current.settings.normalizer.truePeakDbtp = -3;
      }
      const tone = factoryMusicTone(current);
      const synthFile = path.join(output, `${rack.id}-synthetic.txt`);
      const render = async (max: boolean, label: string) => {
        const settings = structuredClone(current.settings);
        settings.maximizer.enabled = max;
        return Promise.all(
          sources.map(async (source, i) => {
            const gain = normalizerGainBreakdown(settings.normalizer, facts[i]);
            const result = await renderMusicReference(
              engine,
              meter,
              source,
              settings,
              tone,
              gain.appliedDb,
              output,
              label,
            );
            return {
              ...result,
              inputGainDb: gain.appliedDb,
              inputLimit: gain.limitedBy,
            };
          }),
        );
      };
      let before = await render(false, 'before-max');
      if (options.has('--calibrate') && !options.has('--refine')) {
        // Anchor makeup to the strongest reference, not the quietest/peakiest
        // excerpt. One outlier must not set the gain for an entire genre.
        current.settings.maximizer.driveDb = quarter(
          Math.max(
            0,
            Math.min(
              18,
              aim - Math.max(...before.map((one) => one.integratedLufs)),
            ),
          ),
        );
      }
      before.forEach((one) => removeRender(one.file));
      const attempts = [];
      const syntheticAt = () => {
        const row = `${rack.id} ${lossBudget} ${crestBudget} ${phraseBudget} ${aim} ${factoryMusicLine(current)}\n`;
        writeFileSync(`${synthFile}.tmp`, row);
        renameSync(`${synthFile}.tmp`, synthFile);
        const result = spawnSync(meter, ['--programme', rack.id, synthFile], {
          encoding: 'utf8',
          windowsHide: true,
        });
        if (result.status !== 0 && result.status !== 1) {
          throw new Error(`Synthetic renderer failed: ${result.stderr}`);
        }
        attempts.push({
          inputCeilingDbtp: current.settings.normalizer.truePeakDbtp,
          driveDb: current.settings.maximizer.driveDb,
          synthetic: {
            status: result.status,
            output: result.stdout,
            failures: result.stderr,
          },
        });
        return result;
      };
      if (
        options.has('--calibrate') &&
        !options.has('--refine') &&
        syntheticAt().status !== 0
      ) {
        // Find the highest safe half-dB ceiling; do not drag every genre down
        // to the headroom needed by one sparse test/reference.
        let failed = -3;
        let passed = -12;
        current.settings.normalizer.truePeakDbtp = passed;
        while (syntheticAt().status !== 0) {
          if (current.settings.maximizer.driveDb <= 0) {
            throw new Error(`No clean synthetic calibration: ${rack.id}`);
          }
          current.settings.maximizer.driveDb = Math.max(
            0,
            current.settings.maximizer.driveDb - 0.5,
          );
        }
        while (failed - passed > 0.5) {
          const midpoint = Math.round(((failed + passed) / 2) * 2) / 2;
          current.settings.normalizer.truePeakDbtp = midpoint;
          if (syntheticAt().status === 0) passed = midpoint;
          else failed = midpoint;
        }
        current.settings.normalizer.truePeakDbtp = passed;
      }
      let final;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const { driveDb } = current.settings.maximizer;
        const synthetic = syntheticAt();
        let over = synthetic.status !== 0;
        let results;
        if (!over) {
          before = await render(false, `before-max-${attempt}`);
          const after = await render(true, `after-${attempt}`);
          results = after.map((one, i) => ({
            ...one,
            limiterLossLu:
              before[i].integratedLufs + driveDb - one.integratedLufs,
            crestLossDb: before[i].crestDb - one.crestDb,
            blockRangeLossDb: before[i].blockRmsRangeDb - one.blockRmsRangeDb,
          }));
          over = results.some(
            (one) =>
              one.truePeakDbtp > -0.99 ||
              one.rawMeasurement.truePeakDbtp > -0.99 ||
              one.limiterLossLu > lossBudget + 0.036 ||
              one.crestLossDb > crestBudget + 0.055 ||
              one.blockRangeLossDb > phraseBudget + 0.055,
          );
        }
        attempts.push({
          inputCeilingDbtp: current.settings.normalizer.truePeakDbtp,
          driveDb,
          synthetic: {
            status: synthetic.status,
            output: synthetic.stdout,
            failures: synthetic.stderr,
          },
          references: results,
        });
        if (!over && results) {
          final = results;
          break;
        }
        results?.forEach((one) => removeRender(one.file));
        if (results) before.forEach((one) => removeRender(one.file));
        if (!options.has('--calibrate')) {
          throw new Error(
            `Current factory fails measured bounds: ${rack.id}\n${synthetic.stderr}`,
          );
        }
        if (current.settings.normalizer.truePeakDbtp > -12) {
          current.settings.normalizer.truePeakDbtp -= 0.5;
        } else if (driveDb > 0) {
          current.settings.maximizer.driveDb = Math.max(0, driveDb - 0.5);
        } else throw new Error(`No clean calibration: ${rack.id}`);
      }
      if (!final) throw new Error(`Calibration did not converge: ${rack.id}`);
      const stages = [
        'deEsser',
        'exciter',
        'bassForge',
        'bassPunch',
        'dimension',
        'eq',
      ] as const;
      const stageEffects = [];
      for (const stage of stages) {
        if (!current.settings[stage].enabled) continue;
        const settings = structuredClone(current.settings);
        settings[stage].enabled = false;
        const off = await Promise.all(
          sources.map((source, i) =>
            renderMusicReference(
              engine,
              meter,
              source,
              settings,
              tone,
              final[i].inputGainDb,
              output,
              `${stage}-off`,
            ),
          ),
        );
        const changes = off.map(
          (one, i) => final[i].integratedLufs - one.integratedLufs,
        );
        const foregroundChanges = off.map(
          (one, i) => final[i].maxShortTermLufs - one.maxShortTermLufs,
        );
        off.forEach((one) => removeRender(one.file));
        if (
          stage === 'deEsser' &&
          changes.some((one) => Math.abs(one) > 0.15)
        ) {
          throw new Error(
            `De-esser changes overall volume excessively: ${rack.id}`,
          );
        }
        stageEffects.push({
          stage,
          loudnessDeltaLu: changes,
          foregroundDeltaLu: foregroundChanges,
        });
      }
      const noCurve = await Promise.all(
        sources.map((source, i) =>
          renderMusicReference(
            engine,
            meter,
            source,
            current.settings,
            undefined,
            final[i].inputGainDb,
            output,
            'curve-off',
          ),
        ),
      );
      stageEffects.push({
        stage: 'genreCurve',
        loudnessDeltaLu: noCurve.map(
          (one, i) => final[i].integratedLufs - one.integratedLufs,
        ),
        foregroundDeltaLu: noCurve.map(
          (one, i) => final[i].maxShortTermLufs - one.maxShortTermLufs,
        ),
      });
      noCurve.forEach((one) => removeRender(one.file));
      const inputOnly = structuredClone(DSP_DEFAULTS);
      inputOnly.enabled = true;
      inputOnly.normalizer = current.settings.normalizer;
      const inputRenders = await Promise.all(
        sources.map((source, i) =>
          renderMusicReference(
            engine,
            meter,
            source,
            inputOnly,
            undefined,
            final[i].inputGainDb,
            output,
            'normalized-input',
          ),
        ),
      );
      const inputs = inputRenders.map((one, i) =>
        measureMusicInput(
          meter,
          measuredSources[i].dryFile,
          one.file,
          final[i].inputGainDb,
        ),
      );
      const references = sources.map((source, i) => {
        const gain = normalizerGainBreakdown(
          current.settings.normalizer,
          facts[i],
        );
        if (
          Math.abs(
            inputs[i].maxShortTermLufs -
              (facts[i].maxShortTermLufs + gain.appliedDb),
          ) > 0.04 ||
          Math.abs(
            inputs[i].integratedLufs -
              (facts[i].integratedLufs + gain.appliedDb),
          ) > 0.04 ||
          inputs[i].alignmentFrames !== 0
        ) {
          throw new Error(
            `Measured input does not match the independently predicted gain: ${source.reference}`,
          );
        }
        return {
          reference: source.reference,
          sourceUrl: source.sourceUrl,
          sourceKind:
            source.sourceKind ??
            'Reference excerpt; catalogue link identifies the song',
          trackName: source.trackName,
          artistName: source.artistName,
          collectionName: source.collectionName,
          trackId: source.trackId,
          mediaSha256: sha(source.file),
          decodedSha256: sha(measuredSources[i].dryFile),
          excerptSeconds: source.seconds,
          sourceLufs: facts[i].integratedLufs,
          sourceForegroundLufs: facts[i].maxShortTermLufs,
          sourceTruePeakDbtp: facts[i].truePeakDbtp,
          normalizedForegroundLufs: inputs[i].maxShortTermLufs,
          predictedNormalizedForegroundLufs:
            facts[i].maxShortTermLufs + gain.appliedDb,
          normalizedIntegratedLufs: inputs[i].integratedLufs,
          normalizedTruePeakDbtp: inputs[i].truePeakDbtp,
          measuredInputGainDb: inputs[i].measuredGainDb,
          inputResidualDb: inputs[i].residualDb,
          inputAlignmentFrames: inputs[i].alignmentFrames,
          inputGainDb: gain.appliedDb,
          inputLimit: gain.limitedBy,
          beforeMax: musicMeasurement(before[i]),
          outputLufs: final[i].integratedLufs,
          outputForegroundLufs: final[i].maxShortTermLufs,
          outputTruePeakDbtp: final[i].truePeakDbtp,
          rawOutput: final[i].rawMeasurement,
          processingLatencyFrames: final[i].processingLatencyFrames,
          limiterLossLu: final[i].limiterLossLu,
          crestLossDb: final[i].crestLossDb,
          blockRangeLossDb: final[i].blockRangeLossDb,
        };
      });
      inputRenders.forEach((one) => removeRender(one.file));
      const predictedI = references.map(
        (one) => one.sourceLufs + one.inputGainDb,
      );
      const predictedS = references.map(
        (one) => one.sourceForegroundLufs + one.inputGainDb,
      );
      const residualI = references.map(
        (one, i) => one.outputLufs - predictedI[i],
      );
      const residualS = references.map(
        (one, i) => one.outputForegroundLufs - predictedS[i],
      );
      const residualIntegratedSpreadLu = Math.abs(residualI[0] - residualI[1]);
      const residualForegroundSpreadLu = Math.abs(residualS[0] - residualS[1]);
      const rawForegroundSpreadLu = Math.abs(
        final[0].maxShortTermLufs - final[1].maxShortTermLufs,
      );
      const closestAimErrorLu = Math.abs(
        Math.max(...final.map((one) => one.integratedLufs)) - aim,
      );
      const hasUnconstrainedReference = references.some(
        (one) => one.inputLimit === 'none',
      );
      if (hasUnconstrainedReference && closestAimErrorLu > 1.5) {
        throw new Error(
          `Unconstrained reference misses the genre strength aim: ${rack.id}, ${closestAimErrorLu} LU`,
        );
      }
      const synthetic = attempts[attempts.length - 1].synthetic;
      const strengthControl = synthetic.output
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line: string) => JSON.parse(line))
        .find((one: { scene: string }) => one.scene === 'strength');
      if (
        !strengthControl ||
        !Number.isFinite(strengthControl.outputForegroundLufs) ||
        !Number.isFinite(strengthControl.outputLufs) ||
        strengthControl.outputForegroundLufs < aim - 1.5 ||
        strengthControl.outputLufs < aim - 1.5
      ) {
        throw new Error(
          `Missing or weak unconstrained strength control: ${rack.id}`,
        );
      }
      if (
        residualIntegratedSpreadLu > 1.5 ||
        residualForegroundSpreadLu > 1.5 ||
        (references.every((one) => one.inputLimit === 'none') &&
          rawForegroundSpreadLu > 1.5)
      ) {
        save(path.join(output, `${rack.id}-failure.json`), {
          validationFailed: true,
          id: rack.id,
          residualIntegratedSpreadLu,
          residualForegroundSpreadLu,
          references,
          stageEffects,
          settings: current.settings,
        });
        throw new Error(
          `Source-dependent genre gain exceeds 1.5 LU: ${rack.id} I=${residualIntegratedSpreadLu}, S=${residualForegroundSpreadLu}`,
        );
      }
      const entry = {
        id: rack.id,
        chainId: current.id,
        calibrationOnly: options.has('--calibrate'),
        ...(!options.has('--calibrate')
          ? {
              provenance: {
                nativeEngineSha256: provenance.nativeEngineSha256,
                nativeMeterSha256: provenance.nativeMeterSha256,
                processingSha256: provenance.processingSources.sha256,
                policySha256: provenance.policySha256,
                media: sources.map((source) =>
                  provenance.media.find((one) => one.id === source.id),
                ),
              },
            }
          : {}),
        inputTargetLufs: current.settings.normalizer.targetLufs,
        outputAimLufs: aim,
        maximizerDriveDb: current.settings.maximizer.driveDb,
        limiterLossBudgetLu: lossBudget,
        gains: preset.curve.bands.map((band) => band.gainDb),
        configurationSha256: musicConfigurationSha256(current),
        settings: current.settings,
        references,
        stageEffects,
        renderedTone: tone,
        residualIntegratedSpreadLu,
        residualForegroundSpreadLu,
        rawIntegratedSpreadLu: Math.abs(
          final[0].integratedLufs - final[1].integratedLufs,
        ),
        rawForegroundSpreadLu,
        strengthControl,
        closestAimErrorLu,
        strengthStatus:
          closestAimErrorLu <= 1.5
            ? 'reference-aim-met'
            : 'peak-constrained-references',
        meanOutputLufs: mean(final.map((one) => one.integratedLufs)),
        attempts,
      };
      save(path.join(output, `${rack.id}-review.json`), entry);
      summaries.push(entry);
      process.stdout.write(
        `${JSON.stringify({
          id: rack.id,
          inputCeiling: current.settings.normalizer.truePeakDbtp,
          drive: current.settings.maximizer.driveDb,
          output: final.map((one) => one.integratedLufs),
          attempts: attempts.length,
        })}\n`,
      );
    } catch (error: unknown) {
      if (!options.has('--keep-going')) throw error;
      failures.push({ id: rack.id, error: String(error) });
      process.stderr.write(`${rack.id}: ${String(error)}\n`);
    }
  }
  if (failures.length) {
    save(path.join(output, 'incomplete.json'), {
      validationFailed: true,
      failures,
    });
    throw new Error(
      `${failures.length} music genres failed verification; no final audit was written`,
    );
  }
  if (options.has('--calibrate')) {
    save(path.join(output, 'calibration.json'), {
      calibrationOnly: true,
      method:
        'Parameter plans only. Reused trials are not current verified evidence; final verification always renders afresh without resume.',
      genres: summaries.map((one) => ({
        id: one.id,
        settings: one.settings,
        configurationSha256: one.configurationSha256,
      })),
    });
    return;
  }
  if (
    sha(manifestFile) !== provenance.manifestSha256 ||
    sha(engine) !== provenance.nativeEngineSha256 ||
    sha(meter) !== provenance.nativeMeterSha256 ||
    musicProcessingSources(root).sha256 !==
      provenance.processingSources.sha256 ||
    sha(path.join(root, 'docs/dsp/music-reference-policy.json')) !==
      provenance.policySha256 ||
    manifest.some(
      (source, i) => sha(source.file) !== provenance.media[i].sha256,
    )
  ) {
    throw new Error(
      'Music evidence inputs changed during the run; no final audit was written',
    );
  }
  const evidence = {
    schema: 2,
    measuredAt: new Date().toISOString(),
    sampleRateHz: 48000,
    method:
      'Factory-only floating-point offline renders. Foreground normalization uses the maximum complete three-second window on a 100 ms grid; integrated loudness is reported separately, not forced equal by compressing quiet passages.',
    headphoneCorrection: false,
    liveApplicationSettings: false,
    outputDevicesOpened: false,
    ...provenance,
    completeCatalogue: summaries.length === GENRE_RACKS.length,
    genres: summaries.map(({ attempts: _attempts, ...entry }) => entry),
  };
  save(path.join(output, 'review.json'), evidence);
};
main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
