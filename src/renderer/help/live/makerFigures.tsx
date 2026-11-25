/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type CSSProperties, useRef } from 'react';
import {
  type IKaraokeMakerToken,
  validateKaraokeMakerProject,
} from 'common/karaoke/makerProject';
import KaraokeMakerEditTools from '../../karaoke/KaraokeMakerEditTools';
import KaraokeMakerHeader from '../../karaoke/KaraokeMakerHeader';
import KaraokeMakerInspector from '../../karaoke/KaraokeMakerInspector';
import KaraokeMakerNavigator from '../../karaoke/KaraokeMakerNavigator';
import KaraokeMakerPitchScroller from '../../karaoke/KaraokeMakerPitchScroller';
import KaraokeMakerPreview from '../../karaoke/KaraokeMakerPreview';
import KaraokeMakerToolbar from '../../karaoke/KaraokeMakerToolbar';
import { createKaraokeLiveValue } from '../../karaoke/karaokeLiveValue';
import type { IHitRegion } from '../../karaoke/makerCanvasGeometry';
import { paintMakerCanvas } from '../../karaoke/makerCanvasPaint';
import type {
  ICanvasSelectionBox,
  INoteLinkDragState,
  INotePaintDraft,
} from '../../karaoke/makerCanvasTypes';
import { fitPitchWindow } from '../../karaoke/makerPitchView';
import { useMakerCanvasModel } from '../../karaoke/useMakerCanvasModel';
import { useTranslation } from '../../utils/I18nContext';
import {
  HELP_MAKER_PROJECT,
  HELP_PLAYHEAD_MS,
  HELP_SONG,
} from './karaokeHelpSong';
import useHelpCanvas from './useHelpCanvas';

/**
 * The Maker chapter's editor, drawn by the Maker's own parts
 * (`helpChapters/listen.ts` frames its tools and its grid out of it).
 *
 * The made-up song (`karaokeHelpSong.ts`) is open in it, its first two lines
 * checked by hand: the header and its tools, the pitch range against the
 * grid's left edge, the overview under the grid, the live preview and the
 * dock are the Maker's own components. The editor itself is the canvas the
 * Maker paints (`paintMakerCanvas`), laid out by the Maker's own model of it
 * (`useMakerCanvasModel`), on a window of the third line; the hooks that
 * hold the editor read the song's audio and its saved draft, so the canvas is
 * painted here, and the dock's status line is its markup, class for class.
 */

const nothing = () => undefined;
const CONTROL_ID = 'help-maker';
const PLAYHEAD = createKaraokeLiveValue(HELP_PLAYHEAD_MS);
const VIEW_START_MS = 18_600;
const VIEW_MS = 12_000;

const TOKENS: IKaraokeMakerToken[] = HELP_MAKER_PROJECT.lyrics.lines.flatMap(
  (line) => line.tokens,
);
const PITCH_WINDOW = fitPitchWindow(HELP_MAKER_PROJECT.melody.notes);
const ISSUES = validateKaraokeMakerProject(HELP_MAKER_PROJECT);
const CHECKED_WORDS = TOKENS.filter((token) => token.timingLocked).length;
/** The Karaoke page's room, which the Maker covers whole. */
const PAGE_STYLE: CSSProperties = { height: 760 };

