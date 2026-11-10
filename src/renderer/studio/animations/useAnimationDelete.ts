/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { animationHistory } from './animationActions';
import useAnimationUsage, { type TAnimationUsage } from './animationUsage';
import type { IViewedAnimation } from './useStudioAnimations';

/**
 * Delete as Ivan set it (2026-11-10: "si no se está usando se borra; si dice
 * se está usando, ask agent to delete it and fix holes"): asked of main at
 * the press, an animation the scene does not play is deleted at once through
 * its history, with Undo standing by; one it plays - or may play, since
 * unknown is not unused - goes to the question that hands it to the chat.
 */
export default function useAnimationDelete(animations: IViewedAnimation[]) {
  const { usage, fresh } = useAnimationUsage(animations);
  /** The question for an animation the scene uses or may use. */
  const [asking, setAsking] = useState<{
    name: string;
    usage: TAnimationUsage;
  }>();
  /** An animation just deleted, for its Undo, and what went wrong, if. */
  const [deleted, setDeleted] = useState<{
    name: string;
    problem?: TranslationKey;
  }>();

  const start = (viewed: IViewedAnimation) => {
    const { name } = viewed.animation;
    fresh(viewed)
      .then(async (now) => {
        if (now !== 'unused') {
          setAsking({ name, usage: now });
          return undefined;
        }
        const outcome = await animationHistory({ action: 'delete', name });
        setDeleted(
          outcome.ok
            ? { name }
            : { name, problem: 'studio.animation.deleteFailed' },
        );
        return undefined;
      })
      .catch(() =>
        setDeleted({ name, problem: 'studio.animation.deleteFailed' }),
      );
  };

  const undo = () => {
    if (!deleted) {
      return;
    }
    const { name } = deleted;
    animationHistory({ action: 'undelete', name })
      .then((outcome) => {
        if (outcome.ok) {
          setDeleted(undefined);
        } else {
          setDeleted({
            name,
            problem:
              outcome.reason === 'taken'
                ? 'studio.animation.undeleteTaken'
                : 'studio.animation.deleteFailed',
          });
        }
        return undefined;
      })
      .catch(() =>
        setDeleted({ name, problem: 'studio.animation.deleteFailed' }),
      );
  };

  return {
    usage,
    start,
    asking,
    closeAsking: () => setAsking(undefined),
    deleted,
    undo,
    dismiss: () => setDeleted(undefined),
  };
}
