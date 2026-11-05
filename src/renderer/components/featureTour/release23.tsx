/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

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
  return (
    <ShowcaseSlide
      prefix="tour.games"
      onOpen={() => actions.openTab('games')}
      visual={<GamingLabVisual />}
      film="gaming-lab"
    />
  );
}
