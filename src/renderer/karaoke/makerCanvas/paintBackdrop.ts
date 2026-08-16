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

import { IKaraokeMakerProject } from '../../../common/karaoke/makerProject';
import {
  IKaraokeMakerSectionGroup,
  KARAOKE_MAKER_LYRIC_LANE_COUNT,
} from '../makerCanvasLayout';
import { formatClock } from '../makerFormat';
import {
  IMakerPlot,
  LYRIC_LANE_HEIGHT,
  MAX_NOTE_MIDI,
  MIN_NOTE_MIDI,
  SECTION_GROUP_HEIGHT,
  SECTION_GROUP_TOP,
  WAVEFORM_HEIGHT,
  WAVEFORM_TOP,
  lyricSectionHeight,
  midiName,
} from '../makerCanvasGeometry';

const LYRIC_SECTION_HEIGHT = lyricSectionHeight(KARAOKE_MAKER_LYRIC_LANE_COUNT);

export interface IPaintBackdropInput {
  plot: IMakerPlot;
  width: number;
  height: number;
  headerHeight: number;
  lyricSectionTop: number;
  project: IKaraokeMakerProject;
  canvasSectionGroups: IKaraokeMakerSectionGroup[];
  viewStartMs: number;
  visibleViewDurationMs: number;
  effectiveDurationMs: number;
}

/**
 * The stage, before anything is standing on it.
 *
 * Everything here is a function of the viewport and the song's shape — the
 * gradient ground, the coloured bands naming verse and chorus, the time ruler,
 * the pitch labels down the left edge, and the waveform. None of it depends on
 * where a word was packed or which note is selected, which is exactly why it
 * can be drawn first and on its own.
 *
 * It reports nothing back. The layers after it emit hit regions because they
 * draw things you can grab; nothing on the backdrop is clickable, so the
 * function returns void rather than an empty array nobody reads.
 *
 * No flags. It draws this and only this — a `paintBackdrop(ctx, { showGrid })`
 * would be two functions wearing one name.
 */
