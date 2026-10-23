/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DE_ESSER_DEFAULTS,
  DE_ESSER_MIN_SPAN,
  DE_ESSER_MODES,
  DE_ESSER_RANGES,
  IDeEsserSettings,
  TDeEsserMode,
} from '../../common/dsp/deEsser';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { Dial } from './DspControls';
import { DE_ESSER_MODE_KEYS } from './DspDeEsserBar';
import { TDeEsserTune } from './deEsserLens';

interface IDspDeEsserControlsProps {
  deEsser: IDeEsserSettings;
  /** A sound edit: the card clears the profile's name with it. */
  onEdit: (next: Partial<IDeEsserSettings>) => void;
  onCommit: () => void;
  /** A control started or stopped being worked, for the display's lens. */
  onTune: (tune: TDeEsserTune, engaged: boolean) => void;
}

const MODE_HINTS: Record<TDeEsserMode, TranslationKey> = {
  spectral: 'dsp.deEsser.mode.spectralHint',
  treble: 'dsp.deEsser.mode.trebleHint',
  whole: 'dsp.deEsser.mode.wholeHint',
};

/**
 * The De-esser's four decisions — Find, Reduce, Timing, Where — as the plan
 * drew them.
 *
 * Each group is three rows of one grid (`_dspDeEsser.scss`): its name with
 * any choice under it, its note, its dials. The rows are shared across the
 * groups standing side by side, so every name, every note and every row of
 * dials starts on one line whatever a language makes of the words.
 *
 * The frequencies are turned in kilohertz: an S lives between 3 and 12 kHz,
 * and "4500 Hz" is a figure read digit by digit where "4.5 kHz" is read at a
 * glance.
 */
