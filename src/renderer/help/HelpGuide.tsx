/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  useCallback,
  useDeferredValue,
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
import HelpChapter, {
  type IHelpCapture,
  type IHelpShownChapter,
} from './HelpChapter';
import { HelpColumnContext, type IHelpColumn } from './HelpColumn';
import HelpContentsEntry from './HelpContentsEntry';
import { HelpFoundContext, type IHelpFound } from './HelpMarks';
import { buildHelpIndex, searchHelp } from './helpSearch';
import '../styles/FeatureTour.scss';

interface IHelpGuideProps {
  onClose: () => void;
}

const NOTHING_FOUND: IHelpFound = { marks: new Map(), targets: new Set() };

/**
 * What follows the reading position, set up once for as long as the guide is
 * open: the scroll listener and the observer, and the sections the observer
 * is watching.
 */
interface IReadingWatch {
  update: () => void;
  resize: ResizeObserver;
  watched: Set<Element>;
}

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
  const readingWatch = useRef<IReadingWatch | undefined>(undefined);
  const [column, setColumn] = useState<IHelpColumn>();
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState<string>();
  const [capture, setCapture] = useState<IHelpCapture>();
  /**
   * What the search answers: the query as typed, a render behind.
   *
   * Every key used to re-render the whole guide and run the search inside the
   * keystroke — thirty-one chapters to change the text in one box. The box
   * now takes the key at once and the chapters follow in a render React can
   * interrupt when the next key arrives; `HelpChapter` and `HelpContentsEntry`
   * are memoised, so the render that takes the key skips all of them.
   */
  const searched = useDeferredValue(query);
  // Read once per language: `t` changes exactly when the text can.
  const chapters = useMemo<IHelpShownChapter[]>(
    () =>
      HELP_CHAPTERS.map(({ id, group, figures }, index) => ({
        id,
        group,
        figures,
        number: index + 1,
        title: t(`help.${id}.title`),
        intro: t(`help.${id}.intro`),
        steps: t(`help.${id}.steps`).split('\n'),
        tip: t(`help.${id}.tip`),
      })),
    [t],
  );
  // The whole guide is read once per language and searched on every key.
  const guide = useMemo(() => buildHelpIndex(HELP_CHAPTERS, locale), [locale]);
  const found = useMemo(() => searchHelp(guide, searched), [guide, searched]);
  const searching = found !== undefined;
  const matches = useMemo<IHelpShownChapter[]>(
    () =>
      found
        ? found.hits.flatMap((hit) =>
            chapters
              .filter((chapter) => chapter.id === hit.chapterId)
              .map((chapter) => ({ ...chapter, hit })),
          )
        : chapters,
    [chapters, found],
  );
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
  const groupLabelAt = (index: number) =>
    searching ||
    index === 0 ||
    matches[index].group !== matches[index - 1].group
      ? t(`help.group.${matches[index].group}`)
      : undefined;
  /** A contents entry pressed: to what the search found there, or its top. */
  const openChapter = useCallback((chapter: IHelpShownChapter) => {
    const heading = document.getElementById(`help-${chapter.id}`);
    if (chapter.hit && article.current) {
      reveal(article.current, chapter.hit.anchor);
    } else {
      heading?.scrollIntoView({ block: 'start' });
    }
    heading?.focus({ preventScroll: true });
  }, []);

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

  // Set up once. It used to be torn down and built again on every key typed
  // in the search, which had nothing new to listen to; what a search changes
  // is which sections there are, and the effect below keeps up with that.
  useEffect(() => {
    const viewport = article.current;
    if (!viewport) {
      return undefined;
    }
    const update = () => {
      // Read afresh: a search redraws the chapters under the listener.
      const headings = Array.from(viewport.querySelectorAll('h2[id]'));
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
    viewport.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(viewport);
    readingWatch.current = { update, resize, watched: new Set() };
    return () => {
      readingWatch.current = undefined;
      viewport.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, []);

  // The sections a search drew, watched for a capture changing their height,
  // and the ones it took away no longer watched, so the observer holds only
  // what is on the page. Then the chapter being read, worked out again.
  useEffect(() => {
    const viewport = article.current;
    const watch = readingWatch.current;
    if (!viewport || !watch) {
      return;
    }
    const drawn = new Set(Array.from(viewport.children));
    watch.watched.forEach((section) => {
      if (!drawn.has(section)) {
        watch.resize.unobserve(section);
        watch.watched.delete(section);
      }
    });
    drawn.forEach((section) => {
      if (!watch.watched.has(section)) {
        watch.resize.observe(section);
        watch.watched.add(section);
      }
    });
    watch.update();
  }, [matches]);

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
                  <HelpContentsEntry
                    key={chapter.id}
                    chapter={chapter}
                    groupLabel={searching ? undefined : groupLabelAt(index)}
                    isActive={activeChapter === `help-${chapter.id}`}
                    onOpen={openChapter}
                  />
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
                <HelpChapter
                  key={chapter.id}
                  chapter={chapter}
                  groupLabel={groupLabelAt(index)}
                  onEnlarge={setCapture}
                />
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
