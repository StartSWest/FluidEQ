/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { karaokeMakerAnalysisProgress } from './makerAnalysisProgress';
import {
  type IKaraokeMakerDownloadSummary,
  KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED,
  type TKaraokeMakerWhisperStage,
} from './makerAi';
import KaraokeMakerDownloadDetails from './KaraokeMakerDownloadDetails';
import { type IWhisperRunProfile } from './useMakerAnalysisRun';
import { type Translate } from '../../common/i18n';

interface IMakerProgressViewInput {
  analysisProgress: number | undefined;
  whisperStage: TKaraokeMakerWhisperStage | undefined;
  downloadProgress:
    (IKaraokeMakerDownloadSummary & { bytesPerSecond?: number }) | undefined;
  whisperRunProfile: IWhisperRunProfile;
  lyricsWorkflowActive: boolean;
  t: Translate;
  handPanMode: boolean;
  noteEditMode: 'select' | 'paint' | undefined;
}

/**
 * What the Maker's progress panel and canvas hint say this render: the
 * analysis bar's fraction and stages, whether lyric work is in progress,
 * the per-file download details, and the hint for the canvas mode in use.
 * Pure derivation from the editor's state, rebuilt on every render.
 */
const makerProgressView = ({
  analysisProgress,
  whisperStage,
  downloadProgress,
  whisperRunProfile,
  lyricsWorkflowActive,
  t,
  handPanMode,
  noteEditMode,
}: IMakerProgressViewInput) => {
  // Pure derivation, so it lives outside the run that produces it.
  const analysisView = karaokeMakerAnalysisProgress({
    analysisProgress,
    whisperStage,
    downloadProgress,
    runProfile: whisperRunProfile,
  });
  const displayedAnalysisProgress = analysisView.fraction;
  const analysisProgressIsIndeterminate = analysisView.isIndeterminate;
  const lyricsDownloadRate = analysisView.downloadRate;
  const visibleWhisperStages = analysisView.stages;
  const lyricsProcessing =
    KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED &&
    (lyricsWorkflowActive || analysisProgress !== undefined);
  /*
   * THE GATE WAS WHISPER-ONLY, AND THAT WAS THE BUG.
   *
   * `whisperStage === 'download'` is true for exactly one of the three models
   * this app fetches, so the file-by-file panel — the one whose own comment
   * says a single bar is indistinguishable from a hang — appeared only for the
   * speech model, and never for the two much larger downloads where somebody
   * actually sits and waits.
   *
   * `downloadProgress` is now the whole condition. It is set only while a
   * download is running and cleared when one ends, whichever model set it, so
   * it already answers the question the stage was being used to approximate.
   */
  const renderWhisperDownloadDetails = () =>
    downloadProgress ? (
      <KaraokeMakerDownloadDetails
        progress={downloadProgress}
        rate={lyricsDownloadRate}
      />
    ) : null;

  let canvasInteractionHint = `${t('karaoke.maker.panHint')} ${t(
    'karaoke.maker.scrubHint',
  )}`;
  if (handPanMode) {
    canvasInteractionHint = t('karaoke.maker.panHint');
  } else if (noteEditMode === 'select') {
    canvasInteractionHint = t('karaoke.maker.selectNotesHint');
  } else if (noteEditMode === 'paint') {
    canvasInteractionHint = t('karaoke.maker.paintNotesHint');
  }

  return {
    displayedAnalysisProgress,
    analysisProgressIsIndeterminate,
    visibleWhisperStages,
    lyricsProcessing,
    renderWhisperDownloadDetails,
    canvasInteractionHint,
  };
};

export default makerProgressView;
