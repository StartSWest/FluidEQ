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

import { type RefObject } from 'react';
import {
  attachKaraokePitchToNote,
  clamp,
  easeKaraokeSingerTrace,
  type IKaraokeMelodyGuidePoint,
  type IKaraokePitchIssue,
  IKaraokePitchPoint,
  type IKaraokePitchWord,
  IKaraokeTraceAxis,
  isTimedTarget,
  karaokeNoteTimingState,
  karaokePitchWordProgress,
  karaokeTraceSampleX,
  MATCH_TOLERANCE_SEMITONES,
  MIN_NOTE_NAME_PLOT_PX,
  PITCH_WORD_LANE_SPACING,
  PITCH_WORD_LANE_TOP,
  PLOT_LEFT,
  roundedRectPath,
  singerTargetAtTime,
  targetAtTime,
  traceColor,
} from './karaokePitchGeometry';
import { readAccent, readAccentLight, readSurfaceAlpha } from '../utils/theme';
import {
  KARAOKE_CANONICAL_CENTER_MIDI,
  midiToNoteName,
  projectSingerPitchToTarget,
  singerPitchMatchesTarget,
  type TKaraokePitchOctavePolicy,
} from '../../common/karaoke/pitch';
import { karaokeLeadNoteShape } from '../../common/karaoke/melodyArticulation';
import {
  type IKaraokeToken,
  type TKaraokePitchTarget,
} from '../../common/karaoke/types';
import { type Translate } from '../../common/i18n';
import { type IKaraokeIssueHitRegion } from './KaraokePitchLane';

// The pitch lane's layers, each painted by one function in the order the
// lane stacks them: the words under their notes, the pitch grid, the note
// blocks, the guide melody, the singer's trace, the review strip and the
// legend. Called from the lane's frame with what that frame measured.

/**
 * The system font, the same stack the stylesheet uses — a canvas cannot read
 * it from there. Named for the platforms it ships on: Windows first, then
 * macOS, then the Linux families, and never `Inter`, which was in here for
 * the life of the lane without ever being bundled.
 */
export const LANE_FONT =
  "'Segoe UI', -apple-system, Ubuntu, Cantarell, 'Noto Sans', 'DejaVu Sans', sans-serif";

interface IPaintWordsInput {
  wordLayout: {
    word: IKaraokePitchWord;
    lane: number;
    noteLeft: number;
    noteRight: number;
    center: number;
    slotLeft: number;
    slotRight: number;
  }[];
  synchronizedPlayheadMs: number;
  context: CanvasRenderingContext2D;
  plotWidth: number;
  plotTop: number;
  textInk: string;
}

/**
 * Each word in its slot under its note, the one being sung lit.
 */
