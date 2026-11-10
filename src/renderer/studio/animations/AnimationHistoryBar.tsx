/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { IHistoryList } from 'main/memberScenes/animationHistory';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { animationHistory } from './animationActions';

type TMove = 'undo' | 'redo' | 'restore-original';

/**
 * Undo, redo and the original for an opened animation (Ivan, 2026-11-10:
 * "and user can undo that too"), over main's history of it: every change the
 * chat or an import made is a version, and the first one is kept for good.
 * Asked again whenever the animation is read anew (`revision`), since the
 * chat changes it from outside this view; hidden while there is nothing to
 * go back or forward to.
 */
export default function AnimationHistoryBar({
  name,
  revision,
}: {
  name: string;
  /** Changes whenever the tab reads the animation's files again. */
  revision: unknown;
}) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<IHistoryList>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    animationHistory({ action: 'list', name })
      .then((outcome) => {
        if (live && outcome.ok && 'history' in outcome) {
          setHistory(outcome.history);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [name, revision]);

  const move = (action: TMove) => {
    setBusy(true);
    animationHistory({ action, name })
      .then((outcome) => {
        setBusy(false);
        if (outcome.ok && 'history' in outcome) {
          setHistory(outcome.history);
        }
        return undefined;
      })
      .catch(() => setBusy(false));
  };

  if (
    !history ||
    (!history.canUndo && !history.canRedo && history.current === 'original')
  ) {
    return null;
  }
  return (
    <div
      className="studio-animation-history"
      role="group"
      aria-label={t('studio.animation.history')}
    >
      <button
        type="button"
        className="button small subtle"
        disabled={busy || !history.canUndo}
        onClick={() => move('undo')}
      >
        {t('studio.animation.undo')}
      </button>
      <button
        type="button"
        className="button small subtle"
        disabled={busy || !history.canRedo}
        onClick={() => move('redo')}
      >
        {t('studio.animation.redo')}
      </button>
      <button
        type="button"
        className="button small subtle"
        disabled={busy || history.current === 'original'}
        onClick={() => move('restore-original')}
      >
        <Glyph name="history" />
        {t('studio.animation.original')}
      </button>
    </div>
  );
}
