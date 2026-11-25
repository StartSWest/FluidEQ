/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { ComponentType } from 'react';
import type { THelpLiveId } from 'common/helpGuide';
import {
  PlayerDrawing,
  PlayerFoldDrawing,
  PlayerMenuDrawing,
} from './playerFigures';
import BandDesignsDrawing from './bandDesignsFigure';
import ConfigDrawing from './configFigure';
import ConvolutionDrawing from './convolutionFigure';
import DesktopDialogDrawing from './desktopFigures';
import {
  BandMenuDrawing,
  EqBandPopoverDrawing,
  EqPageDrawing,
} from './eqPageFigures';
import { DynamicsDrawing, DeEsserDrawing } from './dspFigures';
import DspOverviewDrawing from './dspOverviewFigure';
import EngineDialogDrawing from './engineFigure';
import { DenoiseDrawing, RoomDrawing } from './dspStageFigures';
import ForumDrawing from './forumFigures';
import GamingLabDrawing, { GamingPartsDrawing } from './gamingFigures';
import GamingProfilesDrawing from './gamingProfilesFigure';
import { LibraryPageDrawing, LibraryRecordDrawing } from './libraryFigures';
import { LibraryLyricsDrawing } from './libraryPaneFigures';
import LibraryTagsDrawing from './libraryTagFigure';
import KaraokeDrawing from './karaokeFigures';
import {
  KaraokeMicDrawing,
  KaraokeMixDrawing,
  KaraokeScoreDrawing,
} from './karaokePanelFigures';
import MakerDrawing from './makerFigures';
import { MakerLyricsDrawing, MakerToolsDrawing } from './makerPanelFigures';
import {
  GraphSceneDrawing,
  GraphStyleDrawing,
  GraphViewMenuDrawing,
} from './graphFigures';
import LightingDrawing from './lightingFigures';
import LookPickerDrawing from './lookFigures';
import RailDrawing from './railFigures';
import MicPageDrawing from './micFigures';
import OnlineMediaDrawing from './onlineFigure';
import { SceneDrawing, VisualizersDrawing } from './plusFigures';
import ShareDrawing from './shareFigures';
import SoundPanelDrawing from './soundPanelFigures';
import StudioDrawing from './studioFigures';
import TroubleDrawing from './troubleFigure';
import HeadphonesDrawing from './headphonesFigure';
import WindowHeaderDrawing from './windowFigures';

/**
 * Every live figure's drawing, by the name its chapter gives it
 * (`helpChapters/*.ts`, `live:`). Typed by those names, so a chapter that
 * names a drawing this list does not have fails to build, and one this list
 * keeps after its chapter dropped it fails too.
 *
 * A drawing is a component with no props that draws its panel the way the
 * app does, from made-up content — songs, outputs, curves, computers — and
 * never from the reader's own: it can show a whole panel and leave the
 * framing to its figures, as the player's does. Whatever it renders is
 * inert, hidden from assistive tech and scaled by the figure
 * (`HelpLiveSurface`); `helpLiveFigures.test.tsx` draws every one in every
 * language and fails on a drawing that throws or a control it cannot find.
 */
const HELP_LIVE_FIGURES: Readonly<Record<THelpLiveId, ComponentType>> = {
  'config-page': ConfigDrawing,
  'convolution-page': ConvolutionDrawing,
  'desktop-dialog': DesktopDialogDrawing,
  'dsp-deesser': DeEsserDrawing,
  'dsp-denoise': DenoiseDrawing,
  'dsp-dynamics': DynamicsDrawing,
  'dsp-overview': DspOverviewDrawing,
  'dsp-room': RoomDrawing,
  'engine-dialog': EngineDialogDrawing,
  'eq-band-menu': BandMenuDrawing,
  'eq-band-popover': EqBandPopoverDrawing,
  'eq-bands': EqPageDrawing,
  'eq-page': EqPageDrawing,
  'eq-tab-row': EqPageDrawing,
  'eqmode-card': SoundPanelDrawing,
  'eqmode-designs': BandDesignsDrawing,
  'forum-page': ForumDrawing,
  'gallery-scene': SceneDrawing,
  'gaming-lab': GamingLabDrawing,
  'gaming-parts': GamingPartsDrawing,
  'gaming-profiles': GamingProfilesDrawing,
  'graph-scene': GraphSceneDrawing,
  'graph-style': GraphStyleDrawing,
  'graph-view-menu': GraphViewMenuDrawing,
  'header-left': WindowHeaderDrawing,
  'header-right': WindowHeaderDrawing,
  'headphones-page': HeadphonesDrawing,
  'karaoke-mic': KaraokeMicDrawing,
  'karaoke-mix': KaraokeMixDrawing,
  'karaoke-playlist': KaraokeDrawing,
  'karaoke-score': KaraokeScoreDrawing,
  'karaoke-stage': KaraokeDrawing,
  'library-lyrics': LibraryLyricsDrawing,
  'library-page': LibraryPageDrawing,
  'library-queue': LibraryRecordDrawing,
  'library-record': LibraryRecordDrawing,
  'library-tags-changes': LibraryTagsDrawing,
  'library-tags': LibraryTagsDrawing,
  'lighting-page': LightingDrawing,
  'lighting-tuning': LightingDrawing,
  'look-picker': LookPickerDrawing,
  'maker-bar': MakerDrawing,
  'maker-editor': MakerDrawing,
  'maker-lyrics': MakerLyricsDrawing,
  'maker-tools': MakerToolsDrawing,
  'mic-page': MicPageDrawing,
  'online-page': OnlineMediaDrawing,
  'player-folded': PlayerFoldDrawing,
  'player-menu': PlayerMenuDrawing,
  'player-queue': PlayerDrawing,
  'player-sound': PlayerDrawing,
  'player-top': PlayerDrawing,
  'rail-left': RailDrawing,
  'share-page': ShareDrawing,
  'sound-panel': SoundPanelDrawing,
  'studio-bench': StudioDrawing,
  'trouble-notice': TroubleDrawing,
  'visualizers-gallery': VisualizersDrawing,
  'visualizers-rail': VisualizersDrawing,
};

const DRAWINGS: ReadonlyMap<string, ComponentType> = new Map(
  Object.entries(HELP_LIVE_FIGURES),
);

/** A figure's drawing by the name its chapter gives it. */
export const helpLiveDrawing = (live: string): ComponentType | undefined =>
  DRAWINGS.get(live);

export default HELP_LIVE_FIGURES;
