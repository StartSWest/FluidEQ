/* FluidEQ — GPL-3.0-or-later */
import {
  hasCurrentNormalization,
  mergeNormalizationAnalysis,
} from '../../../common/library/normalization';
import { silentNoiseProfile } from '../../../common/dsp/noiseProfile';
import { normalizerGainBreakdown } from '../../../renderer/dsp/inputNormalizer';
import type { ILibraryNormalizationAnalysis } from '../../../common/library/types';

const old: ILibraryNormalizationAnalysis = {
  version: 2,
  integratedLufs: -22,
  truePeakDbtp: -12,
  noise: silentNoiseProfile(),
  edges: { leadInMs: 100, endMs: 30000 },
};
const measured: ILibraryNormalizationAnalysis = {
  version: 3,
  integratedLufs: -22,
  maxShortTermLufs: -20,
  truePeakDbtp: -12,
  edges: old.edges,
};
const signature = { sizeBytes: 12, mtimeMs: 34 };

it('refreshes only obsolete facts while retaining noise for the same recording', () => {
  expect(hasCurrentNormalization(old)).toBe(false);
  expect(hasCurrentNormalization(measured)).toBe(true);
  expect(
    mergeNormalizationAnalysis(measured, old, signature, signature),
  ).toEqual({
    ...measured,
    noise: old.noise,
  });
  expect(
    mergeNormalizationAnalysis(measured, old, undefined, signature)?.noise,
  ).toBeUndefined();
  expect(
    mergeNormalizationAnalysis(
      measured,
      old,
      { ...signature, mtimeMs: 35 },
      signature,
    )?.noise,
  ).toBeUndefined();
  expect(
    mergeNormalizationAnalysis(undefined, old, signature, signature),
  ).toBeUndefined();
});

it('targets foreground with one constant gain and keeps the shared bounds visible', () => {
  const settings = {
    mode: 'loudness' as const,
    targetLufs: -18,
    truePeakDbtp: -3,
  };
  const result = normalizerGainBreakdown(settings, measured);
  expect(result.appliedDb).toBe(2);
  expect(result.limitedBy).toBe('none');
  expect(normalizerGainBreakdown(settings, old).appliedDb).toBe(4);
  const quieter = normalizerGainBreakdown(settings, {
    ...measured,
    integratedLufs: -42,
    maxShortTermLufs: -40,
    truePeakDbtp: -32,
  });
  expect(quieter.appliedDb).toBe(12);
  expect(quieter.limitedBy).toBe('maxGain');
  const peaky = normalizerGainBreakdown(settings, {
    ...measured,
    truePeakDbtp: -3,
  });
  expect(peaky.appliedDb).toBeCloseTo(-0.95, 10);
  expect(peaky.limitedBy).toBe('ceiling');
  expect(
    normalizerGainBreakdown({ ...settings, mode: 'truePeak' }, measured)
      .appliedDb,
  ).toBe(0);
});
