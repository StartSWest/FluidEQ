/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type {
  IMemberSceneProblem,
  TMemberProblemCode,
  TMemberSceneFile,
} from 'common/memberScenes';
import troubleHoldsBack from './stageTrouble';
import type { TStageTrouble } from './StudioStage';

/** Why a scene does not play, in a sentence for the member, and its words. */
export interface IUnfitReason {
  key: TranslationKey;
  /** The file it is in, for the line that names one (`studio.unfit.file`). */
  file?: TMemberSceneFile;
}

/** The problems a member meets most, each said in plain words of its own. */
const PLAIN: Partial<Record<TMemberProblemCode, TranslationKey>> = {
  'no-daylight': 'studio.unfit.noDaylight',
  'missing-file': 'studio.unfit.missingFile',
  'bad-json': 'studio.unfit.badJson',
  'bad-world': 'studio.unfit.world',
  'bad-model': 'studio.unfit.world',
  'model-too-heavy': 'studio.unfit.world',
  'pack-too-large': 'studio.unfit.tooLarge',
  'file-too-large': 'studio.unfit.tooLarge',
};

/**
 * Why the open scene cannot be kept, put on the desktop or published, said
 * beside the controls that wait for it — or nothing, while it is only still
 * being built. The stage keeps playing the last version that worked while a
 * newer one has a problem, so without this the controls were simply off, and
 * a press on "Put on desktop" did nothing anybody could see (Ivan, 2026-11-10:
 * "it is there but when I try to set the desktop nothing happens").
 *
 * The first problem speaks for the rest: the problem list under the stage
 * shows them all.
 */
const unfitReason = (
  problems: readonly IMemberSceneProblem[] | undefined,
  trouble: TStageTrouble | undefined,
): IUnfitReason | undefined => {
  const [first] = problems ?? [];
  if (first) {
    const plain = PLAIN[first.code];
    return plain
      ? { key: plain }
      : { key: 'studio.unfit.file', file: first.file };
  }
  if (!troubleHoldsBack(trouble)) {
    return undefined;
  }
  switch (trouble?.kind) {
    case 'compile':
      return { key: 'studio.unfit.compile' };
    case 'heavy':
      return { key: 'studio.unfit.heavy' };
    case 'world':
      return { key: 'studio.unfit.world' };
    default:
      return { key: 'studio.unfit.unavailable' };
  }
};

export default unfitReason;
