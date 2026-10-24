/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import {
  setStarterLabelsShown,
  useStarterLabelsShown,
} from './studioStarterGuide';

/**
 * On the stage's plate beside its other controls, while the starter's labels
 * can be shown (`StudioStarterLabels`): one press hides them, one brings them
 * back. A drawing alone, like its neighbours; the name is its tooltip.
 */
export default function StudioStarterLabelsToggle() {
  const { t } = useTranslation();
  const shown = useStarterLabelsShown();
  const name = t('studioStarter.labels');
  return (
    <div className="studio-stage-controls">
      <button
        type="button"
        className="studio-stage-controls__button"
        aria-pressed={shown}
        aria-label={name}
        title={`${name}\n${t('studioStarter.labelsHint')}`}
        onClick={() => setStarterLabelsShown(!shown)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2.5 3.5h6.8l4.2 4.5-4.2 4.5H2.5zM5.4 8h.01" />
        </svg>
      </button>
    </div>
  );
}
