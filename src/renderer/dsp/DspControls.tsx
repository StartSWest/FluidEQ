/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode } from 'react';
import { TranslationKey } from '../../common/i18n/en';
import LabelledKnob from '../components/LabelledKnob';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';

/**
 * The two pieces every processor page in the rack is built from.
 *
 * They lived in `DspPanel` while it was the only thing that drew a page. The
 * exciter's page is now its own file — it grew a display, three bands and a
 * stage of its own — and a second caller is what turns a local helper into a
 * component. Nothing about either changed on the way out.
 */

interface IDialProps {
  labelKey: TranslationKey;
  value: number;
  min: number;
  max: number;
  unit: string;
  step: number;
  /** Where Ctrl+click returns this dial to. */
  defaultValue: number;
  isDisabled: boolean;
  onChange: (next: number) => void;
  onCommit: () => void;
}

/**
 * One parameter of the chain, as `LabelledKnob`.
 *
 * A thin wrapper and deliberately so: all it adds is translating the label key
 * and making `defaultValue` required, because every parameter here HAS a
 * factory value in `DSP_DEFAULTS` and a dial in this rack that ignored
 * Ctrl+click would be the odd one out.
 */
export const Dial = ({
  labelKey,
  value,
  min,
  max,
  unit,
  step,
  defaultValue,
  isDisabled,
  onChange,
  onCommit,
}: IDialProps) => {
  const { t } = useTranslation();
  return (
    <LabelledKnob
      label={t(labelKey)}
      value={value}
      min={min}
      max={max}
      unit={unit}
      step={step}
      defaultValue={defaultValue}
      isDisabled={isDisabled}
      onChange={onChange}
      onCommit={onCommit}
    />
  );
};

interface IProcessorCardProps {
  titleKey: TranslationKey;
  /** Omitted where the page speaks for itself — the EQ's graph does. */
  descriptionKey?: TranslationKey;
  /**
   * Controls that lead the header instead of a description.
   *
   * The header holds the bypass switch at its right end whatever else is in
   * it, so a page with no description left that row empty — a band of nothing
   * with a lone toggle stranded across from it. A page that has a toolbar puts
   * it here and the row carries its weight.
   */
  toolbar?: ReactNode;
  /** Processor-local action placed immediately before the bypass state. */
  beforePower?: ReactNode;
  id: string;
  isEnabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export const ProcessorCard = ({
  titleKey,
  descriptionKey,
  toolbar,
  beforePower,
  id,
  isEnabled,
  onToggle,
  children,
}: IProcessorCardProps) => {
  const { t } = useTranslation();
  return (
    <section
      id={id}
      className={`dsp-card${isEnabled ? ' is-active' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      {/* The preset on the left, the on/off on the RIGHT.

          The switch used to lead the row, which put the least-used control in
          the position the eye reads first and left the page starting with a
          toggle rather than with what the page is. Reading order now runs
          preset → description → switch, and the switch sits at the end of
          the header where a plugin's bypass button lives. Filters without a
          preset simply begin with their description.

          The name itself lives on the rail, which is where it is chosen; the
          heading stays for `aria-labelledby` and is visually hidden. */}
      <header
        className={`dsp-card-header${toolbar ? ' has-toolbar' : ''}${
          descriptionKey || toolbar ? '' : ' is-bare'
        }`}
      >
        {/* Out of the titles block and straight into the header: it is
            visually hidden and exists for `aria-labelledby`, so a wrapper
            around it is a flex item claiming a share of a row it never
            draws in. */}
        <h3 className="dsp-card-title is-visually-hidden" id={`${id}-title`}>
          {t(titleKey)}
        </h3>
        {/* The preset is always the leftmost visible control. It chooses the
            complete processor state, so putting prose before it made the most
            useful control change position from one filter page to the next. */}
        {toolbar}
        {descriptionKey ? (
          <div className="dsp-card-titles">
            <p className="dsp-card-description">{t(descriptionKey)}</p>
          </div>
        ) : undefined}
        {/* The switch says which state it is IN, not what pressing it does.
            A bare toggle with no word beside it leaves the user reading a
            colour, and on a rack where four of these sit behind four pages
            that is a guess every time. */}
        <div className="dsp-card-power">
          {beforePower ? (
            <div className="dsp-card-before-power">{beforePower}</div>
          ) : undefined}
          <span
            className={`dsp-card-power-label${isEnabled ? ' is-on' : ''}`}
            aria-hidden="true"
          >
            {isEnabled ? t('dsp.enabled') : t('dsp.bypassed')}
          </span>
          <Switch
            id={`${id}-toggle`}
            isOn={isEnabled}
            isDisabled={false}
            handleToggle={onToggle}
            ariaLabel={t(titleKey)}
          />
        </div>
      </header>
      <div className="dsp-card-body">{children}</div>
    </section>
  );
};
