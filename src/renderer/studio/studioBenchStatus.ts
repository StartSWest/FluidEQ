/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type { TStageTrouble } from './StudioStage';
import troubleHoldsBack from './stageTrouble';

/** The sentence beside the scene's name in the bench's bar. */
export const studioBenchStatus = ({
  chatBusy,
  hasPack,
  hasProblems,
  trouble,
}: {
  chatBusy: boolean;
  hasPack: boolean;
  hasProblems: boolean;
  trouble?: TStageTrouble;
}): TranslationKey => {
  if (chatBusy) {
    return 'studioChat.status.working';
  }
  if (
    hasPack &&
    (hasProblems ||
      trouble?.kind === 'compile' ||
      (trouble?.kind === 'world' && troubleHoldsBack(trouble)))
  ) {
    return 'studio.status.problem';
  }
  return hasPack ? 'studio.status.live' : 'studio.status.waiting';
};

/** What the scene costs, said on the stage and the drawing tab. */
export const studioBenchCost = (
  trouble: TStageTrouble | undefined,
  playing: boolean,
  scale: number,
): TranslationKey | undefined => {
  if (trouble?.kind === 'heavy') {
    return 'studio.cost.heavy';
  }
  if (trouble?.kind === 'unavailable') {
    return 'studio.cost.unavailable';
  }
  if (playing) {
    return scale < 1 ? 'studio.cost.scaled' : 'studio.cost.full';
  }
  return undefined;
};
