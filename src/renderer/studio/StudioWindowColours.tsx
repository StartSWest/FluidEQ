/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { TranslationKey } from 'common/i18n';
import WindowColourSwatches from '../components/WindowColourSwatches';
import WindowColoursPreview from '../components/WindowColoursPreview';
import { useTranslation } from '../utils/I18nContext';
import type useStudioWindowColours from './useStudioWindowColours';
import type { TWindowColoursSource } from './useStudioWindowColours';

const SOURCE: Record<TWindowColoursSource, TranslationKey> = {
  ai: 'studio.windowColours.byAi',
  palette: 'studio.windowColours.byPalette',
  member: 'studio.windowColours.byYou',
};

/**
 * The Tune tab's Window colours card (Ivan, 2026-11-14: "implement that",
 * the tuning mockup): who chose the colours on it, the three of them, a small
 * window painted in them, "Choose them from the palette" and "Undo my
 * changes". What is chosen here is written into the scene, so it is what the
 * scene publishes with.
 */
export default function StudioWindowColours({
  state,
  idle,
}: {
  state: ReturnType<typeof useStudioWindowColours>;
  idle: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const { colours } = state;
  return (
    <section
      className="studio-card studio-tune__box studio-window-colours"
      aria-labelledby={titleId}
    >
      <div className="studio-window-colours__head">
        <span className="studio-card__eyebrow" id={titleId}>
          {t('studio.windowColours.title')}
        </span>
        <span className="studio-window-colours__source">
          {t(SOURCE[state.source])}
        </span>
      </div>
      {colours ? (
        <>
          <WindowColourSwatches
            colours={colours}
            own={state.own}
            disabled={idle}
            onChange={state.change}
            onCommit={state.commit}
          />
          <WindowColoursPreview colours={colours} named={state.isNamed} />
        </>
      ) : (
        <p className="studio-window-colours__empty">
          {t('studio.windowColours.none')}
        </p>
      )}
      <div className="studio-window-colours__actions">
        <button
          type="button"
          className="button small subtle"
          disabled={idle || !state.canChoosePalette}
          onClick={state.choosePalette}
        >
          {t('studio.windowColours.fromPalette')}
        </button>
        <button
          type="button"
          className="button small subtle"
          disabled={idle || !state.canUndo}
          onClick={state.undo}
        >
          {t('studio.windowColours.undo')}
        </button>
      </div>
      <p className="studio-window-colours__note">
        {state.saving === 'failed'
          ? t('studio.windowColours.failed')
          : t('studio.windowColours.note')}
      </p>
    </section>
  );
}
