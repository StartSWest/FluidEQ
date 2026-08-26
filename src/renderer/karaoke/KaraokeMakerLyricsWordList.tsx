/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerLineIsSection,
  karaokeMakerTokenWasUserTouched,
} from '../../common/karaoke/makerProject';
import { karaokeMakerLyricFocus } from './makerCanvasLayout';
import { TSelection } from './useKaraokeMakerSelection';
import { useTranslation } from '../utils/I18nContext';
import { formatClock } from './makerFormat';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

/**
 * The word list you check afterwards: every timed token, tappable and
 * draggable, with the inspector for whichever one is selected.
 *
 * One of `KaraokeMakerLyricsDialog`'s views (see that file for why they were
 * split apart). It reads the *preview* project rather than the saved one, so
 * an unapplied edit in the textarea is reflected here before it is committed —
 * and `timingEditingLocked` is what stops a drag rearranging timing that the
 * preview has not yet reconciled.
 *
 * Always the original's lines, never a translation's: a translation has no
 * word-level taps of its own, its timing being seeded proportionally from
 * these tokens' spans. A translation shows `KaraokeMakerLyricsReferenceView`
 * in this slot instead.
 */
export interface IKaraokeMakerLyricsWordListProps {
  /** The draft reconciled against the project, so edits preview before apply. */
  previewProject: IKaraokeMakerProject;
  previewTokens: IKaraokeMakerToken[];
  selection: TSelection;
  activeLyricFocus: ReturnType<typeof karaokeMakerLyricFocus>;
  lyricsDraftChanged: boolean;
  /** Dragging must not retime words the preview has not reconciled yet. */
  timingEditingLocked: boolean;
  draggedWordId: string | undefined;
  setDraggedWordId: Dispatch<SetStateAction<string | undefined>>;
  dropLineId: string | undefined;
  setDropLineId: Dispatch<SetStateAction<string | undefined>>;
  moveLyricsEditorWord: (
    tokenId: string,
    lineId: string,
    beforeTokenId: string | null,
  ) => void;
  selectLyricsEditorToken: (token: IKaraokeMakerToken) => void;
  /** Passed in, because it also appears outside this dialog. */
  renderLyricsModalWordInspector: () => ReactNode;
}

const KaraokeMakerLyricsWordList = ({
  activeLyricFocus,
  draggedWordId,
  dropLineId,
  lyricsDraftChanged,
  moveLyricsEditorWord,
  previewProject,
  previewTokens,
  renderLyricsModalWordInspector,
  selectLyricsEditorToken,
  selection,
  setDraggedWordId,
  setDropLineId,
  timingEditingLocked,
}: IKaraokeMakerLyricsWordListProps) => {
  const { t } = useTranslation();
  return (
    <section className="karaoke-maker__lyrics-timing-editor">
      <div className="karaoke-maker__lyrics-section-head">
        <strong>{t('karaoke.maker.wordTiming')}</strong>
        <span>
          {t('karaoke.maker.lyricsTimedCount', {
            timed: previewTokens.filter(
              (token) =>
                token.startMs !== undefined && token.endMs !== undefined,
            ).length,
            total: previewTokens.length,
          })}
        </span>
      </div>
      {!previewTokens.length ? (
        <div className="karaoke-maker__lyrics-timing-placeholder">
          <KaraokeMakerToolIcon name="timing" />
          <strong>{t('karaoke.maker.lyricsNoTimedWords')}</strong>
          <p>{t('karaoke.maker.lyricsTimingEditorHint')}</p>
        </div>
      ) : (
        <div className="karaoke-maker__lyrics-token-preview">
          {lyricsDraftChanged && (
            <div
              className="karaoke-maker__lyrics-draft-preview-note"
              role="status"
            >
              <KaraokeMakerToolIcon name="apply" />
              <span>{t('karaoke.maker.lyricsApplyBeforeTiming')}</span>
            </div>
          )}
          <div
            className={`karaoke-maker__lyrics-token-scroll${
              lyricsDraftChanged ? ' is-preview' : ''
            }`}
          >
            {previewProject.lyrics.lines.map((line) => {
              const isSection = karaokeMakerLineIsSection(line);
              return (
                <div
                  key={line.id}
                  className={`karaoke-maker__lyrics-token-line${
                    isSection ? ' is-section' : ''
                  }${dropLineId === line.id ? ' is-drop-target' : ''}`}
                  onDragOver={
                    isSection || timingEditingLocked
                      ? undefined
                      : (event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          setDropLineId(line.id);
                        }
                  }
                  onDragLeave={(event) => {
                    const nextTarget = event.relatedTarget;
                    if (
                      !(nextTarget instanceof Node) ||
                      !event.currentTarget.contains(nextTarget)
                    ) {
                      setDropLineId(undefined);
                    }
                  }}
                  onDrop={
                    isSection || timingEditingLocked
                      ? undefined
                      : (event) => {
                          event.preventDefault();
                          const tokenId =
                            draggedWordId ||
                            event.dataTransfer.getData('text/plain');
                          if (tokenId) {
                            moveLyricsEditorWord(tokenId, line.id, null);
                          }
                          setDraggedWordId(undefined);
                          setDropLineId(undefined);
                        }
                  }
                >
                  {line.tokens.map((token) =>
                    isSection ? (
                      <span key={token.id}>{token.text}</span>
                    ) : (
                      <button
                        key={token.id}
                        type="button"
                        draggable={!timingEditingLocked}
                        aria-disabled={timingEditingLocked}
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
                          token.startMs === undefined ||
                          token.endMs === undefined
                            ? 'is-untimed '
                            : ''
                        }${
                          karaokeMakerTokenWasUserTouched(token)
                            ? 'is-adjusted'
                            : ''
                        }`}
                        onClick={
                          timingEditingLocked
                            ? undefined
                            : () => selectLyricsEditorToken(token)
                        }
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', token.id);
                          setDraggedWordId(token.id);
                        }}
                        onDragEnd={() => {
                          setDraggedWordId(undefined);
                          setDropLineId(undefined);
                        }}
                        onDragOver={
                          timingEditingLocked
                            ? undefined
                            : (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                event.dataTransfer.dropEffect = 'move';
                                setDropLineId(line.id);
                              }
                        }
                        onDrop={
                          timingEditingLocked
                            ? undefined
                            : (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const tokenId =
                                  draggedWordId ||
                                  event.dataTransfer.getData('text/plain');
                                if (tokenId) {
                                  moveLyricsEditorWord(
                                    tokenId,
                                    line.id,
                                    token.id,
                                  );
                                }
                                setDraggedWordId(undefined);
                                setDropLineId(undefined);
                              }
                        }
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
        </div>
      )}
      {!lyricsDraftChanged &&
        previewTokens.length > 0 &&
        renderLyricsModalWordInspector()}
    </section>
  );
};

export default KaraokeMakerLyricsWordList;
