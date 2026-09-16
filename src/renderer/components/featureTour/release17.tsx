/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import EngineFlow from './EngineFlow';
import LightingVisual from './LightingVisual';
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
      tab="dsp"
      visual={<EngineFlow />}
      actions={actions}
    />
  );
}

export function RoomSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.room"
      tab="dsp"
      visual={<RoomVisual />}
      actions={actions}
    />
  );
}

export function PlusSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.plus"
      tab="community"
      visual={<PlusVisual />}
      actions={actions}
    />
  );
}

export function VisualizersSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.visualizers"
      tab="eq"
      visual={<VisualizersVisual />}
      actions={actions}
    />
  );
}

export function DesktopVisualizerSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.desktop"
      tab="eq"
      visual={<DesktopVisual />}
      actions={actions}
    />
  );
}

export function DynamicLightingSlide({ actions }: ISlideProps) {
  return (
    <ShowcaseSlide
      prefix="tour.lighting"
      tab="community"
      visual={<LightingVisual />}
      actions={actions}
      tag="tour.beta"
    />
  );
}
