/* FluidEQ — GPL-3.0-or-later */
import type { ILibraryNormalizationAnalysis, ILibraryTrack } from './types';

export const hasCurrentNormalization = (
  analysis: ILibraryNormalizationAnalysis | undefined,
): boolean =>
  analysis?.version === 3 &&
  typeof analysis.maxShortTermLufs === 'number' &&
  Number.isFinite(analysis.maxShortTermLufs);

type TSignature = Pick<ILibraryTrack, 'sizeBytes' | 'mtimeMs'>;

/** A meter upgrade must not erase valid noise facts, or borrow them from a
 * different file that happened to replace the cached path. */
export const mergeNormalizationAnalysis = (
  measured: ILibraryNormalizationAnalysis | undefined,
  cached: ILibraryNormalizationAnalysis | undefined,
  signature: TSignature | undefined,
  expected: TSignature,
): ILibraryNormalizationAnalysis | undefined => {
  if (!measured) {
    return undefined;
  }
  const unchanged =
    signature?.sizeBytes === expected.sizeBytes &&
    signature?.mtimeMs === expected.mtimeMs;
  return {
    ...measured,
    noise: measured.noise ?? (unchanged ? cached?.noise : undefined),
  };
};
