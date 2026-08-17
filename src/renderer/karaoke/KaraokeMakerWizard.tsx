/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

export type TKaraokeMakerWizardStep = 'separate' | 'transcribe';

interface IKaraokeMakerWizardProps {
  /** Which step is running, or undefined before the user has agreed to start. */
  activeStep?: TKaraokeMakerWizardStep;
  /** Steps that have finished, so a resumed run does not repeat them. */
  doneSteps: readonly TKaraokeMakerWizardStep[];
  /** 0..1 for the running step, or undefined when it cannot be known yet. */
  progress?: number;
  message?: string;
  onStart: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

/**
 * The offer to set a song up automatically, and the progress once it is running.
 *
 * One dialog for both because they are the same two steps seen before and
 * during. Splitting them produced a hand-off where the user agreed to a plan
 * and then watched an unrelated progress bar, with no way to tell which half of
 * the work they were waiting on.
 *
 * Only ever shown for a song with no complete word timing. A project that is
 * already finished has nothing to detect, and offering to redo it invites
 * someone to overwrite work they did by hand.
 */
const KaraokeMakerWizard = ({
  activeStep,
  doneSteps,
  progress,
  message,
  onStart,
  onSkip,
  onCancel,
}: IKaraokeMakerWizardProps) => {
  const { t } = useTranslation();
  const running = activeStep !== undefined;

  const steps: {
    id: TKaraokeMakerWizardStep;
    label:
      'karaoke.maker.wizardStepSeparate' | 'karaoke.maker.wizardStepTranscribe';
    icon: 'stem' | 'transcribe';
  }[] = [
    {
      id: 'separate',
      label: 'karaoke.maker.wizardStepSeparate',
      icon: 'stem',
    },
    {
      id: 'transcribe',
      label: 'karaoke.maker.wizardStepTranscribe',
      icon: 'transcribe',
    },
  ];

  return (
    <div
      className="karaoke-maker__wizard"
      role="dialog"
      aria-modal="true"
      aria-label={t('karaoke.maker.wizardTitle')}
    >
      <div className="karaoke-maker__wizard-panel">
        <h2 className="karaoke-maker__wizard-title">
          {t('karaoke.maker.wizardTitle')}
        </h2>
        <p className="karaoke-maker__wizard-intro">
          {t('karaoke.maker.wizardIntro')}
        </p>

        <ol className="karaoke-maker__wizard-steps">
          {steps.map((step) => {
            const done = doneSteps.includes(step.id);
            const active = activeStep === step.id;
            return (
              <li
                key={step.id}
                className={`karaoke-maker__wizard-step${
                  active ? ' is-active' : ''
                }${done ? ' is-done' : ''}`}
                // Announced rather than implied by colour alone, so the state
                // survives a screen reader and a monochrome display.
                aria-current={active ? 'step' : undefined}
              >
                <KaraokeMakerToolIcon name={step.icon} />
                <span>{t(step.label)}</span>
              </li>
            );
          })}
        </ol>

        {running && (
          <div className="karaoke-maker__wizard-progress" role="status">
            <progress
              max={1}
              // An omitted value renders as indeterminate, which is the honest
              // display while a step has started but reported nothing yet.
              value={progress}
              aria-label={message ?? t('karaoke.maker.wizardTitle')}
            />
            {message && <p>{message}</p>}
          </div>
        )}

        {/*
          The app's own two variants, never a new one. Written without any
          class these render as the browser default, which on a dark panel is
          nearly invisible — the reason this dialog first looked as though it
          had no options at all.
        */}
        <div className="karaoke-maker__wizard-actions">
          {running ? (
            <button
              type="button"
              className="button small subtle"
              onClick={onCancel}
            >
              {t('karaoke.maker.wizardCancel')}
            </button>
          ) : (
            <>
              {/*
                `subtle` on the recommended action and plain on the decline,
                which is the opposite of how the names read.

                Measured in the running window: `.button.small.subtle` renders
                with a tinted fill and bright cyan text, while plain
                `.button.small` is transparent with dimmer text. So `subtle` is
                this app's emphasised variant and the bare class is its quiet
                one. Naming it the other way round put the wrong button
                forward, and no test could see it — both have a role, a label
                and a click handler either way.
              */}
              <button type="button" className="button small" onClick={onSkip}>
                {t('karaoke.maker.wizardSkip')}
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={onStart}
              >
                {t('karaoke.maker.wizardStart')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KaraokeMakerWizard;
