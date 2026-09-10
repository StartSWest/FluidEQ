import { useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { AI_IDEAS, AI_PROMPT, promptWithIdea } from './aiPrompt';
import { createStudioStarter, linkStudioFolder } from './studioStore';

const HEARS: ReadonlyArray<{ name: TranslationKey; body: TranslationKey }> = [
  { name: 'studio.hears.level.name', body: 'studio.hears.level.body' },
  { name: 'studio.hears.beat.name', body: 'studio.hears.beat.body' },
  { name: 'studio.hears.bass.name', body: 'studio.hears.bass.body' },
  { name: 'studio.hears.mid.name', body: 'studio.hears.mid.body' },
  { name: 'studio.hears.treble.name', body: 'studio.hears.treble.body' },
  { name: 'studio.hears.spectrum.name', body: 'studio.hears.spectrum.body' },
  { name: 'studio.hears.accent.name', body: 'studio.hears.accent.body' },
  { name: 'studio.hears.waveform.name', body: 'studio.hears.waveform.body' },
  { name: 'studio.hears.picture.name', body: 'studio.hears.picture.body' },
];

type TNotice =
  'copied' | 'copiedIdea' | 'copyFailed' | 'starterExists' | undefined;

const NOTICE_KEYS: Record<Exclude<TNotice, undefined>, TranslationKey> = {
  copied: 'studio.notice.copied',
  copiedIdea: 'studio.notice.copiedIdea',
  copyFailed: 'studio.notice.copyFailed',
  starterExists: 'studio.notice.starterExists',
};

/**
 * The Studio before a folder is linked: how to make a scene, in three steps,
 * with the prompt on screen so a member can read what they are pasting.
 *
 * "Copy AI prompt" wears the loud style because it is the recommended way in;
 * the starter project and linking a folder are the quiet alternatives.
 */
export default function StudioStart() {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<TNotice>();
  const [idea, setIdea] = useState('');
  const promptRef = useRef<HTMLPreElement>(null);

  const selectPrompt = () => {
    const element = promptRef.current;
    const selection = window.getSelection();
    if (element && selection) {
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const copy = (withIdea: string) => {
    setIdea(withIdea);
    const text = promptWithIdea(withIdea);
    const done: TNotice = withIdea ? 'copiedIdea' : 'copied';
    const write = navigator.clipboard?.writeText(text);
    if (!write) {
      setNotice('copyFailed');
      selectPrompt();
      return;
    }
    write
      .then(() => setNotice(done))
      .catch(() => {
        setNotice('copyFailed');
        selectPrompt();
      });
  };

  const createStarter = () => {
    createStudioStarter()
      .then((outcome) => {
        setNotice(outcome === 'exists' ? 'starterExists' : undefined);
        return undefined;
      })
      .catch(() => undefined);
  };

  return (
    <div className="studio-start">
      <div className="studio-start__main">
        <h3 className="studio-start__title">{t('studio.start.title')}</h3>
        <ol className="studio-start__steps">
          {([1, 2, 3] as const).map((step) => (
            <li key={step} className="studio-start__step">
              <span className="studio-start__step-number">{step}</span>
              <span className="studio-start__step-title">
                {t(`studio.start.step${step}.title` as TranslationKey)}
              </span>
              <span className="studio-start__step-body">
                {t(`studio.start.step${step}.body` as TranslationKey)}
              </span>
            </li>
          ))}
        </ol>
        <div className="studio-actions">
          <button
            type="button"
            className="button small"
            onClick={() => copy('')}
          >
            {t('studio.action.copyPrompt')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={createStarter}
          >
            {t('studio.action.createStarter')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              linkStudioFolder().catch(() => undefined);
            }}
          >
            {t('studio.action.linkFolder')}
          </button>
        </div>
        {notice && (
          <p
            className={`studio-notice${
              notice === 'copied' || notice === 'copiedIdea'
                ? ' studio-notice--ok'
                : ''
            }`}
            role="status"
          >
            {t(NOTICE_KEYS[notice])}
          </p>
        )}
        <div className="studio-ideas">
          <span className="studio-card__eyebrow">
            {t('studio.ideas.title')}
          </span>
          <div className="studio-ideas__list">
            {AI_IDEAS.map((entry) => {
              const text = t(entry.idea);
              return (
                <button
                  key={entry.label}
                  type="button"
                  className="studio-idea"
                  title={text}
                  onClick={() => copy(text)}
                >
                  {t(entry.label)}
                </button>
              );
            })}
          </div>
        </div>
        <pre
          ref={promptRef}
          className="studio-prompt"
          role="region"
          // A scrolling box must take focus, or a keyboard cannot scroll it
          // (WCAG 2.1.1); the region role and label say what it is.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-label={t('studio.prompt.label')}
        >
          {AI_PROMPT}{' '}
          <mark className="studio-prompt__idea">
            {idea || t('studio.prompt.ideaHere')}
          </mark>
        </pre>
      </div>
      <aside className="studio-card studio-hears">
        <span className="studio-card__eyebrow">{t('studio.hears.title')}</span>
        {HEARS.map((row) => (
          <div key={row.name} className="studio-hears__row">
            <span className="studio-hears__name">{t(row.name)}</span>
            <span className="studio-hears__body">{t(row.body)}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}
