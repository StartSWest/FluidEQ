/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  DspArt,
  KaraokeArt,
  KaraokeMakerArt,
  LibraryArt,
  OnlineMediaArt,
} from './artwork';
import FeatureSlide from './FeatureSlide';
import type { ISlideActions } from './slides';

/**
 * The standing slides, one line each: the text is in the dictionaries under
 * the prefix, the drawing is in `artwork`, and the page is `FeatureSlide`.
 */
interface ISlideProps {
  actions: ISlideActions;
}

export function LibrarySlide({ actions }: ISlideProps) {
  return (
    <FeatureSlide
      prefix="tour.library"
      tab="library"
      art={<LibraryArt />}
      actions={actions}
    />
  );
}

export function DspSlide({ actions }: ISlideProps) {
  return (
    <FeatureSlide
      prefix="tour.dsp"
      tab="dsp"
      art={<DspArt />}
      actions={actions}
    />
  );
}

export function KaraokeSlide({ actions }: ISlideProps) {
  return (
    <FeatureSlide
      prefix="tour.karaoke"
      tab="karaoke"
      art={<KaraokeArt />}
      actions={actions}
    />
  );
}

export function KaraokeMakerSlide({ actions }: ISlideProps) {
  return (
    <FeatureSlide
      prefix="tour.maker"
      tab="karaoke"
      art={<KaraokeMakerArt />}
      actions={actions}
    />
  );
}

export function OnlineMediaSlide({ actions }: ISlideProps) {
  return (
    <FeatureSlide
      prefix="tour.media"
      tab="video"
      art={<OnlineMediaArt />}
      actions={actions}
    />
  );
}
