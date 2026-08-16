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
  IKaraokeMakerNote,
  IKaraokeMakerToken,
} from 'common/karaoke/makerProject';
import { useKaraokeMakerSelection } from 'renderer/karaoke/useKaraokeMakerSelection';

const token = (id: string): IKaraokeMakerToken => ({
  id,
  text: id,
  startsWord: true,
  startMs: 0,
  endMs: 500,
  source: 'manual',
});

const note = (id: string): IKaraokeMakerNote => ({
  id,
  startMs: 0,
  endMs: 500,
  targetMidi: 60,
  kind: 'normal',
  source: 'manual',
});

/**
 * The selection has three rules that used to live eight hundred lines from the
 * state they govern. Each one exists because of something that looked broken.
 */
describe('the Maker selection', () => {
  it('clears a selection whose word has gone', () => {
    // Deleting the selected word used to leave the inspector describing
    // something that no longer existed.
    const { result, rerender } = renderHook(
      ({ tokens }) =>
        useKaraokeMakerSelection({
          initialEditorView: undefined,
          tokens,
          notes: [],
          draftReady: true,
        }),
      { initialProps: { tokens: [token('a'), token('b')] } },
    );

    act(() => result.current.setSelection({ kind: 'word', id: 'b' }));
    expect(result.current.selection).toEqual({ kind: 'word', id: 'b' });

    rerender({ tokens: [token('a')] });
    expect(result.current.selection).toBeUndefined();
  });

  it('leaves a selection alone before the draft decision is made', () => {
    // Until the saved draft has been accepted or declined, what is on screen is
    // provisional — clearing against it would fight the restore.
    const { result, rerender } = renderHook(
      ({ tokens }) =>
        useKaraokeMakerSelection({
          initialEditorView: undefined,
          tokens,
          notes: [],
          draftReady: false,
        }),
      { initialProps: { tokens: [token('a')] } },
    );

    act(() => result.current.setSelection({ kind: 'word', id: 'a' }));
    rerender({ tokens: [] });

    expect(result.current.selection).toEqual({ kind: 'word', id: 'a' });
  });

  it('seeds from the view it was reopened with', () => {
    const { result } = renderHook(() =>
      useKaraokeMakerSelection({
        initialEditorView: {
          viewStartMs: 0,
          viewDurationMs: 12_000,
          followViewport: true,
          previewOpen: true,
          timingScope: 'all',
          selection: { kind: 'note', id: 'n1' },
        },
        tokens: [],
        notes: [note('n1')],
        draftReady: false,
      }),
    );

    expect(result.current.selection).toEqual({ kind: 'note', id: 'n1' });
    // A note selection seeds the multi-note set too, so reopening onto a note
    // does not lose it the moment something else nudges the set.
    expect([...result.current.selectedNoteIds]).toEqual(['n1']);
  });

  it('empties the note set when the selection stops being a note', () => {
    const { result } = renderHook(() =>
      useKaraokeMakerSelection({
        initialEditorView: undefined,
        tokens: [token('a')],
        notes: [note('n1')],
        draftReady: true,
      }),
    );

    act(() => result.current.setSelection({ kind: 'note', id: 'n1' }));
    expect(result.current.selectedNoteIds.size).toBe(1);

    act(() => result.current.setSelection({ kind: 'word', id: 'a' }));
    expect(result.current.selectedNoteIds.size).toBe(0);
  });

  it('arms Ctrl-linking only while a note is selected', () => {
    // The only thing Ctrl does here is arm linking a note to a lyric, so the
    // listener has no business existing at any other time.
    const { result } = renderHook(() =>
      useKaraokeMakerSelection({
        initialEditorView: undefined,
        tokens: [token('a')],
        notes: [note('n1')],
        draftReady: true,
      }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
    });
    expect(result.current.controlLinkMode).toBe(false);

    act(() => result.current.setSelection({ kind: 'note', id: 'n1' }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
    });
    expect(result.current.controlLinkMode).toBe(true);
  });

  it('disarms when the window loses focus with Ctrl still down', () => {
    // Ctrl held while the window goes away never sends its keyup, so without
    // the blur listener the editor stays armed for a gesture the user has
    // walked away from.
    const { result } = renderHook(() =>
      useKaraokeMakerSelection({
        initialEditorView: undefined,
        tokens: [],
        notes: [note('n1')],
        draftReady: true,
      }),
    );

    act(() => result.current.setSelection({ kind: 'note', id: 'n1' }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
    });
    expect(result.current.controlLinkMode).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current.controlLinkMode).toBe(false);
  });
});
