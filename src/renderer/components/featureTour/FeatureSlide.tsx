/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import type { ISlideActions, TTourTab } from './slides';

/**
 * The standing slides share one page: what the feature is, what it can do,
 * how to start, and a picture. Every key hangs off one prefix, so a slide is
 * a prefix, a tab and an illustration; the text lives in the dictionaries.
 *
 * Not the two release slides. The theme one is built around a capture and a
 * live switch, the Share Audio one around a tutorial; forcing them into this
 * shape would have meant flags for "has steps" and "has facts".
 */
interface IFeatureSlideProps {
  /** `tour.library`, `tour.dsp`, ... */
  prefix:
    'tour.library' | 'tour.dsp' | 'tour.karaoke' | 'tour.maker' | 'tour.media';
  tab: TTourTab;
  art: ReactNode;
  actions: ISlideActions;
}

const POINTS = [1, 2, 3, 4] as const;

/**
 * Typed rather than cast: every prefix/suffix pair is checked against the
 * dictionary, so a slide added without its strings fails the build rather
 * than rendering its keys.
 */
type TSuffix =
  | 'kicker'
  | 'title'
  | 'lead'
  | 'how'
  | 'open'
  | `point${(typeof POINTS)[number]}`;

export default function FeatureSlide({
  prefix,
  tab,
  art,
  actions,
}: IFeatureSlideProps) {
  const { t } = useTranslation();
  const key = (suffix: TSuffix): TranslationKey => `${prefix}.${suffix}`;

  return (
    <div className="tour-slide tour-slide--feature">
      <div className="tour-slide__text">
        <span className="tour-slide__kicker">{t(key('kicker'))}</span>
        <h3 className="tour-slide__title">{t(key('title'))}</h3>
        <p className="tour-slide__lead">{t(key('lead'))}</p>

        <ul className="tour-slide__points">
          {POINTS.map((point) => (
            <li key={point}>{t(key(`point${point}`))}</li>
          ))}
        </ul>

        <div className="tour-slide__how">
          <span className="tour-slide__how-title">{t('tour.howTitle')}</span>
          <p>{t(key('how'))}</p>
          <button
            type="button"
            className="button small"
            onClick={() => actions.openTab(tab)}
          >
            {t(key('open'))}
          </button>
        </div>
      </div>

      <figure className="tour-slide__art">{art}</figure>
    </div>
  );
}
