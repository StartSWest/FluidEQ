/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useTranslation } from '../utils/I18nContext';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

/** How far one press of the nudge buttons moves the timing. */
const NUDGE_MS = 100;

/** The slider always reaches at least this far, even from a shifted start. */
const SLIDER_MIN_MS = -30_000;
const SLIDER_MAX_MS = 60_000;

interface IKaraokeMakerTimingPopoverProps {
  scope: 'all' | 'from-word';
  onScopeChange: (scope: 'all' | 'from-word') => void;
  /** False when no word is selected, so there is nothing to shift *from*. */
  canShiftFromWord: boolean;
  /**
   * The shift currently in force, in milliseconds.
   *
   * One number, resolved by the caller. In the component this was
   * `scope === 'all' ? project.meta.gapMs : wordShiftMs` written out five
   * times — as the readout, as the slider's min, its max, its value, and the
   * baseline its onChange subtracted from. Five chances for the branches to
   * drift apart, for one value that was always the same.
   */
  shiftMs: number;
  /** The selected word, for the hint. Absent when the scope is the whole song. */
  selectedWord?: string;
  /** Relative, not absolute: how much further to move from where it is now. */
  onShift: (deltaMs: number) => void;
  onClose: () => void;
}

/**
 * Move the lyrics against the audio, for the whole song or from one word on.
 *
 * The first of the toolbar's popovers to become a component. Each of them is a
 * button that opens a small panel of its own controls, which is why the toolbar
 * turned out not to be a list of buttons that a config array could flatten —
 * the buttons are the small part.
 */
const KaraokeMakerTimingPopover = ({
  scope,
  onScopeChange,
  canShiftFromWord,
  shiftMs,
  selectedWord,
  onShift,
  onClose,
}: IKaraokeMakerTimingPopoverProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="karaoke-maker__tool-popover karaoke-maker__timing-popover"
      role="dialog"
      aria-label={t('karaoke.maker.lyricsTiming')}
    >
      <div className="karaoke-maker__popover-heading">
        <KaraokeMakerToolIcon name="timing" />
        <span>{t('karaoke.maker.lyricsTiming')}</span>
        <output>{Math.round(shiftMs)} ms</output>
        <button
          type="button"
          className="karaoke-maker__popover-close"
          onClick={onClose}
          aria-label={t('karaoke.maker.close')}
        >
          ×
        </button>
      </div>
      <div className="karaoke-maker__timing-scope" role="group">
        <button
          type="button"
          className={scope === 'all' ? 'is-active' : ''}
          onClick={() => onScopeChange('all')}
        >
          {t('karaoke.maker.timingAll')}
        </button>
        <button
          type="button"
          className={scope === 'from-word' ? 'is-active' : ''}
          disabled={!canShiftFromWord}
          onClick={() => onScopeChange('from-word')}
        >
          {t('karaoke.maker.timingFromWord')}
        </button>
      </div>
      <p className="karaoke-maker__timing-hint">
        {scope === 'from-word' && selectedWord
          ? t('karaoke.maker.timingFromWordHint', { word: selectedWord })
          : t('karaoke.maker.timingAllHint')}
      </p>
      <div className="karaoke-maker__timing-shift">
        <button
          type="button"
          onClick={() => onShift(-NUDGE_MS)}
          aria-label={t('karaoke.maker.earlier')}
        >
          −{NUDGE_MS}
        </button>
        <input
          type="range"
          // Widened to include the current value, so a shift already past the
          // usual range still has a thumb on the track rather than pinned.
          min={Math.min(SLIDER_MIN_MS, shiftMs)}
          max={Math.max(SLIDER_MAX_MS, shiftMs)}
          step={25}
          value={shiftMs}
          onChange={(event) => onShift(Number(event.target.value) - shiftMs)}
          aria-label={t('karaoke.maker.lyricsTiming')}
        />
        <button
          type="button"
          onClick={() => onShift(NUDGE_MS)}
          aria-label={t('karaoke.maker.later')}
        >
          +{NUDGE_MS}
        </button>
      </div>
    </div>
  );
};

export default KaraokeMakerTimingPopover;
