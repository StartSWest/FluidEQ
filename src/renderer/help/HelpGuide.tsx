/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { HELP_CHAPTERS } from 'common/helpGuide';
import { PRODUCT_NAME } from 'common/branding';
import { useTranslation } from '../utils/I18nContext';
import DialogHeader from '../components/DialogHeader';
import { HelpColumnContext, type IHelpColumn } from './HelpColumn';
import HelpFigure from './HelpFigure';
import {
  HelpFoundContext,
  Marked,
  MarkedText,
  type IHelpFound,
} from './HelpMarks';
import {
  buildHelpIndex,
  helpAnchor,
  searchHelp,
  type IHelpHit,
} from './helpSearch';
import screenshots from './screenshots';
import '../styles/FeatureTour.scss';

interface IHelpGuideProps {
  onClose: () => void;
}

const NOTHING_FOUND: IHelpFound = { marks: new Map(), targets: new Set() };

/** Where the article draws a passage. Anchors are ids, slashes and digits. */
const drawnAt = (viewport: HTMLElement, anchor: string) =>
  viewport.querySelector<HTMLElement>(`[data-help-anchor="${anchor}"]`);

/**
 * Brings a found passage into view, with its first found word as the current
 * one: a control by its capture, where its ring shows it on the window; a
 * chapter found by its title or its search words from its top; anything else
 * in the middle of the article.
 */
const reveal = (viewport: HTMLElement, anchor: string) => {
  viewport
    .querySelectorAll('mark.help-mark.is-current')
    .forEach((mark) => mark.classList.remove('is-current'));
  const passage = drawnAt(viewport, anchor);
  if (!passage) {
    return;
  }
  const first = passage.querySelector<HTMLElement>('mark.help-mark');
  first?.classList.add('is-current');
  if (anchor.endsWith('/title')) {
    passage.closest('section')?.scrollIntoView({ block: 'start' });
  } else if (anchor.includes('/control/')) {
    passage.closest('figure')?.scrollIntoView({ block: 'start' });
  } else {
    (first ?? passage).scrollIntoView({ block: 'center' });
  }
};

/** Enter and Shift+Enter walk the found words, as find in a browser does. */
const stepThroughMarks = (viewport: HTMLElement, direction: 1 | -1) => {
  const marks = Array.from(
    viewport.querySelectorAll<HTMLElement>('mark.help-mark'),
  );
  if (marks.length === 0) {
    return;
  }
  const current = marks.findIndex((mark) =>
    mark.classList.contains('is-current'),
  );
  let next = (current + direction + marks.length) % marks.length;
  if (current < 0) {
    next = direction > 0 ? 0 : marks.length - 1;
  }
  marks[current]?.classList.remove('is-current');
  marks[next].classList.add('is-current');
  marks[next].scrollIntoView({ block: 'center' });
};

