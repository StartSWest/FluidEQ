/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import KaraokeMakerTimingSliders from './KaraokeMakerTimingSliders';
import KaraokeMakerWordInspector from './KaraokeMakerWordInspector';
import KaraokeMakerSelectionInfo from './KaraokeMakerSelectionInfo';
import KaraokeMakerEditTools from './KaraokeMakerEditTools';
import KaraokeMakerStems from './KaraokeMakerStems';
import KaraokeMakerAnalysisTools from './KaraokeMakerAnalysisTools';
import KaraokeMakerSpeechMemoryPanel from './KaraokeMakerSpeechMemoryPanel';
import {
  KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED,
  writeKaraokeWhisperMemorySettings,
} from './makerAi';
import makerProgressView from './makerProgressView';
import KaraokeMakerToolbar from './KaraokeMakerToolbar';
import KaraokeMakerWizard from './KaraokeMakerWizard';
import KaraokeMakerHeader from './KaraokeMakerHeader';
import KaraokeMakerNavigator from './KaraokeMakerNavigator';
import KaraokeMakerCaptureCoach from './KaraokeMakerCaptureCoach';
import KaraokeMakerFloatingPanel from './KaraokeMakerFloatingPanel';
import KaraokeMakerPreview from './KaraokeMakerPreview';
import KaraokeMakerInspector from './KaraokeMakerInspector';
import KaraokeMakerAnalysisPanels from './KaraokeMakerAnalysisPanels';
import CompactFrame from '../components/CompactFrame';
import MenuIcon from '../icons/MenuIcon';
import KaraokeMakerConfirmDialog from './KaraokeMakerConfirmDialog';
import KaraokeMakerLyricsDialog from './KaraokeMakerLyricsDialog';
import KaraokeMakerWhisperConsent from './KaraokeMakerWhisperConsent';
import { type IKaraokeMakerProps } from './KaraokeMaker';
import { type TKaraokeMakerEditor } from './useKaraokeMakerEditor';
import { type TKaraokeMakerTools } from './useKaraokeMakerTools';

interface IKaraokeMakerViewProps extends Pick<
  IKaraokeMakerProps,
  | 'audioFile'
  | 'backingBlend'
  | 'isFullScreen'
  | 'isPlaying'
  | 'onApply'
  | 'onBackingBlend'
  | 'onClose'
  | 'onFocusStem'
  | 'onPause'
  | 'onPlay'
  | 'onSeek'
  | 'onToggleFullScreen'
  | 'onVocalLevel'
  | 'playheadMs'
  | 'stemFocus'
  | 'vocalLevel'
> {
  editor: TKaraokeMakerEditor;
  tools: TKaraokeMakerTools;
}

/**
 * The Maker's markup: toolbar and its popovers, the canvas and navigator,
 * the capture coach, selection panel, live preview, command dock, progress
 * panels, notices and dialogs. Holds no state and runs no hooks; everything
 * it shows comes from the editor and the tools.
 */
