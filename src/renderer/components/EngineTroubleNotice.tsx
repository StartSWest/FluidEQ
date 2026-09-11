/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { IFluidEngineStatus, TAudioEngine } from 'common/audioEngine';
import { isEngineProblem, type TEngineProblem } from 'common/engineHealth';
import type { TranslationKey } from 'common/i18n/en';
import useEngineTrouble from '../audio/useEngineTrouble';
import { useTranslation } from '../utils/I18nContext';
import Button from '../widgets/Button';
// The output notice's look, which this shares: it is the same message — this
// output is not being processed — for a different reason.
import '../styles/DeviceProfiles.scss';
import '../styles/EngineTroubleNotice.scss';

const PROBLEM_TEXT: Record<TEngineProblem, TranslationKey> = {
  convolution: 'engineHealth.problem.convolution',
  'graphic-eq': 'engineHealth.problem.graphic-eq',
  'dsp-rack': 'engineHealth.problem.dsp-rack',
  'reload-failed': 'engineHealth.problem.reload-failed',
  unwatched: 'engineHealth.problem.unwatched',
};

/** One line per problem; codes this app does not know share a single line. */
const problemLines = (problems: readonly string[]): TranslationKey[] => [
  ...new Set(
    problems.map((code) =>
      isEngineProblem(code)
        ? PROBLEM_TEXT[code]
        : ('engineHealth.problem.other' as const),
    ),
  ),
];

interface IEngineTroubleNoticeProps {
  engine: TAudioEngine | null;
  /**
   * What the setup helper last said about the engine — which outputs it is
   * on and which version is installed — from the status the window holds.
   */
  fluid: IFluidEngineStatus | undefined;
  /** A dialog this notice's own buttons open is up: step aside for it. */
  isHidden: boolean;
  onRestartAudio: () => void;
  onUseApo: () => void;
}

/**
 * Says so when the FluidEQ Engine is failing where it can be heard, and what
 * can be done about it — see `engineTrouble` for when that is.
 *
 * Everything else in FluidEQ goes on working either way; this only makes sure
 * a failing engine is not mistaken for an EQ that does nothing. Restarting
 * Windows audio restarts the engine, which is the repair for anything that
 * went wrong inside it; Equalizer APO is the way out when it is not.
 */
const EngineTroubleNotice = ({
  engine,
  fluid,
  isHidden,
  onRestartAudio,
  onUseApo,
}: IEngineTroubleNoticeProps) => {
  const { t } = useTranslation();
  const trouble = useEngineTrouble(engine, fluid);
  // Put away for as long as this trouble lasts: one that ends and comes back
  // later is a new one, and is worth saying again.
  const [dismissedKey, setDismissedKey] = useState<string | undefined>();
  const key = trouble?.key;
  useEffect(() => {
    setDismissedKey((current) => (current === key ? current : undefined));
  }, [key]);
  const isShown = key !== undefined && !isHidden && key !== dismissedKey;

  useEffect(() => {
    if (!isShown) {
      return undefined;
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDismissedKey(key);
      }
    };
    document.addEventListener('keydown', dismissOnEscape);
    return () => document.removeEventListener('keydown', dismissOnEscape);
  }, [isShown, key]);

  if (!isShown || !trouble) {
    return null;
  }

  const isOff = trouble.kind === 'off';
  const canRestartHelp = isOff || trouble.canRestartHelp;
  const dismiss = () => setDismissedKey(trouble.key);
  const useApo = (
    <Button
      ariaLabel={t('engineHealth.useApo')}
      isDisabled={false}
      className="small subtle"
      handleChange={onUseApo}
    >
      {t('engineHealth.useApo')}
    </Button>
  );

  return createPortal(
    <aside
      className={`device-apo-notice engine-trouble-notice${
        isOff ? '' : ' engine-trouble-notice--partial'
      }`}
      role="alertdialog"
      aria-labelledby="engine-trouble-notice-title"
      aria-describedby="engine-trouble-notice-body"
    >
      <div className="device-apo-notice__copy">
        <span className="apo-badge">
          {isOff ? t('output.off') : t('engineHealth.partlyOff')}
        </span>
        <h2 id="engine-trouble-notice-title">
          {isOff
            ? t('engineHealth.offTitle', { device: trouble.device.name })
            : t('engineHealth.problemsTitle', { device: trouble.device.name })}
        </h2>
        {isOff ? (
          <p id="engine-trouble-notice-body">{t('engineHealth.offBody')}</p>
        ) : (
          <ul
            id="engine-trouble-notice-body"
            className="engine-trouble-notice__problems"
          >
            {problemLines(trouble.problems).map((line) => (
              <li key={line}>{t(line)}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="device-apo-notice__actions">
        {canRestartHelp ? (
          <>
            <Button
              ariaLabel={t('app.menu.restartAudio')}
              isDisabled={false}
              className="small"
              handleChange={onRestartAudio}
            >
              {t('app.menu.restartAudio')}
            </Button>
            {useApo}
            <Button
              ariaLabel={t('output.notNow')}
              isDisabled={false}
              className="small subtle"
              handleChange={dismiss}
            >
              {t('output.notNow')}
            </Button>
          </>
        ) : (
          <>
            {/* Nothing here mends a file the engine could not read; the
                answer is a different file, chosen where it was chosen. */}
            <Button
              ariaLabel={t('output.gotIt')}
              isDisabled={false}
              className="small"
              handleChange={dismiss}
            >
              {t('output.gotIt')}
            </Button>
            {useApo}
          </>
        )}
      </div>
    </aside>,
    document.body,
  );
};

export default EngineTroubleNotice;
