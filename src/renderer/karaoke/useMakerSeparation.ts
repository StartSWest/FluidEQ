/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef, useState } from 'react';
import { TranslationKey } from '../../common/i18n';
import { IKaraokeMakerLicenseRecord } from '../../common/karaoke/makerProject';
import { separateVocals, TSeparationStage } from './makerSeparation/separate';
import {
  SEPARATION_MODEL_PROVENANCE,
  SEPARATION_RUNTIME_PROVENANCE,
  separationHasGpu,
} from './makerSeparation/separationModel';

interface IUseMakerSeparationOptions {
  /** The song as the user supplied it. Separation always reads this. */
  audioFile: File;
  /** Where the vocal stem goes; Whisper and pitch detection both read it. */
  setAnalysisFile: (file: File) => void;
  setAnalysisProgress: (progress?: number) => void;
  setAnalysisMessage: (message?: string) => void;
  setNotice: (message?: string) => void;
  localizeMakerError: (error: unknown, scope: 'analysis') => string;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  /**
   * Record what produced this stem, on the project.
   *
   * Not bookkeeping — the model is MIT, and MIT asks that the copyright notice
   * travel with the work. A project made using it carries the credit, the same
   * way it already does for Whisper and Basic Pitch.
   */
  recordProvenance: (records: readonly IKaraokeMakerLicenseRecord[]) => void;
  /**
   * Both stems, the moment a split succeeds.
   *
   * This is how the stems leave the Maker: the workspace swaps the playing
   * song's audio for the instrumental and files the voice beside it as a
   * `vocals` asset — the pair the player's guide-vocal fader is built on.
   * Without this call the split would exist only inside the editor.
   */
  onStems?: (stems: { vocals: File; instrumental: File }) => void;
}

const STAGE_MESSAGE: Record<TSeparationStage, TranslationKey> = {
  download: 'karaoke.maker.separationDownloading',
  decode: 'karaoke.maker.separationReading',
  separate: 'karaoke.maker.separating',
};

/**
 * Split the song into a voice and a backing track, on this machine.
 *
 * Kept apart from the analysis hook even though both write the same progress
 * bar, because they fail differently and one is a precondition of the other.
 * Separation is a single long compute with a large one-time download in front
 * of it; transcription is a model that may or may not be resident. Folding
 * them together produced a state machine where "downloading" could mean either
 * model and cancelling was ambiguous.
 *
 * The result is written to `analysisFile` rather than anywhere new. That is the
 * whole integration: the Maker already reads its analysis audio from there, so
 * a stem produced here is picked up by Whisper and by pitch detection with no
 * changes to either.
 */
export const useMakerSeparation = ({
  audioFile,
  setAnalysisFile,
  setAnalysisProgress,
  setAnalysisMessage,
  setNotice,
  localizeMakerError,
  t,
  recordProvenance,
  onStems,
}: IUseMakerSeparationOptions) => {
  const abortRef = useRef<AbortController | undefined>(undefined);
  const [isSeparating, setIsSeparating] = useState(false);
  const [instrumental, setInstrumental] = useState<File>();

  const cancelSeparation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = undefined;
  }, []);

  const removeBackground = useCallback(async () => {
    if (abortRef.current) {
      return undefined;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSeparating(true);
    setAnalysisProgress(0);
    setAnalysisMessage(t('karaoke.maker.separationReading'));
    // Said before the wait rather than after it. Without a GPU this is minutes
    // instead of well under one, and a user who learns that at the end has
    // already spent the time.
    if (!(await separationHasGpu())) {
      setNotice(t('karaoke.maker.separationSlow'));
    }
    try {
      const result = await separateVocals(
        audioFile,
        (progress, _message, stage) => {
          setAnalysisProgress(progress);
          setAnalysisMessage(
            t(STAGE_MESSAGE[stage], {
              percent: Math.round(progress * 100),
            }),
          );
        },
        controller.signal,
      );
      setAnalysisFile(result.vocals);
      setInstrumental(result.instrumental);
      recordProvenance([
        SEPARATION_MODEL_PROVENANCE,
        SEPARATION_RUNTIME_PROVENANCE,
      ]);
      onStems?.({ vocals: result.vocals, instrumental: result.instrumental });
      setNotice(t('karaoke.maker.separationDone'));
      return result;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setNotice(t('karaoke.maker.wizardCancelled'));
      } else {
        // The raw error, before it is flattened into a sentence for the user.
        // `localizeMakerError` maps anything unrecognised onto "could not
        // analyze this audio locally", which is fine to read and useless to
        // debug — a refused fetch, a missing WASM file and a decode failure
        // all arrive looking identical. Without this line the only signal a
        // failure leaves is that one sentence.
        // eslint-disable-next-line no-console
        console.error('[karaoke][separation] failed', error);
        setNotice(localizeMakerError(error, 'analysis'));
      }
      return undefined;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = undefined;
      }
      setIsSeparating(false);
      setAnalysisProgress(undefined);
      setAnalysisMessage(undefined);
    }
  }, [
    audioFile,
    localizeMakerError,
    onStems,
    recordProvenance,
    setAnalysisFile,
    setAnalysisMessage,
    setAnalysisProgress,
    setNotice,
    t,
  ]);

  return {
    /** Run the split. Resolves to both stems, or undefined if it failed. */
    removeBackground,
    cancelSeparation,
    isSeparating,
    /** The backing track, once there is one. Kept for export and playback. */
    instrumental,
  };
};

export default useMakerSeparation;
