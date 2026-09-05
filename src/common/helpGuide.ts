/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Screenshot names are shared by the shipped reader and the exported document. */
export const HELP_CHAPTERS = (
  [
    { id: 'start', image: '03-eq-parametric-bands-and-live-response.png' },
    { id: 'eq', image: '03-eq-parametric-bands-and-live-response.png' },
    { id: 'headphones', image: '04-eq-headphone-correction-and-import.png' },
    { id: 'convolution', image: '05-eq-convolution-library.png' },
    {
      id: 'profiles',
      image: '02-online-media-multiple-outputs-one-player-at-a-time.png',
    },
    { id: 'config', image: '06-eq-equalizer-apo-config.png' },
    { id: 'online', image: '01-online-media-youtube-live-eq.png' },
    {
      id: 'share',
      image: '14-share-audio-roles.png',
      width: 1976,
      height: 410,
    },
    { id: 'library', image: '08-library-artists-and-up-next.png' },
    { id: 'queue', image: '09-library-album-and-play-queue.png' },
    { id: 'dsp', image: '07-dsp-maximizer-and-processing-chain.png' },
    { id: 'denoise', image: '13-dsp-denoise-and-source-analysis.png' },
    { id: 'visuals', image: '10-library-customize-visualizer.png' },
    { id: 'karaoke', image: '11-karaoke-player.png' },
    { id: 'maker', image: '12-karaoke-maker-pitch-and-lyrics.png' },
    { id: 'trouble', image: '06-eq-equalizer-apo-config.png' },
  ] as const
).map((chapter) => ({ width: 2560, height: 1392, ...chapter }));

export type HelpChapterId = (typeof HELP_CHAPTERS)[number]['id'];