/** The editor's canvas, painted by the Maker's own painter. */
const HelpMakerCanvas = ({
  model,
}: {
  model: ReturnType<typeof useMakerCanvasModel>;
}) => {
  const hitRegions = useRef<IHitRegion[]>([]);
  const selectionBox = useRef<ICanvasSelectionBox | undefined>(undefined);
  const notePaintDraft = useRef<INotePaintDraft | undefined>(undefined);
  const noteLinkDrag = useRef<INoteLinkDragState | undefined>(undefined);
  const wordFocus = useRef<{ tokenId?: string; startedAt: number }>({
    startedAt: 0,
  });
  const canvasRef = useHelpCanvas((context, width, height, ratio) =>
    paintMakerCanvas({
      context,
      ratio,
      width,
      height,
      headerHeight: model.headerHeight,
      lyricSectionTop: model.lyricSectionTop,
      lyricLaneHeight: model.lyricLaneHeight,
      translationRow: model.translationRow,
      project: HELP_MAKER_PROJECT,
      selection: undefined,
      selectedNoteIds: new Set(),
      canvasLyricWords: model.canvasLyricWords,
      canvasSectionGroups: model.canvasSectionGroups,
      activeLyricFocus: model.activeLyricFocus,
      activeLyricWordId: model.activeLyricWordId,
      controlLinkMode: false,
      viewStartMs: VIEW_START_MS,
      visibleViewDurationMs: model.visibleViewDurationMs,
      pitchWindow: PITCH_WINDOW,
      visualPlayheadMs: HELP_PLAYHEAD_MS,
      effectiveDurationMs: model.effectiveDurationMs,
      hitRegionsRef: hitRegions,
      selectionBoxRef: selectionBox,
      notePaintDraftRef: notePaintDraft,
      noteLinkDragRef: noteLinkDrag,
      // The focused word has been focused for good: no fade in progress.
      wordFocusAnimationRef: wordFocus,
    }),
  );
  return (
    <canvas
      ref={canvasRef}
      id={`${CONTROL_ID}-canvas`}
      className="karaoke-maker__canvas"
    />
  );
};

