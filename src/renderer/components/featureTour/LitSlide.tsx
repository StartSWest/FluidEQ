/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';

/**
 * Every 2.6 slide but the first: look A, the one Ivan picked on 2026-11-25
 * ("A"): the words on one line over a large live picture of the real page,
 * and three numbered points under it whose numbers stand on the parts of
 * the picture they name (`TourLiveFigure`'s marks).
 *
 * The way to the feature is a quiet button beside the lead: Next is the
 * action the tour suggests, so it alone wears the loud style.
 */
export type TLitPrefix =
  | 'tour.v26.autoEq'
  | 'tour.v26.mic'
  | 'tour.v26.eq'
  | 'tour.v26.dynamics'
  | 'tour.v26.library'
  | 'tour.v26.karaoke'
  | 'tour.v26.looks'
  | 'tour.v26.colours'
  | 'tour.v26.gallery'
  | 'tour.v26.publish';

const POINTS = [1, 2, 3] as const;

type TSuffix =
  'kicker' | 'title' | 'lead' | 'open' | `point${(typeof POINTS)[number]}`;

interface ILitSlideProps {
  prefix: TLitPrefix;
  /** Closes the tour where the feature is. */
  onOpen: () => void;
  /** The live picture: a `TourLiveFigure`. */
  figure: ReactNode;
  /**
   * For a panel taller than it is wide (Auto EQ's): the picture down
   * the slide's whole height on the left, the words and points beside it,
   * where under the words it was drawn at half its size.
   */
  isTall?: boolean;
  /** The rest of the release, listed under the last slide of a part. */
  also?: { heading: TranslationKey; lines: readonly TranslationKey[] };
}

export default function LitSlide({
  prefix,
  onOpen,
  figure,
  isTall = false,
  also,
}: ILitSlideProps) {
  const { t } = useTranslation();
  const key = (suffix: TSuffix): TranslationKey => `${prefix}.${suffix}`;

  return (
    <div className={`tour-slide tour-lit${isTall ? ' tour-lit--tall' : ''}`}>
      <header className="tour-lit__head">
        <div className="tour-lit__name">
          <span className="tour-slide__kicker">{t(key('kicker'))}</span>
          <h3 className="tour-slide__title">{t(key('title'))}</h3>
        </div>
        <div className="tour-lit__lead">
          <p className="tour-slide__lead">{t(key('lead'))}</p>
          <button
            type="button"
            className="button small subtle"
            onClick={onOpen}
          >
            {t(key('open'))}
          </button>
        </div>
      </header>

      <figure className="tour-lit__figure">{figure}</figure>

      <ol className="tour-lit__points">
        {POINTS.map((point) => (
          <li key={point}>
            <span className="tour-lit__number" aria-hidden="true">
              {point}
            </span>
            <span>{t(key(`point${point}`))}</span>
          </li>
        ))}
      </ol>

      {also && (
        <section className="tour-lit__also" aria-labelledby={`${prefix}-also`}>
          <h4 className="tour-slide__how-title" id={`${prefix}-also`}>
            {t(also.heading)}
          </h4>
          <ul>
            {also.lines.map((line) => (
              <li key={line}>{t(line)}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
