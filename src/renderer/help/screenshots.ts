/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import online from '../../../docs/01-online-media-youtube-live-eq.png';
import outputs from '../../../docs/02-online-media-multiple-outputs-one-player-at-a-time.png';
import eq from '../../../docs/03-eq-parametric-bands-and-live-response.png';
import headphones from '../../../docs/04-eq-headphone-correction-and-import.png';
import convolution from '../../../docs/05-eq-convolution-library.png';
import config from '../../../docs/06-eq-equalizer-apo-config.png';
import dsp from '../../../docs/07-dsp-maximizer-and-processing-chain.png';
import library from '../../../docs/08-library-artists-and-up-next.png';
import queue from '../../../docs/09-library-album-and-play-queue.png';
import visuals from '../../../docs/10-library-customize-visualizer.png';
import karaoke from '../../../docs/11-karaoke-player.png';
import maker from '../../../docs/12-karaoke-maker-pitch-and-lyrics.png';
import denoise from '../../../docs/13-dsp-denoise-and-source-analysis.png';
import share from '../../../docs/14-share-audio-roles.png';
import type { HelpChapterId } from '../../common/helpGuide';

/** Static imports make webpack include every capture in offline packaged builds. */
const screenshots: Record<HelpChapterId, string> = {
  start: eq,
  eq,
  headphones,
  convolution,
  profiles: outputs,
  config,
  online,
  share,
  library,
  queue,
  dsp,
  denoise,
  visuals,
  karaoke,
  maker,
  trouble: config,
};

export default screenshots;