/** The Maker open on the help song, as the Karaoke page holds it. */
const MakerDrawing = () => {
  const { t } = useTranslation();
  const toolsRef = useRef<HTMLDivElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const wordFocusAnimationRef = useRef<{
    tokenId?: string;
    startedAt: number;
  }>({ startedAt: 0 });
  const model = useMakerCanvasModel({
    durationMs: HELP_SONG.durationMs ?? 0,
    project: HELP_MAKER_PROJECT,
    selection: undefined,
    t,
    tokens: TOKENS,
    translationLanguage: HELP_MAKER_PROJECT.lyrics.language ?? 'en',
    viewDurationMs: VIEW_MS,
    playhead: PLAYHEAD,
    scrubAuditionAnchorMs: undefined,
    wordFocusAnimationRef,
  });
  const editTools = (
    <KaraokeMakerEditTools
      isRecordingLines={false}
      onToggleRecordLines={nothing}
      noteEditMode={undefined}
      onToggleNoteEditMode={nothing}
      canCopyNotes={false}
      onCopyNotes={nothing}
      canPasteNotes={false}
      onPasteNotes={nothing}
      canSplitNote={false}
      onSplitNote={nothing}
      canDelete={false}
      onDelete={nothing}
    />
  );
  const pending = TOKENS.length - CHECKED_WORDS;
  return (
    <div
      className="karaoke-workspace workspace-tab-panel workspace-tab-panel--karaoke is-maker-open has-song"
      style={PAGE_STYLE}
    >
      <div
        className="karaoke-maker"
        role="dialog"
        aria-label={t('karaoke.maker.dialog')}
      >
        <KaraokeMakerHeader
          canRedo={false}
          canUndo
          commit={nothing}
          isFullScreen={false}
          isModelWorking={false}
          issues={ISSUES}
          onApply={nothing}
          onClose={nothing}
          onToggleFullScreen={nothing}
          project={HELP_MAKER_PROJECT}
          redo={nothing}
          setDestructiveAction={nothing}
          setNotice={nothing}
          undo={nothing}
          tools={
            <KaraokeMakerToolbar
              advancedAnalysisTools={null}
              canShiftFromWord={false}
              editTools={editTools}
              exportOpen={false}
              exportProject={() => Promise.resolve()}
              handPanMode={false}
              openLyricsEditor={nothing}
              project={HELP_MAKER_PROJECT}
              projectInputRef={projectInputRef}
              removeTranslation={nothing}
              selectedToken={undefined}
              setDestructiveAction={nothing}
              setExportOpen={nothing}
              setTimingScope={nothing}
              setToolPanel={nothing}
              setTranslationLanguage={nothing}
              shiftTimeline={nothing}
              timingScope="all"
              toggleHandPanMode={nothing}
              toggleToolPanel={nothing}
              tokens={TOKENS}
              toolPanel={undefined}
              toolsRef={toolsRef}
              translationLanguage={HELP_MAKER_PROJECT.lyrics.language ?? 'en'}
              translationLanguages={[
                HELP_MAKER_PROJECT.lyrics.language ?? 'en',
              ]}
              wordShiftMs={0}
            />
          }
        />
        <div className="karaoke-maker__canvas-host">
          <div className="karaoke-maker__canvas-stage">
            <HelpMakerCanvas model={model} />
            <KaraokeMakerPitchScroller
              pitchWindow={PITCH_WINDOW}
              notes={HELP_MAKER_PROJECT.melody.notes}
              durationMs={model.effectiveDurationMs}
              gridTop={model.headerHeight}
              controls={`${CONTROL_ID}-canvas`}
              label={t('karaoke.maker.pitchRange')}
              hint={t('karaoke.maker.pitchHint')}
              onPan={nothing}
              onZoom={nothing}
              onShow={nothing}
              onFit={nothing}
            />
          </div>
          <KaraokeMakerNavigator
            durationMs={model.effectiveDurationMs}
            viewportStartMs={VIEW_START_MS}
            viewportDurationMs={model.visibleViewDurationMs}
            playheadMs={HELP_PLAYHEAD_MS}
            waveform={HELP_MAKER_PROJECT.analysis.waveform}
            notes={HELP_MAKER_PROJECT.melody.notes}
            minimumViewportMs={model.minimumViewDurationMs}
            maximumViewportMs={model.maximumViewDurationMs}
            follow
            positionLabel={t('karaoke.maker.songPosition')}
            followLabel={t('karaoke.lyrics.follow')}
            resetZoomLabel={t('karaoke.maker.resetZoom')}
            onMove={nothing}
            onResize={nothing}
            onFollow={nothing}
            onResetZoom={nothing}
          />
        </div>
        <KaraokeMakerPreview
          song={HELP_SONG}
          playheadMs={HELP_PLAYHEAD_MS}
          textSize={100}
          height={150}
          open
          followRequestKey={0}
          title={t('karaoke.maker.livePreview')}
          showLabel={t('karaoke.maker.showPreview')}
          hideLabel={t('karaoke.maker.hidePreview')}
          resizeLabel={t('karaoke.maker.previewResize')}
          textSizeLabel={t('karaoke.lyrics.textSize')}
          translationLanguage={HELP_MAKER_PROJECT.lyrics.language}
          onSeek={nothing}
          onTextSize={nothing}
          onHeight={nothing}
          onToggle={nothing}
        />
        <div className="karaoke-maker__command-dock">
          <div className="karaoke-maker__command-primary">
            <div className="karaoke-maker__status-row">
              <div className="karaoke-maker__status-end">
                <div
                  className="karaoke-maker__word-state-legend"
                  aria-label={t('karaoke.maker.wordStateLegend')}
                >
                  <span className="is-touched" data-count={CHECKED_WORDS}>
                    <i aria-hidden="true" />
                    {t('karaoke.maker.userAdjustedWords', {
                      count: CHECKED_WORDS,
                    })}
                  </span>
                  <span className="is-pending" data-count={pending}>
                    <i aria-hidden="true" />
                    {t('karaoke.maker.pendingWords', { count: pending })}
                  </span>
                </div>
                <span>
                  {t('karaoke.maker.stats', {
                    notes: HELP_MAKER_PROJECT.melody.notes.length,
                    words: TOKENS.length,
                    checks: ISSUES.length,
                  })}
                </span>
              </div>
            </div>
          </div>
          <KaraokeMakerInspector
            commit={nothing}
            controlId={CONTROL_ID}
            project={HELP_MAKER_PROJECT}
          />
        </div>
      </div>
    </div>
  );
};

export default MakerDrawing;
