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

import { MutableRefObject } from 'react';
import { IKaraokeMakerProject } from '../../common/karaoke/makerProject';
import {
  karaokeMakerLyricFocus,
  karaokeMakerSectionGroups,
} from './makerCanvasLayout';
import {
  IHitRegion,
  TMakerDragBehavior,
  makerPlot,
} from './makerCanvasGeometry';
import {
  ICanvasLyricWord,
  ICanvasSelectionBox,
  INoteLinkDragState,
  INotePaintDraft,
} from './makerCanvasTypes';
import { TSelection } from './useKaraokeMakerSelection';
import { paintBackdrop } from './makerCanvas/paintBackdrop';
import { paintLyrics } from './makerCanvas/paintLyrics';
import { paintNotes } from './makerCanvas/paintNotes';
import { paintOverlays } from './makerCanvas/paintOverlays';

/**
 * Everything the timeline needs to draw one frame.
 *
 * Wide, and that is the right shape: this is a renderer, so it takes data and
 * produces pixels. The alternative to a wide parameter list here was the
 * previous arrangement, where the same values were reachable as closures inside
 * a nine-hundred-line effect and nothing said which of them the drawing
 * actually used.
 *
 * The refs are genuinely mutable and genuinely two-way. `hitRegionsRef` is an
 * output — the paint is the only thing that knows where anything landed, so it
 * records the rectangles as it draws and the pointer handlers read them back.
 * The other four are inputs describing a gesture in flight, read every frame
 * because a drag repaints faster than React re-renders.
 */
export interface IMakerCanvasPaint {
  context: CanvasRenderingContext2D;
  /** Device pixel ratio the backing bitmap was sized for. */
  ratio: number;
  width: number;
  height: number;
  headerHeight: number;
  lyricSectionTop: number;
  project: IKaraokeMakerProject;
  selection: TSelection;
  selectedNoteIds: Set<string>;
  canvasLyricWords: ICanvasLyricWord[];
  canvasSectionGroups: ReturnType<typeof karaokeMakerSectionGroups>;
  activeLyricFocus: ReturnType<typeof karaokeMakerLyricFocus>;
  activeLyricWordId?: string;
  hoveredEditHandle?: {
    kind: 'word' | 'note';
    id: string;
    behavior: TMakerDragBehavior;
  };
  /** Ctrl is down with a note selected: linking is armed. */
  controlLinkMode: boolean;
  viewStartMs: number;
  visibleViewDurationMs: number;
  visualPlayheadMs: number;
  effectiveDurationMs: number;
  /** Written by the paint, read by the pointer handlers. */
  hitRegionsRef: MutableRefObject<IHitRegion[]>;
  selectionBoxRef: MutableRefObject<ICanvasSelectionBox | undefined>;
  notePaintDraftRef: MutableRefObject<INotePaintDraft | undefined>;
  noteLinkDragRef: MutableRefObject<INoteLinkDragState | undefined>;
  wordFocusAnimationRef: MutableRefObject<{
    tokenId?: string;
    startedAt: number;
  }>;
}

/**
 * Draw the whole editor timeline: waveform, sections, lyrics, notes, playhead.
 *
 * One pass, in painter's order, ending by publishing the hit regions it just
 * laid out. It was the body of a `useEffect` inside a seven-thousand-line
 * component and is unchanged here beyond taking its inputs as an argument
 * instead of closing over them.
 */
export const paintMakerCanvas = ({
  context,
  ratio,
  width,
  height,
  headerHeight,
  lyricSectionTop,
  project,
  selection,
  selectedNoteIds,
  canvasLyricWords,
  canvasSectionGroups,
  activeLyricFocus,
  activeLyricWordId,
  hoveredEditHandle,
  controlLinkMode,
  viewStartMs,
  visibleViewDurationMs,
  visualPlayheadMs,
  effectiveDurationMs,
  hitRegionsRef,
  selectionBoxRef,
  notePaintDraftRef,
  noteLinkDragRef,
  wordFocusAnimationRef,
}: IMakerCanvasPaint) => {
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const plot = makerPlot({
    width,
    height,
    headerHeight,
    viewStartMs,
    visibleViewDurationMs,
  });
  const regions: IHitRegion[] = [];

  // The stage first: ground, section bands, ruler, pitch labels, waveform.
  // None of it depends on where a word lands, so it draws before they are
  // measured — and it is the only layer that reports no hit regions back.
  paintBackdrop(context, {
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
  });

  // The words, and everything that depends on them. Packing decides which lane
  // a word occupies, and a note reads its position from the word it belongs to
  // — so this runs before the notes and cannot be reordered with them.
  //
  // Boundary handles are kept apart and appended after the wider word and
  // underline regions, because hit-testing takes the first match and a handle
  // has to win against the region drawn behind it.
  const lyricPaint = paintLyrics(context, {
    plot,
    lyricSectionTop,
    project,
    canvasLyricWords,
    selection,
    activeLyricFocus,
    activeLyricWordId,
    hoveredEditHandle,
    viewStartMs,
    visibleViewDurationMs,
    visualPlayheadMs,
    wordFocusAnimationRef,
  });
  regions.push(...lyricPaint.regions, ...lyricPaint.wordBoundaryRegions);

  // The melody, after the words: a note linked to a lyric is drawn against
  // that word's position, so `canvasLyricWords` goes in to answer "which word
  // is this note on" rather than to draw anything.
  regions.push(
    ...paintNotes(context, {
      plot,
      project,
      canvasLyricWords,
      selectedNoteIds,
      controlLinkMode,
      hoveredEditHandle,
      viewStartMs,
      visibleViewDurationMs,
      visualPlayheadMs,
    }),
  );

  // Last, and on top: the gesture in flight and the playhead. None of it is
  // part of the project, and none of it is grabbable — it reads the regions
  // the layers above produced rather than adding to them.
  paintOverlays(context, {
    plot,
    visualPlayheadMs,
    regions,
    notePaintDraftRef,
    selectionBoxRef,
    noteLinkDragRef,
  });

  hitRegionsRef.current = regions;
};
