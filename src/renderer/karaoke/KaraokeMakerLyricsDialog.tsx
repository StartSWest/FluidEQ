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
  useEffect,
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
import { plainLyrics } from './useKaraokeMakerLyricsDraft';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import KaraokeMakerLyricsPasteView from './KaraokeMakerLyricsPasteView';
import KaraokeMakerLyricsWordList from './KaraokeMakerLyricsWordList';

/**
 * The lyrics dialog: paste words in, then see how they landed.
 *
 * It is really two views sharing a frame — the textarea you paste into
 * (`KaraokeMakerLyricsPasteView`) and the word list you check afterwards
 * (`KaraokeMakerLyricsWordList`) — which is why the draft and the tokens
 * both arrive here and are handed onward. Splitting them out is what made
 * room for the target-language field without this file becoming the largest
 * thing in the Maker a second time.
 *
 * The frame itself now also decides which language a confirmed paste lands
 * on: `pasteTarget` at the original tag is the dialog's original job
 * (`replaceLyrics`, which overwrites and re-times that sheet); any other tag
 * is a translation, seeded from the original's already-known timing instead
 * of detected fresh, so the three replace/detect buttons and the word-timing
 * panel — both specific to the original — are swapped for a single confirm
 * and a read-only, numbered view of the original to paste alongside.
 *
 * Nothing here decides what a confirmed paste *means* — that is
 * `replaceLyrics` and `addTranslation`, arriving as callbacks, because each
 * has consequences elsewhere in the editor a dialog has no business knowing
 * about. This file only decides which of the two the current selection asks
 * for.
 */
export interface IKaraokeMakerLyricsDialogProps {
  project: IKaraokeMakerProject;
  tokens: IKaraokeMakerToken[];
  selection: TSelection;
  activeLyricFocus: ReturnType<typeof karaokeMakerLyricFocus>;

  /** The pasted text, before it becomes lines. */
  lyricsDraft: string;
  setLyricsDraft: Dispatch<SetStateAction<string>>;
  setLyricsOpen: Dispatch<SetStateAction<boolean>>;
  lyricsDraftChanged: boolean;
  lyricsFileName: string | undefined;
  draftLyricsWordCount: number;
  lyricsInputRef: RefObject<HTMLInputElement | null>;

  /** A run in flight, shown inside the dialog while it works. */
  lyricsProcessing: boolean;
  analysisProgress: number | undefined;
  analysisMessage: string | undefined;
  displayedAnalysisProgress: number;
  analysisProgressIsIndeterminate: boolean;
  cancelAnalysis: () => void;

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

  /**
   * Seed a translated sheet from the pasted text, or report back how many
   * lines it should have had. Refuses and reports rather than throws, since a
   * mismatched paste is the expected first outcome, not an error state.
   */
  addTranslation: (text: string, target: string) => void;
  /** Set when the last `addTranslation` call disagreed on line count. */
  mismatch: { expected: number; received: number } | undefined;
  /** Must be called whenever the pasted text changes — a stale count sitting
   * under text the user has already edited would be wrong. */
  clearMismatch: () => void;

  /** Passed in, because both also appear outside this dialog. */
  renderLyricsModalWordInspector: () => ReactNode;
  renderWhisperDownloadDetails: () => ReactNode;
}

