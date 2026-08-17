/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerLineIsSection,
  karaokeMakerTokenWasUserTouched,
} from '../../common/karaoke/makerProject';
import { KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED } from './makerAi';
import { karaokeMakerLyricFocus } from './makerCanvasLayout';
import { TSelection } from './useKaraokeMakerSelection';
import { useTranslation } from '../utils/I18nContext';
import { formatClock } from './makerFormat';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

/**
 * The lyrics dialog: paste words in, then see how they landed.
 *
 * Two hundred and forty-five lines of JSX inside the component's return, and
 * the largest single thing in it. It is really two views sharing a frame — the
 * textarea you paste into, and the word list you check afterwards — which is
 * why the draft and the tokens both arrive.
 *
 * Nothing here decides anything. Replacing the lyrics, selecting a word,
 * cancelling a run: all of them arrive as callbacks, because each one has
 * consequences elsewhere in the editor that a dialog has no business knowing
 * about.
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

  /** Passed in, because both also appear outside this dialog. */
  renderLyricsModalWordInspector: () => ReactNode;
  renderWhisperDownloadDetails: () => ReactNode;
}

const KaraokeMakerLyricsDialog = ({
  activeLyricFocus,
  analysisMessage,
  analysisProgress,
  analysisProgressIsIndeterminate,
  cancelAnalysis,
  destructiveAction,
  displayedAnalysisProgress,
  draftLyricsWordCount,
  lyricsDraft,
  lyricsDraftChanged,
  lyricsFileName,
  lyricsInputRef,
  lyricsProcessing,
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
          <section className="karaoke-maker__lyrics-source">
            <div className="karaoke-maker__lyrics-section-head">
              <strong>{t('karaoke.maker.referenceLyrics')}</strong>
              <div className="karaoke-maker__lyrics-source-actions">
                <span title={lyricsFileName}>
                  {lyricsFileName ??
                    t('karaoke.maker.lyricsWordCount', {
                      count: draftLyricsWordCount,
                    })}
                </span>
                <button
                  type="button"
                  disabled={lyricsProcessing}
                  onClick={() => lyricsInputRef.current?.click()}
                >
                  <KaraokeMakerToolIcon name="project" />
                  <span>{t('karaoke.maker.loadLyricsFile')}</span>
                </button>
              </div>
            </div>
            <textarea
              value={lyricsDraft}
              disabled={lyricsProcessing}
              onChange={(event) => setLyricsDraft(event.target.value)}
              placeholder={t('karaoke.maker.lyricsPlaceholder')}
              spellCheck
            />
          </section>
          <section className="karaoke-maker__lyrics-timing-editor">
            <div className="karaoke-maker__lyrics-section-head">
              <strong>{t('karaoke.maker.wordTiming')}</strong>
              <span>
                {t('karaoke.maker.lyricsTimedCount', {
                  timed: tokens.filter((token) => token.startMs !== undefined)
                    .length,
                  total: tokens.length,
                })}
              </span>
            </div>
            {lyricsDraftChanged || !tokens.length ? (
              <div className="karaoke-maker__lyrics-timing-placeholder">
                <KaraokeMakerToolIcon name="timing" />
                <strong>
                  {t(
                    lyricsDraftChanged
                      ? 'karaoke.maker.lyricsApplyBeforeTiming'
                      : 'karaoke.maker.lyricsNoTimedWords',
                  )}
                </strong>
                <p>{t('karaoke.maker.lyricsTimingEditorHint')}</p>
              </div>
            ) : (
              <div className="karaoke-maker__lyrics-token-scroll">
                {project.lyrics.lines.map((line) => {
                  const isSection = karaokeMakerLineIsSection(line);
                  return (
                    <div
                      key={line.id}
                      className={`karaoke-maker__lyrics-token-line${
                        isSection ? ' is-section' : ''
                      }`}
                    >
                      {line.tokens.map((token) =>
                        isSection ? (
                          <span key={token.id}>{token.text}</span>
                        ) : (
                          <button
                            key={token.id}
                            type="button"
                            className={`${
                              selection?.kind === 'word' &&
                              selection.id === token.id
                                ? 'is-selected '
                                : ''
                            }${
                              token.id === activeLyricFocus?.tokenId
                                ? 'is-current '
                                : ''
                            }${
                              token.startMs === undefined ? 'is-untimed ' : ''
                            }${
                              karaokeMakerTokenWasUserTouched(token)
                                ? 'is-adjusted'
                                : ''
                            }`}
                            onClick={() => selectLyricsEditorToken(token)}
                            title={
                              token.startMs === undefined
                                ? t('karaoke.maker.untimed')
                                : `${formatClock(token.startMs)} → ${formatClock(
                                    token.endMs ?? token.startMs,
                                  )}`
                            }
                          >
                            {token.text}
                          </button>
                        ),
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!lyricsDraftChanged &&
              tokens.length > 0 &&
              renderLyricsModalWordInspector()}
          </section>
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
          {lyricsProcessing ? (
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
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default KaraokeMakerLyricsDialog;
