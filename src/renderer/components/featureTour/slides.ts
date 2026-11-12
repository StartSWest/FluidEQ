/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { ComponentType } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { featureTourKey, type TTourPart } from '../../../common/featureTour';
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
import {
  DesktopVisualizerSlide,
  DynamicLightingSlide,
  FluidEngineSlide,
  PlusSlide,
  RoomSlide,
  VisualizersSlide,
} from './release17';
import {
  GraphViewsSlide,
  GuideSearchSlide,
  LookSlide,
  PresetsSlide,
  StudioSlide,
  ToneSlide,
} from './release18';
import {
  EngineSoundSlide,
  SparksSlide,
  VisualizerEngineSlide,
} from './release20';
import {
  BandsSlide,
  CompactPlayerSlide,
  DeEsserSlide,
  EarsSlide,
  MyCurvesSlide,
  OutputsSlide,
  SongsSlide,
  StudioChatSlide,
} from './release21';
import KaraokeBackgroundSlide, { LanguagesSlide, TraySlide } from './release22';
import GamingLabSlide from './release23';
import {
  AnimationsSlide,
  CameraSlide,
  PicturesSlide,
  SceneControlsSlide,
  StageSlide,
  StudioAiSlide,
} from './release24';
import SignedSlide from './release25Sound';
import SongLevelSlide from './release24Sound';
import {
  CodeSlide,
  EditSlide,
  FullscreenSlide,
  MakersSlide,
  WatchSlide,
} from './release25';
import WalkthroughSlide, { WALKTHROUGH_FILM } from './WalkthroughSlide';

/**
 * The workspace tabs a slide can send the user to. `community` is Plus;
 * `games` is the Gaming Lab, and `presets` the EQ's Presets.
 */
export type TTourTab =
  | 'eq'
  | 'presets'
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
  /**
   * Which What's New the slide is in. Absent is the sound's, which opens
   * after an update; `visuals` is the Visualizers tab's own: scenes, the
   * Gallery, the Studio, desktop backgrounds and lighting (Ivan, 2026-11-11:
   * "nothing to do with the visualizer, never").
   */
  part?: TTourPart;
  Body: ComponentType<{ actions: ISlideActions }>;
}

type TSlideEntry = Omit<ITourSlide, 'release'>;

const SECOND_OUTPUT: TSlideEntry = {
  id: 'second-output',
  titleKey: 'tour.output.title',
  subtitleKey: 'tour.output.subtitle',
  Body: SecondOutputSlide,
};

const SHARE_AUDIO: TSlideEntry = {
  id: 'share-audio',
  titleKey: 'tour.share.title',
  subtitleKey: 'tour.share.subtitle',
  Body: ShareAudioSlide,
};

const ROOM: TSlideEntry = {
  id: 'room',
  titleKey: 'tour.room.title',
  subtitleKey: 'tour.room.subtitle',
  Body: RoomSlide,
};

/**
 * 2.0 announced the Compact player as two players; 2.1 made them one (Ivan,
 * 2026-10-25), and the slide moves up to say so, as the Room's did.
 */
const COMPACT_PLAYER: TSlideEntry = {
  id: 'compact-player',
  titleKey: 'tour.player.title',
  subtitleKey: 'tour.player.subtitle',
  Body: CompactPlayerSlide,
};

/**
 * 2.0 announced a game's own sound as presets switched by the game in front;
 * 2.3's Gaming Lab gives each game its own copy, tuned on one page (Ivan,
 * 2026-11-04), and the slide moves up to say so. Its id stays the one 2.0
 * gave it, so a reader who has seen 2.0's is not shown two games slides.
 */
const GAMING_LAB: TSlideEntry = {
  id: 'game-presets',
  titleKey: 'tour.games.title',
  subtitleKey: 'tour.games.subtitle',
  Body: GamingLabSlide,
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
    part: 'visuals',
    titleKey: 'tour.plus.title',
    subtitleKey: 'tour.plus.subtitle',
    Body: PlusSlide,
  },
  {
    id: 'visualizers',
    part: 'visuals',
    titleKey: 'tour.visualizers.title',
    subtitleKey: 'tour.visualizers.subtitle',
    Body: VisualizersSlide,
  },
  {
    id: 'desktop-visualizer',
    part: 'visuals',
    titleKey: 'tour.desktop.title',
    subtitleKey: 'tour.desktop.subtitle',
    Body: DesktopVisualizerSlide,
  },
  {
    id: 'dynamic-lighting',
    part: 'visuals',
    titleKey: 'tour.lighting.title',
    subtitleKey: 'tour.lighting.subtitle',
    Body: DynamicLightingSlide,
  },
];

