/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Dispatch,
  ReactNode,
  RefObject,
  SetStateAction,
  useMemo,
  useState,
} from 'react';
import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  KARAOKE_ORIGINAL_LANGUAGE,
  karaokeMakerLineIsSection,
} from '../../common/karaoke/makerProject';
import { KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED } from './makerAi';
import { karaokeMakerLyricFocus } from './makerCanvasLayout';
import { TSelection } from './useKaraokeMakerSelection';
import { useTranslation } from '../utils/I18nContext';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import KaraokeMakerLyricsPasteView from './KaraokeMakerLyricsPasteView';
import KaraokeMakerLyricsWordList from './KaraokeMakerLyricsWordList';
import KaraokeMakerLyricsReferenceView from './KaraokeMakerLyricsReferenceView';
import KaraokeMakerAnalysisError, {
  TKaraokeMakerAnalysisRetry,
} from './KaraokeMakerAnalysisError';
import { reconcileKaraokeMakerLyrics } from './makerLyricsReconcile';

/**
 * The lyrics dialog: paste words in, then see how they landed.
 *
 * It is really three views sharing a frame — the textarea you paste into
 * (`KaraokeMakerLyricsPasteView`), the word list you check afterwards
 * (`KaraokeMakerLyricsWordList`), and the read-only original a translation
 * gets checked against instead (`KaraokeMakerLyricsReferenceView`) — which is
 * why the draft and the tokens both arrive here and are handed onward.
 * Splitting them out is what made room for the target-language field without
 * this file becoming the largest thing in the Maker a second time.
 *
 * The frame itself also decides which language a confirmed paste lands on:
 * `pasteTarget` at the original tag is the dialog's original job
 * (`replaceLyrics`, which overwrites and re-times that sheet); any other tag
 * is a translation, seeded from the original's already-known timing instead
 * of detected fresh, so the three replace/detect buttons and the word-timing
 * panel — both specific to the original — are swapped for a single confirm
 * and the reference view.
 *
 * Nothing here decides what a confirmed paste *means* — that is
 * `replaceLyrics` and `addTranslation`, arriving as callbacks, because each
 * has consequences elsewhere in the editor a dialog has no business knowing
 * about. This file only decides which of the two the current selection asks
 * for.
 */
export interface IKaraokeMakerLyricsDialogProps {
  project: IKaraokeMakerProject;
  selection: TSelection;
  activeLyricFocus: ReturnType<typeof karaokeMakerLyricFocus>;

  /** The pasted text, before it becomes lines. Its setter already clears a
   * stale mismatch on every change — see `useKaraokeMakerLyricsDraft` — so
   * nothing here needs to wrap it again. */
  lyricsDraft: string;
  setLyricsDraft: Dispatch<SetStateAction<string>>;
  setLyricsOpen: Dispatch<SetStateAction<boolean>>;
  lyricsDraftChanged: boolean;
  lyricsFileName: string | undefined;
  draftLyricsWordCount: number;
  lyricsInputRef: RefObject<HTMLInputElement | null>;

  /** Which language the entry point that opened this dialog wants: the
   * original (undefined, every entry point before Task 8) or a translation
   * seeded toward this tag ("Add a language"). Read once, as the paste
   * target's initial value — the field is free to change it afterward. */
  initialTranslationTarget: string | undefined;

  /** A run in flight, shown inside the dialog while it works. */
  lyricsProcessing: boolean;
  analysisProgress: number | undefined;
  analysisMessage: string | undefined;
  displayedAnalysisProgress: number;
  analysisProgressIsIndeterminate: boolean;
  analysisError: string | undefined;
  analysisRetry: TKaraokeMakerAnalysisRetry | undefined;
  cancelAnalysis: () => void;
  retryAnalysis: (retry: TKaraokeMakerAnalysisRetry) => Promise<void>;
  dismissAnalysisError: () => void;

  /**
   * What replacing the lyrics is about to destroy, if anything.
   *
   * The dialog shows the warning; the component owns the confirmation, because
   * the same prompt guards clearing notes and restoring the original.
   */
  destructiveAction: string | undefined;
  replaceLyrics: (
    detectTimingAndMelody?: boolean,
    recordLinesAfter?: boolean,
  ) => void;
  selectLyricsEditorToken: (token: IKaraokeMakerToken) => void;
  moveLyricsEditorWord: (
    tokenId: string,
    targetLineId: string,
    beforeTokenId?: string | null,
  ) => void;

  /**
   * Seed a translated sheet from the pasted text, returning how many lines
   * it should have had if the count disagreed — undefined on success.
   * Refuses and reports rather than throws, since a mismatched paste is the
   * expected first outcome, not an error state.
   */
  addTranslation: (
    text: string,
    target: string,
  ) => { expected: number; received: number } | undefined;
  /** Set when the last `addTranslation` call disagreed on line count. */
  mismatch: { expected: number; received: number } | undefined;