const KaraokeMakerView = ({
  editor,
  tools,
  audioFile,
  backingBlend,
  isFullScreen,
  isPlaying,
  onApply,
  onBackingBlend,
  onClose,
  onFocusStem,
  onPause,
  onPlay,
  onSeek,
  onToggleFullScreen,
  onVocalLevel,
  playheadMs,
  stemFocus,
  vocalLevel,
}: IKaraokeMakerViewProps) => {
  const {
    t,
    noteAudition,
    controlId,
    project,
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
    restoreToast,
    dismissRestoreToast,
    translationLanguage,
    setTranslationLanguage,
    translationLanguages,
    addTranslation,
    removeTranslation,
    translationMismatch,
    tokens,
    selection,
    setSelection,
    selectedNoteIds,
    setSelectedNoteIds,
    copiedNotes,
    viewStartMs,
    followViewport,
    timingScope,
    setTimingScope,
    previewOpen,
    setPreviewOpen,
    previewTextSize,
    setPreviewTextSize,
    previewHeight,
    setPreviewHeight,
    lyricsOpen,
    setLyricsOpen,
    lyricsDraft,
    setLyricsDraft,
    lyricsFileName,
    lyricsWorkflowActive,
    setLyricsWorkflowActive,
    draftLyricsWordCount,
    lyricsDraftChanged,
    lyricsDraftTarget,
    lyricFollowRequestKey,
    wordShiftMs,
    destructiveAction,
    setDestructiveAction,
    lineEntryMode,
    syllableSplitDraft,
    setSyllableSplitDraft,
    lineEntrySession,
    lineEntryCountdown,
    handPanMode,
    noteEditMode,
    hoveredEditHandle,
    setHoveredEditHandle,
    isPitchPanReady,
    setIsPitchPanReady,
    isCanvasPanning,
    isCanvasScrubbing,
    visualPlayheadMs,
    lineEntryIndex,
    lineEntryCapture,
    setLineEntryCapture,
    analysisProgress,
    analysisMessage,
    whisperStage,
    whisperRunProfile,
    downloadProgress,
    analysisError,
    analysisRetry,
    analysisFile,
    exportOpen,
    setExportOpen,
    toolPanel,
    setToolPanel,
    noticeEntry,
    setNoticeEntry,
    setNotice,
    whisperConsentOpen,
    setWhisperConsentOpen,
    whisperSession,
    canvasRef,
    canvasHostRef,
    vocalStemInputRef,
    projectInputRef,
    lyricsInputRef,
    toolsRef,
    gesture,
    prepareAfterWhisperRef,
    lyricsWorkflowActiveRef,
    startLineEntryCountdown,
    activeLyricFocus,
    effectiveDurationMs,
    lyricLines,
    maximumViewDurationMs,
    minimumViewDurationMs,
    selectedLyricLineId,
    userTouchedWordCount,
    visibleViewDurationMs,
    issues,
    selectedToken,
    selectedNote,
    selectedNoteToken,
    selectedTokenTimingControls,
    canShiftFromWord,
    previewSong,
    shiftTimeline,
    followPlayhead,
    moveViewport,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    resetLyricZoom,
    resizeViewport,
  } = editor;
  const {
    clearLyrics,
    clearNotes,
    openLyricsEditor,
    restoreOriginal,
    selectLyricsFile,
    ignoreGuidedLine,
    markNextGuidedWord,
    recordLineEntry,
    selectGuidedLine,
    applySyllableSplit,
    copySelectedNotes,
    deleteSelection,
    detachSelectedNotes,
    pasteCopiedNotes,
    splitNote,
    splitSelectedLyricsWord,
    toggleSyllableCutPoint,
    saveStem,
    removeBackground,
    isSeparating,
    effectiveInstrumental,
    stemVocalsFile,
    wizardOpen,
    setWizardOpen,
    wizardStep,
    wizardDone,
    exportProject,
    openProject,
    selectVocalStem,
    auditionLyricsToken,
    moveLyricsEditorSelection,
    moveLyricsEditorWord,
    noteKindLabel,
    selectLyricsEditorToken,
    updateSelectedTokenTiming,
    startLineEntrySync,
    stopLineEntryRecording,
    toggleHandPanMode,
    toggleLineEntryMode,
    toggleNoteEditMode,
    toggleToolPanel,
    releaseWhisperNow,
    requestWhisper,
    runBasicPitch,
    runWhisper,
    runWizard,
    replaceLyrics,
    cancelCurrentWork,
    dismissAnalysisError,
    retryAnalysis,
    isModelWorking,
    lineCaptureState,
    captureGuideLine,
    captureGuideNextLine,
    captureGuidePhase,
    captureGuideVisualState,
    captureGuideInstruction,
  } = tools;
  const renderSelectedWordTimingSliders = (idPrefix: string) => (
    <KaraokeMakerTimingSliders
      idPrefix={idPrefix}
      selectedTokenTimingControls={selectedTokenTimingControls}
      updateSelectedTokenTiming={updateSelectedTokenTiming}
    />
  );

  const renderLyricsModalWordInspector = () => (
    <KaraokeMakerWordInspector
      selectedToken={selectedToken}
      tokens={tokens}
      playheadMs={playheadMs}
      isProcessing={lyricsProcessing}
      controlId={controlId}
      onMoveSelection={moveLyricsEditorSelection}
      onAudition={auditionLyricsToken}
      onStartLineEntry={startLineEntrySync}
      onTimingChange={updateSelectedTokenTiming}
      renderTimingSliders={renderSelectedWordTimingSliders}
    />
  );

  const selectionInfo = (
    <KaraokeMakerSelectionInfo
      applySyllableSplit={applySyllableSplit}
      auditionLyricsToken={auditionLyricsToken}
      commit={commit}
      controlId={controlId}
      deleteSelection={deleteSelection}
      detachSelectedNotes={detachSelectedNotes}
      noteAudition={noteAudition}
      noteKindLabel={noteKindLabel}
      playheadMs={playheadMs}
      project={project}
      renderTimingSliders={renderSelectedWordTimingSliders}
      selectedNote={selectedNote}
      selectedNoteIds={selectedNoteIds}
      selectedNoteToken={selectedNoteToken}
      selectedToken={selectedToken}
      setSyllableSplitDraft={setSyllableSplitDraft}
      splitSelectedLyricsWord={splitSelectedLyricsWord}
      syllableSplitDraft={syllableSplitDraft}
      toggleSyllableCutPoint={toggleSyllableCutPoint}
      updateSelectedTokenTiming={updateSelectedTokenTiming}
    />
  );

  const editTools = (
    <KaraokeMakerEditTools
      isRecordingLines={lineEntryMode}
      onToggleRecordLines={toggleLineEntryMode}
      noteEditMode={noteEditMode}
      onToggleNoteEditMode={toggleNoteEditMode}
      canCopyNotes={selection?.kind === 'note'}
      onCopyNotes={copySelectedNotes}
      canPasteNotes={copiedNotes.length > 0}
      onPasteNotes={pasteCopiedNotes}
      canSplitNote={Boolean(selectedNote)}
      onSplitNote={splitNote}
      canDelete={Boolean(selection)}
      onDelete={deleteSelection}
    />
  );

  const speechMemoryStatusKey = (() => {
    if (whisperSession.inMemory) {
      return 'karaoke.maker.speechMemoryReady';
    }
    return whisperSession.downloaded
      ? 'karaoke.maker.speechMemoryCached'
      : 'karaoke.maker.speechMemoryMissing';
  })();

  const advancedAnalysisTools = (
    <>
      {/*
        The waves themselves live in the editor's timeline, on the shared time
        axis; this popover keeps the housekeeping — saving a stem to disk and
        the guide-vocal level.
      */}
      <KaraokeMakerStems
        instrumental={effectiveInstrumental}
        vocals={stemVocalsFile}
        playheadMs={playheadMs}
        durationMs={effectiveDurationMs}
        onSeek={onSeek}
        isPlaying={isPlaying}
        onPlay={onPlay}
        onPause={onPause}
        stemFocus={stemFocus}
        onFocusStem={onFocusStem}
        backingBlend={backingBlend}
        onBackingBlend={onBackingBlend}
        vocalLevel={vocalLevel}
        onVocalLevel={onVocalLevel}
        onSave={saveStem}
      />
      <KaraokeMakerAnalysisTools
        isAnalysing={analysisProgress !== undefined || isSeparating}
        onDetectLyrics={() =>
          requestWhisper(false, true).catch(() => undefined)
        }
        onDetectMelody={() => runBasicPitch().catch(() => undefined)}
        onRebuild={() => requestWhisper(true).catch(() => undefined)}
        isUsingSongAudio={analysisFile === audioFile}
        onChooseVocalStem={() => vocalStemInputRef.current?.click()}
        onRemoveBackground={() => {
          removeBackground().catch(() => undefined);
        }}
      />
      <KaraokeMakerSpeechMemoryPanel
        session={whisperSession}
        statusKey={speechMemoryStatusKey}
        isModelWorking={isModelWorking}
        onRelease={() => releaseWhisperNow().catch(() => undefined)}
        onSettingsChange={writeKaraokeWhisperMemorySettings}
      />
    </>
  );

  const renderEditStatus = () => {
    if (handPanMode) {
      return (
        <div className="karaoke-maker__tap-status is-live">
          <span>{t('karaoke.maker.panHint')}</span>
          <button type="button" onClick={toggleHandPanMode}>
            × {t('karaoke.maker.cancel')}
          </button>
        </div>
      );
    }
    if (lineEntryMode) {
      return <span>{captureGuideInstruction}</span>;
    }
    // Nothing in the default state. A permanent three-line manual under the
    // toolbar was chrome pretending to be help — and once the status row
    // overlaid the toolbar's flanks it ran straight through the buttons. The
    // gestures live in tooltips now; this row speaks only when a mode needs
    // guiding.
    return null;
  };

  const {
    displayedAnalysisProgress,
    analysisProgressIsIndeterminate,
    visibleWhisperStages,
    lyricsProcessing,
    renderWhisperDownloadDetails,
    canvasInteractionHint,
  } = makerProgressView({
    analysisProgress,
    whisperStage,
    downloadProgress,
    whisperRunProfile,
    lyricsWorkflowActive,
    t,
    handPanMode,
    noteEditMode,
  });

  const makerToolbar = (
    <KaraokeMakerToolbar
      advancedAnalysisTools={advancedAnalysisTools}
      canShiftFromWord={canShiftFromWord}
      editTools={editTools}
      exportOpen={exportOpen}
      exportProject={exportProject}
      onSaveInstrumental={
        effectiveInstrumental
          ? () => {
              // A plain object-URL download. The stem is already a File in
              // memory, so there is nothing to re-encode or ask the main
              // process for.
              const url = URL.createObjectURL(effectiveInstrumental);
              const link = document.createElement('a');
              link.href = url;
              link.download = effectiveInstrumental.name;
              link.click();
              URL.revokeObjectURL(url);
            }
          : undefined
      }
      handPanMode={handPanMode}
      openLyricsEditor={openLyricsEditor}
      project={project}
      projectInputRef={projectInputRef}
      removeTranslation={removeTranslation}
      selectedToken={selectedToken}
      setDestructiveAction={setDestructiveAction}
      setExportOpen={setExportOpen}
      setTimingScope={setTimingScope}
      setToolPanel={setToolPanel}
      setTranslationLanguage={setTranslationLanguage}
      shiftTimeline={shiftTimeline}
      timingScope={timingScope}
      toggleHandPanMode={toggleHandPanMode}
      toggleToolPanel={toggleToolPanel}
      tokens={tokens}
      toolPanel={toolPanel}
      toolsRef={toolsRef}
      translationLanguage={translationLanguage}
      translationLanguages={translationLanguages}
      wordShiftMs={wordShiftMs}
    />
  );

  return (
    <div
      className={`karaoke-maker${isFullScreen ? ' is-fullscreen' : ''}`}
      role="dialog"
      aria-label={t('karaoke.maker.dialog')}
    >
      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && wizardOpen && (
        <KaraokeMakerWizard
          activeStep={wizardStep}
          doneSteps={wizardDone}
          progress={analysisProgress}
          message={analysisMessage}
          onStart={() => {
            runWizard().catch(() => undefined);
          }}
          onSkip={() => setWizardOpen(false)}
          onHide={() => setWizardOpen(false)}
          language={project.lyrics.language}
          onLanguage={(language) =>
            commit((current) => ({
              ...current,
              lyrics: { ...current.lyrics, language },
            }))
          }
          onCancel={cancelCurrentWork}
        />
      )}
      <input
        ref={vocalStemInputRef}
        hidden
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a"
        onChange={selectVocalStem}
      />
      <input
        ref={projectInputRef}
        hidden
        type="file"
        accept=".json,.fluideq-karaoke.json,.lrc,.elrc,.txt,application/json,text/plain"
        onChange={openProject}
      />
      <input
        ref={lyricsInputRef}
        hidden
        type="file"
        accept=".lrc,.elrc,.txt,text/plain"
        onChange={selectLyricsFile}
      />
      <KaraokeMakerHeader
        canRedo={canRedo}
        canUndo={canUndo}
        commit={commit}
        isFullScreen={isFullScreen}
        isModelWorking={isModelWorking}
        issues={issues}
        onApply={onApply}
        onClose={onClose}
        onToggleFullScreen={onToggleFullScreen}
        project={project}
        redo={redo}
        setDestructiveAction={setDestructiveAction}
        setNotice={setNotice}
        tools={makerToolbar}
        undo={undo}
      />

      <div ref={canvasHostRef} className="karaoke-maker__canvas-host">
        <canvas
          ref={canvasRef}
          className={`karaoke-maker__canvas${
            handPanMode ? ' is-hand-pan' : ''
          }${
            isPitchPanReady ? ' is-pitch-pan-ready' : ''
          }${isCanvasPanning ? ' is-panning' : ''}${
            isCanvasScrubbing ? ' is-scrubbing' : ''
          }${noteEditMode === 'select' ? ' is-note-selecting' : ''}${
            noteEditMode === 'paint' ? ' is-note-painting' : ''
          }${
            hoveredEditHandle?.behavior === 'move' ? ' is-note-move-ready' : ''
          }${
            hoveredEditHandle?.behavior === 'resize-start' ||
            hoveredEditHandle?.behavior === 'resize-end'
              ? ' is-note-resize-ready'
              : ''
          }`}
          // NO NATIVE TOOLTIP ON THE EDITING SURFACE.
          //
          // A `title` on the canvas means the browser pops a yellow box under
          // the pointer after a second of stillness — over the one element
          // somebody rests the pointer on constantly while deciding where to
          // drag a note. It covered the notes it was describing, and it could
          // not be styled or placed. The instruction is still on screen: it is
          // rendered as the status line under the canvas, which is where the
          // mode already says what the current tool does.
          aria-label={canvasInteractionHint}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          onPointerLeave={() => {
            if (!gesture.drag.current) {
              setHoveredEditHandle(undefined);
              setIsPitchPanReady(false);
            }
          }}
        />
        <KaraokeMakerNavigator
          durationMs={effectiveDurationMs}
          viewportStartMs={viewStartMs}
          viewportDurationMs={visibleViewDurationMs}
          playheadMs={visualPlayheadMs}
          waveform={project.analysis.waveform}
          notes={project.melody.notes}
          minimumViewportMs={minimumViewDurationMs}
          maximumViewportMs={maximumViewDurationMs}
          follow={followViewport}
          positionLabel={t('karaoke.maker.songPosition')}
          previousLabel={t('karaoke.maker.previousView')}
          nextLabel={t('karaoke.maker.nextView')}
          followLabel={t('karaoke.lyrics.follow')}
          resetZoomLabel={t('karaoke.maker.resetZoom')}
          onMove={moveViewport}
          onResize={resizeViewport}
          onFollow={followPlayhead}
          onResetZoom={resetLyricZoom}
        />
      </div>

      <KaraokeMakerCaptureCoach
        anchorRef={canvasHostRef}
        moveLabel={t('karaoke.maker.captureMoveGuide')}
        setup={
          lineEntryMode && lineEntrySession === 'setup' && captureGuideLine
            ? {
                eyebrow: t('karaoke.maker.captureGuideTitle'),
                title: t('karaoke.maker.captureSetupTitle'),
                description: t('karaoke.maker.captureSetupBody'),
                currentLine: captureGuideLine.tokens
                  .map((token) => token.text)
                  .join(' '),
                startLabel: t('karaoke.maker.captureStartRecording'),
              }
            : undefined
        }
        countdown={
          lineEntryMode && lineEntryCountdown
            ? {
                cue: lineEntryCountdown,
                label: t('karaoke.maker.captureCountdownReady'),
              }
            : undefined
        }
        help={
          lineEntryMode
            ? {
                audioLabel: t('karaoke.maker.captureGuideAudio'),
                lyricLabel: t('karaoke.maker.captureGuideLyrics'),
                playbackLabel: t('karaoke.maker.captureGuidePlayback'),
                wordLabel: t('karaoke.maker.captureGuideWords'),
                undoLabel: t('karaoke.maker.captureGuideUndo'),
              }
            : undefined
        }
        guide={
          lineEntryMode && lineEntrySession === 'active' && captureGuideLine
            ? {
                title: t('karaoke.maker.captureGuideTitle'),
                instruction: captureGuideInstruction,
                currentLine: captureGuideLine.tokens
                  .map((token) => token.text)
                  .join(' '),
                nextLine: captureGuideNextLine?.tokens
                  .map((token) => token.text)
                  .join(' '),
                nextLabel: t('karaoke.maker.captureGuideNext'),
                phase: captureGuidePhase,
                startLabel: t('karaoke.maker.captureStartPoint'),
                endLabel: t('karaoke.maker.captureEndPoint'),
              }
            : undefined
        }
        actions={
          lineEntryMode
            ? {
                isPlaying,
                playLabel: t('karaoke.transport.play'),
                pauseLabel: t('karaoke.transport.pause'),
                markLabel: t(
                  captureGuidePhase === 'start'
                    ? 'karaoke.maker.markLine'
                    : 'karaoke.maker.markLineEnd',
                ),
                markWordLabel: t('karaoke.maker.markNextWord'),
                undoLabel: t('karaoke.maker.undo'),
                ignoreLabel: t('karaoke.maker.ignoreLine'),
                stopLabel: t('karaoke.maker.stopRecording'),
                cancelLabel: t('karaoke.maker.cancel'),
                canUndo,
                canMarkWord:
                  captureGuidePhase === 'end' &&
                  (lineEntryCapture?.wordBoundariesMs?.length ?? 0) <
                    Math.max(0, (captureGuideLine?.tokens.length ?? 0) - 1),
                onTogglePlayback: () => {
                  if (isPlaying) {
                    onPause();
                  } else {
                    Promise.resolve(onPlay()).catch(() => undefined);
                  }
                },
                onMark: recordLineEntry,
                onMarkWord: markNextGuidedWord,
                onUndo: () => {
                  undo();
                  setLineEntryCapture(undefined);
                  selectGuidedLine(lineEntryIndex - 1);
                },
                onIgnore: ignoreGuidedLine,
                onStop: stopLineEntryRecording,
                onCancel: stopLineEntryRecording,
              }
            : undefined
        }
        onStart={startLineEntryCountdown}
      />

      {!lineEntryMode && (selectedNoteIds.size > 0 || selectedToken) && (
        <KaraokeMakerFloatingPanel
          anchorRef={canvasHostRef}
          className={`karaoke-maker__selection-coach${
            selectedToken && !syllableSplitDraft ? ' is-word-selection' : ''
          }`}
          ariaLabel={t('karaoke.maker.selectionPanel')}
          moveLabel={t('karaoke.maker.selectionMoveGuide')}
          closeLabel={t('karaoke.maker.dismissSelection')}
          onClose={() => {
            noteAudition.stop();
            setSyllableSplitDraft(undefined);
            setSelection(undefined);
            setSelectedNoteIds(new Set());
          }}
        >
          <div className="karaoke-maker__selection-coach-content">
            {selectionInfo}
          </div>
        </KaraokeMakerFloatingPanel>
      )}

      <KaraokeMakerPreview
        song={previewSong}
        playheadMs={visualPlayheadMs}
        textSize={previewTextSize}
        height={previewHeight}
        open={previewOpen}
        followRequestKey={lyricFollowRequestKey}
        title={t('karaoke.maker.livePreview')}
        showLabel={t('karaoke.maker.showPreview')}
        hideLabel={t('karaoke.maker.hidePreview')}
        resizeLabel={t('karaoke.maker.previewResize')}
        textSizeLabel={t('karaoke.lyrics.textSize')}
        centerLineId={
          lineEntryMode ? lyricLines[lineEntryIndex]?.id : selectedLyricLineId
        }
        activeLineId={
          lineEntryMode ? lyricLines[lineEntryIndex]?.id : selectedLyricLineId
        }
        captureState={
          lineEntrySession === 'active' ? lineCaptureState : undefined
        }
        captureLineState={
          lineEntryMode && lineEntrySession === 'active' && captureGuideLine
            ? captureGuideVisualState
            : undefined
        }
        // The toolbar's own translation picker, so the preview's row shows
        // exactly the sheet the toolbar has selected -- see
        // KaraokeMakerPreview.tsx's own doc comment.
        translationLanguage={translationLanguage}
        onSeek={onSeek}
        onTextSize={setPreviewTextSize}
        onHeight={setPreviewHeight}
        onToggle={() => setPreviewOpen((current) => !current)}
      />

      <div className="karaoke-maker__command-dock">
        <div className="karaoke-maker__command-primary">
          <div
            className={`karaoke-maker__status-row${
              lineEntryMode ? ' is-guided' : ''
            }${handPanMode || lineEntryMode ? ' has-message' : ''}`}
          >
            {renderEditStatus()}
            <div className="karaoke-maker__status-end">
              <div
                className="karaoke-maker__word-state-legend"
                aria-label={t('karaoke.maker.wordStateLegend')}
              >
                <span className="is-touched" data-count={userTouchedWordCount}>
                  <i aria-hidden="true" />
                  {t('karaoke.maker.userAdjustedWords', {
                    count: userTouchedWordCount,
                  })}
                </span>
                <span
                  className="is-pending"
                  data-count={Math.max(0, tokens.length - userTouchedWordCount)}
                >
                  <i aria-hidden="true" />
                  {t('karaoke.maker.pendingWords', {
                    count: Math.max(0, tokens.length - userTouchedWordCount),
                  })}
                </span>
              </div>
              <span>
                {t('karaoke.maker.stats', {
                  notes: project.melody.notes.length,
                  words: tokens.length,
                  checks: issues.length,
                })}
              </span>
            </div>
          </div>
        </div>

        <KaraokeMakerInspector
          commit={commit}
          controlId={controlId}
          project={project}
        />

        {/* No transport here. The bar at the foot of the window carries the
            karaoke controls now — the same buttons, the same faders — and a
            second copy inside the editor was two sets of controls for one
            song, twenty pixels apart. See `KaraokeWorkspace`, which hands its
            transport to that bar. */}
      </div>

      {/*
        On the editor surface, not in the Repair-tools popover. It lived there
        first, and the wizard's finale was invisible: separation completed,
        the dialog closed, and the stems it produced sat behind a closed menu —
        which read as "it did nothing", the exact impression the whole panel
        exists to prevent. It floats where the analysis progress does, so the
        work and its result appear in the same place.
      */}
      {/*
        The guide-vocal fader, on the editor surface whenever a split exists.
        It lived only inside the Repair-tools popover first — the same
        discoverability mistake the stems panel made: the one control that
        makes the orange wave audible was behind a closed menu.
      */}
      <KaraokeMakerAnalysisPanels
        analysisError={analysisError}
        analysisMessage={analysisMessage}
        analysisProgress={analysisProgress}
        analysisProgressIsIndeterminate={analysisProgressIsIndeterminate}
        analysisRetry={analysisRetry}
        // Both jobs report through this panel, so its button has to stop both.
        cancelAnalysis={cancelCurrentWork}
        displayedAnalysisProgress={displayedAnalysisProgress}
        dismissAnalysisError={dismissAnalysisError}
        lyricsOpen={lyricsOpen}
        renderWhisperDownloadDetails={renderWhisperDownloadDetails}
        retryAnalysis={retryAnalysis}
        visibleWhisperStages={visibleWhisperStages}
        whisperStage={whisperStage}
      />
      {/* Up for five seconds of its own animation, and gone on its end. It
          was a five-second timer, restarted whenever the analysis panel came
          and went; the element is mounted and unmounted with that panel, so
          the animation restarts with it all the same, and a new notice is a
          new element (`key`) with its five seconds from the start. */}
      {analysisProgress === undefined && !analysisError && noticeEntry && (
        <div
          key={noticeEntry.id}
          className="karaoke-maker__notice"
          role="status"
          aria-live="polite"
          onAnimationEnd={(event) => {
            if (
              event.target !== event.currentTarget ||
              event.animationName !== 'karaoke-maker-notice-linger'
            ) {
              return;
            }
            const noticeId = noticeEntry.id;
            setNoticeEntry((current) =>
              current?.id === noticeId ? undefined : current,
            );
          }}
        >
          <span>{noticeEntry.message}</span>
        </div>
      )}
      {restoreToast && (
        // A corner notice, not a question: it passes clicks through to the
        // tools under it and goes by itself, so it carries no ×.
        <CompactFrame
          key={restoreToast}
          className="karaoke-maker__toast"
          role="status"
          aria-modal={undefined}
          aria-live="polite"
          icon={<MenuIcon name="check" />}
          title={restoreToast}
          titleId="karaoke-maker-toast-title"
          onAnimationEnd={(event) => {
            // The fade that is its lifetime, not the drift beside it (which
            // reduced motion ends at once) nor anything inside it.
            if (
              event.target === event.currentTarget &&
              event.animationName === 'karaoke-maker-toast'
            ) {
              dismissRestoreToast();
            }
          }}
        />
      )}

      <KaraokeMakerConfirmDialog
        action={destructiveAction}
        onCancel={() => setDestructiveAction(undefined)}
        onConfirm={() => {
          if (destructiveAction === 'notes') {
            clearNotes();
          } else if (destructiveAction === 'lyrics') {
            clearLyrics();
          } else {
            restoreOriginal();
          }
        }}
      />

      {lyricsOpen && (
        <KaraokeMakerLyricsDialog
          activeLyricFocus={activeLyricFocus}
          addTranslation={addTranslation}
          analysisError={analysisError}
          analysisMessage={analysisMessage}
          analysisProgress={analysisProgress}
          analysisProgressIsIndeterminate={analysisProgressIsIndeterminate}
          analysisRetry={analysisRetry}
          // The lyrics workflow can run a split before it transcribes, so the
          // dialog's cancel reaches the same pair as the panel's.
          cancelAnalysis={cancelCurrentWork}
          destructiveAction={destructiveAction}
          displayedAnalysisProgress={displayedAnalysisProgress}
          dismissAnalysisError={dismissAnalysisError}
          draftLyricsWordCount={draftLyricsWordCount}
          initialTranslationTarget={lyricsDraftTarget}
          lyricsDraft={lyricsDraft}
          lyricsDraftChanged={lyricsDraftChanged}
          lyricsFileName={lyricsFileName}
          lyricsInputRef={lyricsInputRef}
          lyricsProcessing={lyricsProcessing}
          mismatch={translationMismatch}
          moveLyricsEditorWord={moveLyricsEditorWord}
          project={project}
          renderLyricsModalWordInspector={renderLyricsModalWordInspector}
          renderWhisperDownloadDetails={renderWhisperDownloadDetails}
          replaceLyrics={replaceLyrics}
          retryAnalysis={retryAnalysis}
          selectLyricsEditorToken={selectLyricsEditorToken}
          selection={selection}
          setLyricsDraft={setLyricsDraft}
          setLyricsOpen={setLyricsOpen}
        />
      )}
      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && whisperConsentOpen && (
        <KaraokeMakerWhisperConsent
          lyricsWorkflowActiveRef={lyricsWorkflowActiveRef}
          prepareAfterWhisperRef={prepareAfterWhisperRef}
          runWhisper={runWhisper}
          setLyricsWorkflowActive={setLyricsWorkflowActive}
          setWhisperConsentOpen={setWhisperConsentOpen}
        />
      )}
    </div>
  );
};

export default KaraokeMakerView;
