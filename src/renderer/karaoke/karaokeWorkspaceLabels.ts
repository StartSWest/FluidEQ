/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TKaraokeSessionError } from './useKaraokeSession';
import { TranslationKey } from '../../common/i18n';

// What the workspace calls a session's failure and a song's source, by the
// key each is translated under.

export const ERROR_KEYS: Record<TKaraokeSessionError, TranslationKey> = {
  'missing-audio': 'karaoke.error.missingAudio',
  ambiguous: 'karaoke.error.ambiguous',
  unsupported: 'karaoke.error.unsupported',
  read: 'karaoke.error.read',
  playback: 'karaoke.error.playback',
};

export const SOURCE_KEYS: Record<string, TranslationKey> = {
  'audio-only': 'karaoke.source.audioOnly',
  lrc: 'karaoke.source.lrc',
  elrc: 'karaoke.source.elrc',
  ultrastar: 'karaoke.source.ultrastar',
};
