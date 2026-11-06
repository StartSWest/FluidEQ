/* FluidEQ — GPL-3.0-or-later */
import { readFileSync } from 'fs';
import path from 'path';
import recorded from '../../../../docs/dsp/music-reference-audit.json';
import policy from '../../../../docs/dsp/music-reference-policy.json';
import {
  factoryMusicLine,
  factoryMusicTone,
  musicConfigurationSha256,
  musicProcessingSources,
} from '../../../../.erb/scripts/music-dsp-evidence';
import { GENRE_NOTES } from '../../../common/dsp/genreNotes';
import {
  GENRE_MEASURED,
  genreMeasuredSongs,
} from '../../../common/dsp/genreEvidence';
import { GENRE_RACKS, genreChainId } from '../../../common/dsp/genres';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import {
  IDspSettings,
  NORMALIZER_LOUDNESS_PEAK_MARGIN_DB,
} from '../../../common/dsp/chain';
import { normalizerGainBreakdown } from '../../../renderer/dsp/inputNormalizer';

type IMeasurement = Record<
  | 'integratedLufs'
  | 'maxShortTermLufs'
  | 'truePeakDbtp'
  | 'crestDb'
  | 'blockRmsRangeDb',
  number
>;
type IReference = Record<
  | 'excerptSeconds'
  | 'sourceLufs'
  | 'sourceForegroundLufs'
  | 'sourceTruePeakDbtp'
  | 'inputGainDb'
  | 'normalizedForegroundLufs'
  | 'normalizedIntegratedLufs'
  | 'normalizedTruePeakDbtp'
  | 'measuredInputGainDb'
  | 'inputResidualDb'
  | 'inputAlignmentFrames'
  | 'outputLufs'
  | 'outputForegroundLufs'
  | 'outputTruePeakDbtp'
  | 'limiterLossLu'
  | 'crestLossDb'
  | 'blockRangeLossDb',
  number
> & {
  reference: string;
  sourceUrl: string;
  trackId: number;
  mediaSha256: string;
  decodedSha256: string;
  inputLimit: string;
  beforeMax: IMeasurement;
  rawOutput: IMeasurement;
};
interface IProvenance {
  nativeEngineSha256: string;
  nativeMeterSha256: string;
  policySha256: string;
}
interface IGenre {
  id: string;
  chainId: string;
  calibrationOnly: false;
  configurationSha256: string;
  settings: IDspSettings;
  renderedTone: ReturnType<typeof factoryMusicTone>;
  gains: number[];
  outputAimLufs: number;
  limiterLossBudgetLu: number;
  provenance: IProvenance & {
    processingSha256: string;
    media: { id: string; sha256: string }[];
  };
  references: IReference[];
  stageEffects: {
    stage: string;
    loudnessDeltaLu: number[];
    foregroundDeltaLu: number[];
  }[];
  strengthStatus: string;
  closestAimErrorLu: number;
  strengthControl: Record<
    | 'sourceForegroundLufs'
    | 'sourceTruePeakDbtp'
    | 'outputLufs'
    | 'outputForegroundLufs'
    | 'truePeakDbtp'
    | 'limiterLossLu'
    | 'crestLossDb'
    | 'phraseLossDb',
    number
  >;
}
const audit = recorded as unknown as IProvenance & {
  schema: number;
  completeCatalogue: boolean;
  headphoneCorrection: boolean;
  liveApplicationSettings: boolean;
  outputDevicesOpened: boolean;
  processingSources: ReturnType<typeof musicProcessingSources>;
  media: { id: string; sha256: string }[];
  genres: IGenre[];
};
const root = path.resolve(__dirname, '../../../..');
const presetOf = (id: string) => {
  const preset = DSP_PRESETS.find((one) => one.id === id);
  if (!preset) {
    throw new Error(`No preset for ${id}`);
  }
  return preset;
};
const spread = (values: number[]) => Math.abs(values[0] - values[1]);
const budgets = (loss: number) => {
  if (loss < 0.2) {
    return { crest: 1.75, phrase: 0.65 };
  }
  if (loss < 0.5) {
    return { crest: 3, phrase: 1 };
  }
  return { crest: 4, phrase: 1.5 };
};

