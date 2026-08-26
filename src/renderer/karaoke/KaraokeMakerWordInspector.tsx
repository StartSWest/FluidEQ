/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ReactNode } from 'react';
import { IKaraokeMakerToken } from '../../common/karaoke/makerProject';
import { useTranslation } from '../utils/I18nContext';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import { formatClock } from './makerFormat';

interface IKaraokeMakerWordInspectorProps {
  /** Undefined shows the empty state rather than nothing. */
  selectedToken?: IKaraokeMakerToken;
  tokens: IKaraokeMakerToken[];
  playheadMs: number;
  /** Disables the controls while a detection run owns the lyrics. */
  isProcessing: boolean;
  /** Prefix for the label/input pairs, so two editors on screen stay distinct. */
  controlId: string;
  /** Only ever one word either way, so the type says so. */
  onMoveSelection: (direction: -1 | 1) => void;
  onAudition: (token: IKaraokeMakerToken) => void;
  onStartLineEntry: (preferredTokenId?: string) => void;
  onTimingChange: (update: {
    text?: string;
    startMs?: number;
    durationMs?: number;
  }) => void;
  /**
   * The sliders, built by the caller from an id prefix.
   *
   * They read the neighbouring words to decide how far a boundary may move,
   * which is the project's business and not this panel's — but the ids have to
   * be unique per word, so the prefix comes from here.
   */
  renderTimingSliders: (idPrefix: string) => ReactNode;
}

/**
 * The selected word, and what can be done to its timing.
 *
 * The right-hand half of the lyrics editor. It was a render function inside a
 * seven-thousand-line component; the modal that holds it is genuinely the UI
 * for both the lyric draft and the detection run, so it does not get cheaper by
 * being moved — but its interior does.
 */
const KaraokeMakerWordInspector = ({
  selectedToken,
  tokens,
  playheadMs,
  isProcessing,
  controlId,
  onMoveSelection,
  onAudition,
  onStartLineEntry,
  onTimingChange,
  renderTimingSliders,
}: IKaraokeMakerWordInspectorProps) => {
  const { t } = useTranslation();
  if (!selectedToken) {
    return (
      <div className="karaoke-maker__lyrics-word-empty">
        <KaraokeMakerToolIcon name="lyrics" />
        <span>{t('karaoke.maker.lyricsSelectWord')}</span>
      </div>
    );
  }
  const selectedIndex = tokens.findIndex(
    (token) => token.id === selectedToken.id,
  );
  return (
    <div className="karaoke-maker__lyrics-word-editor">
      <div className="karaoke-maker__lyrics-word-editor-head">
        <div>
          <span>{t('karaoke.maker.lyricsSelectedWord')}</span>
          <strong>{selectedToken.text}</strong>
        </div>
        <nav aria-label={t('karaoke.maker.lyricsWordNavigation')}>
          <button
            type="button"
            disabled={selectedIndex <= 0}
            onClick={() => onMoveSelection(-1)}
            aria-label={t('karaoke.maker.previousWord')}
          >
            <KaraokeMakerToolIcon name="previous" />
          </button>
          <output>
            {selectedIndex + 1} / {tokens.length}
          </output>
          <button
            type="button"
            disabled={selectedIndex < 0 || selectedIndex >= tokens.length - 1}
            onClick={() => onMoveSelection(1)}
            aria-label={t('karaoke.maker.nextWord')}
          >
            <KaraokeMakerToolIcon name="next" />
          </button>
        </nav>
      </div>
      {renderTimingSliders(`${controlId}-lyrics-word-${selectedToken.id}`)}
      <div className="karaoke-maker__lyrics-word-actions">
        <button
          type="button"
          disabled={selectedToken.startMs === undefined}
          onClick={() => onAudition(selectedToken)}
        >
          <KaraokeMakerToolIcon name="preview" />
          {t('karaoke.maker.playWord')}
        </button>
        <button
          type="button"
          onClick={() => onTimingChange({ startMs: playheadMs })}
        >
          <KaraokeMakerToolIcon name="timing" />
          {t('karaoke.maker.usePlayhead')}
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={isProcessing}
          onClick={() => onStartLineEntry(selectedToken.id)}
        >
          <KaraokeMakerToolIcon name="align" />
          {t('karaoke.maker.syncLinesFromHere')}
        </button>
        <span
          className={
            selectedToken.startMs === undefined ? 'is-untimed' : undefined
          }
        >
          {selectedToken.startMs === undefined
            ? t('karaoke.maker.untimed')
            : `${formatClock(selectedToken.startMs)} → ${formatClock(
                selectedToken.endMs ?? selectedToken.startMs,
              )}`}
        </span>
      </div>
    </div>
  );
};

export default KaraokeMakerWordInspector;
