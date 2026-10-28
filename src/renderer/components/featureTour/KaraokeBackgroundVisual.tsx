/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo } from 'react';
import type { IKaraokeSong } from '../../../common/karaoke/types';
import KaraokeGraphBackgroundButton from '../../karaoke/KaraokeGraphBackgroundButton';
import KaraokeLyrics from '../../karaoke/KaraokeLyrics';
import { useTranslation } from '../../utils/I18nContext';
import scene from '../../../../assets/tour/scene-aurora.jpg';
import '../../styles/Karaoke.scss';

const nothing = () => undefined;

/**
 * The real lyric renderer and background control, with synthetic words. Only
 * the scene is a shipped still, as in PlayerPicture: a tour never starts an
 * audio capture or reads the listener's song, scene ownership or playlist.
 */
function KaraokeDrawing() {
  const { t } = useTranslation();
  const lyric = t('tour.karaokeBackground.lyric');
  const song = useMemo<IKaraokeSong>(
    () => ({
      id: 'tour-karaoke-background',
      title: '',
      assets: [],
      timingPrecision: 'line',
      lines: [
        {
          id: 'tour-line',
          startMs: 0,
          endMs: 8000,
          tokens: [{ text: lyric, startMs: 0, endMs: 8000 }],
        },
      ],
      pitch: { kind: 'none', reason: 'missing' },
      meta: { sourceFormat: 'tour', gapMs: 0 },
    }),
    [lyric],
  );
  return (
    <div
      className="karaoke-background-visual__drawing"
      inert
      aria-hidden="true"
    >
      <div className="karaoke-background-visual__stage">
        <div className="karaoke-stage-media karaoke-graph-background">
          <img
            className="karaoke-background-visual__scene"
            src={scene}
            alt=""
          />
        </div>
        <KaraokeLyrics song={song} playheadMs={3400} onSeek={nothing} />
      </div>
      <div className="karaoke-workspace__actions">
        <KaraokeGraphBackgroundButton isSelected onClick={nothing} />
        <span>{t('karaoke.stage.showGraph')}</span>
      </div>
    </div>
  );
}

export default function KaraokeBackgroundVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="karaoke-background-visual"
      role="img"
      aria-label={t('tour.karaokeBackground.imageAlt')}
    >
      <KaraokeDrawing />
    </div>
  );
}
