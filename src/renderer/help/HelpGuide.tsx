/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HELP_CHAPTERS } from 'common/helpGuide';
import { PRODUCT_NAME } from 'common/branding';
import { useTranslation } from '../utils/I18nContext';
import DialogHeader from '../components/DialogHeader';
import screenshots from './screenshots';
import '../styles/FeatureTour.scss';

interface IHelpGuideProps {
  onClose: () => void;
}

export default function HelpGuide({ onClose }: IHelpGuideProps) {
  const { t, locale } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const lightbox = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const article = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState<string>();
  const [capture, setCapture] = useState<{ src: string; title: string }>();
  const chapters = HELP_CHAPTERS.map(({ id, width, height }) => ({
    id,
    width,
    height,
    title: t(`help.${id}.title`),
    intro: t(`help.${id}.intro`),
    steps: t(`help.${id}.steps`).split('\n'),
    tip: t(`help.${id}.tip`),
  }));
  const words = query
    .trim()
    .toLocaleLowerCase(locale)
    .split(/\s+/)
    .filter(Boolean);
  const matches = chapters.filter((chapter) => {
    const text = [chapter.title, chapter.intro, ...chapter.steps, chapter.tip]
      .join(' ')
      .toLocaleLowerCase(locale);
    return words.every((word) => text.includes(word));
  });

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const containKeys = (event: KeyboardEvent) => event.stopPropagation();
    element?.addEventListener('keydown', containKeys);
    element?.showModal();
    search.current?.focus();
    return () => {
      element?.close();
      element?.removeEventListener('keydown', containKeys);
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, []);

  useEffect(() => {
    const viewport = article.current;
    if (!viewport) {
      return undefined;
    }
    const headings = Array.from(viewport.querySelectorAll('h2[id]'));
    const updateChapter = () => {
      // Track the heading crossing the reading area, rather than the biggest
      // visible section: long screenshots would otherwise select too early.
      const readingLine =
        viewport.getBoundingClientRect().top +
        Math.min(120, viewport.clientHeight * 0.2);
      let current = headings[0];
      headings.forEach((heading) => {
        if (heading.getBoundingClientRect().top <= readingLine) {
          current = heading;
        }
      });
      if (
        viewport.scrollHeight > viewport.clientHeight &&
        viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1
      ) {
        current = headings[headings.length - 1];
      }
      setActiveChapter(current?.id);
    };
    viewport.addEventListener('scroll', updateChapter, { passive: true });
    const resize = new ResizeObserver(updateChapter);
    resize.observe(viewport);
    Array.from(viewport.children).forEach((child) => resize.observe(child));
    updateChapter();
    return () => {
      viewport.removeEventListener('scroll', updateChapter);
      resize.disconnect();
    };
  }, [query, locale]);

  useEffect(() => {
    // Keep the current number visible in both the vertical desktop rail and
    // the horizontal chapter strip, without moving keyboard focus.
    dialog.current
      ?.querySelector('[aria-current="location"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeChapter]);

  useEffect(() => {
    if (!capture) {
      return undefined;
    }
    const element = lightbox.current;
    const containKeys = (event: KeyboardEvent) => event.stopPropagation();
    element?.addEventListener('keydown', containKeys);
    element?.showModal();
    return () => {
      element?.close();
      element?.removeEventListener('keydown', containKeys);
    };
  }, [capture]);

  // The guide is portalled outside the draggable titlebar. Native modal dialogs
  // provide focus containment and make the live audio controls inert underneath.
  return createPortal(
    <>
      <dialog
        ref={dialog}
        className="help-guide"
        aria-labelledby="help-title"
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <DialogHeader
          eyebrow={PRODUCT_NAME}
          title={t('help.title')}
          titleId="help-title"
          closeLabel={t('help.close')}
          onClose={onClose}
        />
        <div className="help-guide__layout">
          <aside className="help-guide__rail">
            <label htmlFor="help-search">{t('help.search')}</label>
            <input
              ref={search}
              id="help-search"
              type="search"
              value={query}
              placeholder={t('help.searchHint')}
              onChange={(event) => {
                setQuery(event.target.value);
                article.current?.scrollTo({ top: 0 });
              }}
            />
            <span className="help-guide__count" aria-live="polite">
              {t('help.results', { count: matches.length })}
            </span>
            <nav aria-label={t('help.contents')}>
              {matches.map((chapter) => (
                <button
                  className={`feature-tour__rail-item${activeChapter === `help-${chapter.id}` ? ' is-active' : ''}`}
                  key={chapter.id}
                  type="button"
                  aria-current={
                    activeChapter === `help-${chapter.id}`
                      ? 'location'
                      : undefined
                  }
                  onClick={() => {
                    const target = document.getElementById(
                      `help-${chapter.id}`,
                    );
                    target?.scrollIntoView({ block: 'start' });
                    target?.focus({ preventScroll: true });
                  }}
                >
                  <span
                    className="feature-tour__rail-number"
                    aria-hidden="true"
                  >
                    {chapters.indexOf(chapter) + 1}
                  </span>
                  <span>{chapter.title}</span>
                </button>
              ))}
            </nav>
            <span className="help-guide__offline">{t('help.offline')}</span>
          </aside>
          <div className="help-guide__article" ref={article}>
            {!query.trim() && (
              <header className="help-guide__hero">
                <span className="eyebrow">
                  {PRODUCT_NAME} / {t('help.title')}
                </span>
                <h1>{t('help.subtitle')}</h1>
                <p>{t('help.intro')}</p>
                <p className="help-guide__capture-note">
                  {t('help.captureNote')}
                </p>
              </header>
            )}
            {matches.length === 0 && (
              <div className="help-guide__empty">
                <p>{t('help.empty')}</p>
                <button
                  className="button small"
                  type="button"
                  onClick={() => {
                    setQuery('');
                    search.current?.focus();
                  }}
                >
                  {t('help.clear')}
                </button>
              </div>
            )}
            {matches.map((chapter) => (
              <section
                key={chapter.id}
                className="help-guide__chapter"
                aria-labelledby={`help-${chapter.id}`}
              >
                <div className="help-guide__chapter-heading">
                  <span
                    className="feature-tour__rail-number"
                    aria-hidden="true"
                  >
                    {chapters.indexOf(chapter) + 1}
                  </span>
                  <h2 id={`help-${chapter.id}`} tabIndex={-1}>
                    {chapter.title}
                  </h2>
                </div>
                <p>{chapter.intro}</p>
                <figure>
                  <button
                    type="button"
                    className="help-guide__capture"
                    aria-label={t('help.enlarge', { title: chapter.title })}
                    onClick={() =>
                      setCapture({
                        src: screenshots[chapter.id],
                        title: chapter.title,
                      })
                    }
                  >
                    <img
                      src={screenshots[chapter.id]}
                      alt={chapter.title}
                      loading="lazy"
                      width={chapter.width}
                      height={chapter.height}
                    />
                  </button>
                  <figcaption>
                    {t('help.enlarge', { title: chapter.title })}
                  </figcaption>
                </figure>
                <h3>{t('help.steps')}</h3>
                <ol>
                  {chapter.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <aside className="help-guide__tip">
                  <strong>{t('help.tip')}</strong>
                  <p>{chapter.tip}</p>
                </aside>
              </section>
            ))}
            {matches.length > 0 && (
              <button
                className="button small subtle"
                type="button"
                onClick={() => {
                  article.current?.scrollTo({ top: 0 });
                  search.current?.focus();
                }}
              >
                {t('help.back')}
              </button>
            )}
          </div>
        </div>
      </dialog>
      {capture && (
        <dialog
          ref={lightbox}
          className="help-lightbox"
          aria-label={capture.title}
          onCancel={(event) => {
            event.preventDefault();
            setCapture(undefined);
          }}
        >
          <DialogHeader
            eyebrow={PRODUCT_NAME}
            title={capture.title}
            titleId="help-capture-title"
            closeLabel={t('help.closeImage')}
            onClose={() => setCapture(undefined)}
          />
          <div className="help-lightbox__image">
            <img src={capture.src} alt={capture.title} />
          </div>
        </dialog>
      )}
    </>,
    document.body,
  );
}
