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

/** The choices offered; Whisper accepts far more, these are the app's own. */
const WIZARD_LANGUAGES = [
  'es',
  'en',
  'de',
  'fr',
  'it',
  'pt',
  'ru',
  'ja',
  'zh',
  'hi',
] as const;

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

        {!running && (
          <label
            className="karaoke-maker__wizard-language"
            htmlFor="karaoke-wizard-language"
          >
            <span>{t('karaoke.maker.wizardLanguage')}</span>
            <select
              id="karaoke-wizard-language"
              value={language ?? 'auto'}
              onChange={(event) =>
                onLanguage(
                  event.target.value === 'auto'
                    ? undefined
                    : event.target.value,
                )
              }
            >
              <option value="auto">
                {t('karaoke.maker.wizardLanguageAuto')}
              </option>
              {WIZARD_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {languageNames?.of(code) ?? code}
                </option>
              ))}
            </select>
          </label>
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

        {/*
          The app's own two variants, never a new one. Written without any
          class these render as the browser default, which on a dark panel is
          nearly invisible — the reason this dialog first looked as though it
          had no options at all.
        */}
        <div className="karaoke-maker__wizard-actions">
          {running ? (
            <>
              {/*
                The same escape the lyric detection has: the dialog goes away,
                the work does not. The floating progress card in the corner
                stays, with its own cancel, so dismissing this window is never
                mistaken for stopping the run.
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
                Measured in the running window rather than assumed from the
                names: plain `.button.small` is the solid accent fill
                (rgb(0,229,207)) and `subtle` is a 7% tint. So the recommended
                action wears the plain class and the decline wears `subtle` —
                this dialog shipped once the other way round, with the loud
                button saying "I will do it myself", and no test could see it.
              */}
              <button
                type="button"
                className="button small subtle"
                onClick={onSkip}
              >
                {t('karaoke.maker.wizardSkip')}
              </button>
              <button type="button" className="button small" onClick={onStart}>
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
