/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { memo } from 'react';
import type { HELP_CHAPTERS } from 'common/helpGuide';
import { useTranslation } from '../utils/I18nContext';
import { useTheme } from '../utils/theme';
import HelpFigure from './HelpFigure';
import { Marked } from './HelpMarks';
import { helpAnchor, type IHelpHit } from './helpSearch';
import { helpScreenshot } from './screenshots';

type TGuideChapter = (typeof HELP_CHAPTERS)[number];

/** A chapter as the guide shows it: in the reader's language, and found. */
export interface IHelpShownChapter {
  id: TGuideChapter['id'];
  group: TGuideChapter['group'];
  figures: TGuideChapter['figures'];
  /** Its place in the guide, which a search keeps while reordering it. */
  number: number;
  title: string;
  intro: string;
  steps: string[];
  tip: string;
  /** Where a search found it, while one is running. */
  hit?: IHelpHit;
}

/** A capture asked to be shown at full size. */
export interface IHelpCapture {
  src: string;
  title: string;
}

interface IHelpChapterProps {
  chapter: IHelpShownChapter;
  /** Its part of the guide, named above it when it is the first shown. */
  groupLabel?: string;
  onEnlarge: (capture: IHelpCapture) => void;
}

/**
 * One chapter of the guide's article.
 *
 * A component of its own, and memoised, because typing in the guide's search
 * re-rendered all of them on every key: thirty-one chapters of captures,
 * call-outs and steps, to change the text in one box. The search now answers
 * a deferred copy of the query (`HelpGuide`), and a chapter re-renders only
 * when that answer changes it — or when what it has found does, which
 * `Marked` hears through its context.
 */
function HelpChapter({ chapter, groupLabel, onEnlarge }: IHelpChapterProps) {
  const { t } = useTranslation();
  // The pictures follow the window: Light captures in the Light theme.
  const theme = useTheme();
  return (
    <section
      className="help-guide__chapter"
      aria-labelledby={`help-${chapter.id}`}
    >
      {groupLabel && (
        <span className="eyebrow help-guide__chapter-group">{groupLabel}</span>
      )}
      <div className="help-guide__chapter-heading">
        <span className="feature-tour__rail-number" aria-hidden="true">
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
        const title = figure.caption ? t(figure.caption) : chapter.title;
        const src = helpScreenshot(figure.image, theme);
        return (
          <HelpFigure
            key={figure.image}
            anchor={helpAnchor.figure(chapter.id, figureIndex)}
            figure={figure}
            src={src}
            title={title}
            onEnlarge={() => onEnlarge({ src, title })}
          />
        );
      })}
      <h3>{t('help.steps')}</h3>
      <ol>
        {chapter.steps.map((step, stepIndex) => (
          <li
            key={step}
            data-help-anchor={helpAnchor.step(chapter.id, stepIndex)}
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
  );
}

export default memo(HelpChapter);
