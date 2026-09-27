/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import type { TStudioSize } from './StudioStage';
import { setStudioGridShown, useStudioGridShown } from './studioPaper';
import { SIZE_ICONS } from './studioTestIcons';

const SIZES: readonly TStudioSize[] = ['graph', 'narrow', 'wide', 'full'];

interface IStudioStageControlsProps {
  size: TStudioSize;
  onSize: (size: TStudioSize) => void;
}

/**
 * The stage's own controls, on the stage: the size it is tried at and the
 * graph's grid over it (layout A, Ivan 2026-09-27). They were rows in the
 * side column, a scroll away from the picture they change.
 *
 * They stand on the stage's plate beside the reading of how the scene keeps
 * up (`StudioStage`: "join all into one with runs smoothly"), so they stay
 * as the reading always has, and take as little of the picture as they can:
 * the chosen size says its name and the others show their drawing, the grid
 * its drawing alone. Every name is still the button's accessible name and
 * its tooltip. The drawings are only drawn on a stage that plays, so nothing
 * here waits for a scene.
 */
export default function StudioStageControls({
  size,
  onSize,
}: IStudioStageControlsProps) {
  const { t } = useTranslation();
  const isGridShown = useStudioGridShown();
  const sizeName = (entry: TStudioSize) =>
    t(`studio.size.${entry}` as TranslationKey);
  const gridName = t('studio.grid.label');
  return (
    <div className="studio-stage-controls">
      <div
        className="studio-stage-controls__group"
        role="group"
        aria-label={t('studio.size.title')}
      >
        {SIZES.map((entry) => (
          <button
            key={entry}
            type="button"
            className="studio-stage-controls__button"
            aria-pressed={size === entry}
            aria-label={sizeName(entry)}
            title={sizeName(entry)}
            onClick={() => onSize(entry)}
          >
            {SIZE_ICONS[entry]}
            <span className="studio-stage-controls__word" aria-hidden="true">
              {sizeName(entry)}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="studio-stage-controls__button studio-stage-controls__grid"
        aria-pressed={isGridShown}
        aria-label={gridName}
        // The name first, then what it is for: a drawing alone says neither.
        title={`${gridName}\n${t('studio.grid.hint')}`}
        onClick={() => setStudioGridShown(!isGridShown)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11" />
        </svg>
      </button>
    </div>
  );
}