  /** Passed in, because both also appear outside this dialog. */
  renderLyricsModalWordInspector: () => ReactNode;
  renderWhisperDownloadDetails: () => ReactNode;
}

const KaraokeMakerLyricsDialog = ({
  activeLyricFocus,
  addTranslation,
  analysisError,
  analysisMessage,
  analysisProgress,
  analysisProgressIsIndeterminate,
  analysisRetry,
  cancelAnalysis,
  destructiveAction,
  displayedAnalysisProgress,
  dismissAnalysisError,
  draftLyricsWordCount,
  initialTranslationTarget,
  lyricsDraft,
  lyricsDraftChanged,
  lyricsFileName,
  lyricsInputRef,
  lyricsProcessing,
  mismatch,
  project,
  moveLyricsEditorWord,
  renderLyricsModalWordInspector,
  renderWhisperDownloadDetails,
  replaceLyrics,
  retryAnalysis,
  selectLyricsEditorToken,
  selection,
  setLyricsDraft,
  setLyricsOpen,
}: IKaraokeMakerLyricsDialogProps) => {
  const { t } = useTranslation();
  // `karaokeTranslationLanguages` and `useMakerTranslations` use this exact
  // fallback — the sentinel is only for a project that never declared a
  // language, and UltraStar imports populate a real tag from `#LANGUAGE`, so
  // the bare constant is not a reliable stand-in for "the original" once a
  // project has one.
  const originalLanguage = project.lyrics.language ?? KARAOKE_ORIGINAL_LANGUAGE;
  // Seeded from the entry point, then owned here: the parent only ever
  // mounts this component fresh (`lyricsOpen && <...>`), so there is no
  // stale selection to carry across a close and this only needs to be read
  // once, not kept in sync with a prop that can no longer change under it.
  const [pasteTarget, setPasteTarget] = useState(
    initialTranslationTarget ?? originalLanguage,
  );
  const isTranslationTarget = pasteTarget !== originalLanguage;

  // `addTranslation` already knows the answer the instant it runs, so the
  // dialog reads it straight from the call rather than watching state a
  // render behind — no flag is needed to tell "just succeeded" apart from
  // "never tried".
  const confirmTranslation = () => {
    if (!addTranslation(lyricsDraft, pasteTarget)) {
      setLyricsOpen(false);
    }
  };

  // Built ahead of the return rather than as an inline ternary chain: a third
  // branch (processing / translation / replace-or-detect) made the JSX read
  // as a nested ternary, and the three are mutually exclusive states, not a
  // cascade of fallbacks.
  let actionBarContent: ReactNode;
  if (lyricsProcessing) {
    actionBarContent = (
      <>
        <button type="button" onClick={cancelAnalysis}>
          {t('karaoke.maker.cancel')}
        </button>
        <button
          className="is-primary"
          type="button"
          onClick={() => setLyricsOpen(false)}
        >
          {t('karaoke.maker.continueInBackground')}
        </button>
      </>
    );
  } else if (isTranslationTarget) {
    actionBarContent = (
      // Small emphasis, not the three-way replace/detect choice: a
      // translation always gets the same treatment — seeded from the
      // original's timing — so there is only one action to confirm. Still
      // `button small`, not `subtle`: a count mismatch is asking the user to
      // fix the text, not offering them a way out of it.
      <button
        type="button"
        className="button small"
        disabled={!lyricsDraft.trim()}
        onClick={confirmTranslation}
      >
        <KaraokeMakerToolIcon name="apply" />
        {t('karaoke.translation.add')}
      </button>
    );
  } else {
    actionBarContent = (
      <>
        <button
          type="button"
          disabled={!lyricsDraft.trim()}
          onClick={() => replaceLyrics(false)}
        >
          <KaraokeMakerToolIcon name="apply" />
          {t(
            destructiveAction === 'replace-lyrics'
              ? 'karaoke.maker.replaceLyrics'
              : 'karaoke.maker.acceptLyrics',
          )}
        </button>
        <button
          type="button"
          disabled={!lyricsDraft.trim()}
          onClick={() => replaceLyrics(false, true)}
        >
          <KaraokeMakerToolIcon name="timing" />
          {t('karaoke.maker.acceptAndRecordLines')}
        </button>
        {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && (
          <button
            className="is-primary"
            type="button"
            disabled={!lyricsDraft.trim()}
            onClick={() => replaceLyrics(true)}
          >
            <KaraokeMakerToolIcon name="analyze" />
            {t(
              destructiveAction === 'replace-lyrics'
                ? 'karaoke.maker.replaceAndDetect'
                : 'karaoke.maker.detectTimingMelody',
            )}
          </button>
        )}
      </>
    );
  }

  const [draggedWordId, setDraggedWordId] = useState<string>();
  const [dropLineId, setDropLineId] = useState<string>();
  const previewProject = useMemo(
    () =>
      lyricsDraftChanged
        ? reconcileKaraokeMakerLyrics(project, lyricsDraft).project
        : project,
    [lyricsDraft, lyricsDraftChanged, project],
  );
  const previewTokens = useMemo(
    () =>
      previewProject.lyrics.lines
        .filter((line) => !karaokeMakerLineIsSection(line))
        .flatMap((line) => line.tokens),
    [previewProject],
  );
  const timingEditingLocked = lyricsProcessing || lyricsDraftChanged;
  return (
    <div
      className={`karaoke-maker__modal-backdrop${
        lyricsProcessing ? ' is-processing' : ''
      }`}
      role="presentation"
    >
      <div
        className={`karaoke-maker__lyrics-modal${
          lyricsProcessing ? ' is-processing' : ''
        }`}
        role="dialog"
        aria-label={t('karaoke.maker.lyricsTitle')}
      >
        <header className="karaoke-maker__lyrics-modal-head">
          <div>
            <span className="karaoke-maker__eyebrow">
              {t('karaoke.maker.lyricsEyebrow')}
            </span>
            <h2>{t('karaoke.maker.lyricsTitle')}</h2>
            <p>{t('karaoke.maker.lyricsReferenceHint')}</p>
          </div>
        </header>
        <button
          className="karaoke-maker__lyrics-modal-close"
          type="button"
          aria-label={t('karaoke.maker.cancel')}
          data-tooltip={t('karaoke.maker.cancel')}
          onClick={() => setLyricsOpen(false)}
        >
          <KaraokeMakerToolIcon name="close" />
        </button>
        <div className="karaoke-maker__lyrics-editor-body">
          <KaraokeMakerLyricsPasteView
            draftLyricsWordCount={draftLyricsWordCount}
            lyricsDraft={lyricsDraft}
            lyricsFileName={lyricsFileName}
            lyricsInputRef={lyricsInputRef}
            lyricsProcessing={lyricsProcessing}
            onDraftChange={setLyricsDraft}
            onTargetLanguageChange={setPasteTarget}
            originalLanguage={originalLanguage}
            previewProject={previewProject}
            targetLanguage={pasteTarget}
          />
          {isTranslationTarget ? (
            <KaraokeMakerLyricsReferenceView
              mismatch={mismatch}
              project={project}
            />
          ) : (
            <KaraokeMakerLyricsWordList
              activeLyricFocus={activeLyricFocus}
              draggedWordId={draggedWordId}
              dropLineId={dropLineId}
              lyricsDraftChanged={lyricsDraftChanged}
              moveLyricsEditorWord={moveLyricsEditorWord}
              previewProject={previewProject}
              previewTokens={previewTokens}
              renderLyricsModalWordInspector={renderLyricsModalWordInspector}
              selectLyricsEditorToken={selectLyricsEditorToken}
              selection={selection}
              setDraggedWordId={setDraggedWordId}
              setDropLineId={setDropLineId}
              timingEditingLocked={timingEditingLocked}
            />
          )}
        </div>
        {analysisProgress !== undefined && (
          <div
            className="karaoke-maker__lyrics-progress"
            role="status"
            aria-live="polite"
          >
            <div className="karaoke-maker__analysis-progress-heading">
              <strong>
                {analysisMessage ?? t('karaoke.maker.whisperPreparing')}
              </strong>
              {!analysisProgressIsIndeterminate && (
                <span>{Math.round(displayedAnalysisProgress * 100)}%</span>
              )}
            </div>
            {renderWhisperDownloadDetails()}
            <div
              className={`karaoke-maker__analysis-progress-bar${
                analysisProgressIsIndeterminate ? ' is-indeterminate' : ''
              }`}
              role="progressbar"
              aria-label={
                analysisMessage ?? t('karaoke.maker.whisperPreparing')
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                analysisProgressIsIndeterminate
                  ? undefined
                  : Math.round(displayedAnalysisProgress * 100)
              }
            >
              <span
                style={
                  analysisProgressIsIndeterminate
                    ? undefined
                    : { width: `${displayedAnalysisProgress * 100}%` }
                }
              />
            </div>
          </div>
        )}
        {analysisProgress === undefined && analysisError && (
          <KaraokeMakerAnalysisError
            error={analysisError}
            retry={analysisRetry}
            onRetry={retryAnalysis}
            onDismiss={dismissAnalysisError}
            inline
          />
        )}
        <div className="karaoke-maker__modal-actions karaoke-maker__lyrics-actions">
          {destructiveAction === 'replace-lyrics' && (
            <p className="karaoke-maker__replace-warning" role="alert">
              {t('karaoke.maker.replaceLyricsWarning')}
            </p>
          )}
          {actionBarContent}
        </div>
      </div>
    </div>
  );
};

export default KaraokeMakerLyricsDialog;
