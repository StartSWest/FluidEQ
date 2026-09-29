/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type Dispatch, type SetStateAction, useEffect } from 'react';
import { type IKaraokeMakerProject } from '../../common/karaoke/makerProject';

interface IMakerJobControlsInput {
  cancelSeparation: () => void;
  cancelAnalysis: () => void;
  setAnalysisError: Dispatch<SetStateAction<string | undefined>>;
  setAnalysisRetry: Dispatch<
    SetStateAction<'whisper' | 'whisper-runtime' | 'pitch' | undefined>
  >;
  runBasicPitch: (
    baseProject?: IKaraokeMakerProject,
    preserveTranscriptSuccess?: boolean,
  ) => Promise<void>;
  runWhisper: () => Promise<void>;
  isSeparating: boolean;
  analysisProgress: number | undefined;
  onModelWorkChange: (working: boolean) => void;
}

/**
 * The controls every long job of the Maker shares — separation,
 * transcription and melody detection: one cancel for whichever is running,
 * dismissing and retrying a failure, and the lock that keeps the workspace
 * from switching songs under a job still writing into this one.
 */
const useMakerJobControls = ({
  cancelSeparation,
  cancelAnalysis,
  setAnalysisError,
  setAnalysisRetry,
  runBasicPitch,
  runWhisper,
  isSeparating,
  analysisProgress,
  onModelWorkChange,
}: IMakerJobControlsInput) => {
  /**
   * Stop whichever long job is running, without asking which one it is.
   *
   * THE CANCEL BUTTON USED TO CANCEL THE WRONG THING. Separation and
   * transcription both report through `analysisProgress`, so both are shown by
   * the same progress panel — but that panel's button called `cancelAnalysis`,
   * which returns immediately when there is no transcription controller. Start
   * a split from "Separate voice from music" and the only control on screen
   * did nothing at all, for the longest wait in the app: a 700 MB model
   * download followed by minutes of compute on a machine with no GPU.
   *
   * Both are safe to call when idle — each is a no-op without its controller —
   * so this needs no flag saying which is running, and cannot go stale if a
   * third job ever reports through the same bar. The wizard has always called
   * the pair together for exactly this reason; this is that, everywhere a
   * cancel is offered.
   */
  const cancelCurrentWork = () => {
    cancelSeparation();
    cancelAnalysis();
  };

  const dismissAnalysisError = () => {
    setAnalysisError(undefined);
    setAnalysisRetry(undefined);
  };

  const retryAnalysis = (
    retry: 'whisper' | 'whisper-runtime' | 'pitch',
  ): Promise<void> => (retry === 'pitch' ? runBasicPitch() : runWhisper());

  /*
   * LEAVING MID-RUN LANDED ONE SONG'S STEMS ON ANOTHER SONG.
   *
   * The models outlive the component that starts them: separation resolves
   * into `onStems`, which writes the voice and the backing onto the song this
   * editor was opened for and saves them under that song's id. Close the
   * Maker while it runs and that closure keeps its old song while the
   * workspace moves on, so the split finished into a song nobody was looking
   * at — and the editor, reopened on the new song, was keyed to different
   * audio and showed none of it. Transcription and melody detection have the
   * same shape: they commit into `project`, which unmounts with the editor.
   *
   * So the doors are shut while any of them runs, rather than the results
   * being redirected afterwards. Every one of these jobs is cancellable from
   * the progress panel that is already on screen, and that is the way out.
   *
   * `analysisProgress` covers transcription and melody detection — both report
   * through it — and `isSeparating` covers the split from the call, before its
   * first progress tick. Every model download happens inside one of those
   * runs, so `downloadProgress` is deliberately NOT read here: it is a
   * description of a fetch, not of a run, and this lock has to end when the
   * run does.
   */
  const isModelWorking = isSeparating || analysisProgress !== undefined;
  useEffect(() => {
    onModelWorkChange(isModelWorking);
  }, [isModelWorking, onModelWorkChange]);
  useEffect(
    () => () => {
      onModelWorkChange(false);
    },
    [onModelWorkChange],
  );

  // Not the guard above doing its job twice. The editor can still go away
  // without anyone clicking a way out of it — the song is removed, the
  // playlist is cleared — and a split left running then resolves into a
  // closure whose song has gone. `analysisAbortRef` has always been aborted on
  // unmount for transcription; separation was the one job that kept going.
  useEffect(() => () => cancelSeparation(), [cancelSeparation]);

  return {
    cancelCurrentWork,
    dismissAnalysisError,
    retryAnalysis,
    isModelWorking,
  };
};

export default useMakerJobControls;
