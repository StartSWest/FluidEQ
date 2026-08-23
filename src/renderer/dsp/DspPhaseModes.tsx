/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { TPhaseView } from './store';

/**
 * The three things the phase block can be, as glyphs rather than words.
 *
 * Words would not fit: this block is as wide as a dial and the names are
 * "off", "correlation" and "goniometer". The shapes say it faster anyway — a
 * crossed circle, a needle, a scatter — and each one is a picture of what it
 * switches to rather than a label for it.
 */
const VIEWS: { view: TPhaseView; key: TranslationKey; path: string }[] = [
  {
    view: 'off',
    key: 'dsp.eq.phaseOff',
    // A circle with a stroke through it: nothing being shown.
    path: 'M8 3.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6M4.6 12.4 11.4 3.6',
  },
  {
    view: 'needle',
    key: 'dsp.eq.phaseNeedle',
    // An arc with a pointer standing in it.
    path: 'M2.6 12.4a5.4 5.4 0 0 1 10.8 0M8 12.4 5.6 6.2',
  },
  {
    view: 'scope',
    key: 'dsp.eq.phaseScope',
    // The lobe a goniometer draws, upright, over its own axes.
    path: 'M8 2.4c2.6 2 3.6 5.4 0 11.2-3.6-5.8-2.6-9.2 0-11.2M2.4 8h11.2',
  },
];

interface IDspPhaseModesProps {
  view: TPhaseView;
  onChange: (next: TPhaseView) => void;
}

const DspPhaseModes = ({ view, onChange }: IDspPhaseModesProps) => {
  const { t } = useTranslation();

  return (
    <div className="dsp-phase-modes" role="radiogroup">
      {VIEWS.map((entry) => (
        <button
          key={entry.view}
          type="button"
          role="radio"
          aria-checked={entry.view === view}
          aria-label={t(entry.key)}
          title={t(entry.key)}
          className={`dsp-phase-mode${
            entry.view === view ? ' is-selected' : ''
          }`}
          onClick={() => onChange(entry.view)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d={entry.path} />
          </svg>
        </button>
      ))}
    </div>
  );
};

export default DspPhaseModes;
