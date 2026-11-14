/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { AnimationEvent, RefObject, useLayoutEffect, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';

/** Before the grid has been measured: about one screen of a normal window. */
const FIRST_GUESS = 12;

interface IGallerySkeletonProps {
  ref: RefObject<HTMLDivElement | null>;
  /** The cards have arrived and the placeholders are fading out over them. */
  closing: boolean;
  onAnimationEnd: (event: AnimationEvent) => void;
}

/**
 * Placeholder cards while a list's first answer is on its way.
 *
 * AS MANY AS THE SCREEN HOLDS. Six used to stand at the top of an otherwise
 * empty page, and the page then filled in around them. Now the grid is
 * measured — its columns, a card's height, and how far it is from the foot of
 * the gallery's scroller — and filled to that foot, the last row cut there
 * rather than pushing a scrollbar onto a page that has nothing to scroll yet.
 *
 * They fade in together (`Gallery.scss`), and when the cards come they fade
 * out over them instead of vanishing a moment before: the page goes from
 * placeholders to scenes without an empty frame between. Each card lands
 * exactly where its placeholder stood, at its size, because a placeholder is
 * built from the card's own rows.
 */
export default function GallerySkeleton({
  ref,
  closing,
  onAnimationEnd,
}: IGallerySkeletonProps) {
  const { t } = useTranslation();
  const [fill, setFill] = useState<{ count: number; height?: number }>({
    count: FIRST_GUESS,
  });

  useLayoutEffect(() => {
    const grid = ref.current;
    // Measured while arriving only: a leaving grid keeps what it had, so its
    // cards do not reshuffle under the ones replacing them.
    if (!grid || closing) {
      return undefined;
    }
    const scroller = grid.closest<HTMLElement>('.gallery-visualizers');
    const measure = () => {
      const card = grid.firstElementChild;
      if (!(card instanceof HTMLElement) || card.offsetHeight === 0) {
        return;
      }
      const style = getComputedStyle(grid);
      const columns = Math.max(
        1,
        style.gridTemplateColumns.split(' ').filter(Boolean).length,
      );
      const gap = parseFloat(style.rowGap) || 0;
      const foot = scroller
        ? scroller.getBoundingClientRect().bottom -
          (parseFloat(getComputedStyle(scroller).paddingBottom) || 0)
        : window.innerHeight;
      const height = Math.max(
        card.offsetHeight,
        Math.floor(foot - grid.getBoundingClientRect().top),
      );
      const rows = Math.ceil((height + gap) / (card.offsetHeight + gap));
      const count = columns * rows;
      setFill((current) =>
        current.count === count && current.height === height
          ? current
          : { count, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    if (scroller) {
      observer.observe(scroller);
    }
    return () => observer.disconnect();
  }, [closing, ref]);

  return (
    <div
      ref={ref}
      className="gallery-grid gallery-grid--skeleton"
      role={closing ? undefined : 'status'}
      aria-label={closing ? undefined : t('plus.gallery.loading')}
      aria-hidden={closing || undefined}
      data-closing={closing ? '' : undefined}
      onAnimationEnd={onAnimationEnd}
      style={fill.height === undefined ? undefined : { maxHeight: fill.height }}
    >
      {Array.from({ length: fill.count }, (_, index) => (
        <span
          key={index}
          className="gallery-card gallery-card--skeleton"
          aria-hidden="true"
        >
          <span className="gallery-card__ghost-picture" />
          {/* The card's own rows, in its own classes, each holding a bar
              where its words will be: a placeholder is exactly the size of
              the card that replaces it because it is built the same way.
              Its own picture and two bars were 58 px shorter, and every card
              grew as the list came (Ivan, 2026-11-13). */}
          <span className="gallery-card__body">
            <span className="gallery-card__name">
              <span className="gallery-ghost-bar" />
            </span>
            <span className="gallery-card__byline">
              <span className="gallery-ghost-bar gallery-ghost-bar--short" />
            </span>
            <span className="gallery-card__version">
              <span className="gallery-ghost-bar gallery-ghost-bar--short" />
            </span>
            <span className="gallery-card__foot">
              <span className="gallery-card__adds">
                <span className="gallery-ghost-bar gallery-ghost-bar--short" />
              </span>
              <span className="gallery-card__controls">
                <span className="button small subtle gallery-ghost-control" />
              </span>
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
