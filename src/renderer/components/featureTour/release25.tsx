/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import ShowcaseSlide from './ShowcaseSlide';
import StudioCodeVisual from './StudioCodeVisual';
import StudioEditVisual from './StudioEditVisual';
import StudioMakersVisual from './StudioMakersVisual';
import StudioWatchVisual from './StudioWatchVisual';
import type { ISlideActions } from './slides';

/**
 * What 2.5 brings the visualizers, all of it in the Visualizers' own What's
 * New (Ivan, 2026-11-11: yes to 2.5's Studio news as slides there): Edit
 * mode, the AI that watches a scene move, Higgsfield beside GPT, and the Code
 * tab's every file, with the rest of the release for makers and listeners
 * listed under that last one.
 */
interface ISlideProps {
  actions: ISlideActions;
}

export function EditSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.edit"
      onOpen={() => actions.openTab('community')}
      visual={<StudioEditVisual />}
    />
  );
}

export function WatchSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.watch"
      onOpen={() => actions.openTab('community')}
      visual={<StudioWatchVisual />}
    />
  );
}

export function MakersSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.makers"
      onOpen={() => actions.openTab('community')}
      visual={<StudioMakersVisual />}
    />
  );
}

/** The rest of 2.5 on the visualizers' side, under its last slide. */
const ALSO: readonly TranslationKey[] = [
  'tour.v25.recover',
  'tour.v25.never',
  'tour.v25.copy',
  'tour.v25.review',
  'tour.v25.publish',
];

export function CodeSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    // 2.4's list under a slide, kept in its classes (`_tour-release24b.scss`).
    <div className="tour-release24">
      <ShowcaseSlide
        prefix="tour.code"
        onOpen={() => actions.openTab('community')}
        visual={<StudioCodeVisual />}
      />
      <section
        className="tour-slide__how dialog-frame__group tour-release24__also"
        aria-labelledby="tour-release25-also"
      >
        <h4 className="tour-slide__how-title" id="tour-release25-also">
          {t('tour.v25.also')}
        </h4>
        <ul className="tour-showcase__points">
          {ALSO.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