const KaraokeMakerLyricsDialog = ({
  activeLyricFocus,
  addTranslation,
  analysisMessage,
  analysisProgress,
  analysisProgressIsIndeterminate,
  cancelAnalysis,
  clearMismatch,
  destructiveAction,
  displayedAnalysisProgress,
  draftLyricsWordCount,
  lyricsDraft,
  lyricsDraftChanged,
  lyricsFileName,
  lyricsInputRef,
  lyricsProcessing,
  mismatch,
  project,
  renderLyricsModalWordInspector,
  renderWhisperDownloadDetails,
  replaceLyrics,
  selectLyricsEditorToken,
  selection,
  setLyricsDraft,
  setLyricsOpen,
  tokens,
}: IKaraokeMakerLyricsDialogProps) => {
  const { t } = useTranslation();
  // `karaokeTranslationLanguages` and `useMakerTranslations` use this exact
  // fallback — the sentinel is only for a project that never declared a
  // language, and UltraStar imports populate a real tag from `#LANGUAGE`, so
  // the bare constant is not a reliable stand-in for "the original" once a
  // project has one.
  const originalLanguage = project.lyrics.language ?? KARAOKE_ORIGINAL_LANGUAGE;
  // Resets to the original every time the dialog opens, because the parent
  // only ever mounts this component fresh (`lyricsOpen && <...>`) — there is
  // no stale selection to carry across a close.
  const [pasteTarget, setPasteTarget] = useState(originalLanguage);
  const isTranslationTarget = pasteTarget !== originalLanguage;

  const handleDraftChange = (value: string) => {
    setLyricsDraft(value);
    clearMismatch();
  };

  // `addTranslation` reports success only by leaving `mismatch` unset, and
  // that field already starts unset before any attempt — so watching it
  // alone cannot tell "never tried" from "just succeeded". This flag marks
  // the one render that followed a real submit, and is cleared the instant
  // it is read, which is what lets the effect below tell the two apart.
  const [translationSubmitted, setTranslationSubmitted] = useState(false);
  useEffect(() => {
    if (!translationSubmitted) {
      return;
    }
    setTranslationSubmitted(false);
    if (!mismatch) {
      setLyricsOpen(false);
    }
  }, [translationSubmitted, mismatch, setLyricsOpen]);

  const confirmTranslation = () => {
    setTranslationSubmitted(true);
    addTranslation(lyricsDraft, pasteTarget);
  };

  // One text entry per `project.lyrics.lines` entry, in the same order:
  // `plainLyrics` already builds exactly that, newline-joined, so splitting
  // it back apart recovers each line's words without a second token-join
  // here. Section headings consume no *pasted* line — `seedKaraokeTranslation`
  // filters them out before counting — so they carry no number either, or a
  // user counting rows against the mismatch message would arrive at a
  // different number than the code did.
  const originalLineRows = useMemo(() => {
    const texts = plainLyrics(project).split('\n');
    let lyricNumber = 0;
    return project.lyrics.lines.map((line, index) => {
      const isSection = karaokeMakerLineIsSection(line);
      if (!isSection) {
        lyricNumber += 1;
      }
      return {
        id: line.id,
        text: texts[index] ?? '',
        isSection,
        number: isSection ? undefined : lyricNumber,
      };
    });
  }, [project]);

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
            onDraftChange={handleDraftChange}
            onTargetLanguageChange={setPasteTarget}
            originalLanguage={originalLanguage}
            targetLanguage={pasteTarget}
          />
          {isTranslationTarget ? (
            <section className="karaoke-maker__lyrics-reference">
              <div className="karaoke-maker__lyrics-reference-head">
                <div className="karaoke-maker__lyrics-section-head">
                  <strong>{t('karaoke.maker.referenceLyrics')}</strong>
                </div>
                {mismatch && (
                  <p
                    className="karaoke-maker__translation-mismatch"
                    role="status"
                  >
                    {t('karaoke.translation.mismatch', {
                      expected: mismatch.expected,
                      received: mismatch.received,
                    })}
                  </p>
                )}
              </div>
              <div className="karaoke-maker__lyrics-token-scroll">
                {originalLineRows.map((row) => (
                  <div
                    key={row.id}
                    className={`karaoke-maker__lyrics-token-line${
                      row.isSection ? ' is-section' : ''
                    }`}
                  >
                    {row.isSection ? (
                      <span>{row.text}</span>
                    ) : (
                      <>
                        <span className="karaoke-maker__lyrics-line-number">
                          {row.number}
                        </span>
                        <span>{row.text}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <KaraokeMakerLyricsWordList
              activeLyricFocus={activeLyricFocus}
              lyricsDraftChanged={lyricsDraftChanged}
              project={project}
              renderLyricsModalWordInspector={renderLyricsModalWordInspector}
              selectLyricsEditorToken={selectLyricsEditorToken}
              selection={selection}
              tokens={tokens}
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
