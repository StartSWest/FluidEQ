/* FluidEQ — GPL-3.0-or-later */
import { createHash } from 'crypto';
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
import type { IDspSettings } from '../../../common/dsp/chain';

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
  | 'measuredInputGainDb'
  | 'inputResidualDb'
  | 'inputAlignmentFrames'
  | 'outputLufs'
  | 'outputForegroundLufs'
  | 'outputTruePeakDbtp'
  | 'limiterLossLu'
  | 'crestLossDb'
  | 'blockRangeLossDb'
  | 'relativeLoudnessLu'
  | 'ceilingMatchedDryLufs',
  number
> & {
  reference: string;
  sourceUrl: string;
  trackId: number;
  mediaSha256: string;
  decodedSha256: string;
  beforeMax: IMeasurement;
  driveOnly: IMeasurement;
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
  configurationSha256: string;
  settings: IDspSettings;
  renderedTone: ReturnType<typeof factoryMusicTone>;
  gains: number[];
  limiterLossBudgetLu: number;
  provenance: IProvenance & {
    processingSha256: string;
    media: { id: string; sha256: string }[];
  };
  references: IReference[];
  stageEffects: ({
    stage: string;
  } & Record<
    | 'loudnessDeltaLu'
    | 'foregroundDeltaLu'
    | 'peakDeltaDb'
    | 'crestDeltaDb'
    | 'phraseDeltaDb',
    number[]
  >)[];
  strengthControl: Record<
    | 'sourceLufs'
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
  liveOpening: Record<
    | 'truePeakDbtp'
    | 'firstBlockExcessDb'
    | 'first100MsExcessDb'
    | 'firstSecondExcessDb',
    number
  >;
}
const audit = recorded as unknown as IProvenance & {
  schema: number;
  completeCatalogue: boolean;
  headphoneCorrection: boolean;
  liveApplicationSettings: boolean;
  outputDevicesOpened: boolean;
  fixtureSha256: string;
  processingSources: ReturnType<typeof musicProcessingSources>;
  media: { id: string; sha256: string }[];
  genres: IGenre[];
};
const root = path.resolve(__dirname, '../../../..');
const fixture = path.join(
  root,
  'native/dsp-core/tests/fixtures/music-factory.txt',
);
const presetOf = (id: string) => {
  const preset = DSP_PRESETS.find((one) => one.id === id);
  if (!preset) {
    throw new Error(`No preset for ${id}`);
  }
  return preset;
};
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
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
  it('requires fresh evidence for all 83 racks and the 166 original references', () => {
    expect(audit.schema).toBe(3);
    expect(audit.completeCatalogue).toBe(true);
    expect(audit.processingSources).toEqual(musicProcessingSources(root));
    const shaText = (file: string) =>
      createHash('sha256')
        .update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))
        .digest('hex');
    expect(audit.policySha256).toBe(
      shaText(path.join(root, 'docs/dsp/music-reference-policy.json')),
    );
    expect(audit.fixtureSha256).toBe(shaText(fixture));
    [audit.nativeEngineSha256, audit.nativeMeterSha256].forEach((hash) =>
      expect(hash).toMatch(/^[a-f0-9]{64}$/),
    );
    expect(audit.headphoneCorrection).toBe(false);
    expect(audit.liveApplicationSettings).toBe(false);
    expect(audit.outputDevicesOpened).toBe(false);
    expect(audit.genres.map((one) => one.id).sort()).toEqual(
      GENRE_RACKS.map((one) => one.id).sort(),
    );
    expect(audit.media).toHaveLength(166);
    expect(new Set(audit.media.map((one) => one.id)).size).toBe(166);
    expect(JSON.stringify(audit)).not.toMatch(/[A-Z]:[\\/]|\\\\Users\\|\.wav"/);
  });

  it('holds exact curves and native settings to the fixture that actually runs in CI', () => {
    const rows = readFileSync(fixture, 'utf8').trim().split(/\r?\n/);
    expect(rows).toHaveLength(83);
    audit.genres.forEach((genre) => {
      const preset = presetOf(genre.chainId);
      const rack = GENRE_RACKS.find((one) => one.id === genre.id);
      if (!rack) {
        throw new Error(`Unknown genre ${genre.id}`);
      }
      expect(genre.chainId).toBe(genreChainId(rack));
      expect(genre.configurationSha256).toBe(musicConfigurationSha256(preset));
      expect(genre.settings).toEqual(preset.settings);
      expect(genre.renderedTone).toEqual(factoryMusicTone(preset));
      expect(genre.gains).toEqual(preset.curve?.bands.map((one) => one.gainDb));
      const pinned = Reflect.get(policy.genres, genre.id);
      const loss = pinned.limiterLossBudgetLu;
      expect(genre.limiterLossBudgetLu).toBe(loss);
      const bound = budgets(loss);
      expect(rows).toContain(
        `${genre.id} ${loss} ${bound.crest} ${bound.phrase} ${factoryMusicLine(preset)}`,
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
      expect(genre.settings.normalizer.mode).toBe('off');
      expect(genre.settings.maximizer.ceilingDb).toBeLessThanOrEqual(-1);
    });
  });

  it('verifies both named recordings and compares their whole input to the original waveform', () => {
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
        expect(reference.measuredInputGainDb).toBeCloseTo(0, 4);
        expect(reference.inputResidualDb).toBeLessThan(-100);
        expect(reference.inputAlignmentFrames).toBe(0);
      });
    });
  });

  it('preserves the original limiter and dynamics budgets with fixed drive', () => {
    audit.genres.forEach((genre) => {
      const bound = budgets(genre.limiterLossBudgetLu);
      expect(
        spread(genre.references.map((one) => one.outputLufs - one.sourceLufs)),
      ).toBeLessThanOrEqual(1.5);
      expect(
        spread(
          genre.references.map(
            (one) => one.outputForegroundLufs - one.sourceForegroundLufs,
          ),
        ),
      ).toBeLessThanOrEqual(1.5);
      genre.references.forEach((one) => {
        expect(one.relativeLoudnessLu).toBeCloseTo(
          one.outputLufs - one.sourceLufs,
          7,
        );
        expect(one.ceilingMatchedDryLufs).toBeCloseTo(
          one.sourceLufs +
            Math.min(
              0,
              genre.settings.maximizer.ceilingDb - one.sourceTruePeakDbtp,
            ),
          7,
        );
        expect(one.outputTruePeakDbtp).toBeLessThanOrEqual(-0.99);
        expect(one.rawOutput.truePeakDbtp).toBeLessThanOrEqual(-0.99);
        expect(one.limiterLossLu).toBeCloseTo(
          one.driveOnly.integratedLufs - one.outputLufs,
          7,
        );
        expect(one.limiterLossLu).toBeLessThanOrEqual(
          genre.limiterLossBudgetLu + 0.036,
        );
        expect(one.crestLossDb).toBeLessThanOrEqual(bound.crest + 0.055);
        expect(one.blockRangeLossDb).toBeLessThanOrEqual(bound.phrase + 0.055);
      });
      const control = genre.strengthControl;
      expect(control.sourceForegroundLufs).toBeCloseTo(-18, 4);
      expect(control.sourceTruePeakDbtp).toBeLessThan(-12);
      expect(
        Math.abs(control.outputLufs - control.sourceLufs),
      ).toBeLessThanOrEqual(4.5);
      expect(
        Math.abs(control.outputForegroundLufs - control.sourceForegroundLufs),
      ).toBeLessThanOrEqual(4.5);
      expect(control.truePeakDbtp).toBeLessThanOrEqual(-0.99);
      expect(control.limiterLossLu).toBeLessThanOrEqual(
        genre.limiterLossBudgetLu + 0.036,
      );
      expect(control.crestLossDb).toBeLessThanOrEqual(bound.crest + 0.055);
      expect(control.phraseLossDb).toBeLessThanOrEqual(bound.phrase + 0.055);
      const opening = genre.liveOpening;
      expect(opening.truePeakDbtp).toBeLessThanOrEqual(-0.99);
      [
        opening.firstBlockExcessDb,
        opening.first100MsExcessDb,
        opening.firstSecondExcessDb,
      ].forEach((excess) => expect(excess).toBeLessThan(0.75));
    });
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
      genre.stageEffects.forEach(({ stage: _stage, ...deltas }) => {
        Object.values(deltas).forEach((series) => {
          expect(series).toHaveLength(2);
          series.forEach((one) => expect(Number.isFinite(one)).toBe(true));
        });
      });
      genre.stageEffects
        .filter((effect) => effect.stage === 'deEsser')
        .flatMap((effect) => effect.loudnessDeltaLu)
        .forEach((one) => expect(Math.abs(one)).toBeLessThanOrEqual(0.15));
      const { deEsser } = genre.settings;
      expect(deEsser.isolate).toBe(false);
      const meanGain =
        genre.references.reduce((sum, one) => sum + one.relativeLoudnessLu, 0) /
        2;
      expect(GENRE_MEASURED[genre.id][0]).toBeCloseTo(meanGain, 2);
      expect(GENRE_MEASURED[genre.id][1]).toBeCloseTo(
        Math.max(...genre.references.map((one) => one.outputTruePeakDbtp)),
        2,
      );
      expect(genreMeasuredSongs(genre.id)).toBe(2);
    });
    audit.genres
      .map((genre) => genre.settings.deEsser)
      .filter((deEsser) => deEsser.enabled)
      .forEach((deEsser) => {
        expect(deEsser).toMatchObject({ mode: 'spectral', centreOnly: true });
        expect(deEsser.rangeDb).toBeLessThanOrEqual(1.5);
        expect(deEsser.sensitivity).toBeLessThanOrEqual(0.1);
        expect(deEsser.keepCymbals).toBeGreaterThanOrEqual(0.9);
      });
    expect(presetOf('empty').settings.normalizer.mode).toBe('off');
    expect(presetOf('empty').settings.maximizer.enabled).toBe(false);
    ['piano', 'strings', 'ambient'].forEach((id) =>
      expect(presetOf(id).settings.eq.monoBelowHz).toBe(0),
    );
  });

  it('retains the approved tonal balance and dynamics in both named Pop and K-pop references', () => {
    const { controls } = recorded.approvalComparison;
    ['pop', 'kPop'].forEach((id) => {
      const names = controls
        .filter((control) => control.genre === id)
        .map((control) => control.reference);
      expect(names).toEqual(GENRE_NOTES[id].listen);
    });
    controls.forEach((control) => {
      Object.values(control.levelMatchedSpectrumDeltaDb).forEach((delta) =>
        expect(Math.abs(delta)).toBeLessThanOrEqual(0.75),
      );
      expect(Math.abs(control.crestDeltaDb)).toBeLessThanOrEqual(0.75);
      expect(control.phraseContrastDeltaDb).toBeGreaterThanOrEqual(-0.25);
    });
  });
});
