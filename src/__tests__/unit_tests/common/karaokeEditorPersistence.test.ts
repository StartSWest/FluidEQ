/* FluidEQ Karaoke editor persistence tests. GPL-3.0-or-later. */

import {
  clearKaraokeProgress,
  readKaraokeMakerEditorView,
  readKaraokeMakerOpen,
  readKaraokeProgress,
  writeKaraokeMakerEditorView,
  writeKaraokeMakerOpen,
  writeKaraokeProgress,
} from '../../../renderer/karaoke/karaokeEditorPersistence';

describe('Karaoke editor persistence', () => {
  beforeEach(() => window.localStorage.clear());

  it('restores the editor viewport and active selection per project', () => {
    writeKaraokeMakerEditorView('maker-song-a', {
      viewStartMs: 42_500,
      viewDurationMs: 8_000,
      followViewport: false,
      previewOpen: true,
      timingScope: 'from-word',
      selection: { kind: 'word', id: 'word-12' },
    });

    expect(readKaraokeMakerEditorView('maker-song-a')).toEqual({
      viewStartMs: 42_500,
      viewDurationMs: 8_000,
      followViewport: false,
      previewOpen: true,
      timingScope: 'from-word',
      selection: { kind: 'word', id: 'word-12' },
    });
    expect(readKaraokeMakerEditorView('maker-song-b')).toBeUndefined();
  });

  it('restores whether the Maker was open and the exact song progress', () => {
    writeKaraokeMakerOpen(true);
    writeKaraokeProgress('album/song.mp3', 91_275);

    expect(readKaraokeMakerOpen()).toBe(true);
    expect(readKaraokeProgress()).toEqual({
      version: 1,
      selectedPlaylistId: 'album/song.mp3',
      playheadMs: 91_275,
    });

    clearKaraokeProgress();
    expect(readKaraokeProgress()).toBeUndefined();
  });

  it('remembers the note grid pitch zoom per project, and drops a broken one', () => {
    const view = {
      viewStartMs: 0,
      viewDurationMs: 8_000,
      followViewport: true,
      previewOpen: true,
      timingScope: 'all' as const,
    };
    writeKaraokeMakerEditorView('maker-song-a', {
      ...view,
      pitchWindow: { lowMidi: 52.5, highMidi: 70 },
    });
    expect(readKaraokeMakerEditorView('maker-song-a')?.pitchWindow).toEqual({
      lowMidi: 52.5,
      highMidi: 70,
    });

    // Upside down: not a window. The rest of the view still restores.
    window.localStorage.setItem(
      'fluideq.karaoke.maker-editor-views.v1',
      JSON.stringify({
        version: 1,
        projects: {
          'maker-song-b': {
            ...view,
            pitchWindow: { lowMidi: 70, highMidi: 50 },
            updatedAt: 1,
          },
        },
      }),
    );
    const restored = readKaraokeMakerEditorView('maker-song-b');
    expect(restored?.viewDurationMs).toBe(8_000);
    expect(restored?.pitchWindow).toBeUndefined();
  });

  it('ignores malformed persisted editor data', () => {
    window.localStorage.setItem(
      'fluideq.karaoke.maker-editor-views.v1',
      '{"version":1,"projects":{"broken":{"viewStartMs":-1}}}',
    );
    window.localStorage.setItem(
      'fluideq.karaoke.current-progress.v1',
      '{"version":1,"selectedPlaylistId":"song","playheadMs":-5}',
    );

    expect(readKaraokeMakerEditorView('broken')).toBeUndefined();
    expect(readKaraokeProgress()).toBeUndefined();
  });
});
