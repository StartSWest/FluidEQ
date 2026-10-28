/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Compact player's picture in What's New plays (`PlayerPicture`):
 * made-up songs by made-up artists, never real music, with covers drawn here
 * rather than taken from anybody's album, and the levels a listener's
 * sound might stand at. The player's harness plays the same albums
 * (`.claude/harness-player`, `?songs=demo`), so a picture of one and the
 * other tell the same story.
 */

import type { GraphStyle } from 'common/graphStyles';
import type { TranslationKey } from 'common/i18n';

const cover = (body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240">${body}</svg>`,
  )}`;

const COVERS = {
  // A sea at dusk under a low sun.
  coastlines: cover(
    '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a6b"/><stop offset=".55" stop-color="#e2718a"/><stop offset=".56" stop-color="#1d4f7a"/><stop offset="1" stop-color="#0b1c33"/></linearGradient></defs>' +
      '<rect width="120" height="120" fill="url(#s)"/><circle cx="60" cy="64" r="16" fill="#ffd3a1" opacity=".92"/>' +
      '<rect y="66" width="120" height="54" fill="#12375c" opacity=".92"/>' +
      '<g stroke="#ffd3a1" stroke-width="1.4" opacity=".55"><path d="M40 74h40M46 80h28M52 86h16"/></g>',
  ),
  // A cut-paper moon on warm paper.
  paperMoons: cover(
    '<rect width="120" height="120" fill="#f1e2c8"/><circle cx="62" cy="54" r="30" fill="#e4a95c"/>' +
      '<circle cx="74" cy="46" r="27" fill="#f1e2c8"/><path d="M0 96 Q30 84 60 96 T120 96 V120 H0Z" fill="#2f4a5c"/>' +
      '<path d="M0 104 Q30 94 60 104 T120 104 V120 H0Z" fill="#1d3140"/>',
  ),
  // A night grid under a pink storm.
  neonWeather: cover(
    '<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12002b"/><stop offset="1" stop-color="#3a0a52"/></linearGradient></defs>' +
      '<rect width="120" height="120" fill="url(#n)"/><circle cx="60" cy="52" r="24" fill="#ff3fa4" opacity=".85"/>' +
      '<g stroke="#27e2ff" stroke-width="1" opacity=".8"><path d="M0 78h120M0 88h120M0 100h120M0 114h120"/>' +
      '<path d="M60 78 L10 120M60 78 L35 120M60 78 L60 120M60 78 L85 120M60 78 L110 120"/></g>',
  ),
  // Green water in long bands.
  slowCurrents: cover(
    '<rect width="120" height="120" fill="#0e3b3a"/>' +
      '<g fill="none" stroke-width="7" stroke-linecap="round"><path d="M-10 30 Q30 14 60 30 T130 30" stroke="#3fb58f"/>' +
      '<path d="M-10 52 Q30 36 60 52 T130 52" stroke="#6fd1a8"/><path d="M-10 74 Q30 58 60 74 T130 74" stroke="#a5e8c2"/>' +
      '<path d="M-10 96 Q30 80 60 96 T130 96" stroke="#e4f7d9"/></g>',
  ),
  // Rings from one point, in warm light.
  frequencies: cover(
    '<rect width="120" height="120" fill="#1a1110"/>' +
      '<g fill="none" stroke="#ff8a3d"><circle cx="38" cy="82" r="10" stroke-width="3"/><circle cx="38" cy="82" r="24" stroke-width="2.4" opacity=".8"/>' +
      '<circle cx="38" cy="82" r="40" stroke-width="1.8" opacity=".6"/><circle cx="38" cy="82" r="58" stroke-width="1.2" opacity=".4"/>' +
      '<circle cx="38" cy="82" r="78" stroke-width=".8" opacity=".25"/></g>',
  ),
};

export interface IPictureSong {
  title: string;
  artist: string;
  cover: string;
  durationMs: number;
}

/**
 * The queue as Up next lists it: one song already played, the one playing,
 * and what comes after — more than the shelf shows, as a real queue is.
 */
export const PICTURE_QUEUE: readonly IPictureSong[] = [
  {
    title: 'Paper Moons',
    artist: 'Kestrel Bay',
    cover: COVERS.paperMoons,
    durationMs: 226_000,
  },
  {
    title: 'Afterglow Avenue',
    artist: 'Velvet Circuit',
    cover: COVERS.neonWeather,
    durationMs: 245_000,
  },
  {
    title: 'Low Orbit',
    artist: 'Velvet Circuit',
    cover: COVERS.neonWeather,
    durationMs: 302_000,
  },
  {
    title: 'Tidewater',
    artist: 'Mono Atlas',
    cover: COVERS.slowCurrents,
    durationMs: 204_000,
  },
  {
    title: 'Summer in Reverse',
    artist: 'Mono Atlas',
    cover: COVERS.slowCurrents,
    durationMs: 219_000,
  },
  {
    title: 'Lanterns',
    artist: 'Aurora Lane',
    cover: COVERS.coastlines,
    durationMs: 235_000,
  },
  {
    title: 'Static Hearts',
    artist: 'Northbound Echo',
    cover: COVERS.frequencies,
    durationMs: 198_000,
  },
];

/** Which of `PICTURE_QUEUE` is playing. */
export const PICTURE_NOW = 1;

/** Where in it: three minutes and thirteen seconds into four minutes five. */
export const PICTURE_POSITION_MS = 193_000;

/** What Up next's tabs read: the whole queue's length and what is left of it. */
export const PICTURE_QUEUE_COUNT = 14;
export const PICTURE_QUEUE_LEFT_MS = 2_360_000;
export const PICTURE_PLAYLIST_COUNT = 1;

/** The level the song's chip reads, in dB. */
export const PICTURE_LEVEL_DB = -7.1;

/** The computer's volume, in percent. */
export const PICTURE_VOLUME = 64;

/**
 * The output the foot names, in the reader's language as Windows names its
 * own outputs: an English "Headphones" stood in the Russian and Japanese
 * guides beside every other word translated.
 */
export const PICTURE_OUTPUT: TranslationKey = 'tour.engine.flow.headphones';

/** The preamp, which Auto normalize is setting. */
export const PICTURE_PREAMP_DB = -2;

/** A ten-band EQ with a little lift at both ends, as a listener tunes one. */
export const PICTURE_BANDS: readonly { hz: number; gain: number }[] = [
  { hz: 32, gain: 3.5 },
  { hz: 63, gain: 2.8 },
  { hz: 125, gain: 1.2 },
  { hz: 250, gain: -0.4 },
  { hz: 500, gain: -1.2 },
  { hz: 1000, gain: -0.6 },
  { hz: 2000, gain: 0.5 },
  { hz: 4000, gain: 1.8 },
  { hz: 8000, gain: 2.9 },
  { hz: 16000, gain: 2.2 },
];

/** The Tone, turned a little: warmer at the bottom, brighter at the top. */
export const PICTURE_TONE = { bass: 3, mid: -1, treble: 2 } as const;

/** The standard look in the second picture's panel. */
export const PICTURE_LOOK: GraphStyle = 'synthwave';

/**
 * The scene behind the first picture, as the player's look picker names and
 * colours it: an aurora over mountains, named as a scene would be.
 */
export const PICTURE_SCENE = {
  name: 'Northern Lights',
  swatch: ['#1af2b3', '#408cff', '#d94cf2', '#0a1a3d'],
} as const;

/**
 * What the player's picture layer is set to at this size, as `PlayerStage`
 * measures it in the window: where the transport's frost begins and how far
 * it fades in, and the foot the scrim holds dark from (480 x 966, measured in
 * the player's harness).
 */
export const PICTURE_STAGE_LAYER = {
  '--player-panel-foot': '346px',
  '--player-frost-top': '218px',
  '--player-frost-ramp': '128px',
} as const;

/** The player's own width, and the height the pictures stand at. */
export const PICTURE_WIDTH = 480;
export const PICTURE_HEIGHT = 966;
