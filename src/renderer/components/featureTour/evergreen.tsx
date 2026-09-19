/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  CustomLooksArt,
  DspArt,
  KaraokeArt,
  KaraokeMakerArt,
  LibraryArt,
  OnlineMediaArt,
} from './artwork';
import { useTranslation } from '../../utils/I18nContext';
import { useTheme } from '../../utils/theme';
import secondOutputShot from '../../../../assets/tour/second-output.png';
import secondOutputOceanShot from '../../../../assets/tour/second-output-ocean.png';
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

/**
 * The one standing slide with a capture rather than a drawing: the panel
 * is small, carries nothing personal beyond device names, and a list of
 * real outputs with one switched on says what the feature is faster than
 * any diagram of it.
 */
export function SecondOutputSlide({ actions }: ISlideProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <FeatureSlide
      prefix="tour.output"
      tab="eq"
      art={
        <img
          className="tour-art tour-art--shot"
          src={theme === 'ocean' ? secondOutputOceanShot : secondOutputShot}
          alt={t('tour.output.imageAlt')}
        />
      }
      actions={actions}
    />
  );
}

export function CustomLooksSlide({ actions }: ISlideProps) {
  return (
    <FeatureSlide
      prefix="tour.looks"
      tab="eq"
      art={<CustomLooksArt />}
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
