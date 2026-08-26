/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode } from 'react';
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
 * The word list you check afterwards: every timed token, tappable, with the
 * inspector for whichever one is selected.
 *
 * Half of `KaraokeMakerLyricsDialog`'s two views (see that file for why they
 * were split apart). Always reads `project.lyrics.lines` — the original's
 * timing — because a translation has no word-level taps of its own yet; its
 * timing is seeded proportionally from these tokens' spans.
 */
export interface IKaraokeMakerLyricsWordListProps {
  project: IKaraokeMakerProject;
  tokens: IKaraokeMakerToken[];
  selection: TSelection;
  activeLyricFocus: ReturnType<typeof karaokeMakerLyricFocus>;
  lyricsDraftChanged: boolean;
  selectLyricsEditorToken: (token: IKaraokeMakerToken) => void;
  /** Passed in, because it also appears outside this dialog. */
  renderLyricsModalWordInspector: () => ReactNode;
}

const KaraokeMakerLyricsWordList = ({
  activeLyricFocus,
  lyricsDraftChanged,
  project,
  renderLyricsModalWordInspector,
  selectLyricsEditorToken,
  selection,
  tokens,
}: IKaraokeMakerLyricsWordListProps) => {
  const { t } = useTranslation();
  return (
    <section className="karaoke-maker__lyrics-timing-editor">
      <div className="karaoke-maker__lyrics-section-head">
        <strong>{t('karaoke.maker.wordTiming')}</strong>
        <span>
          {t('karaoke.maker.lyricsTimedCount', {
            timed: tokens.filter((token) => token.startMs !== undefined).length,
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
                        selection?.kind === 'word' && selection.id === token.id
                          ? 'is-selected '
                          : ''
                      }${
                        token.id === activeLyricFocus?.tokenId
                          ? 'is-current '
                          : ''
                      }${token.startMs === undefined ? 'is-untimed ' : ''}${
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
  );
};

export default KaraokeMakerLyricsWordList;
