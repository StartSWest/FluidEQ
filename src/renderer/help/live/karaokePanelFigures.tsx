/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useRef } from 'react';
import { formatKaraokeTime } from 'common/karaoke/clock';
import {
  karaokeLineDeltas,
  karaokeProgress,
  summarizeKaraokeRun,
} from 'common/karaoke/scoringSummary';
import DialogClose from '../../components/DialogClose';
import BackdropAppearanceControls from '../../graph/BackdropAppearanceControls';
import { KaraokeMicrophoneSettings } from '../../karaoke/KaraokeMicrophone';
import KaraokeScoreMap from '../../karaoke/KaraokeScoreMap';
import KaraokeScoreRecap from '../../karaoke/KaraokeScoreRecap';
import {
  type IKaraokeTransportLevel,
  KaraokeTransportLevel,
} from '../../karaoke/KaraokeTransport';
import type { IKaraokeEndCard } from '../../karaoke/useKaraokeScore';
import { MAX_OVERLAY_BLUR } from '../../utils/graphOverlay';
import { useTranslation } from '../../utils/I18nContext';
import { HELP_MICROPHONE } from './karaokeFigures';
import {
  HELP_RESULTS_WHOLE,
  HELP_SHEET,
  HELP_SONG_DURATION_MS,
  HELP_SONG_TITLE,
} from './karaokeHelpSong';

/**
 * The Karaoke chapter's three panels, each on its own face
 * (`helpChapters/listen.ts`): the microphone's popover, the mix menu and
 * the card at the end of a sung song.
 *
 * The microphone's panel is its own component, handed a made-up USB
 * microphone that is on; the mix menu is the bar's own faders
 * (`KaraokeTransportLevel`) and the scene's See-through and Blur, in the
 * menu's markup, because the menu is portalled to the window; the card is
 * its own two panes in the dialog's markup, for a run of the made-up song
 * scored by the app's own summary and a made-up best before it.
 */

const nothing = () => undefined;

/** The microphone popover, open, on the menus' face. */
export const KaraokeMicDrawing = () => (
  <div className="karaoke-microphone-popover">
    <KaraokeMicrophoneSettings
      microphone={{ ...HELP_MICROPHONE, level: 0.46 }}
    />
  </div>
);

/** The mix menu with a separated song, its voice layered under the backing. */
export const KaraokeMixDrawing = () => {
  const { t } = useTranslation();
  const levels: readonly IKaraokeTransportLevel[] = [
    {
      id: 'master',
      label: t('library.volume'),
      value: 0.72,
      pressed: false,
      onToggle: nothing,
      toggleLabel: t('library.mute'),
      onChange: nothing,
    },
    {
      id: 'melody',
      label: t('karaoke.pitch.toneVolume'),
      value: 0.35,
      channel: 'melody',
      pressed: true,
      onToggle: nothing,
      onChange: nothing,
    },
    {
      id: 'backing',
      label: t('karaoke.maker.stemBacking'),
      value: 0.9,
      channel: 'backing',
      onChange: nothing,
    },
    {
      id: 'vocal',
      label: t('karaoke.transport.vocalLevel'),
      value: 0.25,
      channel: 'vocal',
      onChange: nothing,
    },
  ];
  return (
    <div className="karaoke-transport__mix-popover">
      <strong className="karaoke-transport__mix-title">
        {t('karaoke.transport.mixSettings')}
      </strong>
      <div className="karaoke-transport__mix-levels">
        {levels.map((level) => (
          <KaraokeTransportLevel
            key={level.id}
            level={level}
            inputId={`help-karaoke-mix-${level.id}`}
            onTouch={nothing}
            isInMenu
          />
        ))}
      </div>
      <div role="group" aria-label={t('tabs.karaoke')}>
        <BackdropAppearanceControls
          idPrefix="help-karaoke-scene"
          transparencyHint={t('graph.seeThrough')}
          opacity={0.6}
          onChangeOpacity={nothing}
          blur={6}
          onChangeBlur={nothing}
          minOpacity={0}
          maxBlur={MAX_OVERLAY_BLUR}
        />
      </div>
    </div>
  );
};

const DAY_MS = 86_400_000;
/** The run sung now, a day after the reader's made-up week of tries. */
const SUNG_AT = Date.UTC(2026, 10, 24, 20);

const summary = summarizeKaraokeRun(HELP_SHEET, HELP_RESULTS_WHOLE);
/** The best before this one: weaker on the third line, a touch better on the fifth. */
const BEFORE_BEST_LINES = summary.linePercents.map((percent, index) => {
  if (percent === undefined) {
    return null;
  }
  if (index === 2) {
    return Math.max(0, percent - 14);
  }
  return index === 4 ? Math.min(100, percent + 5) : percent - 2;
});
const BEFORE_BEST = Math.round(summary.score * 0.93);
const deltas = karaokeLineDeltas(summary.linePercents, BEFORE_BEST_LINES);

const CARD: IKaraokeEndCard = {
  sheet: HELP_SHEET,
  results: HELP_RESULTS_WHOLE,
  summary,
  best: { kind: 'new', delta: summary.score - BEFORE_BEST },
  deltas,
  progress: karaokeProgress(deltas, true),
  attempts: [
    {
      at: SUNG_AT - 6 * DAY_MS,
      score: Math.round(summary.score * 0.71),
      lines: [],
    },
    {
      at: SUNG_AT - 3 * DAY_MS,
      score: Math.round(summary.score * 0.84),
      lines: [],
    },
    { at: SUNG_AT - DAY_MS, score: BEFORE_BEST, lines: BEFORE_BEST_LINES },
    { at: SUNG_AT, score: summary.score, lines: [] },
  ],
  bestAt: SUNG_AT,
};

/** The card at the end of the song, as `KaraokeScoreCard` lays it out. */
export const KaraokeScoreDrawing = () => {
  const { t } = useTranslation();
  const practiseRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="karaoke-score-card"
      role="dialog"
      aria-label={t('karaoke.score.recapTitle')}
    >
      <DialogClose label={t('karaoke.score.close')} onClose={nothing} />
      <div className="karaoke-score-card__body">
        <KaraokeScoreRecap
          card={CARD}
          songLabel={`${HELP_SONG_TITLE} · ${formatKaraokeTime(HELP_SONG_DURATION_MS)}`}
          titleId="help-karaoke-score-title"
          practiseRef={practiseRef}
          onPractiseLine={nothing}
          onSingAgain={nothing}
        />
        <KaraokeScoreMap card={CARD} onPractiseLine={nothing} />
      </div>
    </div>
  );
};