/**
 * 2.0, prepared as 1.8 and never released under that number, which is why
 * most of its slides live in `release18.tsx` (the later ones in
 * `release20.tsx`). In the order Ivan named what 2.0 is (2026-09-28): the new
 * look, which is the first thing anyone sees; the visualizers' new engine and
 * the sparks they throw; the presets and the engine that plays them; the
 * Room; games; then the Compact player and the rest. The Room moves up into
 * this release: thirteen of its twenty-four rooms, the page they are picked
 * on and its free locks arrived here, and one slide cannot stand in two
 * places. The Dark theme's slide went with the two themes: the theme is one
 * slider now, and the new look's slide shows it.
 */
const RELEASE_20: TSlideEntry[] = [
  {
    id: 'new-look',
    titleKey: 'tour.look.title',
    subtitleKey: 'tour.look.subtitle',
    Body: LookSlide,
  },
  {
    id: 'visualizer-engine',
    part: 'visuals',
    titleKey: 'tour.gpu.title',
    subtitleKey: 'tour.gpu.subtitle',
    Body: VisualizerEngineSlide,
  },
  {
    id: 'pointer-sparks',
    part: 'visuals',
    titleKey: 'tour.sparks.title',
    subtitleKey: 'tour.sparks.subtitle',
    Body: SparksSlide,
  },
  {
    id: 'presets',
    titleKey: 'tour.presets.title',
    subtitleKey: 'tour.presets.subtitle',
    Body: PresetsSlide,
  },
  {
    id: 'engine-sound',
    titleKey: 'tour.sound.title',
    subtitleKey: 'tour.sound.subtitle',
    Body: EngineSoundSlide,
  },
  ROOM,
  GAMING_LAB,
  COMPACT_PLAYER,
  {
    id: 'graph-views',
    titleKey: 'tour.graph.title',
    subtitleKey: 'tour.graph.subtitle',
    Body: GraphViewsSlide,
  },
  {
    id: 'tone',
    titleKey: 'tour.tone.title',
    subtitleKey: 'tour.tone.subtitle',
    Body: ToneSlide,
  },
  {
    id: 'studio',
    part: 'visuals',
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

/**
 * 2.1, in the order of what a listener meets first: every output keeping its
 * own sound, a band tuned for each ear, Share Audio both ways (its slide says
 * so now; it was a standing one), the one Compact player in place of 2.0's
 * two (its slide moved up), the bands read out on the graph with EQ mode
 * beside it, the listener's own list of curves beside OPRA's, songs that
 * remember their sound, the DSP rack's De-esser, and the Studio's chat.
 */
const RELEASE_21: TSlideEntry[] = [
  {
    id: 'every-output',
    titleKey: 'tour.outputs.title',
    subtitleKey: 'tour.outputs.subtitle',
    Body: OutputsSlide,
  },
  {
    id: 'each-ear',
    titleKey: 'tour.ears.title',
    subtitleKey: 'tour.ears.subtitle',
    Body: EarsSlide,
  },
  SHARE_AUDIO,
  COMPACT_PLAYER,
  {
    id: 'band-labels',
    titleKey: 'tour.bands.title',
    subtitleKey: 'tour.bands.subtitle',
    Body: BandsSlide,
  },
  {
    id: 'my-curves',
    titleKey: 'tour.myCurves.title',
    subtitleKey: 'tour.myCurves.subtitle',
    Body: MyCurvesSlide,
  },
  {
    id: 'song-sound',
    titleKey: 'tour.songs.title',
    subtitleKey: 'tour.songs.subtitle',
    Body: SongsSlide,
  },
  {
    id: 'de-esser',
    titleKey: 'tour.deesser.title',
    subtitleKey: 'tour.deesser.subtitle',
    Body: DeEsserSlide,
  },
  {
    id: 'studio-chat',
    part: 'visuals',
    titleKey: 'tour.chat.title',
    subtitleKey: 'tour.chat.subtitle',
    Body: StudioChatSlide,
  },
];

/**
 * 2.2: the walkthrough of the whole app first, then Karaoke's backdrop,
 * starting in the tray and the two new languages.
 */
const RELEASE_22: TSlideEntry[] = [
  {
    id: WALKTHROUGH_FILM,
    titleKey: 'tour.walkthrough.title',
    subtitleKey: 'tour.walkthrough.subtitle',
    Body: WalkthroughSlide,
  },
  {
    id: 'karaoke-background',
    part: 'visuals',
    titleKey: 'tour.karaokeBackground.title',
    subtitleKey: 'tour.karaokeBackground.subtitle',
    Body: KaraokeBackgroundSlide,
  },
  {
    id: 'tray-start',
    titleKey: 'tour.tray.title',
    subtitleKey: 'tour.tray.subtitle',
    Body: TraySlide,
  },
  {
    id: 'languages',
    titleKey: 'tour.languages.title',
    subtitleKey: 'tour.languages.subtitle',
    Body: LanguagesSlide,
  },
];

/** 2.3: the Gaming Lab. */
const RELEASE_23: TSlideEntry[] = [GAMING_LAB];

/**
 * 2.4: the Studio first and most of all (Ivan, 2026-11-09: "whats new very
 * big the new studio capability and all that is posible to do with it") -
 * its animations, the pictures in its chat, its stage, its AI and what a
 * scene hands the member to tune - then the visualizers' camera, on the
 * graph and the desktop, with the rest of the release listed under it.
 */
const RELEASE_24: TSlideEntry[] = [
  {
    id: 'studio-animations',
    part: 'visuals',
    titleKey: 'tour.animations.title',
    subtitleKey: 'tour.animations.subtitle',
    Body: AnimationsSlide,
  },
  {
    id: 'studio-pictures',
    part: 'visuals',
    titleKey: 'tour.pictures.title',
    subtitleKey: 'tour.pictures.subtitle',
    Body: PicturesSlide,
  },
  {
    id: 'studio-stage',
    part: 'visuals',
    titleKey: 'tour.stage.title',
    subtitleKey: 'tour.stage.subtitle',
    Body: StageSlide,
  },
  {
    id: 'studio-ai',
    part: 'visuals',
    titleKey: 'tour.ai.title',
    subtitleKey: 'tour.ai.subtitle',
    Body: StudioAiSlide,
  },
  {
    id: 'scene-controls',
    part: 'visuals',
    titleKey: 'tour.controls.title',
    subtitleKey: 'tour.controls.subtitle',
    Body: SceneControlsSlide,
  },
  {
    id: 'scene-camera',
    part: 'visuals',
    titleKey: 'tour.camera.title',
    subtitleKey: 'tour.camera.subtitle',
    Body: CameraSlide,
  },
];

/**
 * 2.4's sound, announced from 2.5: its own tour listed it under the
 * visualizers' camera, and from 2.5 the What's New that opens after an update
 * is the sound's alone.
 */
const SONG_LEVEL: TSlideEntry = {
  id: 'song-level',
  titleKey: 'tour.level.title',
  subtitleKey: 'tour.level.subtitle',
  Body: SongLevelSlide,
};

/**
 * 2.5's visualizers, all of them in the Visualizers' own What's New: Edit
 * mode, full screen, the AI that watches a scene, Higgsfield and the Code tab,
 * with the rest of the release listed under the last.
 */
const RELEASE_25: TSlideEntry[] = [
  {
    id: 'studio-edit',
    part: 'visuals',
    titleKey: 'tour.edit.title',
    subtitleKey: 'tour.edit.subtitle',
    Body: EditSlide,
  },
  {
    id: 'studio-fullscreen',
    part: 'visuals',
    titleKey: 'tour.fullscreen.title',
    subtitleKey: 'tour.fullscreen.subtitle',
    Body: FullscreenSlide,
  },
  {
    id: 'studio-watch',
    part: 'visuals',
    titleKey: 'tour.watch.title',
    subtitleKey: 'tour.watch.subtitle',
    Body: WatchSlide,
  },
  {
    id: 'studio-makers',
    part: 'visuals',
    titleKey: 'tour.makers.title',
    subtitleKey: 'tour.makers.subtitle',
    Body: MakersSlide,
  },
  {
    id: 'studio-code',
    part: 'visuals',
    titleKey: 'tour.code.title',
    subtitleKey: 'tour.code.subtitle',
    Body: CodeSlide,
  },
];

/**
 * 2.5's news for everybody, at the head of the sound's What's New: the road
 * so far, how long FluidEQ has been alive, the walkthrough film, and that it
 * is now signed by its developer and keeps updating itself, free for everyone
 * (Ivan, 2026-11-11: no paid edition). Not visualizer news, so it is the
 * sound's.
 */
const SIGNED: TSlideEntry = {
  id: 'signed',
  titleKey: 'tour.signed.title',
  subtitleKey: 'tour.signed.subtitle',
  Body: SignedSlide,
};

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
  // The sound's What's New opens on 2.5's signing, then 2.4's sound,
  // never shown as a slide before; the Visualizers' opens on 2.5's own and
  // keeps 2.4 as new under its number.
  '2.5': [
    ...announced('2.5', [SIGNED]),
    ...announced('2.5', RELEASE_25),
    ...announced('2.4', [SONG_LEVEL]),
    ...announced('2.4', RELEASE_24),
    // Earlier features remain discoverable without being announced again.
    ...RELEASE_23,
    // The walkthrough film opens from 2.5's first page, so it is not shown twice.
    ...RELEASE_22.filter((entry) => entry.id !== WALKTHROUGH_FILM),
    ...RELEASE_21.filter((entry) => !RELEASE_23.includes(entry)),
    ...RELEASE_20.filter(
      (entry) => !RELEASE_21.includes(entry) && !RELEASE_23.includes(entry),
    ),
  ],
  '2.4': [
    ...announced('2.4', RELEASE_24),
    ...announced('2.3', RELEASE_23),
    // Earlier features remain discoverable without being announced again.
    ...RELEASE_22,
    ...RELEASE_21.filter((entry) => !RELEASE_23.includes(entry)),
    ...RELEASE_20.filter(
      (entry) => !RELEASE_21.includes(entry) && !RELEASE_23.includes(entry),
    ),
  ],
  '2.3': [
    ...announced('2.3', RELEASE_23),
    ...announced('2.2', RELEASE_22),
    // Earlier features remain discoverable without being announced again;
    // the games slide 2.0 announced is 2.3's now.
    ...RELEASE_21.filter((entry) => !RELEASE_23.includes(entry)),
    ...RELEASE_20.filter(
      (entry) => !RELEASE_21.includes(entry) && !RELEASE_23.includes(entry),
    ),
  ],
  '2.2': [
    ...announced('2.2', RELEASE_22),
    ...announced('2.1', RELEASE_21),
    // Earlier features remain discoverable without being announced again.
    ...RELEASE_20.filter((entry) => !RELEASE_21.includes(entry)),
  ],
  '1.6': announced('1.6', [SECOND_OUTPUT, SHARE_AUDIO]),
  '1.7': announced('1.7', RELEASE_17),
  '2.0': [
    ...announced('2.0', RELEASE_20),
    ...announced(
      '1.7',
      RELEASE_17.filter((entry) => !RELEASE_20.includes(entry)),
    ),
  ],
  // A slide 2.1 moved up is new under 2.1 alone, as the Room is under 2.0.
  '2.1': [
    ...announced('2.1', RELEASE_21),
    ...announced(
      '2.0',
      RELEASE_20.filter((entry) => !RELEASE_21.includes(entry)),
    ),
  ],
};

/**
 * 1.7's slides, standing from 2.1 on: two releases back, they are no longer
 * new to anyone coming from the one before, and nothing announced once leaves
 * the tour. The Room stays with 2.0, which announced most of it.
 */
const STANDING_17: TSlideEntry[] = RELEASE_17.filter(
  (entry) => !RELEASE_20.includes(entry),
);

/**
 * The standing slides: everything that has been here a while, for whoever has
 * never opened it. A release's new slides join this list once the next
 * release takes their place, so nothing announced once disappears from the
 * tour. Always after the new ones, always in this order: the most recent
 * arrivals first, then the tabs, ending on Online Media so the tour closes on
 * the thing most people came for.
 */
const ALWAYS: TSlideEntry[] = [
  ...STANDING_17,
  SECOND_OUTPUT,
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
    part: 'visuals',
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

/** A part's slides, in the tour's order. */
export const slidesOfPart = (
  slides: ITourSlide[],
  part: TTourPart,
): ITourSlide[] => slides.filter((slide) => (slide.part ?? 'sound') === part);

/**
 * The slides a part announces as new in this version, `major.minor`:
 * nothing when the release brought that part nothing.
 */
export const newInPart = (
  slides: ITourSlide[],
  part: TTourPart,
  version: string,
): ITourSlide[] =>
  slidesOfPart(slides, part).filter(
    (slide) => slide.release === featureTourKey(version),
  );
