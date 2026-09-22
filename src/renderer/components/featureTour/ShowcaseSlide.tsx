/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';

/**
 * A feature release's headline slide: the picture larger than the words.
 *
 * Not `FeatureSlide`. That one explains a tab that has been here a while, in
 * four points beside a small drawing; this one announces something new, and
 * what it has to show — a scene playing, the path the sound now takes — needs
 * the room. Three points, so the picture keeps it.
 */
interface IShowcaseSlideProps {
  prefix:
    | 'tour.engine'
    | 'tour.room'
    | 'tour.plus'
    | 'tour.visualizers'
    | 'tour.desktop'
    | 'tour.lighting'
    | 'tour.player'
    | 'tour.games'
    | 'tour.presets'
    | 'tour.tone'
    | 'tour.studio'
    | 'tour.help';
  /** What the slide's button does: land somewhere, and close the tour. */
  onOpen: () => void;
  visual: ReactNode;
  /** A word beside the kicker for something still being finished: "Beta". */
  tag?: TranslationKey;
  /** Numbers the slide's words quote, counted by the app rather than typed. */
  values?: Record<string, string | number>;
}

const POINTS = [1, 2, 3] as const;

type TSuffix =
  | 'kicker'
  | 'title'
  | 'lead'
  | 'how'
  | 'open'
  | `point${(typeof POINTS)[number]}`;

export default function ShowcaseSlide({
  prefix,
  onOpen,
  visual,
  tag,
  values,
}: IShowcaseSlideProps) {
  const { t } = useTranslation();
  const key = (suffix: TSuffix): TranslationKey => `${prefix}.${suffix}`;

  return (
    <div className="tour-slide tour-slide--showcase">
      <div className="tour-slide__text">
        <span className="tour-slide__kicker">
          {t(key('kicker'))}
          {tag && <span className="tour-slide__tag">{t(tag)}</span>}
        </span>
        <h3 className="tour-slide__title">{t(key('title'))}</h3>
        <p className="tour-slide__lead">{t(key('lead'), values)}</p>

        <ul className="tour-showcase__points">
          {POINTS.map((point) => (
            <li key={point}>{t(key(`point${point}`), values)}</li>
          ))}
        </ul>

        <div className="tour-slide__how">
          <span className="tour-slide__how-title">{t('tour.howTitle')}</span>
          <p>{t(key('how'))}</p>
          <button type="button" className="button small" onClick={onOpen}>
            {t(key('open'))}
          </button>
        </div>
      </div>

      <figure className="tour-showcase__visual">{visual}</figure>
    </div>
  );
}
