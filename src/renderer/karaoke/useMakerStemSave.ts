/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from 'react';
import { encodeFileAsMp3 } from './makerSeparation/encodeMp3';
import { type Translate } from '../../common/i18n';

interface IMakerStemSaveInput {
  analysisAbortRef: RefObject<AbortController | undefined>;
  setAnalysisProgress: Dispatch<SetStateAction<number | undefined>>;
  setAnalysisMessage: Dispatch<SetStateAction<string | undefined>>;
  t: Translate;
  setNotice: (message?: string) => void;
}

/**
 * Saving a stem to disk in the format asked for: a WAV written as it is,
 * or an MP3 encoded first with its progress on the Maker's shared panel,
 * cancellable from that panel's own button.
 */
const useMakerStemSave = ({
  analysisAbortRef,
  setAnalysisProgress,
  setAnalysisMessage,
  t,
  setNotice,
}: IMakerStemSaveInput) => {
  const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Hand a stem to the user in the format they asked for, and only that one.
   *
   * THE CHOICE IS THE POINT. A WAV goes into a DAW — lossless, already in
   * memory, written instantly. An MP3 goes on a phone or into a message — a
   * fifth of the size, and several seconds of encoding to produce. Which of
   * those somebody wants is a thing only they know, so the panel asks instead
   * of writing both and making the answer their problem.
   */
  const saveStem = useCallback(
    (file: File, format: 'wav' | 'mp3') => {
      if (format === 'wav') {
        downloadFile(file);
        return;
      }
      const mp3Name = `${file.name.replace(/\.[^.]+$/, '')}.mp3`;
      /*
       * Reported through the same panel a model download uses, deliberately.
       *
       * Encoding a full song takes several seconds — long enough that a click
       * with no visible answer reads as a broken button. `analysisProgress`
       * and `analysisMessage` are what the shared progress panel draws, and
       * that panel already has the cancel button and the bar; giving MP3 its
       * own would be a second dialect for the same sentence.
       *
       * The controller is the analysis one, so the cancel already wired to
       * that panel aborts this too. Nothing else can be running underneath
       * it: encoding is started from a button in a panel that only exists
       * once a split has finished.
       */
      const controller = new AbortController();
      analysisAbortRef.current = controller;
      setAnalysisProgress(0);
      setAnalysisMessage(t('karaoke.maker.stemMp3Encoding'));
      encodeFileAsMp3(file, mp3Name, {
        onProgress: setAnalysisProgress,
        signal: controller.signal,
      })
        .then((mp3) => {
          downloadFile(mp3);
          setNotice(t('karaoke.maker.stemMp3Saved'));
          return undefined;
        })
        .catch((error) => {
          if ((error as Error).name === 'AbortError') {
            setNotice(t('karaoke.maker.wizardCancelled'));
            return;
          }
          // eslint-disable-next-line no-console -- context-rich error before the failure is flattened into the notice below
          console.error('[karaoke][stems] mp3 encode failed', error);
          setNotice(t('karaoke.maker.stemMp3Failed'));
        })
        .finally(() => {
          if (analysisAbortRef.current === controller) {
            analysisAbortRef.current = undefined;
          }
          setAnalysisProgress(undefined);
          setAnalysisMessage(undefined);
        });
    },
    [analysisAbortRef, setAnalysisMessage, setAnalysisProgress, setNotice, t],
  );

  return { saveStem };
};

export default useMakerStemSave;