export const paintBackdrop = (
  context: CanvasRenderingContext2D,
  {
    plot,
    width,
    height,
    headerHeight,
    lyricSectionTop,
    project,
    canvasSectionGroups,
    viewStartMs,
    visibleViewDurationMs,
    effectiveDurationMs,
  }: IPaintBackdropInput,
) => {
  const {
    left: plotLeft,
    right: plotRight,
    width: plotWidth,
    bottom: plotBottom,
    timeX,
    noteY,
  } = plot;

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, 'rgba(8, 24, 43, .96)');
  background.addColorStop(1, 'rgba(5, 19, 34, .98)');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const lyricBackground = context.createLinearGradient(
    0,
    lyricSectionTop,
    0,
    headerHeight,
  );
  lyricBackground.addColorStop(0, 'rgba(10, 35, 52, .72)');
  lyricBackground.addColorStop(1, 'rgba(4, 22, 36, .9)');
  context.fillStyle = lyricBackground;
  context.fillRect(
    plotLeft,
    lyricSectionTop - 3,
    plotWidth,
    LYRIC_SECTION_HEIGHT + 6,
  );
  if (canvasSectionGroups.length) {
    context.fillStyle = 'rgba(7, 29, 45, .94)';
    context.fillRect(
      plotLeft,
      SECTION_GROUP_TOP - 3,
      plotWidth,
      SECTION_GROUP_HEIGHT,
    );
    context.save();
    context.beginPath();
    context.rect(
      plotLeft,
      SECTION_GROUP_TOP - 3,
      plotWidth,
      SECTION_GROUP_HEIGHT,
    );
    context.clip();
    canvasSectionGroups.forEach((group, index) => {
      const rawLeft = timeX(group.startMs);
      const rawRight = timeX(group.endMs);
      if (rawRight < plotLeft || rawLeft > plotRight) {
        return;
      }
      const left = Math.max(plotLeft, rawLeft);
      const right = Math.min(plotRight, Math.max(left + 1, rawRight));
      const centerY = SECTION_GROUP_TOP + SECTION_GROUP_HEIGHT / 2 - 2;
      const groupGradient = context.createLinearGradient(left, 0, right, 0);
      groupGradient.addColorStop(
        0,
        index % 2 ? 'rgba(34, 213, 199, .12)' : 'rgba(72, 196, 232, .1)',
      );
      groupGradient.addColorStop(1, 'rgba(17, 109, 126, .025)');
      context.fillStyle = groupGradient;
      context.fillRect(left, SECTION_GROUP_TOP - 2, right - left, 25);
      context.strokeStyle = 'rgba(63, 232, 216, .45)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(left + 1, SECTION_GROUP_TOP + 22);
      context.lineTo(Math.max(left + 1, right - 4), SECTION_GROUP_TOP + 22);
      context.stroke();
      context.font = '800 10px Inter, system-ui, sans-serif';
      const text = group.text.toUpperCase();
      const measuredWidth = context.measureText(text).width;
      const textX = Math.max(
        left + measuredWidth / 2 + 9,
        Math.min(
          right - measuredWidth / 2 - 9,
          rawLeft + 10 + measuredWidth / 2,
        ),
      );
      context.save();
      context.beginPath();
      context.rect(
        left + 4,
        SECTION_GROUP_TOP,
        Math.max(0, right - left - 8),
        22,
      );
      context.clip();
      context.fillStyle = 'rgba(111, 255, 243, .94)';
      context.shadowColor = 'rgba(36, 223, 207, .48)';
      context.shadowBlur = 7;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, textX, centerY);
      context.restore();
    });
    context.restore();
    context.strokeStyle = 'rgba(44, 226, 211, .2)';
    context.beginPath();
    context.moveTo(plotLeft, lyricSectionTop - 3);
    context.lineTo(plotRight, lyricSectionTop - 3);
    context.stroke();
  }
  for (let lane = 1; lane < KARAOKE_MAKER_LYRIC_LANE_COUNT; lane += 1) {
    const laneY = lyricSectionTop + lane * LYRIC_LANE_HEIGHT;
    context.strokeStyle = 'rgba(76, 151, 174, .085)';
    context.beginPath();
    context.moveTo(plotLeft, laneY);
    context.lineTo(plotRight, laneY);
    context.stroke();
  }
  context.strokeStyle = 'rgba(44, 226, 211, .18)';
  context.beginPath();
  context.moveTo(plotLeft, headerHeight - 1);
  context.lineTo(plotRight, headerHeight - 1);
  context.stroke();

  context.strokeStyle = 'rgba(71, 116, 151, .13)';
  context.lineWidth = 1;
  let majorStep = 15_000;
  if (visibleViewDurationMs <= 10_000) {
    majorStep = 1_000;
  } else if (visibleViewDurationMs <= 40_000) {
    majorStep = 5_000;
  }
  const firstTick = Math.floor(viewStartMs / majorStep) * majorStep;
  for (
    let tick = firstTick;
    tick <= viewStartMs + visibleViewDurationMs;
    tick += majorStep
  ) {
    const x = timeX(tick);
    context.beginPath();
    context.moveTo(x, headerHeight - 2);
    context.lineTo(x, plotBottom);
    context.stroke();
    context.fillStyle = 'rgba(174, 201, 222, .58)';
    context.font = '10px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(formatClock(tick), x, height - 10);
  }
  for (let midi = MIN_NOTE_MIDI; midi <= MAX_NOTE_MIDI; midi += 3) {
    const y = noteY(midi);
    context.strokeStyle =
      midi % 12 === 0 ? 'rgba(65, 218, 203, .16)' : 'rgba(71, 116, 151, .08)';
    context.beginPath();
    context.moveTo(plotLeft, y);
    context.lineTo(plotRight, y);
    context.stroke();
    if (midi % 12 === 0) {
      context.fillStyle = 'rgba(160, 244, 112, .72)';
      context.textAlign = 'right';
      context.fillText(midiName(midi), plotLeft - 8, y + 3);
    }
  }

  const { waveform } = project.analysis;
  if (waveform?.length) {
    context.save();
    context.beginPath();
    context.rect(plotLeft, WAVEFORM_TOP, plotWidth, WAVEFORM_HEIGHT);
    context.clip();
    context.fillStyle = 'rgba(22, 211, 198, .18)';
    context.beginPath();
    const startIndex = Math.floor(
      (viewStartMs / effectiveDurationMs) * waveform.length,
    );
    const endIndex = Math.ceil(
      ((viewStartMs + visibleViewDurationMs) / effectiveDurationMs) *
        waveform.length,
    );
    for (let xIndex = 0; xIndex < Math.ceil(plotWidth); xIndex += 1) {
      const progress = xIndex / plotWidth;
      const index = Math.max(
        0,
        Math.min(
          waveform.length - 1,
          Math.round(startIndex + (endIndex - startIndex) * progress),
        ),
      );
      const amplitude = waveform[index] ?? 0;
      const x = plotLeft + xIndex;
      const centerY = WAVEFORM_TOP + WAVEFORM_HEIGHT / 2;
      const halfHeight = Math.max(0.6, amplitude * (WAVEFORM_HEIGHT / 2 - 2));
      context.rect(x, centerY - halfHeight, 1, halfHeight * 2);
    }
    context.fill();
    context.strokeStyle = 'rgba(72, 246, 230, .32)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(plotLeft, WAVEFORM_TOP + WAVEFORM_HEIGHT / 2);
    context.lineTo(plotRight, WAVEFORM_TOP + WAVEFORM_HEIGHT / 2);
    context.stroke();
    context.restore();
  }
};
