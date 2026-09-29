/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type Translate } from '../../common/i18n';

interface IMakerErrorTextInput {
  t: Translate;
}

/**
 * The sentence a Maker failure is reported with, in the listener's
 * language: an error's own message is matched to what went wrong (the
 * audio's limits, a missing component, an old project, an unreadable
 * lyric file, a failed model download) and never shown as it came.
 */
const makerErrorText = ({ t }: IMakerErrorTextInput) => {
  const localizeMakerError = (
    error: unknown,
    context: 'analysis' | 'export' | 'import' | 'whisper',
  ): string => {
    const message = error instanceof Error ? error.message : String(error);
    if (/1 GB|30 minutes/i.test(message)) {
      return t('karaoke.maker.errorAudioLimits');
    }
    if (/unavailable|AudioContext|WASM|Basic Pitch model/i.test(message)) {
      return t('karaoke.maker.errorComponentUnavailable');
    }
    if (/unsupported FluidEQ Karaoke Maker project version/i.test(message)) {
      return t('karaoke.maker.errorProjectVersion');
    }
    if (/Unsupported lyric extension|could not be parsed/i.test(message)) {
      return t('karaoke.maker.errorParse');
    }
    if (
      context === 'whisper' &&
      /Hugging Face|download|fetch|network/i.test(message)
    ) {
      return t('karaoke.maker.whisperDownloadError');
    }
    if (context === 'export') {
      return /at least one melody note/i.test(message)
        ? t('karaoke.maker.errorExportNeedsNotes')
        : t('karaoke.maker.errorExport');
    }
    if (context === 'import') {
      return t('karaoke.maker.errorImport');
    }
    return t('karaoke.maker.errorAnalysis');
  };

  return { localizeMakerError };
};

export default makerErrorText;
