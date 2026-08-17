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

import { act, renderHook } from '@testing-library/react';
import {
  IKaraokeMakerLine,
  IKaraokeMakerToken,
} from 'common/karaoke/makerProject';
import { IMakerCanvasGesture } from 'renderer/karaoke/useMakerCanvasGesture';
import { useMakerToolModes } from 'renderer/karaoke/useMakerToolModes';

const token = (id: string, startMs?: number): IKaraokeMakerToken => ({
  id,
  text: id,
  startsWord: true,
  startMs,
  endMs: startMs === undefined ? undefined : startMs + 400,
  source: 'manual',
});

const line = (id: string, tokens: IKaraokeMakerToken[]): IKaraokeMakerLine => ({
  id,
  tokens,
});

/** Every gesture ref set, so a reset has something to clear in each of them. */
const busyGesture = (): IMakerCanvasGesture => ({
  hitRegions: { current: [] },
  drag: { current: { behavior: 'move' } as never },
  pan: { current: { pointerX: 10, viewStartMs: 0 } },
  scrub: { current: { anchorMs: 0, auditionWordGrain: false } },
  selectionBox: { current: { x: 0, y: 0, width: 1, height: 1 } as never },
  notePaintDraft: { current: { startMs: 0 } as never },
  noteLinkDrag: { current: { noteId: 'n1' } as never },
  lastDragAuditionMidi: { current: 60 },
});

const setup = (over: Partial<Parameters<typeof useMakerToolModes>[0]> = {}) => {
  const tokens = [token('w1', 0), token('w2')];
  const calls = {
    cancelAudibleInteractions: jest.fn(),
    clearLineEntryCountdown: jest.fn(),
    onPause: jest.fn(),
    onSeek: jest.fn(),
    setExportOpen: jest.fn(),
    setFollowViewport: jest.fn(),
    setHandPanMode: jest.fn(),
    setIsCanvasPanning: jest.fn(),
    setIsCanvasScrubbing: jest.fn(),
    setLineEntryCapture: jest.fn(),
    setLineEntryIndex: jest.fn(),
    setLineEntryMode: jest.fn(),
    setLineEntrySession: jest.fn(),
    setLyricFollowRequestKey: jest.fn(),
    setLyricsOpen: jest.fn(),
    setNoteEditMode: jest.fn(),
    setPreviewOpen: jest.fn(),
    setSelection: jest.fn(),
    setToolPanel: jest.fn(),
    setViewStartMs: jest.fn(),
  };
  const gesture = busyGesture();
  const lineEntryIndexRef = { current: 7 };
  const { result } = renderHook(() =>
    useMakerToolModes({
      ...calls,
      gesture,
      lineEntryIndexRef,
      lineEntryMode: false,
      lyricLines: [line('l1', tokens)],
      maximumViewStartMs: 10_000,
      selectedToken: undefined,
      tokens,
      visibleViewDurationMs: 12_000,
      ...over,
    }),
  );
  return { calls, gesture, lineEntryIndexRef, result };
};

/**
 * The reset used to be written out four times and no two copies agreed.
 *
 * These tests exist because that disagreement was invisible: each copy read as
 * though it put everything away, and the ones that missed a ref left the editor
 * in two states at once with nothing to show for it until a later gesture
 * behaved oddly.
 */
describe('the Maker tool modes', () => {
  it('clears every gesture when the hand tool is taken up', () => {
    // The scrub in particular: this path used to leave it set, so switching to
    // the hand tool mid-scrub left the editor believing one was still running.
    const { gesture, result } = setup();
    act(() => result.current.toggleHandPanMode());

    expect(gesture.pan.current).toBeUndefined();
    expect(gesture.scrub.current).toBeUndefined();
    expect(gesture.drag.current).toBeUndefined();
    expect(gesture.selectionBox.current).toBeUndefined();
    expect(gesture.notePaintDraft.current).toBeUndefined();
    expect(gesture.noteLinkDrag.current).toBeUndefined();
  });

  it('clears every gesture when a note tool is taken up', () => {
    const { gesture, result } = setup();
    act(() => result.current.toggleNoteEditMode('paint'));

    expect(gesture.pan.current).toBeUndefined();
    expect(gesture.scrub.current).toBeUndefined();
    expect(gesture.drag.current).toBeUndefined();
    expect(gesture.selectionBox.current).toBeUndefined();
    expect(gesture.notePaintDraft.current).toBeUndefined();
    expect(gesture.noteLinkDrag.current).toBeUndefined();
  });

  it('puts the other tool away rather than holding both', () => {
    const { calls, result } = setup();
    act(() => result.current.toggleHandPanMode());
    expect(calls.setNoteEditMode).toHaveBeenCalledWith(undefined);

    act(() => result.current.toggleNoteEditMode('select'));
    expect(calls.setHandPanMode).toHaveBeenCalledWith(false);
  });

  it('disarms a note tool when a capture starts', () => {
    // This path used to leave paint mode armed, so the first tap of a guided
    // capture painted a note instead of timing a word.
    const { calls, result } = setup();
    act(() => result.current.startLineEntrySync());

    expect(calls.setNoteEditMode).toHaveBeenCalledWith(undefined);
    expect(calls.setHandPanMode).toHaveBeenCalledWith(false);
    expect(calls.setLineEntryMode).toHaveBeenLastCalledWith(true);
  });

  it('writes the line index straight to the ref a callback reads', () => {
    // The state setter alone is a render behind, and the first keystroke can
    // land before that render.
    const { lineEntryIndexRef, result } = setup();
    act(() => result.current.beginLineCapture({ lineIndex: 3, tokenId: 'w1' }));

    expect(lineEntryIndexRef.current).toBe(3);
  });

  it('leaves the playhead alone for a line that has no timing yet', () => {
    // Nowhere to seek to. Moving the playhead in would throw away wherever the
    // user had got to for no gain.
    const tokens = [token('w1')];
    const { calls, result } = setup({
      lyricLines: [line('l1', tokens)],
      tokens,
    });
    act(() => result.current.startLineEntrySync());

    expect(calls.onSeek).not.toHaveBeenCalled();
    expect(calls.setViewStartMs).not.toHaveBeenCalled();
  });

  it('gives a timed line a second of run-up', () => {
    const tokens = [token('w1', 5_000)];
    const { calls, result } = setup({
      lyricLines: [line('l1', tokens)],
      tokens,
    });
    act(() => result.current.startLineEntrySync());

    expect(calls.onSeek).toHaveBeenCalledWith(4_000);
  });
});
