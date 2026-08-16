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
import { readKaraokeMakerEditorView } from 'renderer/karaoke/karaokeEditorPersistence';
import {
  DEFAULT_PREVIEW_HEIGHT,
  DEFAULT_VIEW_MS,
  useKaraokeMakerEditorView,
} from 'renderer/karaoke/useKaraokeMakerEditorView';

/** The envelope the caller fills each render; the hook decides when to post it. */
const view = (hook: {
  result: { current: { editorViewRef: { current: unknown } } };
}) => hook.result.current.editorViewRef;

/**
 * Where the editor was looking, remembered per project.
 *
 * Seven values that are written together and read together. The failure they
 * guard against is quiet: reopen a song and find yourself at the start of it
 * with the preview shut, having lost nothing the app would ever report.
 */
describe('the Maker editor view', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts at the defaults when the song has never been opened', () => {
    const { result } = renderHook(() =>
      useKaraokeMakerEditorView('fresh-song', undefined, undefined),
    );

    expect(result.current.viewStartMs).toBe(0);
    expect(result.current.viewDurationMs).toBe(DEFAULT_VIEW_MS);
    expect(result.current.previewHeight).toBe(DEFAULT_PREVIEW_HEIGHT);
    expect(result.current.followViewport).toBe(true);
    expect(result.current.timingScope).toBe('all');
  });

  it('takes its starting point from the view it is handed', () => {
    // The record is read by the caller, because the selection seeds from the
    // same read — two reads that have to agree is one more than is needed.
    const { result } = renderHook(() =>
      useKaraokeMakerEditorView('song', undefined, {
        viewStartMs: 4_000,
        viewDurationMs: 8_000,
        followViewport: false,
        previewOpen: false,
        previewTextSize: 120,
        previewHeight: 210,
        timingScope: 'from-word',
      }),
    );

    expect(result.current.viewStartMs).toBe(4_000);
    expect(result.current.viewDurationMs).toBe(8_000);
    expect(result.current.followViewport).toBe(false);
    expect(result.current.previewOpen).toBe(false);
    expect(result.current.previewTextSize).toBe(120);
    expect(result.current.previewHeight).toBe(210);
    expect(result.current.timingScope).toBe('from-word');
  });

  it('writes the view back under the song it belongs to', () => {
    const hook = renderHook(() =>
      useKaraokeMakerEditorView('song-a', undefined, undefined),
    );

    act(() => {
      hook.result.current.setViewStartMs(7_500);
      hook.result.current.setTimingScope('from-word');
    });
    // The caller fills the envelope; the hook decides when it is posted.
    act(() => {
      view(hook as never).current = {
        viewStartMs: 7_500,
        viewDurationMs: DEFAULT_VIEW_MS,
        followViewport: true,
        previewOpen: true,
        previewTextSize: 100,
        previewHeight: DEFAULT_PREVIEW_HEIGHT,
        timingScope: 'from-word',
        selection: undefined,
      };
      jest.advanceTimersByTime(200);
    });

    const saved = readKaraokeMakerEditorView('song-a');
    expect(saved?.viewStartMs).toBe(7_500);
    expect(saved?.timingScope).toBe('from-word');
    // And nothing was written under a song that was never opened.
    expect(readKaraokeMakerEditorView('song-b')).toBeUndefined();
  });

  it('remembers the preview pane for the app, not for one song', () => {
    // Where you were looking is about this song. Whether the preview is open at
    // all is a preference about the editor, so it is one key rather than one
    // per karaoke file.
    const first = renderHook(() =>
      useKaraokeMakerEditorView('song-a', undefined, undefined),
    );
    expect(first.result.current.previewOpen).toBe(true);

    act(() => first.result.current.setPreviewOpen(false));

    const second = renderHook(() =>
      useKaraokeMakerEditorView('song-b', undefined, undefined),
    );
    expect(second.result.current.previewOpen).toBe(false);
  });

  it('saves against the song it was recorded for, not the one now open', () => {
    // A playlist can advance while the editor is closing. The unmount write
    // reads the id it recorded rather than whatever is current, or the view
    // lands on the wrong song.
    const hook = renderHook(
      ({ id }) => useKaraokeMakerEditorView(id, undefined, undefined),
      { initialProps: { id: 'song-a' } },
    );

    act(() => {
      view(hook as never).current = {
        viewStartMs: 3_000,
        viewDurationMs: DEFAULT_VIEW_MS,
        followViewport: true,
        previewOpen: true,
        timingScope: 'all',
        selection: undefined,
      };
    });
    hook.unmount();

    expect(readKaraokeMakerEditorView('song-a')?.viewStartMs).toBe(3_000);
  });
});
