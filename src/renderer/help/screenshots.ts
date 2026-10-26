/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import online from '../../../docs/01-online-media-youtube-live-eq.png';
import eq from '../../../docs/03-eq-parametric-bands-and-live-response.png';
import headphones from '../../../docs/04-eq-headphone-correction-and-import.png';
import convolution from '../../../docs/05-eq-convolution-library.png';
import config from '../../../docs/06-eq-equalizer-apo-config.png';
import library from '../../../docs/08-library-artists-and-up-next.png';
import queue from '../../../docs/09-library-album-and-play-queue.png';
import karaoke from '../../../docs/11-karaoke-player.png';
import maker from '../../../docs/12-karaoke-maker-pitch-and-lyrics.png';
import denoise from '../../../docs/13-dsp-denoise-and-source-analysis.png';
import engine from '../../../docs/15-engine-dialog.png';
import bands from '../../../docs/16-eq-bands.png';
import bandMenu from '../../../docs/17-band-menu.png';
import eqMode from '../../../docs/18-eq-mode.png';
import bandDesigns from '../../../docs/19-band-designs.png';
import dsp from '../../../docs/20-dsp.png';
import room from '../../../docs/32-dsp-room.png';
import strip from '../../../docs/21-graph-strip.png';
import stripPlus from '../../../docs/22-graph-strip-plus.png';
import viewMenu from '../../../docs/23-graph-view-menu.png';
import makerTools from '../../../docs/33-karaoke-maker-tools.png';
import makerLyrics from '../../../docs/34-karaoke-maker-lyrics.png';
import makerToolbar from '../../../docs/35-karaoke-maker-toolbar.png';
import bandSelected from '../../../docs/36-eq-band-selected.png';
import railLeft from '../../../docs/39-rail-left.png';
import railRight from '../../../docs/40-rail-right.png';
import games from '../../../docs/41-game-presets.png';
import type { THelpPicture } from '../../common/helpGuide';

/**
 * Every capture, one set: taken at the middle of the Brightness slider, where
 * one picture reads on a dark window and a light one (2026-09-29; the Light
 * theme's twins went with the themes). Static imports make webpack include
 * each one in offline packaged builds.
 *
 * A live figure's still is not here: the app draws that figure from its own
 * components (`HelpLiveFigure`), and only the exported guide shows the still.
 */
const SHOTS: Record<THelpPicture, string> = {
  '01-online-media-youtube-live-eq.png': online,
  '03-eq-parametric-bands-and-live-response.png': eq,
  '04-eq-headphone-correction-and-import.png': headphones,
  '05-eq-convolution-library.png': convolution,
  '06-eq-equalizer-apo-config.png': config,
  '08-library-artists-and-up-next.png': library,
  '09-library-album-and-play-queue.png': queue,
  '11-karaoke-player.png': karaoke,
  '12-karaoke-maker-pitch-and-lyrics.png': maker,
  '13-dsp-denoise-and-source-analysis.png': denoise,
  '15-engine-dialog.png': engine,
  '16-eq-bands.png': bands,
  '17-band-menu.png': bandMenu,
  '18-eq-mode.png': eqMode,
  '19-band-designs.png': bandDesigns,
  '20-dsp.png': dsp,
  '32-dsp-room.png': room,
  '21-graph-strip.png': strip,
  '22-graph-strip-plus.png': stripPlus,
  '23-graph-view-menu.png': viewMenu,
  '33-karaoke-maker-tools.png': makerTools,
  '34-karaoke-maker-lyrics.png': makerLyrics,
  '35-karaoke-maker-toolbar.png': makerToolbar,
  '36-eq-band-selected.png': bandSelected,
  '39-rail-left.png': railLeft,
  '40-rail-right.png': railRight,
  '41-game-presets.png': games,
};

/** A capture, as the guide shows it. */
const helpScreenshot = (image: THelpPicture): string => SHOTS[image];

export default helpScreenshot;
