/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every language the local Whisper large-v3 model was trained on, the app's
 * ten UI locales first.
 *
 * The model's own set rather than a curation: offering fewer than the model
 * supports would be a transcription dropdown lying about the detector, and
 * offering fewer than this would be a translation dropdown lying about what
 * a lyric sheet can be tagged. Two call sites need exactly this list —
 * `KaraokeMakerWizard`'s transcription-source picker and the lyrics paste
 * view's translation-target picker — and shared here rather than declared
 * twice, so the two cannot quietly drift into disagreeing about what the
 * local model actually supports.
 */
const KARAOKE_LANGUAGE_CODES = [
  ...['es', 'en', 'de', 'fr', 'it', 'pt', 'ru', 'ja', 'zh', 'hi'],
  ...(
    'af am ar as az ba be bg bn bo br bs ca cs cy da el et eu fa fi fo gl ' +
    'gu ha haw he hr ht hu hy id is jw ka kk km kn ko la lb ln lo lt lv mg ' +
    'mi mk ml mn mr ms mt my ne nl nn no oc pa pl ps ro sa sd si sk sl sn ' +
    'so sq sr su sv sw ta te tg th tk tl tr tt uk ur uz vi yi yo yue'
  ).split(' '),
];

export default KARAOKE_LANGUAGE_CODES;