export default function HelpGuide({ onClose }: IHelpGuideProps) {
  const { t, locale } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const lightbox = useRef<HTMLDialogElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const article = useRef<HTMLDivElement>(null);
  const columnEdge = useRef<HTMLDivElement>(null);
  const [column, setColumn] = useState<IHelpColumn>();
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState<string>();
  const [capture, setCapture] = useState<{ src: string; title: string }>();
  const chapters = HELP_CHAPTERS.map(({ id, group, figures }, index) => ({
    id,
    group,
    figures,
    // Its place in the guide, which a search keeps while reordering it.
    number: index + 1,
    title: t(`help.${id}.title`),
    intro: t(`help.${id}.intro`),
    steps: t(`help.${id}.steps`).split('\n'),
    tip: t(`help.${id}.tip`),
  }));
  // The whole guide is read once per language and searched on every key.
  const guide = useMemo(() => buildHelpIndex(HELP_CHAPTERS, locale), [locale]);
  const found = useMemo(() => searchHelp(guide, query), [guide, query]);
  const searching = found !== undefined;
  const matches: ((typeof chapters)[number] & { hit?: IHelpHit })[] = found
    ? found.hits.flatMap((hit) =>
        chapters
          .filter((chapter) => chapter.id === hit.chapterId)
          .map((chapter) => ({ ...chapter, hit })),
      )
    : chapters;
  const foundInGuide = useMemo<IHelpFound>(
    () =>
      found
        ? {
            marks: found.marks,
            targets: new Set(found.hits.map((hit) => hit.anchor)),
          }
        : NOTHING_FOUND,
    [found],
  );
  /**
   * The group heading goes above the first chapter of each group shown. A
   * search puts the best chapter first whatever part it is in, so then every
   * chapter says which part it is from.
   */
  const startsGroup = (index: number) =>
    searching ||
    index === 0 ||
    matches[index].group !== matches[index - 1].group;

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const containKeys = (event: KeyboardEvent) => event.stopPropagation();
    element?.addEventListener('keydown', containKeys);
    element?.showModal();
    searchBox.current?.focus();
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

  // The column every capture is drawn to, before the first paint so none
  // appears at one size and jumps to another. A resize of the window alone
  // can change the height a capture may take without changing the column's
  // width, which is the one thing the observer watches, so both are heard.
  useLayoutEffect(() => {
    const edge = columnEdge.current;
    if (!edge) {
      return undefined;
    }
    const measure = () =>
      setColumn((last) =>
        last?.width === edge.clientWidth && last.height === window.innerHeight
          ? last
          : { width: edge.clientWidth, height: window.innerHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(edge);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // A new search goes to where its best match is drawn. The captures that
  // appear with it are drawn at their size from the start (`HelpColumn.ts`),
  // so the passage is where it will stay.
  useEffect(() => {
    const viewport = article.current;
    const best = found?.hits[0];
    if (viewport && best) {
      reveal(viewport, best.anchor);
    }
  }, [found]);

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
    <HelpColumnContext.Provider value={column}>
      <HelpFoundContext.Provider value={foundInGuide}>
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
                ref={searchBox}
                id="help-search"
                type="search"
                value={query}
                placeholder={t('help.searchHint')}
                onChange={(event) => {
                  setQuery(event.target.value);
                  article.current?.scrollTo({ top: 0 });
                }}
                // Capture, not bubble: the dialog stops every key on its way
                // out, so that the app's own shortcuts stay behind the guide,
                // and a bubbling handler here would never hear one.
                onKeyDownCapture={(event) => {
                  if (event.key === 'Enter' && article.current) {
                    event.preventDefault();
                    stepThroughMarks(article.current, event.shiftKey ? -1 : 1);
                  }
                }}
              />
              <span className="help-guide__count" aria-live="polite">
                {t(matches.length === 1 ? 'help.resultsOne' : 'help.results', {
                  count: matches.length,
                })}
              </span>
              <nav aria-label={t('help.contents')}>
                {matches.map((chapter, index) => (
                  <Fragment key={chapter.id}>
                    {!searching && startsGroup(index) && (
                      <span className="help-guide__group" aria-hidden="true">
                        {t(`help.group.${chapter.group}`)}
                      </span>
                    )}
                    <button
                      className={`feature-tour__rail-item help-guide__entry${activeChapter === `help-${chapter.id}` ? ' is-active' : ''}`}
                      type="button"
                      aria-label={chapter.title}
                      aria-describedby={
                        chapter.hit ? `help-found-${chapter.id}` : undefined
                      }
                      aria-current={
                        activeChapter === `help-${chapter.id}`
                          ? 'location'
                          : undefined
                      }
                      onClick={() => {
                        const heading = document.getElementById(
                          `help-${chapter.id}`,
                        );
                        if (chapter.hit && article.current) {
                          reveal(article.current, chapter.hit.anchor);
                        } else {
                          heading?.scrollIntoView({ block: 'start' });
                        }
                        heading?.focus({ preventScroll: true });
                      }}
                    >
                      <span
                        className="feature-tour__rail-number"
                        aria-hidden="true"
                      >
                        {chapter.number}
                      </span>
                      <span className="help-guide__entry-text">
                        <span className="help-guide__entry-title">
                          <Marked
                            text={chapter.title}
                            anchor={helpAnchor.title(chapter.id)}
                            kind="title"
                          />
                        </span>
                        {chapter.hit && chapter.hit.snippet.length > 0 && (
                          <span
                            id={`help-found-${chapter.id}`}
                            className="help-guide__entry-found"
                          >
                            {chapter.hit.snippet.map((part, partIndex) => (
                              <Fragment key={part.text}>
                                {partIndex > 0 && (
                                  <span
                                    className="help-guide__entry-gap"
                                    aria-hidden="true"
                                  >
                                    {' · '}
                                  </span>
                                )}
                                <MarkedText
                                  text={part.text}
                                  marks={part.marks}
                                />
                              </Fragment>
                            ))}
                          </span>
                        )}
                      </span>
                    </button>
                  </Fragment>
                ))}
              </nav>
              <span className="help-guide__offline">{t('help.offline')}</span>
            </aside>
            <div className="help-guide__article" ref={article}>
              <div
                className="help-guide__column"
                ref={columnEdge}
                aria-hidden="true"
              />
              {!searching && (
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
                      searchBox.current?.focus();
                    }}
                  >
                    {t('help.clear')}
                  </button>
                </div>
              )}
              {matches.map((chapter, index) => (
                <section
                  key={chapter.id}
                  className="help-guide__chapter"
                  aria-labelledby={`help-${chapter.id}`}
                >
                  {startsGroup(index) && (
                    <span className="eyebrow help-guide__chapter-group">
                      {t(`help.group.${chapter.group}`)}
                    </span>
                  )}
                  <div className="help-guide__chapter-heading">
                    <span
                      className="feature-tour__rail-number"
                      aria-hidden="true"
                    >
                      {chapter.number}
                    </span>
                    <h2
                      id={`help-${chapter.id}`}
                      tabIndex={-1}
                      data-help-anchor={helpAnchor.title(chapter.id)}
                    >
                      <Marked
                        text={chapter.title}
                        anchor={helpAnchor.title(chapter.id)}
                        kind="title"
                      />
                    </h2>
                  </div>
                  <p data-help-anchor={helpAnchor.intro(chapter.id)}>
                    <Marked
                      text={chapter.intro}
                      anchor={helpAnchor.intro(chapter.id)}
                      kind="intro"
                    />
                  </p>
                  {chapter.figures.map((figure, figureIndex) => {
                    const title = figure.caption
                      ? t(figure.caption)
                      : chapter.title;
                    return (
                      <HelpFigure
                        key={figure.image}
                        anchor={helpAnchor.figure(chapter.id, figureIndex)}
                        figure={figure}
                        src={screenshots[figure.image]}
                        title={title}
                        onEnlarge={() =>
                          setCapture({ src: screenshots[figure.image], title })
                        }
                      />
                    );
                  })}
                  <h3>{t('help.steps')}</h3>
                  <ol>
                    {chapter.steps.map((step, stepIndex) => (
                      <li
                        key={step}
                        data-help-anchor={helpAnchor.step(
                          chapter.id,
                          stepIndex,
                        )}
                      >
                        <Marked
                          text={step}
                          anchor={helpAnchor.step(chapter.id, stepIndex)}
                          kind="step"
                        />
                      </li>
                    ))}
                  </ol>
                  <aside
                    className="help-guide__tip"
                    data-help-anchor={helpAnchor.tip(chapter.id)}
                  >
                    <strong>{t('help.tip')}</strong>
                    <p>
                      <Marked
                        text={chapter.tip}
                        anchor={helpAnchor.tip(chapter.id)}
                        kind="tip"
                      />
                    </p>
                  </aside>
                </section>
              ))}
              {matches.length > 0 && (
                <button
                  className="button small subtle"
                  type="button"
                  onClick={() => {
                    article.current?.scrollTo({ top: 0 });
                    searchBox.current?.focus();
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
      </HelpFoundContext.Provider>
    </HelpColumnContext.Provider>,
    document.body,
  );
}
