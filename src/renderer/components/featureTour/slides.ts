/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { ComponentType } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { featureTourKey } from '../../../common/featureTour';
import BlackThemeSlide from './BlackThemeSlide';
import ShareAudioSlide from './ShareAudioSlide';
import {
  CustomLooksSlide,
  DspSlide,
  KaraokeMakerSlide,
  KaraokeSlide,
  LibrarySlide,
  OnlineMediaSlide,
  SecondOutputSlide,
} from './evergreen';

/** The workspace tabs a slide can send the user to. */
export type TTourTab = 'eq' | 'share' | 'library' | 'dsp' | 'karaoke' | 'video';

/** What a slide can ask the app to do on the user's behalf. */
export interface ISlideActions {
  /** Close the tour and land on that tab. */
  openTab: (tab: TTourTab) => void;
}

export interface ITourSlide {
  id: string;
  /** The rail entry: what the feature is called, and one line under it. */
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  /** Arrived with the running version, as opposed to always being here. */
  isNew: boolean;
  Body: ComponentType<{ actions: ISlideActions }>;
}

type TSlideEntry = Omit<ITourSlide, 'isNew'>;

/**
 * What each feature release brought, keyed by `major.minor`.
 *
 * Only the big things go here: a theme, a whole new tab. A release whose
 * changes are all fixes and small additions has no entry, and the tour opens
 * with the standing slides alone.
 */
const NEW_BY_RELEASE: Record<string, TSlideEntry[]> = {
  '1.6': [
    {
      id: 'black-theme',
      titleKey: 'tour.theme.title',
      subtitleKey: 'tour.theme.subtitle',
      Body: BlackThemeSlide,
    },
    {
      id: 'share-audio',
      titleKey: 'tour.share.title',
      subtitleKey: 'tour.share.subtitle',
      Body: ShareAudioSlide,
    },
  ],
};

/**
 * The standing slides: the tabs that have been here for a while, for whoever
 * has never opened them. Always after the new ones, always in this order,
 * ending on Online Media so the tour closes on the thing most people came
 * for.
 */
const ALWAYS: TSlideEntry[] = [
  {
    id: 'library',
    titleKey: 'tour.library.title',
    subtitleKey: 'tour.library.subtitle',
    Body: LibrarySlide,
  },
  {
    id: 'dsp',
    titleKey: 'tour.dsp.title',
    subtitleKey: 'tour.dsp.subtitle',
    Body: DspSlide,
  },
  {
    id: 'second-output',
    titleKey: 'tour.output.title',
    subtitleKey: 'tour.output.subtitle',
    Body: SecondOutputSlide,
  },
  {
    id: 'custom-looks',
    titleKey: 'tour.looks.title',
    subtitleKey: 'tour.looks.subtitle',
    Body: CustomLooksSlide,
  },
  {
    id: 'karaoke',
    titleKey: 'tour.karaoke.title',
    subtitleKey: 'tour.karaoke.subtitle',
    Body: KaraokeSlide,
  },
  {
    id: 'karaoke-maker',
    titleKey: 'tour.maker.title',
    subtitleKey: 'tour.maker.subtitle',
    Body: KaraokeMakerSlide,
  },
  {
    id: 'online-media',
    titleKey: 'tour.media.title',
    subtitleKey: 'tour.media.subtitle',
    Body: OnlineMediaSlide,
  },
];

export const featureTourFor = (version: string): ITourSlide[] => [
  ...(NEW_BY_RELEASE[featureTourKey(version)] ?? []).map((entry) => ({
    ...entry,
    isNew: true,
  })),
  ...ALWAYS.map((entry) => ({ ...entry, isNew: false })),
];
