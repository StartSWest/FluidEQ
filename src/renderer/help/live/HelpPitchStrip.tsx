/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  KARAOKE_CANONICAL_CENTER_MIDI,
  karaokePitchViewportForTargets,
  midiToNoteName,
} from 'common/karaoke/pitch';
import type { IKaraokeToken } from 'common/karaoke/types';
import MenuIcon from '../../icons/MenuIcon';
import { pictureKeyFor } from '../../karaoke/karaokeCanvasInk';
import {
  isTimedTarget,
  karaokePitchSongTimeX,
  MINIMUM_VISIBLE_SEMITONES,
  PLOT_INSET_Y,
  PLOT_LEFT,
  PLOT_RIGHT,
  singerTargetAtTime,
  VIEWPORT_PADDING_SEMITONES,
  WINDOW_FUTURE_MS,
  WINDOW_PAST_MS,
} from '../../karaoke/karaokePitchGeometry';
import { VERDICT_KEYS } from '../../karaoke/karaokeScoreFormat';
import { paintNoteBlocks, paintPitchGrid } from '../../karaoke/pitchLaneLayers';
import paintTrace from '../../karaoke/pitchLaneTrace';
import { type IKaraokeLaneVerdict } from '../../karaoke/useKaraokeScore';
import { useTranslation } from '../../utils/I18nContext';
import { readAccent, readTextInk } from '../../utils/theme';
import {
  HELP_PLAYHEAD_MS,
  HELP_SINGING_CENTS,
  HELP_SINGING_MIDI,
  HELP_SONG,
  HELP_TRACE,
  helpVerdictOf,
} from './karaokeHelpSong';
import useHelpCanvas from './useHelpCanvas';

/**
 * The Karaoke's pitch strip, stopped at the help song's playhead and drawn
 * by the strip's own painters (`pitchLaneLayers`, `pitchLaneTrace`) in the
 * order `KaraokePitchLane` stacks them: the grid with its note names, the
 * notes as boxes filled with the voice's colours and their verdicts' chips,
 * the playhead, and the singer's line. The lane itself only draws a voice it
 * hears through the microphone as the song plays, so the voice here is a
 * made-up one (`HELP_TRACE`); the corner is its markup, class for class,
 * with the microphone on and the note it hears.
 */
const HelpPitchStrip = () => {
  const { t } = useTranslation();
  const verdictLabel = ({ verdict, octave }: IKaraokeLaneVerdict) =>
    octave
      ? t('karaoke.score.octaveMark', { verdict: t(VERDICT_KEYS[verdict]) })
      : t(VERDICT_KEYS[verdict]);
  const canvasRef = useHelpCanvas((context, width, height, ratio) => {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const target = HELP_SONG.pitch;
    if (target.kind !== 'notes') {
      return;
    }
    const playheadMs = HELP_PLAYHEAD_MS;
    const plotWidth = Math.max(1, width - PLOT_LEFT - PLOT_RIGHT);
    const plotHeight = Math.max(1, height - PLOT_INSET_Y * 2);
    const windowStartMs = playheadMs - WINDOW_PAST_MS;
    const windowEndMs = playheadMs + WINDOW_FUTURE_MS;
    const visibleNotes = target.notes.filter(
      (note): note is IKaraokeToken =>
        isTimedTarget(note) &&
        (note.endMs ?? 0) >= windowStartMs &&
        (note.startMs ?? 0) <= windowEndMs,
    );
    const { centerMidi, semitoneSpan } = karaokePitchViewportForTargets(
      visibleNotes
        .map((note) => note.targetMidi)
        .filter((midi): midi is number => midi !== undefined)
        .sort((left, right) => left - right),
      KARAOKE_CANONICAL_CENTER_MIDI,
      MINIMUM_VISIBLE_SEMITONES,
      VIEWPORT_PADDING_SEMITONES,
    );
    const topMidi = centerMidi + semitoneSpan / 2;
    const semitoneHeight = plotHeight / semitoneSpan;
    const yForMidi = (midi: number) =>
      PLOT_INSET_Y + (topMidi - midi) * semitoneHeight;
    const xForSongTime = (timeMs: number) =>
      karaokePitchSongTimeX(timeMs, playheadMs, plotWidth);
    const keyed = pictureKeyFor(false);
    const now = performance.now();
    paintPitchGrid({
      context,
      yForMidi,
      lowMidi: topMidi - semitoneSpan,
      highMidi: topMidi,
      semitoneHeight,
      plotWidth,
      textInk: readTextInk(),
      markMidi: singerTargetAtTime(visibleNotes, playheadMs),
      keyed,
    });
    paintNoteBlocks({
      visibleNotes,
      sung: {
        trace: HELP_TRACE,
        centerMidi,
        octavePolicy: target.octavePolicy,
      },
      xForSongTime,
      semitoneHeight,
      synchronizedPlayheadMs: playheadMs,
      yForMidi,
      context,
      readVerdict: helpVerdictOf,
      verdictLabel,
      now,
      plotWidth,
      keyed,
    });
    const playheadX = Math.round(xForSongTime(playheadMs)) + 0.5;
    context.strokeStyle = readAccent(0.75, 'rgba(27, 222, 231, 0.75)');
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(playheadX, 0);
    context.lineTo(playheadX, height);
    context.stroke();
    paintTrace({
      trace: HELP_TRACE,
      synchronizedPlayheadMs: playheadMs,
      now,
      plotWidth,
      hasSongClock: true,
      hasTargets: true,
      visibleNotes,
      centerMidi,
      octavePolicy: target.octavePolicy,
      yForMidi,
      context,
      plotTop: PLOT_INSET_Y,
      plotHeight,
    });
  });

  return (
    <article
      className="karaoke-pitch has-targets"
      aria-label={t('karaoke.pitch.title')}
    >
      <canvas
        ref={canvasRef}
        className="is-scrubbable"
        aria-label={t('karaoke.pitch.waveCanvas')}
      />
      <div className="karaoke-pitch__corner">
        <span className="karaoke-pitch__readout">
          <strong>{midiToNoteName(HELP_SINGING_MIDI)}</strong>
          <span>+{HELP_SINGING_CENTS} ¢</span>
        </span>
        <button
          type="button"
          className="karaoke-pitch__mic is-live"
          aria-pressed
          aria-label={t('karaoke.mic.turnOff')}
        >
          <MenuIcon name="microphone" className="karaoke-button__icon" />
        </button>
      </div>
    </article>
  );
};

export default HelpPitchStrip;