describe('measured music factory contract', () => {
  it('requires complete fresh evidence tied to processing sources and both native binaries', () => {
    expect(audit.schema).toBe(2);
    expect(audit.completeCatalogue).toBe(true);
    expect(audit.processingSources).toEqual(musicProcessingSources(root));
    [
      audit.nativeEngineSha256,
      audit.nativeMeterSha256,
      audit.policySha256,
    ].forEach((hash) => expect(hash).toMatch(/^[a-f0-9]{64}$/));
    expect(audit.headphoneCorrection).toBe(false);
    expect(audit.liveApplicationSettings).toBe(false);
    expect(audit.outputDevicesOpened).toBe(false);
    expect(audit.genres.map((one) => one.id).sort()).toEqual(
      GENRE_RACKS.map((one) => one.id).sort(),
    );
    expect(audit.media).toHaveLength(166);
    expect(JSON.stringify(audit)).not.toMatch(/[A-Z]:[\\/]|\\\\Users\\|\.wav"/);
  });

  it('holds exact curves, native scalars and tone designs to the real CI render fixture', () => {
    const rows = readFileSync(
      path.join(root, 'native/dsp-core/tests/fixtures/music-factory.txt'),
      'utf8',
    )
      .trim()
      .split(/\r?\n/);
    expect(rows).toHaveLength(83);
    audit.genres.forEach((genre) => {
      const preset = presetOf(genre.chainId);
      const rack = GENRE_RACKS.find((one) => one.id === genre.id);
      if (!rack) {
        throw new Error(`Unknown genre ${genre.id}`);
      }
      expect(genre.chainId).toBe(genreChainId(rack));
      expect(genre.calibrationOnly).toBe(false);
      expect(genre.configurationSha256).toBe(musicConfigurationSha256(preset));
      expect(genre.settings).toEqual(preset.settings);
      expect(genre.renderedTone).toEqual(factoryMusicTone(preset));
      expect(genre.gains).toEqual(preset.curve?.bands.map((one) => one.gainDb));
      const pinned = Reflect.get(policy.genres, genre.id);
      expect(genre.limiterLossBudgetLu).toBe(pinned.limiterLossBudgetLu);
      expect(genre.outputAimLufs).toBe(pinned.outputAimLufs);
      const bound = budgets(pinned.limiterLossBudgetLu);
      expect(rows).toContain(
        `${genre.id} ${pinned.limiterLossBudgetLu} ${bound.crest} ${bound.phrase} ${pinned.outputAimLufs} ${factoryMusicLine(preset)}`,
      );
      expect(genre.provenance.nativeEngineSha256).toBe(
        audit.nativeEngineSha256,
      );
      expect(genre.provenance.nativeMeterSha256).toBe(audit.nativeMeterSha256);
      expect(genre.provenance.processingSha256).toBe(
        audit.processingSources.sha256,
      );
      expect(genre.provenance.policySha256).toBe(audit.policySha256);
      expect(genre.settings.master.enabled).toBe(false);
      expect(genre.settings.dynamics.enabled).toBe(false);
      expect(genre.settings.normalizer).toMatchObject({
        mode: 'loudness',
        targetLufs: -18,
      });
      expect(genre.settings.maximizer.ceilingDb).toBe(-1);
    });
  });

  it('measures both named recordings and their complete normalized input independently', () => {
    audit.genres.forEach((genre) => {
      expect(genre.references.map((one) => one.reference)).toEqual(
        GENRE_NOTES[genre.id].listen,
      );
      expect(genre.references).toHaveLength(2);
      genre.references.forEach((reference, i) => {
        expect(reference.sourceUrl).toBe(
          `https://music.apple.com/us/song/${reference.trackId}`,
        );
        expect(reference.excerptSeconds).toBeGreaterThan(10);
        expect(reference.mediaSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(reference.decodedSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(genre.provenance.media[i].sha256).toBe(reference.mediaSha256);
        expect(audit.media).toContainEqual(genre.provenance.media[i]);
        const gain = normalizerGainBreakdown(genre.settings.normalizer, {
          version: 3,
          integratedLufs: reference.sourceLufs,
          maxShortTermLufs: reference.sourceForegroundLufs,
          truePeakDbtp: reference.sourceTruePeakDbtp,
        });
        expect(reference.inputGainDb).toBeCloseTo(gain.appliedDb, 7);
        expect(reference.inputLimit).toBe(gain.limitedBy);
        expect(reference.measuredInputGainDb).toBeCloseTo(gain.appliedDb, 4);
        expect(reference.inputResidualDb).toBeLessThan(-100);
        expect(reference.inputAlignmentFrames).toBe(0);
        expect(
          Math.abs(
            reference.normalizedForegroundLufs -
              reference.sourceForegroundLufs -
              gain.appliedDb,
          ),
        ).toBeLessThanOrEqual(0.04);
        expect(
          Math.abs(
            reference.normalizedIntegratedLufs -
              reference.sourceLufs -
              gain.appliedDb,
          ),
        ).toBeLessThanOrEqual(0.04);
        expect(reference.normalizedTruePeakDbtp).toBeLessThanOrEqual(
          genre.settings.normalizer.truePeakDbtp -
            NORMALIZER_LOUDNESS_PEAK_MARGIN_DB +
            0.001,
        );
      });
      genre.references
        .filter((one) => one.inputLimit === 'none')
        .forEach((one) =>
          expect(one.normalizedForegroundLufs).toBeCloseTo(-18, 2),
        );
    });
  });

  it('retains original dynamics budgets and reports peak-constrained strength honestly', () => {
    audit.genres.forEach((genre) => {
      const bound = budgets(genre.limiterLossBudgetLu);
      expect(
        spread(
          genre.references.map(
            (one) => one.outputLufs - one.sourceLufs - one.inputGainDb,
          ),
        ),
      ).toBeLessThanOrEqual(1.5);
      expect(
        spread(
          genre.references.map(
            (one) =>
              one.outputForegroundLufs -
              one.sourceForegroundLufs -
              one.inputGainDb,
          ),
        ),
      ).toBeLessThanOrEqual(1.5);
      genre.references.forEach((one) => {
        expect(Number.isFinite(one.outputLufs)).toBe(true);
        expect(one.outputTruePeakDbtp).toBeLessThanOrEqual(-0.99);
        expect(one.rawOutput.truePeakDbtp).toBeLessThanOrEqual(-0.99);
        expect(one.limiterLossLu).toBeCloseTo(
          one.beforeMax.integratedLufs +
            genre.settings.maximizer.driveDb -
            one.outputLufs,
          7,
        );
        expect(one.limiterLossLu).toBeLessThanOrEqual(
          genre.limiterLossBudgetLu + 0.036,
        );
        expect(one.crestLossDb).toBeLessThanOrEqual(bound.crest + 0.055);
        expect(one.blockRangeLossDb).toBeLessThanOrEqual(bound.phrase + 0.055);
      });
      const aimError = Math.abs(
        Math.max(...genre.references.map((one) => one.outputLufs)) -
          genre.outputAimLufs,
      );
      expect(genre.closestAimErrorLu).toBeCloseTo(aimError, 7);
      expect(genre.strengthStatus).toBe(
        aimError <= 1.5 ? 'reference-aim-met' : 'peak-constrained-references',
      );
      const control = genre.strengthControl;
      expect(control.sourceForegroundLufs).toBeCloseTo(-18, 4);
      expect(control.sourceTruePeakDbtp).toBeLessThan(
        genre.settings.normalizer.truePeakDbtp -
          NORMALIZER_LOUDNESS_PEAK_MARGIN_DB,
      );
      expect(control.outputForegroundLufs).toBeGreaterThanOrEqual(
        genre.outputAimLufs - 1.5,
      );
      expect(control.outputLufs).toBeGreaterThanOrEqual(
        genre.outputAimLufs - 1.5,
      );
      expect(control.truePeakDbtp).toBeLessThanOrEqual(-0.99);
      expect(control.limiterLossLu).toBeLessThanOrEqual(
        genre.limiterLossBudgetLu + 0.036,
      );
      expect(control.crestLossDb).toBeLessThanOrEqual(bound.crest + 0.055);
      expect(control.phraseLossDb).toBeLessThanOrEqual(bound.phrase + 0.055);
    });
    audit.genres
      .filter((genre) =>
        genre.references.every((one) => one.inputLimit === 'none'),
      )
      .forEach((genre) =>
        expect(
          spread(genre.references.map((one) => one.outputForegroundLufs)),
        ).toBeLessThanOrEqual(1.5),
      );
    audit.genres
      .filter((genre) => genre.closestAimErrorLu > 1.5)
      .forEach((genre) =>
        expect(genre.references.every((one) => one.inputLimit !== 'none')).toBe(
          true,
        ),
      );
  });

  it('bypasses every active colour stage and curve, keeps de-essing gentle and readouts current', () => {
    const stages = [
      'deEsser',
      'exciter',
      'bassForge',
      'bassPunch',
      'dimension',
      'eq',
    ] as const;
    audit.genres.forEach((genre) => {
      expect(genre.stageEffects.map((one) => one.stage).sort()).toEqual(
        [
          ...stages.filter((stage) => genre.settings[stage].enabled),
          'genreCurve',
        ].sort(),
      );
      genre.stageEffects.forEach((effect) => {
        expect(effect.loudnessDeltaLu).toHaveLength(2);
        expect(effect.foregroundDeltaLu).toHaveLength(2);
        [...effect.loudnessDeltaLu, ...effect.foregroundDeltaLu].forEach(
          (one) => expect(Number.isFinite(one)).toBe(true),
        );
      });
      genre.stageEffects
        .filter((effect) => effect.stage === 'deEsser')
        .flatMap((effect) => effect.loudnessDeltaLu)
        .forEach((one) => expect(Math.abs(one)).toBeLessThanOrEqual(0.15));
      expect(genre.settings.deEsser.isolate).toBe(false);
      [genre.settings.deEsser]
        .filter((one) => one.enabled)
        .forEach((deEsser) => {
          expect(deEsser).toMatchObject({
            mode: 'spectral',
            centreOnly: true,
          });
          expect(deEsser.rangeDb).toBeLessThanOrEqual(1.5);
          expect(deEsser.sensitivity).toBeLessThanOrEqual(0.1);
          expect(deEsser.keepCymbals).toBeGreaterThanOrEqual(0.9);
        });
      const meanGain =
        genre.references.reduce(
          (sum, one) => sum + one.outputLufs - one.sourceLufs,
          0,
        ) / 2;
      expect(GENRE_MEASURED[genre.id][0]).toBeCloseTo(meanGain, 2);
      expect(GENRE_MEASURED[genre.id][1]).toBeCloseTo(
        Math.max(...genre.references.map((one) => one.outputTruePeakDbtp)),
        2,
      );
      expect(genreMeasuredSongs(genre.id)).toBe(2);
    });
    expect(presetOf('empty').settings.normalizer.mode).toBe('off');
    expect(presetOf('empty').settings.maximizer.enabled).toBe(false);
    ['piano', 'strings', 'ambient'].forEach((id) =>
      expect(presetOf(id).settings.eq.monoBelowHz).toBe(0),
    );
  });
});
