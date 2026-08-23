/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IExciterBandSettings,
  IExciterSettings,
} from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { Dial, ProcessorCard } from './DspControls';
import DspExciterDisplay from './DspExciterDisplay';

interface IDspExciterCardProps {
  exciter: IExciterSettings;
  onPatch: (next: IExciterSettings) => void;
  onCommit: () => void;
}

const BAND_LABELS: TranslationKey[] = [
  'dsp.exciter.band.low',
  'dsp.exciter.band.mid',
  'dsp.exciter.band.high',
];

/**
 * The exciter's page: three bands, the organic stage, and a display of what
 * both are doing.
 *
 * Its own file because it stopped being three dials. `DspPanel` draws four
 * processors and was over the size this project allows before this page grew a
 * canvas, a per-band switch and a stage of its own; the compressor's page is
 * the next one that should come out.
 */
const DspExciterCard = ({
  exciter,
  onPatch,
  onCommit,
}: IDspExciterCardProps) => {
  const { t } = useTranslation();

  const patchBand = (index: number, patch: Partial<IExciterBandSettings>) => {
    onPatch({
      ...exciter,
      bands: exciter.bands.map((band, at) =>
        at === index ? { ...band, ...patch } : band,
      ),
    });
  };

  return (
    <ProcessorCard
      id="dsp-exciter"
      titleKey="dsp.exciter.title"
      descriptionKey="dsp.exciter.description"
      isEnabled={exciter.enabled}
      onToggle={() => onPatch({ ...exciter, enabled: !exciter.enabled })}
    >
      {/* Loud, and at the top, because it changes what comes out of the
          speakers more than any other control on the page. A monitoring mode
          that is easy to leave on is one somebody leaves on and then reports
          as the rack having broken — so it is a lit button rather than a
          checkbox, and it says what it is doing while it does it. */}
      <div className="dsp-exciter-monitor">
        <button
          type="button"
          className={`button small${exciter.isolate ? '' : ' subtle'}`}
          aria-pressed={exciter.isolate}
          disabled={!exciter.enabled}
          onClick={() => {
            onPatch({ ...exciter, isolate: !exciter.isolate });
            onCommit();
          }}
        >
          {t('dsp.exciter.isolate')}
        </button>
        <span className="dsp-exciter-monitor-hint">
          {exciter.isolate
            ? t('dsp.exciter.isolateOn')
            : t('dsp.exciter.isolateHint')}
        </span>
      </div>

      <DspExciterDisplay settings={exciter} />

      <div className="dsp-crossovers">
        <Dial
          labelKey="dsp.exciter.crossoverLow"
          value={exciter.crossoverHz[0]}
          defaultValue={DSP_DEFAULTS.exciter.crossoverHz[0]}
          min={120}
          max={1_000}
          unit="Hz"
          step={10}
          isDisabled={!exciter.enabled}
          onCommit={onCommit}
          onChange={(low) =>
            onPatch({ ...exciter, crossoverHz: [low, exciter.crossoverHz[1]] })
          }
        />
        <Dial
          labelKey="dsp.exciter.crossoverHigh"
          value={exciter.crossoverHz[1]}
          defaultValue={DSP_DEFAULTS.exciter.crossoverHz[1]}
          min={1_000}
          max={12_000}
          unit="Hz"
          step={100}
          isDisabled={!exciter.enabled}
          onCommit={onCommit}
          onChange={(high) =>
            onPatch({ ...exciter, crossoverHz: [exciter.crossoverHz[0], high] })
          }
        />
      </div>

      {exciter.bands.map((band, index) => (
        <div className="dsp-band" key={BAND_LABELS[index]}>
          {/* The band's own switch sits ON its title row, so a band that is
              off reads as off from across the page rather than from a mix dial
              that happens to be at zero. Three bands where two are silent is
              the normal state of this processor, and the page has to say which
              two without being read closely. */}
          <div className="dsp-band-head">
            <span className="dsp-band-title">{t(BAND_LABELS[index])}</span>
            <Switch
              id={`dsp-exciter-band-${index}`}
              isOn={band.enabled}
              isDisabled={!exciter.enabled}
              handleToggle={() => {
                patchBand(index, { enabled: !band.enabled });
                onCommit();
              }}
              ariaLabel={t(BAND_LABELS[index])}
            />
          </div>
          <div className="dsp-band-dials">
            <Dial
              labelKey="dsp.exciter.drive"
              value={band.drive}
              defaultValue={DSP_DEFAULTS.exciter.bands[index].drive}
              min={1}
              max={10}
              unit=""
              step={0.1}
              isDisabled={!exciter.enabled || !band.enabled}
              onCommit={onCommit}
              onChange={(drive) => patchBand(index, { drive })}
            />
            <Dial
              labelKey="dsp.exciter.mix"
              value={band.mix}
              defaultValue={DSP_DEFAULTS.exciter.bands[index].mix}
              min={0}
              max={1}
              unit=""
              step={0.01}
              isDisabled={!exciter.enabled || !band.enabled}
              onCommit={onCommit}
              onChange={(mix) => patchBand(index, { mix })}
            />
            {/* 0 is all even, 1 is all odd — one dial, because they are the
                same curve at two asymmetries rather than two effects. */}
            <Dial
              labelKey="dsp.exciter.texture"
              value={band.texture}
              defaultValue={DSP_DEFAULTS.exciter.bands[index].texture}
              min={0}
              max={1}
              unit=""
              step={0.01}
              isDisabled={!exciter.enabled || !band.enabled}
              onCommit={onCommit}
              onChange={(texture) => patchBand(index, { texture })}
            />
            <Dial
              labelKey="dsp.exciter.threshold"
              value={band.thresholdDb}
              defaultValue={DSP_DEFAULTS.exciter.bands[index].thresholdDb}
              min={-60}
              max={0}
              unit="dB"
              step={0.5}
              isDisabled={!exciter.enabled || !band.enabled || !band.dynamic}
              onCommit={onCommit}
              onChange={(thresholdDb) => patchBand(index, { thresholdDb })}
            />
          </div>
          <label
            className="dsp-band-dynamic"
            htmlFor={`dsp-exciter-dyn-${index}`}
          >
            <Switch
              id={`dsp-exciter-dyn-${index}`}
              isOn={band.dynamic}
              isDisabled={!exciter.enabled || !band.enabled}
              handleToggle={() => {
                patchBand(index, { dynamic: !band.dynamic });
                onCommit();
              }}
              ariaLabel={t('dsp.exciter.dynamic')}
            />
            <span>{t('dsp.exciter.dynamic')}</span>
          </label>
        </div>
      ))}

      {/* Its own block rather than a fourth band, because it is not one: it
          works on its own bandpass, at a frequency the user chooses, and what
          it adds is body rather than excitement. Two dials, and the reason
          there are only two is in `organic.ts` — the drift and the tracking
          are the effect, not settings on top of it. */}
      <div className="dsp-band dsp-band-organic">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('dsp.exciter.organic')}</span>
          <Switch
            id="dsp-exciter-organic"
            isOn={exciter.organic.enabled}
            isDisabled={!exciter.enabled}
            handleToggle={() => {
              onPatch({
                ...exciter,
                organic: {
                  ...exciter.organic,
                  enabled: !exciter.organic.enabled,
                },
              });
              onCommit();
            }}
            ariaLabel={t('dsp.exciter.organic')}
          />
        </div>
        <p className="dsp-band-hint">{t('dsp.exciter.organicHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.exciter.organicAmount"
            value={exciter.organic.amount}
            defaultValue={DSP_DEFAULTS.exciter.organic.amount}
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!exciter.enabled || !exciter.organic.enabled}
            onCommit={onCommit}
            onChange={(amount) =>
              onPatch({ ...exciter, organic: { ...exciter.organic, amount } })
            }
          />
          <Dial
            labelKey="dsp.exciter.organicFocus"
            value={exciter.organic.focusHz}
            defaultValue={DSP_DEFAULTS.exciter.organic.focusHz}
            min={40}
            max={16_000}
            unit="Hz"
            step={10}
            // At full range there is no band left to centre, so the dial that
            // centres it is telling the truth by being unavailable rather than
            // by quietly doing nothing.
            isDisabled={
              !exciter.enabled ||
              !exciter.organic.enabled ||
              exciter.organic.range >= 1
            }
            onCommit={onCommit}
            onChange={(focusHz) =>
              onPatch({ ...exciter, organic: { ...exciter.organic, focusHz } })
            }
          />
          <Dial
            labelKey="dsp.exciter.organicRange"
            value={exciter.organic.range}
            defaultValue={DSP_DEFAULTS.exciter.organic.range}
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!exciter.enabled || !exciter.organic.enabled}
            onCommit={onCommit}
            onChange={(range) =>
              onPatch({ ...exciter, organic: { ...exciter.organic, range } })
            }
          />
        </div>
      </div>
    </ProcessorCard>
  );
};

export default DspExciterCard;
