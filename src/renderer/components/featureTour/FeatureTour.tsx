/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '../../utils/I18nContext';
import DialogHeader from '../DialogHeader';
import type { ISlideActions, ITourSlide, TTourTab } from './slides';
import '../../styles/FeatureTour.scss';

interface IFeatureTourProps {
  version: string;
  slides: ITourSlide[];
  /** Whether "don't show again" was ticked when the panel was closed. */
  onClose: (dontShowAgain: boolean) => void;
  /** Opens the changelog on top of this panel. */
  onShowReleaseNotes: () => void;
  /** Closes the tour and lands on that tab. */
  onOpenTab: (tab: TTourTab) => void;
  /**
   * True while the changelog is open on top. Escape and the backdrop then
   * belong to the panel above; without this one Escape closed both.
   */
  isCovered: boolean;
}

/**
 * The feature tour: two thirds of the window, one big slide per new thing.
 *
 * The changelog dialog lists everything a version changed; this panel is for
 * the two or three things worth a picture. A rail on the left names them, the
 * stage on the right shows the current one, and the footer carries the tick
 * that decides whether the panel comes back on the next launch.
 */
export default function FeatureTour({
  version,
  slides,
  onClose,
  onShowReleaseNotes,
  onOpenTab,
  isCovered,
}: IFeatureTourProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const isLast = index === slides.length - 1;
  // Focus lands on the primary button: Enter walks the slides and closes at
  // the end, without hunting for anything.
  const primaryRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(
    () => onClose(dontShowAgain),
    [onClose, dontShowAgain],
  );

  const goNext = useCallback(() => {
    if (isLast) {
      close();
    } else {
      setIndex((current) => Math.min(current + 1, slides.length - 1));
    }
  }, [close, isLast, slides.length]);

  const goBack = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isCovered) {
        return;
      }
      if (event.key === 'Escape') {
        close();
      } else if (event.key === 'ArrowRight' && !isLast) {
        goNext();
      } else if (event.key === 'ArrowLeft') {
        goBack();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, goNext, goBack, isLast, isCovered]);

  const actions = useMemo<ISlideActions>(
    () => ({ openTab: onOpenTab }),
    [onOpenTab],
  );

  const slide = slides[index];
  const { Body } = slide;

  return (
    <div
      className="feature-tour-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isCovered) {
          close();
        }
      }}
    >
      <div
        className="feature-tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-tour-title"
      >
        <DialogHeader
          eyebrow={t('tour.eyebrow')}
          title={t('tour.title')}
          titleId="feature-tour-title"
          version={version}
          closeLabel={t('tour.close')}
          onClose={close}
        />

        <div className="feature-tour__body">
          <nav className="feature-tour__rail" aria-label={t('tour.rail')}>
            {slides.map((entry, entryIndex) => {
              // A group heading above the first entry of each kind: what
              // this version brought, then what has been here all along.
              const startsGroup =
                entryIndex === 0 ||
                entry.isNew !== slides[entryIndex - 1].isNew;
              let heading: string | null = null;
              if (startsGroup) {
                heading = entry.isNew
                  ? t('tour.rail.new')
                  : t('tour.rail.always');
              }
              return (
                <Fragment key={entry.id}>
                  {heading && (
                    <span className="feature-tour__rail-heading">
                      {heading}
                    </span>
                  )}
                  <button
                    type="button"
                    className={`feature-tour__rail-item${
                      entryIndex === index ? ' is-active' : ''
                    }`}
                    aria-current={entryIndex === index ? 'step' : undefined}
                    onClick={() => setIndex(entryIndex)}
                  >
                    <span className="feature-tour__rail-number">
                      {entryIndex + 1}
                    </span>
                    <span className="feature-tour__rail-text">
                      <span className="feature-tour__rail-title">
                        {t(entry.titleKey)}
                        {entry.isNew && (
                          <span className="feature-tour__rail-new">
                            {t('tour.newBadge')}
                          </span>
                        )}
                      </span>
                      <span className="feature-tour__rail-subtitle">
                        {t(entry.subtitleKey)}
                      </span>
                    </span>
                  </button>
                </Fragment>
              );
            })}
          </nav>

          {/* Keyed on the slide so a change of slide remounts the stage and
              replays its entrance, rather than swapping text in place. */}
          <section key={slide.id} className="feature-tour__stage">
            <Body actions={actions} />
          </section>
        </div>

        <div className="feature-tour__footer">
          <label className="feature-tour__tick" htmlFor="feature-tour-tick">
            <input
              id="feature-tour-tick"
              type="checkbox"
              className="feature-tour__check"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
            />
            <span>{t('tour.dontShowAgain')}</span>
          </label>

          <button
            type="button"
            className="feature-tour__notes"
            onClick={onShowReleaseNotes}
          >
            {t('tour.releaseNotes')}
          </button>

          <div className="feature-tour__nav">
            <span className="feature-tour__count">
              {t('tour.stepOf', {
                current: index + 1,
                total: slides.length,
              })}
            </span>
            <button
              type="button"
              className="button small subtle"
              disabled={index === 0}
              onClick={goBack}
            >
              {t('tour.back')}
            </button>
            <button
              ref={primaryRef}
              type="button"
              className="button small"
              onClick={goNext}
            >
              {isLast ? t('tour.done') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
