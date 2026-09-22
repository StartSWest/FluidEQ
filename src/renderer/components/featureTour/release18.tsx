/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_PRESETS } from '../../../common/dsp/presets';
import ShowcaseSlide from './ShowcaseSlide';
import {
  GamesVisual,
  GuideVisual,
  PlayerVisual,
  PresetsVisual,
  StudioVisual,
  ToneVisual,
} from './release18Visuals';
import type { ISlideActions } from './slides';

/**
 * What 1.8 announces, one headline slide each. The Room's slide is 1.7's,
 * moved up with new words (`slides.ts` says why); these are the rest.
 */
interface ISlideProps {
  actions: ISlideActions;
}

/**
 * The catalogue's own counts, so the slide cannot go stale the way "nine
 * stages" and "38 styles" did: None is the absence of a chain, not one.
 */
const PRESET_COUNTS = {
  chains: DSP_PRESETS.filter((preset) => preset.id !== 'empty').length,
  styles: DSP_PRESETS.filter((preset) => preset.group === 'genre').length,
};

export function CompactPlayerSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.player"
      onOpen={actions.openPlayer}
      visual={<PlayerVisual />}
    />
  );
}

export function GamePresetsSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.games"
      onOpen={() => actions.openTab('games')}
      visual={<GamesVisual />}
    />
  );
}

export function PresetsSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.presets"
      onOpen={() => actions.openTab('eq')}
      visual={<PresetsVisual />}
      values={PRESET_COUNTS}
    />
  );
}

export function ToneSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.tone"
      onOpen={() => actions.openTab('eq')}
      visual={<ToneVisual />}
    />
  );
}

export function StudioSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.studio"
      onOpen={() => actions.openTab('community')}
      visual={<StudioVisual />}
    />
  );
}

export function GuideSearchSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.help"
      onOpen={actions.openGuide}
      visual={<GuideVisual />}
    />
  );
}