export const paintWords = ({
  wordLayout,
  synchronizedPlayheadMs,
  context,
  plotWidth,
  plotTop,
  textInk,
}: IPaintWordsInput) => {
  wordLayout.forEach((layoutWord) => {
    const { word, lane, noteLeft, noteRight, center, slotLeft, slotRight } =
      layoutWord;
    const slotWidth = Math.max(1, slotRight - slotLeft);
    const isCurrent =
      word.startMs <= synchronizedPlayheadMs &&
      word.endMs >= synchronizedPlayheadMs;
    const isComplete = synchronizedPlayheadMs > word.endMs;
    const wordProgress = karaokePitchWordProgress(
      word.startMs,
      word.endMs,
      synchronizedPlayheadMs,
    );
    context.save();
    context.beginPath();
    context.rect(PLOT_LEFT, 0, plotWidth, plotTop - 3);
    context.clip();
    let labelFontSize = isCurrent ? 14 : 12.5;
    const labelWeight = isCurrent ? 700 : 600;
    context.font = `${labelWeight} ${labelFontSize}px ${LANE_FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    let textWidth = Math.max(1, context.measureText(word.text).width);
    const availableLabelWidth = Math.max(18, slotWidth - 8);
    if (textWidth > availableLabelWidth) {
      labelFontSize = Math.max(
        8.5,
        labelFontSize * (availableLabelWidth / textWidth),
      );
      context.font = `${labelWeight} ${labelFontSize}px ${LANE_FONT}`;
      textWidth = Math.max(1, context.measureText(word.text).width);
    }
    const labelX = clamp(
      center,
      PLOT_LEFT + textWidth / 2 + 3,
      PLOT_LEFT + plotWidth - textWidth / 2 - 3,
    );
    const labelY = PITCH_WORD_LANE_TOP + lane * PITCH_WORD_LANE_SPACING;
    const textLeft = labelX - textWidth / 2;
    context.fillStyle = isComplete
      ? readAccentLight(0.88, 'rgba(151, 247, 238, .88)')
      : textInk;
    context.fillText(word.text, labelX, labelY);
    if (wordProgress > 0 && !isComplete) {
      context.save();
      context.beginPath();
      context.rect(
        textLeft,
        labelY - labelFontSize,
        textWidth * wordProgress,
        labelFontSize * 2,
      );
      context.clip();
      context.fillStyle = readAccentLight(1, '#73fff3');
      context.fillText(word.text, labelX, labelY);
      context.restore();
    }
    context.restore();

    context.strokeStyle = readAccent(0.25, 'rgba(34, 224, 214, 0.25)');
    context.lineWidth = 1.4;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(noteLeft, plotTop - 6);
    context.lineTo(Math.max(noteLeft + 1, noteRight), plotTop - 6);
    context.stroke();
    if (wordProgress > 0) {
      const progressRight =
        noteLeft + Math.max(1, noteRight - noteLeft) * wordProgress;
      context.save();
      context.strokeStyle = isComplete
        ? readAccent(0.7, 'rgba(91, 237, 224, .7)')
        : readAccent(1, '#49f2e3');
      context.lineWidth = isCurrent ? 2.6 : 2;
      context.beginPath();
      context.moveTo(noteLeft, plotTop - 6);
      context.lineTo(Math.max(noteLeft + 1, progressRight), plotTop - 6);
      context.stroke();
      context.restore();
    }
  });
};

interface IPaintPitchGridInput {
  firstPitchTick: number;
  topPitchTick: number;
  lineStep: number;
  labelStep: number;
  yForMidi: (midi: number) => number;
  context: CanvasRenderingContext2D;
  targetHasAbsoluteOctaves: boolean;
  plotWidth: number;
}

/**
 * The pitch lines, every `lineStep` semitones from a C, labelled every
 * `labelStep` with the note's name (and its octave where the target has
 * absolute octaves).
 */
export const paintPitchGrid = ({
  firstPitchTick,
  topPitchTick,
  lineStep,
  labelStep,
  yForMidi,
  context,
  targetHasAbsoluteOctaves,
  plotWidth,
}: IPaintPitchGridInput) => {
  for (
    let tickMidi = firstPitchTick;
    tickMidi <= topPitchTick;
    tickMidi += lineStep
  ) {
    const semitone = tickMidi - KARAOKE_CANONICAL_CENTER_MIDI;
    const isLabelled = semitone % labelStep === 0;
    const y = yForMidi(tickMidi);
    let labelColor = 'rgba(242, 208, 79, 0.78)';
    if (semitone > 0) {
      labelColor = 'rgba(155, 227, 72, 0.78)';
    } else if (semitone < 0) {
      labelColor = 'rgba(255, 101, 93, 0.78)';
    }
    if (isLabelled) {
      context.fillStyle = labelColor;
      context.fillText(
        `${midiToNoteName(tickMidi, targetHasAbsoluteOctaves)} ${
          semitone > 0 ? '+' : ''
        }${semitone}`,
        PLOT_LEFT - 8,
        y,
      );
    }
    context.strokeStyle =
      semitone === 0 ? 'rgba(242, 208, 79, 0.2)' : 'rgba(225, 231, 244, 0.075)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(PLOT_LEFT, y);
    context.lineTo(PLOT_LEFT + plotWidth, y);
    context.stroke();
  }
};

interface IPaintNoteBlocksInput {
  visibleNotes: IKaraokeToken[];
  xForSongTime: (timeMs: number) => number;
  semitoneHeight: number;
  latestVoicedPoint: IKaraokePitchPoint | undefined;
  octavePolicy: TKaraokePitchOctavePolicy;
  synchronizedPlayheadMs: number;
  yForMidi: (midi: number) => number;
  context: CanvasRenderingContext2D;
  targetHasAbsoluteOctaves: boolean;
  plotWidth: number;
  floatingLabelRightByPitch: Map<number, number>;
  plotHeight: number;
  plotTop: number;
}

/**
 * The target's note blocks, lit while the singer is on them, with each
 * note's name floated beside it where there is room.
 */
export const paintNoteBlocks = ({
  visibleNotes,
  xForSongTime,
  semitoneHeight,
  latestVoicedPoint,
  octavePolicy,
  synchronizedPlayheadMs,
  yForMidi,
  context,
  targetHasAbsoluteOctaves,
  plotWidth,
  floatingLabelRightByPitch,
  plotHeight,
  plotTop,
}: IPaintNoteBlocksInput) => {
  visibleNotes.forEach((note) => {
    const startMs = note.startMs as number;
    const { endMs } = karaokeLeadNoteShape({
      startMs,
      endMs: note.endMs as number,
      targetMidi: note.targetMidi,
      kind: note.kind,
    });
    const midi = note.targetMidi as number;
    const x = xForSongTime(startMs);
    const noteWidth = Math.max(3, xForSongTime(endMs) - x);
    const noteHeight = Math.max(4, semitoneHeight * 0.76);
    let noteColor = 'rgba(83, 139, 238, 0.68)';
    let noteEdge = readAccent(0.88, 'rgba(61, 214, 226, 0.88)');
    if (note.kind === 'free') {
      noteColor = 'rgba(83, 139, 238, 0.25)';
      noteEdge = 'rgba(83, 139, 238, 0.42)';
    }
    const isPitchMatch =
      note.kind !== 'free' &&
      latestVoicedPoint !== undefined &&
      latestVoicedPoint.songTimeMs >= startMs &&
      latestVoicedPoint.songTimeMs <= endMs &&
      singerPitchMatchesTarget(
        latestVoicedPoint.midi,
        midi,
        octavePolicy,
        MATCH_TOLERANCE_SEMITONES,
      );
    const timingState = karaokeNoteTimingState(
      startMs,
      endMs,
      synchronizedPlayheadMs,
    );
    if (isPitchMatch) {
      noteColor = readAccent(0.96, 'rgba(40, 242, 213, 0.96)');
      noteEdge = readAccentLight(1, 'rgba(226, 255, 250, 1)');
    }
    const noteY = yForMidi(midi) - noteHeight / 2;
    const noteGradient = context.createLinearGradient(
      x,
      noteY,
      x + noteWidth,
      noteY,
    );
    noteGradient.addColorStop(0, noteEdge);
    noteGradient.addColorStop(0.35, noteColor);
    noteGradient.addColorStop(1, noteColor);
    context.fillStyle = noteGradient;
    roundedRectPath(context, x, noteY, noteWidth, noteHeight);
    context.fill();

    if (timingState !== 'idle') {
      let timingBorder = readAccent(0.5, 'rgba(34, 224, 214, 0.5)');
      if (timingState === 'active') {
        timingBorder = 'rgba(48, 145, 255, 1)';
      }
      if (isPitchMatch) {
        timingBorder = readAccentLight(1, 'rgba(226, 255, 250, 1)');
      }
      context.strokeStyle = timingBorder;
      context.lineWidth = timingState === 'active' ? 2.2 : 1.35;
      context.setLineDash([]);
      roundedRectPath(context, x, noteY, noteWidth, noteHeight);
      context.stroke();
    }

    const noteName = midiToNoteName(midi, targetHasAbsoluteOctaves);
    const labelX = Math.max(
      PLOT_LEFT + 8,
      Math.min(PLOT_LEFT + plotWidth - 8, x + noteWidth / 2),
    );
    context.font = `700 11px ${LANE_FONT}`;
    const labelWidth = context.measureText(noteName).width;
    const pitchRow = Math.round(midi);
    const previousLabelRight =
      floatingLabelRightByPitch.get(pitchRow) ?? -Infinity;
    const labelLeft = labelX - labelWidth / 2;
    // A name needs a line of room above or below its block. In a lane too
    // short for either — 14px of canvas under a docked graph on a 720-tall
    // window — it was printed half outside the plot, cut off by the card's
    // own edge. The blocks are what that lane is for; the names go.
    if (
      plotHeight >= MIN_NOTE_NAME_PLOT_PX &&
      labelLeft > previousLabelRight + 5
    ) {
      const labelAbove = noteY - 4 >= plotTop + 9;
      context.textAlign = 'center';
      context.textBaseline = labelAbove ? 'bottom' : 'top';
      context.fillStyle = isPitchMatch
        ? readAccentLight(1, 'rgba(226, 255, 250, 1)')
        : 'rgba(221, 233, 251, 0.9)';
      context.fillText(
        noteName,
        labelX,
        labelAbove ? noteY - 3 : noteY + noteHeight + 3,
      );
      floatingLabelRightByPitch.set(pitchRow, labelX + labelWidth / 2);
    }
  });
};

interface IPaintMelodyGuideInput {
  melodyGuide: IKaraokeMelodyGuidePoint[];
  context: CanvasRenderingContext2D;
  xForSongTime: (timeMs: number) => number;
  yForMidi: (midi: number) => number;
  plotWidth: number;
  visibleNotes: IKaraokeToken[];
  synchronizedPlayheadMs: number;
}

/**
 * The guide melody as one singer-like curve over the note blocks.
 */
export const paintMelodyGuide = ({
  melodyGuide,
  context,
  xForSongTime,
  yForMidi,
  plotWidth,
  visibleNotes,
  synchronizedPlayheadMs,
}: IPaintMelodyGuideInput) => {
  if (melodyGuide.length > 1) {
    const guidePath = () => {
      context.beginPath();
      let previous: { x: number; y: number; startsPhrase: boolean } | undefined;
      melodyGuide.forEach((point) => {
        const plotted = {
          x: xForSongTime(point.songTimeMs),
          y: yForMidi(point.midi),
          startsPhrase: point.startsPhrase,
        };
        if (!previous || plotted.startsPhrase) {
          context.moveTo(plotted.x, plotted.y);
        } else {
          const controlX = (previous.x + plotted.x) / 2;
          context.bezierCurveTo(
            controlX,
            previous.y,
            controlX,
            plotted.y,
            plotted.x,
            plotted.y,
          );
        }
        previous = plotted;
      });
    };
    const guideGradient = context.createLinearGradient(
      PLOT_LEFT,
      0,
      PLOT_LEFT + plotWidth,
      0,
    );
    guideGradient.addColorStop(0, 'rgba(91, 147, 235, 0.34)');
    guideGradient.addColorStop(0.2, 'rgba(123, 195, 255, 0.82)');
    guideGradient.addColorStop(
      1,
      readAccent(0.76, 'rgba(107, 233, 242, 0.76)'),
    );
    // One sharp line. It ran over a 6px haze of its own blue under a
    // 10px glow, and the lane read as lit fog (Ivan, 2026-09-26: the
    // pitch lane "need to be clean and nice").
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.setLineDash([]);
    context.strokeStyle = guideGradient;
    context.lineWidth = 1.8;
    guidePath();
    context.stroke();

    const guideTargetMidi = targetAtTime(
      visibleNotes.filter((note) => note.kind !== 'free'),
      synchronizedPlayheadMs,
    );
    if (guideTargetMidi !== undefined) {
      const guideY = yForMidi(guideTargetMidi);
      const guideX = xForSongTime(synchronizedPlayheadMs);
      context.fillStyle = readAccentLight(1, '#dff8ff');
      context.beginPath();
      context.arc(guideX, guideY, 3, 0, Math.PI * 2);
      context.fill();
    }
  }
};

interface IPaintTraceInput {
  trace: IKaraokePitchPoint[];
  synchronizedPlayheadMs: number;
  now: number;
  plotWidth: number;
  hasSongClock: boolean;
  hasTargets: boolean;
  visibleNotes: IKaraokeToken[];
  centerMidi: number;
  octavePolicy: TKaraokePitchOctavePolicy;
  yForMidi: (midi: number) => number;
  context: CanvasRenderingContext2D;
  plotTop: number;
  plotHeight: number;
}

/**
 * The singer's own pitch, the newest sample on the cursor, folded to the
 * target's octave by the lane's octave policy.
 */
export const paintTrace = ({
  trace,
  synchronizedPlayheadMs,
  now,
  plotWidth,
  hasSongClock,
  hasTargets,
  visibleNotes,
  centerMidi,
  octavePolicy,
  yForMidi,
  context,
  plotTop,
  plotHeight,
}: IPaintTraceInput) => {
  if (trace.length > 0) {
    // See `karaokeTraceSampleX`: the newest sample lands on the cursor.
    const traceAxis: IKaraokeTraceAxis = {
      playheadMs: synchronizedPlayheadMs,
      nowMs: now,
      plotWidth,
      hasSongClock,
      usesSongTime: hasTargets,
    };
    const xForTracePoint = (point: IKaraokePitchPoint) =>
      karaokeTraceSampleX(point, traceAxis);
    const visualPitchSamples = trace.map((point) => {
      // `visibleNotes`, not the whole chart: every point drawn here is
      // inside the window those notes were selected for, and searching a
      // three-minute song's worth of syllables per sample per frame was
      // paying for several thousand lookups a second to answer with one
      // of the forty notes on screen.
      const noteMidi = singerTargetAtTime(visibleNotes, point.songTimeMs);
      return {
        // Three steps, in this order, and each undoes a different kind of
        // wrongness. The octave projection decides whether a bass singing
        // an octave down counts as the same note. The attachment draws the
        // remaining error against that note instead of against the whole
        // lane — see `attachKaraokePitchToNote` for why compressing beats
        // snapping. The easing, further down, calms the detector.
        //
        // Only the picture is touched. Scoring and the performance review
        // read the raw samples, so a curve that sits on the note does not
        // quietly award marks the singing did not earn.
        midi: point.voiced
          ? attachKaraokePitchToNote(
              projectSingerPitchToTarget(
                point.midi,
                noteMidi ?? centerMidi,
                octavePolicy,
              ),
              noteMidi,
            )
          : centerMidi,
        timeMs: hasTargets ? point.songTimeMs : point.wallTimeMs,
        voiced: point.voiced,
      };
    });
    const easedMidis = easeKaraokeSingerTrace(visualPitchSamples, centerMidi);
    const plottedTrace = trace.map((point, index) => ({
      ...point,
      x: xForTracePoint(point),
      y: yForMidi(easedMidis[index]),
    }));
    const first = plottedTrace[0];
    const last = plottedTrace[plottedTrace.length - 1];
    const previous = plottedTrace[plottedTrace.length - 2];
    const headColor = traceColor(last, previous, visibleNotes, octavePolicy);
    const tracePath = () => {
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (let index = 1; index < plottedTrace.length - 1; index += 1) {
        const point = plottedTrace[index];
        const next = plottedTrace[index + 1];
        context.quadraticCurveTo(
          point.x,
          point.y,
          (point.x + next.x) / 2,
          (point.y + next.y) / 2,
        );
      }
      context.lineTo(last.x, last.y);
    };

    context.lineJoin = 'round';
    context.lineCap = 'round';
    // The curve is the one thing on this canvas whose extent is decided by
    // a microphone rather than by the layout, so it is the one thing that
    // can run off the plot and paint over the semitone labels in the left
    // gutter. Held to the plot rectangle it simply leaves at the edge.
    context.save();
    context.beginPath();
    context.rect(PLOT_LEFT, plotTop - 6, plotWidth, plotHeight + 12);
    context.clip();

    // The microphone is one continuous pitch curve over the song blocks.
    // Input energy changes its weight; the presentation-only pitch easing
    // above calms detector wobble without changing scoring coordinates.
    const microphoneGradient = context.createLinearGradient(
      first.x,
      0,
      Math.max(first.x + 1, last.x),
      0,
    );
    const range = Math.max(1, last.x - first.x);
    plottedTrace.forEach((point, index) => {
      microphoneGradient.addColorStop(
        Math.max(0, Math.min(1, (point.x - first.x) / range)),
        traceColor(point, plottedTrace[index - 1], visibleNotes, octavePolicy),
      );
    });
    // One stroke that thickens as the voice gets louder. It was a 6px
    // haze under a glow sized by the same energy — the loudness is still
    // there, in the line's own weight rather than in a blur round it.
    context.globalAlpha = Math.max(0.72, last.confidence);
    context.strokeStyle = microphoneGradient;
    context.lineWidth = 2.1 + Math.min(1.6, last.energy * 3);
    tracePath();
    context.stroke();
    context.globalAlpha = 1;

    // The voice's head: a ring that breathes while it sings, round a
    // point. It was a radial glow the ring's size.
    const pulse = last.voiced ? 4.6 + Math.sin(now / 145) * 0.75 : 2.7;
    context.strokeStyle = headColor;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(last.x, last.y, pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = last.voiced ? '#ffffff' : headColor;
    context.beginPath();
    context.arc(last.x, last.y, 1.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
};

interface IPaintReviewInput {
  target: TKaraokePitchTarget | undefined;
  showsReview: boolean;
  t: Translate;
  currentIssues: IKaraokePitchIssue[];
  height: number;
  plotWidth: number;
  width: number;
  context: CanvasRenderingContext2D;
  textInk: string;
  hoveredIssueIdRef: RefObject<string | undefined>;
  issueHitRegionsRef: RefObject<IKaraokeIssueHitRegion[]>;
  synchronizedPlayheadMs: number;
}

/**
 * The review strip for a sung song: each issue along the song's length,
 * its hit region kept for the pointer, the hovered one called out.
 */
export const paintReview = ({
  target,
  showsReview,
  t,
  currentIssues,
  height,
  plotWidth,
  width,
  context,
  textInk,
  hoveredIssueIdRef,
  issueHitRegionsRef,
  synchronizedPlayheadMs,
}: IPaintReviewInput) => {
  if (target?.kind === 'notes' && showsReview) {
    const performanceDurationMs = target.notes.reduce(
      (duration, note) =>
        isTimedTarget(note) ? Math.max(duration, note.endMs) : duration,
      1,
    );
    const reviewLabel = t('karaoke.pitch.review');
    const reviewCount = t('karaoke.pitch.reviewCount', {
      count: currentIssues.length,
    });
    const reviewY = height - 22;
    const reviewTrackHeight = 11;
    const reviewMinimumTrackWidth = Math.min(82, plotWidth * 0.42);
    const reviewFontSize = width < 620 ? 10 : 11;
    context.font = `700 ${reviewFontSize}px ${LANE_FONT}`;
    const measuredLabelWidth = Math.ceil(
      context.measureText(reviewLabel).width,
    );
    const measuredCountWidth = Math.ceil(
      context.measureText(reviewCount).width,
    );
    // Localized labels vary dramatically in length. Size both gutters from
    // the text that is actually drawn instead of letting a fixed English
    // width place the track underneath Spanish and other translations.
    let reviewLabelWidth = measuredLabelWidth + 22;
    let reviewCountWidth = measuredCountWidth + 12;
    if (
      reviewLabelWidth + reviewCountWidth + reviewMinimumTrackWidth >
      plotWidth
    ) {
      reviewCountWidth = 0;
    }
    reviewLabelWidth = Math.min(
      reviewLabelWidth,
      Math.max(0, plotWidth - reviewCountWidth - reviewMinimumTrackWidth),
    );
    if (reviewLabelWidth < 28) {
      reviewLabelWidth = 0;
    }
    const reviewTrackX = PLOT_LEFT + reviewLabelWidth;
    const reviewTrackWidth = Math.max(
      24,
      plotWidth - reviewLabelWidth - reviewCountWidth,
    );
    // The plot's own ground, opaque, so the strip hides what scrolls
    // under it without standing out from the plot as a lighter slab. It
    // was the block colour under a drop shadow.
    context.save();
    context.fillStyle = readSurfaceAlpha(
      '--surface-base',
      0.94,
      'rgba(1, 21, 33, 0.94)',
    );
    roundedRectPath(
      context,
      PLOT_LEFT - 7,
      reviewY - 5,
      plotWidth + 14,
      reviewTrackHeight + 10,
      8,
    );
    context.fill();
    context.restore();

    context.textBaseline = 'middle';
    if (reviewLabelWidth > 0) {
      context.fillStyle = readAccent(0.78, 'rgba(107, 233, 242, 0.78)');
      context.beginPath();
      context.arc(
        PLOT_LEFT + 3,
        reviewY + reviewTrackHeight / 2,
        2,
        0,
        2 * Math.PI,
      );
      context.fill();
      context.textAlign = 'left';
      context.fillStyle = textInk;
      context.fillText(
        reviewLabel,
        PLOT_LEFT + 10,
        reviewY + reviewTrackHeight / 2,
        Math.max(1, reviewLabelWidth - 16),
      );
    }

    const trackGradient = context.createLinearGradient(
      reviewTrackX,
      reviewY,
      reviewTrackX,
      reviewY + reviewTrackHeight,
    );
    // The empty-track colour, like every groove in the app — not black.
    trackGradient.addColorStop(
      0,
      readSurfaceAlpha('--track-well', 0.95, 'rgba(46, 79, 99, 0.95)'),
    );
    trackGradient.addColorStop(
      1,
      readSurfaceAlpha('--track-well', 0.85, 'rgba(46, 79, 99, 0.85)'),
    );
    context.fillStyle = trackGradient;
    context.strokeStyle = readAccent(0.13, 'rgba(107, 233, 242, 0.13)');
    context.lineWidth = 1;
    roundedRectPath(
      context,
      reviewTrackX,
      reviewY,
      reviewTrackWidth,
      reviewTrackHeight,
    );
    context.fill();
    context.stroke();

    currentIssues.forEach((issue) => {
      const issueStart = Math.max(
        0,
        Math.min(1, issue.startMs / performanceDurationMs),
      );
      const issueEnd = Math.max(
        issueStart,
        Math.min(1, issue.endMs / performanceDurationMs),
      );
      const issueLeft = reviewTrackX + issueStart * reviewTrackWidth;
      const issueRight = reviewTrackX + issueEnd * reviewTrackWidth;
      const issueWidth = Math.max(3, issueRight - issueLeft);
      const isHovered = hoveredIssueIdRef.current === issue.id;
      let issueColor = '#f0a64a';
      if (issue.kind === 'high') {
        issueColor = '#9be348';
      } else if (issue.kind === 'low') {
        issueColor = '#ff655d';
      }
      context.fillStyle = issueColor;
      context.globalAlpha = isHovered ? 1 : 0.88;
      roundedRectPath(
        context,
        issueLeft,
        reviewY + 2,
        issueWidth,
        reviewTrackHeight - 4,
      );
      context.fill();
      context.globalAlpha = 1;
      issueHitRegionsRef.current.push({
        issue,
        left: issueLeft - 2,
        right: issueLeft + issueWidth + 2,
        top: reviewY - 4,
        bottom: reviewY + reviewTrackHeight + 4,
      });
    });

    const reviewPlayheadX =
      reviewTrackX +
      Math.max(0, Math.min(1, synchronizedPlayheadMs / performanceDurationMs)) *
        reviewTrackWidth;
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    context.beginPath();
    context.moveTo(reviewPlayheadX, reviewY - 2);
    context.lineTo(reviewPlayheadX, reviewY + reviewTrackHeight + 2);
    context.stroke();
    if (reviewCountWidth > 0) {
      context.textAlign = 'right';
      context.fillStyle = textInk;
      context.fillText(
        reviewCount,
        PLOT_LEFT + plotWidth - 3,
        reviewY + reviewTrackHeight / 2,
        Math.max(1, reviewCountWidth - 8),
      );
    }
  }
};

interface IPaintLegendInput {
  hasTargets: boolean;
  width: number;
  plotHeight: number;
  t: Translate;
  plotWidth: number;
  plotTop: number;
  context: CanvasRenderingContext2D;
}

/**
 * The legend of the lane's colours, where the lane is wide and tall enough.
 */
export const paintLegend = ({
  hasTargets,
  width,
  plotHeight,
  t,
  plotWidth,
  plotTop,
  context,
}: IPaintLegendInput) => {
  if (hasTargets && width >= 560 && plotHeight >= 86) {
    const legendItems = [
      ['guide', t('karaoke.pitch.guide'), '#8fc8ff'],
      ['↑', t('karaoke.pitch.high'), '#9be348'],
      ['—', t('karaoke.pitch.tuned'), '#f2d04f'],
      ['↓', t('karaoke.pitch.low'), '#ff655d'],
    ] as const;
    const legendWidth = 132;
    const legendHeight = 72;
    const legendX = PLOT_LEFT + plotWidth - legendWidth - 11;
    const legendY = plotTop + plotHeight - legendHeight - 10;
    // The review strip's ground, for the same reason, with an edge and
    // nothing else: no drop shadow, no lit rim along its top.
    context.save();
    context.fillStyle = readSurfaceAlpha(
      '--surface-base',
      0.94,
      'rgba(1, 21, 33, 0.94)',
    );
    roundedRectPath(context, legendX, legendY, legendWidth, legendHeight, 9);
    context.fill();
    context.restore();
    context.strokeStyle = readAccent(0.16, 'rgba(107, 233, 242, 0.16)');
    context.lineWidth = 1;
    roundedRectPath(context, legendX, legendY, legendWidth, legendHeight, 9);
    context.stroke();

    context.font = `600 11px ${LANE_FONT}`;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    legendItems.forEach(([symbol, label, color], index) => {
      const y = legendY + 13 + index * 15;
      const swatchX = legendX + 13;
      context.fillStyle = color;
      context.strokeStyle = color;
      if (symbol === 'guide') {
        context.lineWidth = 1.6;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(swatchX, y + 1);
        context.bezierCurveTo(
          swatchX + 3,
          y - 3,
          swatchX + 7,
          y + 3,
          swatchX + 12,
          y - 1,
        );
        context.stroke();
      } else {
        context.font = `700 11px ${LANE_FONT}`;
        context.fillText(symbol, swatchX + 1, y);
      }
      context.font = `600 11px ${LANE_FONT}`;
      context.fillStyle = 'rgba(222, 232, 247, 0.9)';
      context.fillText(label, legendX + 34, y, legendWidth - 45);
    });
  }
};
