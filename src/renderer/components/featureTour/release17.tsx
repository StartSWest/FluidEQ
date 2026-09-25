/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import EngineFlow from './EngineFlow';
import LightingVisual from './LightingVisual';
import { FREE_LOOK_COUNT } from './lookCounts';
import RoomVisual from './RoomVisual';
import ShowcaseSlide from './ShowcaseSlide';
import {
  DesktopVisual,
  PlusVisual,
  VisualizersVisual,
} from './showcaseVisuals';
import type { ISlideActions } from './slides';

/**
 * What 1.7 announces, one headline slide each: the text is in the dictionaries
 * under the prefix, the picture in `showcaseVisuals`, `LightingVisual` or
 * `EngineFlow`, and the
 * page is `ShowcaseSlide`.
 */
interface ISlideProps {
  actions: ISlideActions;
}

export function FluidEngineSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.engine"
      onOpen={() => actions.openTab('dsp')}
      visual={<EngineFlow />}
    />
  );
}

export function RoomSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.room"
      onOpen={() => actions.openTab('dsp')}
      visual={<RoomVisual />}
    />
  );
}

export function PlusSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.plus"
      onOpen={() => actions.openTab('community')}
      visual={<PlusVisual />}
    />
  );
}

export function VisualizersSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.visualizers"
      onOpen={() => actions.openTab('eq')}
      visual={<VisualizersVisual />}
      values={{ styles: FREE_LOOK_COUNT }}
    />
  );
}

export function DesktopVisualizerSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.desktop"
      onOpen={() => actions.openTab('eq')}
      visual={<DesktopVisual />}
    />
  );
}

export function DynamicLightingSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.lighting"
      onOpen={() => actions.openTab('community')}
      visual={<LightingVisual />}
      tag="tour.beta"
    />
  );
}
