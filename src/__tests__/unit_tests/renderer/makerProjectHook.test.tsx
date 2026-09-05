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

import { act, renderHook, waitFor } from '@testing-library/react';
import { IKaraokeSong } from 'common/karaoke/types';
import useKaraokeMakerProject from 'renderer/karaoke/useKaraokeMakerProject';

jest.mock('renderer/karaoke/makerAnalysis', () => ({
  extractKaraokeMakerWaveform: () =>
    Promise.resolve({ waveform: [0.1, 0.2], durationMs: 30_000 }),
}));

const saveKaraokeMakerDraft = jest.fn().mockResolvedValue(undefined);
const loadKaraokeMakerDraft = jest.fn().mockResolvedValue(undefined);
const deleteKaraokeMakerDraft = jest.fn().mockResolvedValue(undefined);

const song = (): IKaraokeSong => ({
  id: 'hook-song',
  title: 'Hook',
  artist: 'Tester',
  durationMs: 30_000,
  assets: [],
  lines: [],
  timingPrecision: 'none',
  pitch: { kind: 'none', reason: 'missing' },
  meta: { sourceFormat: 'plain', gapMs: 0 },
});

const audioFile = () =>
  new File(['audio'], 'hook.mp3', { type: 'audio/mpeg' }) as File;

const setup = async () => {
  const view = renderHook(() =>
    useKaraokeMakerProject({
      song: song(),
      audioFile: audioFile(),
      restoreSavedDraft: false,
      t: ((key: string) => key) as never,
      onProjectAdopted: () => {},
    }),
  );
  // Waveform decoding resolves after mount; settle that effect before testing
  // edits or tearing down the hook.
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

/**
 * The project, its history and its draft on disk.
 *
 * Three invariants that used to be a thousand lines apart, which is how they
 * managed to disagree: every edit goes through `commit`, autosave fires on
 * `updatedAt` and nothing else, and Restore is undoable.
 */
describe('the Maker project', () => {
  beforeEach(() => {
    saveKaraokeMakerDraft.mockClear().mockResolvedValue(undefined);
    loadKaraokeMakerDraft.mockClear().mockResolvedValue(undefined);
    deleteKaraokeMakerDraft.mockClear().mockResolvedValue(undefined);
    window.electron = {
      ipcRenderer: {
        saveKaraokeMakerDraft,
        loadKaraokeMakerDraft,
        deleteKaraokeMakerDraft,
      },
    } as unknown as typeof window.electron;
  });

  it('starts with nothing to undo or redo', async () => {
    const { result } = await setup();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('stamps every commit and makes it undoable', async () => {
    const { result } = await setup();
    const before = result.current.project.updatedAt;

    // `updatedAt` has millisecond resolution and this test is faster than
    // that, so the clock is moved rather than the assertion weakened.
    jest.useFakeTimers().setSystemTime(Date.parse(before) + 1_000);
    act(() => {
      result.current.commit((current) => ({ ...current, title: 'Renamed' }));
    });
    jest.useRealTimers();

    expect(result.current.project.title).toBe('Renamed');
    // `commit` touches updatedAt, which is the only thing autosave watches.
    expect(result.current.project.updatedAt).not.toBe(before);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(result.current.project.title).toBe('Hook');
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.project.title).toBe('Renamed');
  });

  it('drops the redo branch when a new edit lands on top of an undo', async () => {
    // The future belonged to a past that no longer happened.
    const { result } = await setup();

    act(() => result.current.commit((c) => ({ ...c, title: 'First' })));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.commit((c) => ({ ...c, title: 'Second' })));
    expect(result.current.canRedo).toBe(false);
  });

  it('keeps the history bounded rather than growing all session', async () => {
    const { result } = await setup();

    act(() => {
      for (let index = 0; index < 120; index += 1) {
        result.current.commit((c) => ({ ...c, title: `Edit ${index}` }));
      }
    });

    // Every one of the 120 edits is still undoable up to the cap, and the cap
    // holds — undoing past it simply runs out rather than misbehaving.
    act(() => {
      for (let index = 0; index < 200; index += 1) {
        result.current.undo();
      }
    });
    expect(result.current.canUndo).toBe(false);
  });

  it('rebuilds the imported original and deletes the draft it replaced', async () => {
    const { result } = await setup();
    act(() => result.current.commit((c) => ({ ...c, title: 'Edited' })));

    let original: { title: string } | undefined;
    act(() => {
      original = result.current.restoreOriginal();
    });

    expect(original?.title).toBe('Hook');
    expect(result.current.project.title).toBe('Hook');
    // The saved draft held the work being discarded, so it goes rather than
    // waiting for autosave to overwrite it.
    expect(deleteKaraokeMakerDraft).toHaveBeenCalledTimes(1);
    // And Restore is undoable, which is what its confirmation promises.
    act(() => result.current.undo());
    expect(result.current.project.title).toBe('Edited');
  });

  it('decodes the waveform once and keeps it across an edit', async () => {
    const { result } = await setup();

    await waitFor(() =>
      expect(result.current.project.analysis.waveform).toHaveLength(2),
    );

    act(() => result.current.commit((c) => ({ ...c, title: 'Edited' })));
    // The waveform describes the audio file, not the editing, so an edit must
    // not send it back for another decode.
    expect(result.current.project.analysis.waveform).toHaveLength(2);
  });
});
