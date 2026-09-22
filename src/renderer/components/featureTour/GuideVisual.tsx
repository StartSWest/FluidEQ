/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { HELP_CHAPTERS } from '../../../common/helpGuide';
import { MarkedText } from '../../help/HelpMarks';
import { buildHelpIndex, searchHelp } from '../../help/helpSearch';
import { useTranslation } from '../../utils/I18nContext';

/** How many answers the picture lists: the rail's first screenful. */
const SHOWN = 3;

/**
 * The user guide searched, for real: the question a reader of this language
 * would type, and what the guide's own search answers — the chapters in its
 * order, each with the passage it found and the words marked. Beside them,
 * the first answer as the guide opens it, with a picture's control numbered
 * the way every picture in it is. Nothing here is written for the picture,
 * so it cannot claim a result the search does not give.
 */
export default function GuideVisual() {
  const { t, locale } = useTranslation();
  const query = t('tour.help.query');
  const hits = useMemo(
    () =>
      searchHelp(buildHelpIndex(HELP_CHAPTERS, locale), query)?.hits.slice(
        0,
        SHOWN,
      ) ?? [],
    [locale, query],
  );
  const [first] = hits;

  return (
    <div
      className="guide-visual"
      role="img"
      aria-label={t('tour.help.imageAlt')}
    >
      <div className="guide-visual__rail">
        <span className="guide-visual__search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="M15 15l5 5" />
          </svg>
          {query}
        </span>
        <ol className="guide-visual__hits">
          {hits.map((hit, index) => (
            <li
              key={hit.chapterId}
              className={index === 0 ? 'is-active' : undefined}
            >
              <strong>{t(`help.${hit.chapterId}.title`)}</strong>
              <span className="guide-visual__found">
                {hit.snippet.map((part) => (
                  <MarkedText
                    key={`${part.text}-${part.marks.length}`}
                    text={part.text}
                    marks={part.marks}
                  />
                ))}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="guide-visual__page">
        {first && (
          <strong className="guide-visual__title">
            {t(`help.${first.chapterId}.title`)}
          </strong>
        )}
        <span className="guide-visual__figure">
          <span className="guide-visual__window">
            <i className="guide-visual__bar" />
            <i className="guide-visual__bar is-short" />
            <i className="guide-visual__control" />
            <i className="guide-visual__bar is-wide" />
          </span>
          <svg
            className="guide-visual__lead"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M8 52 H34" />
          </svg>
          <span className="guide-visual__number">1</span>
        </span>
        {first && (
          <span className="guide-visual__passage">
            {first.snippet.map((part) => (
              <MarkedText
                key={`${part.text}-${part.marks.length}`}
                text={part.text}
                marks={part.marks}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
