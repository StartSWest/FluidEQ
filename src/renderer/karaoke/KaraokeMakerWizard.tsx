/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import KARAOKE_LANGUAGE_CODES from './karaokeLanguageCodes';
import Dropdown from '../widgets/Dropdown';
import MenuIcon from '../icons/MenuIcon';
import DialogFrame from '../components/DialogFrame';
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
  /** Close the dialog and let the run carry on under the progress card. */
  onHide: () => void;
  /**
   * BCP-47 code of the lyrics' language, or undefined for auto-detection.
   *
   * Asked here, before the run, because auto-detection over singing is the
   * silent failure mode: a Spanish song mis-detected as English transcribes
   * into fluent nonsense with no error anywhere. One explicit choice removes
   * the whole class.
   */
  language?: string;
  onLanguage: (language: string | undefined) => void;
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
  onHide,
  language,
  onLanguage,
}: IKaraokeMakerWizardProps) => {
  const { t } = useTranslation();
  const running = activeStep !== undefined;
  const languageNames =
    typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames([language ?? 'en'], { type: 'language' })
      : undefined;

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
    // The cover dims the Maker as a backdrop dims the window; the frame inside
    // it is the dialog.
    <div className="karaoke-maker__wizard" role="presentation">
      <DialogFrame
        className="karaoke-maker__wizard-panel"
        icon={<MenuIcon name="smart" />}
        title={t('karaoke.maker.wizardTitle')}
        titleId="karaoke-maker-wizard-title"
        description={t('karaoke.maker.wizardIntro')}
        closeLabel={t('support.close')}
        // The quiet way out in both states: before the run it is "I will do
        // it myself", during it "Continue in background" — the dialog goes,
        // the work does not. Never Stop, which throws the run away.
        onClose={running ? onHide : onSkip}
        footer={
          <div className="dialog-frame__actions">
            {running ? (
              <>
                {/*
                  The same escape the lyric detection has: the dialog goes
                  away, the work does not. The floating progress card in the
                  corner stays, with its own cancel, so dismissing this window
                  is never mistaken for stopping the run.
                */}
                <button
                  type="button"
                  className="button small subtle"
                  onClick={onHide}
                >
                  {t('karaoke.maker.wizardHide')}
                </button>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={onCancel}
                >
                  {t('karaoke.maker.wizardCancel')}
                </button>
              </>
            ) : (
              <>
                {/*
                  The recommended action wears the loud class and the decline
                  the quiet one: this dialog shipped once the other way round,
                  with the loud button saying "I will do it myself", and no
                  test could see it.
                */}
                <button
                  type="button"
                  className="button small subtle"
                  onClick={onSkip}
                >
                  {t('karaoke.maker.wizardSkip')}
                </button>
                <button
                  type="button"
                  className="button small"
                  onClick={onStart}
                >
                  {t('karaoke.maker.wizardStart')}
                </button>
              </>
            )}
          </div>
        }
      >
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
                <span
                  className="karaoke-maker__wizard-step-mark"
                  aria-hidden="true"
                >
                  <KaraokeMakerToolIcon name={step.icon} />
                </span>
                <span>{t(step.label)}</span>
                {/*
                  The running phase carries its own spinner at the row's end,
                  and a finished one its check — the list itself says where
                  the run stands without reading the progress bar below.
                */}
                {active && (
                  <span
                    className="karaoke-maker__wizard-step-loader"
                    aria-hidden="true"
                  />
                )}
                {done && (
                  <MenuIcon
                    name="check"
                    className="karaoke-maker__wizard-step-done"
                  />
                )}
              </li>
            );
          })}
        </ol>

        {!running && (
          <div className="karaoke-maker__wizard-language">
            <span>{t('karaoke.maker.wizardLanguage')}</span>
            <Dropdown
              name={t('karaoke.maker.wizardLanguage')}
              options={[
                {
                  value: 'auto',
                  label: t('karaoke.maker.wizardLanguageAuto'),
                  display: t('karaoke.maker.wizardLanguageAuto'),
                },
                ...KARAOKE_LANGUAGE_CODES.map((code) => {
                  const label = languageNames?.of(code) ?? code;
                  return { value: code, label, display: label };
                }),
              ]}
              value={language ?? 'auto'}
              handleChange={(value: string) =>
                onLanguage(value === 'auto' ? undefined : value)
              }
              isDisabled={false}
              isFilterable
              placement="down"
            />
          </div>
        )}

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
      </DialogFrame>
    </div>
  );
};

export default KaraokeMakerWizard;
