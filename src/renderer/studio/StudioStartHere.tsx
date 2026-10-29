/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import {
  closeStarterGuide,
  useStarterGuide,
  type TStarterStep,
} from './studioStarterGuide';
import '../styles/StudioStarter.scss';

interface IGuideStep {
  key: TStarterStep | 'publish';
  title: TranslationKey;
  hint: TranslationKey;
}

const STEPS: readonly IGuideStep[] = [
  {
    key: 'heard',
    title: 'studioStarter.step.heard',
    hint: 'studioStarter.step.heardHint',
  },
  {
    key: 'dial',
    title: 'studioStarter.step.dial',
    hint: 'studioStarter.step.dialHint',
  },
  {
    key: 'asked',
    title: 'studioStarter.step.asked',
    hint: 'studioStarter.step.askedHint',
  },
  {
    key: 'publish',
    title: 'studioStarter.step.publish',
    hint: 'studioStarter.step.publishHint',
  },
];

/** One sentence each, for the member's AI: what a first change can be. */
const IDEAS: readonly TranslationKey[] = [
  'studioStarter.idea.planet',
  'studioStarter.idea.rain',
  'studioStarter.idea.sunset',
  'studioStarter.idea.city',
  'studioStarter.idea.galaxy',
  'studioStarter.idea.calm',
];

interface IStudioStartHereProps {
  projectId: string;
  /**
   * Puts an idea in the message box; absent where there is no chat to send
   * it to, and the ideas are not offered.
   */
  onIdea?: (idea: string) => void;
}

/**
 * "Start here", at the top of the chat while a new project's guide is open
 * (`studioStarterGuide.ts`): play a song, move a dial, ask the AI for one
 * change, publish. Each step ticks from what the member does — nothing to
 * press to say it is done — and the one to do next says how. Publishing
 * the scene ends it, and so does its close button.
 */
export default function StudioStartHere({
  projectId,
  onIdea,
}: IStudioStartHereProps) {
  const { t } = useTranslation();
  const guide = useStarterGuide(projectId);
  if (!guide) {
    return null;
  }
  const isDone = (key: IGuideStep['key']) =>
    key !== 'publish' && guide.steps.includes(key);
  const next = STEPS.find((step) => !isDone(step.key));
  const doneCount = STEPS.filter((step) => isDone(step.key)).length;
  return (
    <section className="studio-start" aria-label={t('studioStarter.title')}>
      <header className="studio-start__head">
        <span className="studio-start__title">{t('studioStarter.title')}</span>
        <span className="studio-start__count">
          {t('studioStarter.count', {
            done: doneCount,
            total: STEPS.length,
          })}
        </span>
        <button
          type="button"
          className="studio-start__close"
          aria-label={t('studioStarter.close')}
          title={t('studioStarter.close')}
          onClick={() => closeStarterGuide(projectId)}
        >
          <Glyph name="close" />
        </button>
      </header>
      <ol className="studio-start__steps">
        {STEPS.map((step, index) => {
          const done = isDone(step.key);
          const current = step === next;
          return (
            <li
              key={step.key}
              className={`studio-start__step${done ? ' is-done' : ''}${current ? ' is-next' : ''}`}
            >
              <span className="studio-start__mark" aria-hidden="true">
                {done ? <Glyph name="check" /> : index + 1}
              </span>
              <span className="studio-start__words">
                <span className="studio-start__step-title">
                  {t(step.title)}
                </span>
                {current && (
                  <span className="studio-start__hint">{t(step.hint)}</span>
                )}
                {/* Offered until a change is made, whichever step is next:
                    a member may well ask before playing anything. */}
                {!done && step.key === 'asked' && onIdea && (
                  <span
                    className="studio-start__ideas"
                    role="group"
                    aria-label={t('studioStarter.ideas')}
                  >
                    {IDEAS.map((idea) => (
                      <button
                        key={idea}
                        type="button"
                        className="studio-idea"
                        onClick={() => onIdea(t(idea))}
                      >
                        {t(idea)}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
