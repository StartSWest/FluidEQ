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
import RainbowModeSlide from './RainbowModeSlide';
import {
  CustomLooksSlide,
  DspSlide,
  KaraokeMakerSlide,
  KaraokeSlide,
  LibrarySlide,
  OnlineMediaSlide,
  SecondOutputSlide,
} from './evergreen';
import {
  DesktopVisualizerSlide,
  DynamicLightingSlide,
  FluidEngineSlide,
  PlusSlide,
  RoomSlide,
  VisualizersSlide,
} from './release17';
import {
  CompactPlayerSlide,
  GamePresetsSlide,
  GuideSearchSlide,
  PresetsSlide,
  StudioSlide,
  ToneSlide,
} from './release18';

/**
 * The workspace tabs a slide can send the user to. `community` is Plus;
 * `games` is the Game presets page behind EQ.
 */
export type TTourTab =
  | 'eq'
  | 'games'
  | 'share'
  | 'library'
  | 'dsp'
  | 'karaoke'
  | 'video'
  | 'community';

/** What a slide can ask the app to do on the user's behalf. */
export interface ISlideActions {
  /** Close the tour and land on that tab. */
  openTab: (tab: TTourTab) => void;
  /** Close the tour and turn the window into the Compact player. */
  openPlayer: () => void;
  /** Close the tour and open the user guide. */
  openGuide: () => void;
}

export interface ITourSlide {
  id: string;
  /** The rail entry: what the feature is called, and one line under it. */
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  /**
   * The feature release that announced it, `major.minor`, when the tour
   * shows it as new; absent on a standing slide. The rail heads each
   * release's slides with its number.
   */
  release?: string;
  Body: ComponentType<{ actions: ISlideActions }>;
}

type TSlideEntry = Omit<ITourSlide, 'release'>;

const SECOND_OUTPUT: TSlideEntry = {
  id: 'second-output',
  titleKey: 'tour.output.title',
  subtitleKey: 'tour.output.subtitle',
  Body: SecondOutputSlide,
};

const BLACK_THEME: TSlideEntry = {
  id: 'black-theme',
  titleKey: 'tour.theme.title',
  subtitleKey: 'tour.theme.subtitle',
  Body: BlackThemeSlide,
};

const SHARE_AUDIO: TSlideEntry = {
  id: 'share-audio',
  titleKey: 'tour.share.title',
  subtitleKey: 'tour.share.subtitle',
  Body: ShareAudioSlide,
};

const RAINBOW_MODE: TSlideEntry = {
  id: 'rainbow-mode',
  titleKey: 'tour.rainbow.title',
  subtitleKey: 'tour.rainbow.subtitle',
  Body: RainbowModeSlide,
};

const ROOM: TSlideEntry = {
  id: 'room',
  titleKey: 'tour.room.title',
  subtitleKey: 'tour.room.subtitle',
  Body: RoomSlide,
};

/**
 * 1.7, in the order it was announced: the engine first, because everything
 * plays through it.
 */
const RELEASE_17: TSlideEntry[] = [
  {
    id: 'fluideq-engine',
    titleKey: 'tour.engine.title',
    subtitleKey: 'tour.engine.subtitle',
    Body: FluidEngineSlide,
  },
  ROOM,
  {
    id: 'fluideq-plus',
    titleKey: 'tour.plus.title',
    subtitleKey: 'tour.plus.subtitle',
    Body: PlusSlide,
  },
  {
    id: 'visualizers',
    titleKey: 'tour.visualizers.title',
    subtitleKey: 'tour.visualizers.subtitle',
    Body: VisualizersSlide,
  },
  {
    id: 'desktop-visualizer',
    titleKey: 'tour.desktop.title',
    subtitleKey: 'tour.desktop.subtitle',
    Body: DesktopVisualizerSlide,
  },
  {
    id: 'dynamic-lighting',
    titleKey: 'tour.lighting.title',
    subtitleKey: 'tour.lighting.subtitle',
    Body: DynamicLightingSlide,
  },
  RAINBOW_MODE,
];

/**
 * 1.8. The Compact player first, because it is the one thing in it that
 * changes how the whole window is used. The Room moves up into this release:
 * thirteen of its twenty-four rooms, the page they are picked on and its free
 * locks arrived here, and one slide cannot stand in two places.
 */
const RELEASE_18: TSlideEntry[] = [
  {
    id: 'compact-player',
    titleKey: 'tour.player.title',
    subtitleKey: 'tour.player.subtitle',
    Body: CompactPlayerSlide,
  },
  {
    id: 'game-presets',
    titleKey: 'tour.games.title',
    subtitleKey: 'tour.games.subtitle',
    Body: GamePresetsSlide,
  },
  {
    id: 'presets',
    titleKey: 'tour.presets.title',
    subtitleKey: 'tour.presets.subtitle',
    Body: PresetsSlide,
  },
  ROOM,
  {
    id: 'tone',
    titleKey: 'tour.tone.title',
    subtitleKey: 'tour.tone.subtitle',
    Body: ToneSlide,
  },
  {
    id: 'studio',
    titleKey: 'tour.studio.title',
    subtitleKey: 'tour.studio.subtitle',
    Body: StudioSlide,
  },
  {
    id: 'guide-search',
    titleKey: 'tour.help.title',
    subtitleKey: 'tour.help.subtitle',
    Body: GuideSearchSlide,
  },
];

const announced = (release: string, entries: TSlideEntry[]): ITourSlide[] =>
  entries.map((entry) => ({ ...entry, release }));

/**
 * What each feature release shows as new, keyed by `major.minor`.
 *
 * Only the big things go here: an engine, a membership, a theme, a whole new
 * way of using the window. A release whose changes are all fixes and small
 * additions has no entry, and the tour opens with the standing slides alone.
 *
 * A release also keeps showing the release before it as new, under its own
 * number (Ivan, 2026-09-22: "keep all new stuffs still new"): a week after 1.7
 * most people had not met its slides yet, and the version they are coming
 * from decides what is new to them, not the version they are going to.
 */
const NEW_BY_RELEASE: Record<string, ITourSlide[]> = {
  '1.6': announced('1.6', [SECOND_OUTPUT, BLACK_THEME, SHARE_AUDIO]),
  '1.7': announced('1.7', RELEASE_17),
  '1.8': [
    ...announced('1.8', RELEASE_18),
    ...announced(
      '1.7',
      RELEASE_17.filter((entry) => !RELEASE_18.includes(entry)),
    ),
  ],
};

/**
 * The standing slides: everything that has been here a while, for whoever has
 * never opened it. A release's new slides join this list once the next
 * release takes their place, so nothing announced once disappears from the
 * tour. Always after the new ones, always in this order: the most recent
 * arrivals first, then the tabs, ending on Online Media so the tour closes on
 * the thing most people came for.
 */
const ALWAYS: TSlideEntry[] = [
  RAINBOW_MODE,
  SECOND_OUTPUT,
  BLACK_THEME,
  SHARE_AUDIO,
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

export const featureTourFor = (version: string): ITourSlide[] => {
  const featured = NEW_BY_RELEASE[featureTourKey(version)] ?? [];
  const featuredIds = new Set(featured.map((entry) => entry.id));
  return [...featured, ...ALWAYS.filter((entry) => !featuredIds.has(entry.id))];
};
