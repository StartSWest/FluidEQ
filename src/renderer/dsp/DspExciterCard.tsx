/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  EXCITER_BAND_LIMITS,
  EXCITER_MIN_OCTAVES,
  IExciterBandSettings,
  IExciterSettings,
  constrainExciterBandPosition,
  maximumExciterBandRangeAtFrequency,
} from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { Dial, ProcessorCard } from './DspControls';
import DspExciterBar from './DspExciterBar';
import DspExciterGraph from './DspExciterGraph';

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
      presetId: '',
      bands: exciter.bands.map((band, at) => {
        if (at !== index) {
          return band;
        }
        const next = { ...band, ...patch };
        return {
          ...next,
          ...constrainExciterBandPosition(index, next.freqHz, next.range),
        };
      }),
    });
  };

  /** Any sound edit makes the result Custom; bypass and Isolate do not. */
  const patchProfileSettings = (patch: Partial<IExciterSettings>) =>
    onPatch({ ...exciter, ...patch, presetId: '' });

  return (
    <ProcessorCard
      id="dsp-exciter"
      titleKey="dsp.exciter.title"
      isEnabled={exciter.enabled}
      onToggle={() => {
        onPatch({
          ...exciter,
          enabled: !exciter.enabled,
          isolate: false,
        });
        onCommit();
      }}
      beforePower={
        <div
          className="dsp-exciter-isolate"
          title={
            exciter.isolate
              ? t('dsp.exciter.isolateOn')
              : t('dsp.exciter.isolateHint')
          }
        >
          <span
            className={`dsp-exciter-isolate-label${
              exciter.isolate ? ' is-on' : ''
            }`}
            aria-hidden="true"
          >
            {t('dsp.exciter.isolate')}
          </span>
          <Switch
            id="dsp-exciter-isolate"
            isOn={exciter.isolate}
            isDisabled={!exciter.enabled}
            handleToggle={() => {
              onPatch({ ...exciter, isolate: !exciter.isolate });
              onCommit();
            }}
            ariaLabel={t('dsp.exciter.isolate')}
          />
        </div>
      }
      toolbar={
        <DspExciterBar
          exciter={exciter}
          onChange={onPatch}
          onCommit={onCommit}
        />
      }
    >
      <DspExciterGraph
        settings={exciter}
        onChange={onPatch}
        onCommit={onCommit}
      />

      <div className="dsp-exciter-controls">
        <div className="dsp-exciter-band-row">
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
                {/* A centre and a width, and the width opens either side of the
                centre. Nothing stops two bands covering the same octave —
                these are parallel additions rather than a decomposition, so
                an overlap simply means that octave gets both lots of
                harmonics. */}
                <Dial
                  labelKey="dsp.exciter.bandFreq"
                  value={band.freqHz}
                  defaultValue={DSP_DEFAULTS.exciter.bands[index].freqHz}
                  min={
                    EXCITER_BAND_LIMITS[index].minHz *
                    2 ** (EXCITER_MIN_OCTAVES / 2)
                  }
                  max={
                    EXCITER_BAND_LIMITS[index].maxHz /
                    2 ** (EXCITER_MIN_OCTAVES / 2)
                  }
                  unit="Hz"
                  step={10}
                  isDisabled={!exciter.enabled || !band.enabled}
                  onCommit={onCommit}
                  onChange={(freqHz) => patchBand(index, { freqHz })}
                />
                <Dial
                  labelKey="dsp.exciter.bandRange"
                  value={band.range}
                  defaultValue={DSP_DEFAULTS.exciter.bands[index].range}
                  min={0}
                  // High's legal region is only three octaves wide. Giving
                  // it the generic ten-octave maximum left three quarters of
                  // the physical dial clamped and apparently broken.
                  max={
                    index === 2
                      ? maximumExciterBandRangeAtFrequency(index, band.freqHz)
                      : 1
                  }
                  unit=""
                  step={0.01}
                  isDisabled={!exciter.enabled || !band.enabled}
                  onCommit={onCommit}
                  onChange={(range) => patchBand(index, { range })}
                />
                <Dial
                  labelKey="dsp.exciter.drive"
                  value={band.drive}
                  defaultValue={DSP_DEFAULTS.exciter.bands[index].drive}
                  min={1}
                  max={3.5}
                  unit=""
                  step={0.05}
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
                {/* One asymmetry control. Low/Mid can reach body-heavy even
                current; High maps the same travel from presence toward airy
                odd current so its warm end never becomes another Mid band. */}
                <Dial
                  labelKey="dsp.exciter.texture"
                  value={band.texture}
                  defaultValue={DSP_DEFAULTS.exciter.bands[index].texture}
                  min={0}
                  max={0.7}
                  unit=""
                  step={0.01}
                  isDisabled={!exciter.enabled || !band.enabled}
                  onCommit={onCommit}
                  onChange={(texture) => patchBand(index, { texture })}
                />
              </div>
            </div>
          ))}
        </div>

        {/* These affect the whole Exciter rather than one selected band. They
            lead the single wide row, but move below the band row whenever the
            layout has to split. That keeps the same scope-first hierarchy as
            the EQ without changing the controls' reading order in the DOM. */}
        <div className="dsp-exciter-global-row">
          {/* Timing is intentionally one control. Its hardware-style crossover
              points are fixed in the DSP; exposing them made a simple punch
              and clarity tool look like another multiband EQ. */}
          <div className="dsp-band dsp-band-align">
            <div className="dsp-band-head">
              <span className="dsp-band-title">{t('dsp.exciter.align')}</span>
              <Switch
                id="dsp-exciter-align"
                isOn={exciter.align.enabled}
                isDisabled={!exciter.enabled}
                handleToggle={() => {
                  patchProfileSettings({
                    align: {
                      ...exciter.align,
                      enabled: !exciter.align.enabled,
                    },
                  });
                  onCommit();
                }}
                ariaLabel={t('dsp.exciter.align')}
              />
            </div>
            <p className="dsp-band-hint">{t('dsp.exciter.alignHint')}</p>
            <div className="dsp-band-dials">
              <Dial
                labelKey="dsp.exciter.alignAmount"
                value={exciter.align.amount}
                defaultValue={DSP_DEFAULTS.exciter.align.amount}
                min={0}
                max={1}
                unit=""
                step={0.01}
                isDisabled={!exciter.enabled || !exciter.align.enabled}
                onCommit={onCommit}
                onChange={(amount) =>
                  patchProfileSettings({
                    align: { ...exciter.align, amount },
                  })
                }
              />
            </div>
          </div>

          {/* Its own block rather than a fourth exciter band: it generates a
              soft, even-dominant body layer around the chosen region. It uses
              the same continuously conducting diode curve as the three
              exciter bands. */}
          <div className="dsp-band dsp-band-organic">
            <div className="dsp-band-head">
              <span className="dsp-band-title">{t('dsp.exciter.organic')}</span>
              <Switch
                id="dsp-exciter-organic"
                isOn={exciter.organic.enabled}
                isDisabled={!exciter.enabled}
                handleToggle={() => {
                  patchProfileSettings({
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
                  patchProfileSettings({
                    organic: { ...exciter.organic, amount },
                  })
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
                isDisabled={!exciter.enabled || !exciter.organic.enabled}
                onCommit={onCommit}
                onChange={(focusHz) =>
                  patchProfileSettings({
                    organic: { ...exciter.organic, focusHz },
                  })
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
                  patchProfileSettings({
                    organic: { ...exciter.organic, range },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </ProcessorCard>
  );
};

export default DspExciterCard;
