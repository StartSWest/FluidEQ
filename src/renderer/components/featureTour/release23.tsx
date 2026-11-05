/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import GamingLabVisual from './GamingLabVisual';
import ShowcaseSlide from './ShowcaseSlide';
import type { ISlideActions } from './slides';

/**
 * What 2.3 announces: the Gaming Lab (Ivan, 2026-11-04: "create the new
 * whats new card for this exciting feature"). It replaces 2.0's games slide,
 * which drew a game's sound as cards on the desktop, and moves up as the
 * Room's and the Compact player's did (`slides.ts`): the Lab drawn by its
 * own parts, and its film under the picture.
 */
interface ISlideProps {
  actions: ISlideActions;
}

export default function GamingLabSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  return (
    <div className="tour-release23">
      <ShowcaseSlide
        prefix="tour.games"
        onOpen={() => actions.openTab('games')}
        visual={<GamingLabVisual />}
        film="gaming-lab"
      />
      <section
        className="tour-slide__how dialog-frame__group tour-release23__also"
        aria-labelledby="tour-release23-also"
      >
        <h4 className="tour-slide__how-title" id="tour-release23-also">
          {t('tour.v23.also')}
        </h4>
        <ul className="tour-showcase__points">
          {(
            [
              'tour.v23.engineKey',
              'tour.v23.profiles',
              'tour.v23.dsp',
              'tour.v23.help',
              'tour.v23.forum',
              'tour.v23.layout',
            ] as const
          ).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