const DspDeEsserControls = ({
  deEsser,
  onEdit,
  onCommit,
  onTune,
}: IDspDeEsserControlsProps) => {
  const { t } = useTranslation();
  const isOff = !deEsser.enabled;

  /** A dial's report to the lens. */
  const engage = (tune: TDeEsserTune) => (engaged: boolean) =>
    onTune(tune, engaged);
  /**
   * A choice's: the option under the pointer or the keyboard's ring, so the
   * lens shows what that option would do before it is picked. Nothing while
   * the stage is off, as the dials report nothing then.
   */
  const pointAt = (tune: TDeEsserTune, engaged: boolean) => {
    if (!isOff) {
      onTune(tune, engaged);
    }
  };
  const focusOn = (tune: TDeEsserTune, target: Element) => {
    if (target.matches(':focus-visible')) {
      pointAt(tune, true);
    }
  };

  /**
   * The range keeps a third of an octave between its ends, as the engine
   * does (`DE_ESSER_MIN_SPAN`): turning one end into the other carries the
   * other along rather than refusing the turn.
   */
  const setLow = (lowHz: number) =>
    onEdit({
      lowHz,
      highHz: Math.min(
        DE_ESSER_RANGES.highHz.max,
        Math.max(deEsser.highHz, lowHz * DE_ESSER_MIN_SPAN),
      ),
    });
  const setHigh = (highHz: number) =>
    onEdit({
      highHz,
      lowHz: Math.max(
        DE_ESSER_RANGES.lowHz.min,
        Math.min(deEsser.lowHz, highHz / DE_ESSER_MIN_SPAN),
      ),
    });

  /** A choice is a whole edit: it is committed as it is made. */
  const choose = (next: Partial<IDeEsserSettings>) => {
    onEdit(next);
    onCommit();
  };

  return (
    <div className="dsp-de-esser-controls">
      <div className="dsp-band">
        <div className="dsp-de-esser-head">
          <span className="dsp-band-title">{t('dsp.deEsser.group.find')}</span>
        </div>
        <p className="dsp-band-hint">{t('dsp.deEsser.group.findHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.deEsser.sensitivity"
            onEngage={engage({ control: 'sensitivity' })}
            value={deEsser.sensitivity * 100}
            defaultValue={DE_ESSER_DEFAULTS.sensitivity * 100}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(value) => onEdit({ sensitivity: value / 100 })}
          />
          <Dial
            labelKey="dsp.deEsser.lowHz"
            onEngage={engage({ control: 'listening' })}
            value={deEsser.lowHz / 1000}
            defaultValue={DE_ESSER_DEFAULTS.lowHz / 1000}
            min={DE_ESSER_RANGES.lowHz.min / 1000}
            max={DE_ESSER_RANGES.lowHz.max / 1000}
            unit="kHz"
            step={0.1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(value) => setLow(value * 1000)}
          />
          <Dial
            labelKey="dsp.deEsser.highHz"
            onEngage={engage({ control: 'listening' })}
            value={deEsser.highHz / 1000}
            defaultValue={DE_ESSER_DEFAULTS.highHz / 1000}
            min={DE_ESSER_RANGES.highHz.min / 1000}
            max={DE_ESSER_RANGES.highHz.max / 1000}
            unit="kHz"
            step={0.1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(value) => setHigh(value * 1000)}
          />
        </div>
      </div>

      <div className="dsp-band">
        <div className="dsp-de-esser-head">
          <span className="dsp-band-title">
            {t('dsp.deEsser.group.reduce')}
          </span>
          <div
            className="segmented"
            role="group"
            aria-label={t('dsp.deEsser.mode.label')}
          >
            {DE_ESSER_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`segmented__option${
                  deEsser.mode === mode ? ' is-selected' : ''
                }`}
                aria-pressed={deEsser.mode === mode}
                disabled={isOff}
                onClick={() => choose({ mode })}
                onPointerEnter={() => pointAt({ control: 'mode', mode }, true)}
                onPointerLeave={() => pointAt({ control: 'mode', mode }, false)}
                onFocus={(event) =>
                  focusOn({ control: 'mode', mode }, event.target)
                }
                onBlur={() => pointAt({ control: 'mode', mode }, false)}
              >
                {t(DE_ESSER_MODE_KEYS[mode])}
              </button>
            ))}
          </div>
        </div>
        <p className="dsp-band-hint">{t(MODE_HINTS[deEsser.mode])}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.deEsser.rangeDb"
            onEngage={engage({ control: 'depth' })}
            value={deEsser.rangeDb}
            defaultValue={DE_ESSER_DEFAULTS.rangeDb}
            min={DE_ESSER_RANGES.rangeDb.min}
            max={DE_ESSER_RANGES.rangeDb.max}
            unit="dB"
            step={0.5}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(rangeDb) => onEdit({ rangeDb })}
          />
          {/* How far a band's cut reaches its neighbours. Treble and Whole
              voice cut by the deepest band alone, which no spread changes,
              so it rests there rather than turning nothing. */}
          <Dial
            labelKey="dsp.deEsser.widthOct"
            onEngage={engage({ control: 'width' })}
            value={deEsser.widthOct}
            defaultValue={DE_ESSER_DEFAULTS.widthOct}
            min={DE_ESSER_RANGES.widthOct.min}
            max={DE_ESSER_RANGES.widthOct.max}
            unit="oct"
            step={0.05}
            isDisabled={isOff || deEsser.mode !== 'spectral'}
            onCommit={onCommit}
            onChange={(widthOct) => onEdit({ widthOct })}
          />
        </div>
      </div>

      <div className="dsp-band">
        <div className="dsp-de-esser-head">
          <span className="dsp-band-title">
            {t('dsp.deEsser.group.timing')}
          </span>
        </div>
        <p className="dsp-band-hint">{t('dsp.deEsser.group.timingHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.deEsser.attackMs"
            onEngage={engage({ control: 'attack' })}
            value={deEsser.attackMs}
            defaultValue={DE_ESSER_DEFAULTS.attackMs}
            min={DE_ESSER_RANGES.attackMs.min}
            max={DE_ESSER_RANGES.attackMs.max}
            unit="ms"
            step={0.1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(attackMs) => onEdit({ attackMs })}
          />
          <Dial
            labelKey="dsp.deEsser.releaseMs"
            onEngage={engage({ control: 'release' })}
            value={deEsser.releaseMs}
            defaultValue={DE_ESSER_DEFAULTS.releaseMs}
            min={DE_ESSER_RANGES.releaseMs.min}
            max={DE_ESSER_RANGES.releaseMs.max}
            unit="ms"
            step={5}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(releaseMs) => onEdit({ releaseMs })}
          />
        </div>
      </div>

      <div className="dsp-band">
        <div className="dsp-de-esser-head">
          <span className="dsp-band-title">{t('dsp.deEsser.group.where')}</span>
          <div
            className="segmented"
            role="group"
            aria-label={t('dsp.deEsser.where.label')}
          >
            {[true, false].map((centreOnly) => (
              <button
                key={String(centreOnly)}
                type="button"
                className={`segmented__option${
                  deEsser.centreOnly === centreOnly ? ' is-selected' : ''
                }`}
                aria-pressed={deEsser.centreOnly === centreOnly}
                disabled={isOff}
                onClick={() => choose({ centreOnly })}
                onPointerEnter={() =>
                  pointAt({ control: 'where', centreOnly }, true)
                }
                onPointerLeave={() =>
                  pointAt({ control: 'where', centreOnly }, false)
                }
                onFocus={(event) =>
                  focusOn({ control: 'where', centreOnly }, event.target)
                }
                onBlur={() => pointAt({ control: 'where', centreOnly }, false)}
              >
                {centreOnly
                  ? t('dsp.deEsser.where.centre')
                  : t('dsp.deEsser.where.all')}
              </button>
            ))}
          </div>
        </div>
        <p className="dsp-band-hint">
          {deEsser.centreOnly
            ? t('dsp.deEsser.where.centreHint')
            : t('dsp.deEsser.where.allHint')}
        </p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.deEsser.keepCymbals"
            onEngage={engage({ control: 'keepCymbals' })}
            value={deEsser.keepCymbals * 100}
            defaultValue={DE_ESSER_DEFAULTS.keepCymbals * 100}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(value) => onEdit({ keepCymbals: value / 100 })}
          />
        </div>
      </div>
    </div>
  );
};

export default DspDeEsserControls;
