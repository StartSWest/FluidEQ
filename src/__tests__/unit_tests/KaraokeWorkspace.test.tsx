/*
<AQUA: System-wide parametric audio equalizer interface>
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

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { findSongTitle } from '../utils/karaokeSongTitle';
import { setTransportSlot } from '../../renderer/audio/transportSlot';
import KaraokeWorkspace from '../../renderer/karaoke/KaraokeWorkspace';
import {
  createKaraokeAudioClock,
  IKaraokeAudioClock,
} from '../../renderer/karaoke/karaokeAudioClock';
import { FakeClockContext, openFakeClock } from '../utils/fakeAudioClock';

jest.mock('../../renderer/audio/LiveAudioContext', () => ({
  ...jest.requireActual('../../renderer/audio/LiveAudioContext'),
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => ({
    isPaused: false,
    readFrame: () => undefined,
  }),
}));

/**
 * The count-in, the Maker's countdown and its auditions keep time on the sound
 * card's clock, which jsdom does not have. One clock the test moves by hand,
 * shared by the workspace and its Maker as the real one is.
 */
let mockClockContext = new FakeClockContext();
let mockClock: IKaraokeAudioClock = createKaraokeAudioClock(
  openFakeClock(mockClockContext),
);
jest.mock('../../renderer/karaoke/karaokeAudioClock', () => ({
  ...jest.requireActual('../../renderer/karaoke/karaokeAudioClock'),
  useKaraokeAudioClock: () => mockClock,
}));

describe('KaraokeWorkspace', () => {
  const originalMatchMedia = window.matchMedia;
  let barSlot: HTMLDivElement | undefined;
  const createObjectURL = jest.fn(() => 'blob:karaoke-song');
  const revokeObjectURL = jest.fn();
  const load = jest.fn();
  const pause = jest.fn();
  const play = jest.fn().mockResolvedValue(undefined);
  const getPathForFile = jest.fn((_file: File) => '');
  const saveKaraokeSession = jest.fn().mockResolvedValue(undefined);
  const restoreKaraokeSession = jest.fn().mockResolvedValue(undefined);
  const readKaraokeSessionFile = jest.fn().mockResolvedValue(undefined);
  const clearKaraokeSession = jest.fn().mockResolvedValue(undefined);
  const loadKaraokeMakerDraft = jest.fn().mockResolvedValue(undefined);
  const saveKaraokeMakerDraft = jest.fn().mockResolvedValue(undefined);
  const deleteKaraokeMakerDraft = jest.fn().mockResolvedValue(undefined);

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: load,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pause,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: play,
    });
  });

  beforeEach(() => {
    mockClockContext = new FakeClockContext();
    mockClock = createKaraokeAudioClock(openFakeClock(mockClockContext));
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    load.mockClear();
    pause.mockClear();
    play.mockClear();
    getPathForFile.mockReset().mockReturnValue('');
    saveKaraokeSession.mockReset().mockResolvedValue(undefined);
    restoreKaraokeSession.mockReset().mockResolvedValue(undefined);
    readKaraokeSessionFile.mockReset().mockResolvedValue(undefined);
    clearKaraokeSession.mockReset().mockResolvedValue(undefined);
    loadKaraokeMakerDraft.mockReset().mockResolvedValue(undefined);
    saveKaraokeMakerDraft.mockReset().mockResolvedValue(undefined);
    deleteKaraokeMakerDraft.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        platform: 'win32',
        ipcRenderer: {
          getPathForFile,
          saveKaraokeSession,
          restoreKaraokeSession,
          readKaraokeSessionFile,
          clearKaraokeSession,
          loadKaraokeMakerDraft,
          saveKaraokeMakerDraft,
          deleteKaraokeMakerDraft,
          // The separation surface. Stems resolve to "none on disk" so the
          // restore effect stays quiet unless a test says otherwise.
          loadKaraokeStems: jest.fn().mockResolvedValue(null),
          saveKaraokeStems: jest.fn().mockResolvedValue(undefined),
          releaseKaraokeSeparationModel: jest.fn(),
          cancelKaraokeSeparation: jest.fn(),
          separateKaraokeVocals: jest.fn(),
          onKaraokeSeparationProgress: jest.fn().mockReturnValue(() => {}),
        },
      },
    });
    window.localStorage.clear();

    // The strip of the shared transport bar this tab draws into.
    //
    // The app has one bar and karaoke portals its controls — faders, jumps
    // and pitch tone — into it rather than drawing a second row of its own.
    // Without the node the bar supplies there is nowhere for them to land, so
    // a workspace mounted alone has no play button at all. This is the bar's
    // own ref callback, given a node to hand over.
    barSlot = document.createElement('div');
    document.body.append(barSlot);
    setTransportSlot(barSlot);
  });

  afterEach(async () => {
    await act(async () => {
      cleanup();
      setTransportSlot(null);
    });
    barSlot?.remove();
    barSlot = undefined;
    jest.useRealTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
  });

  // The empty stage of the K1 mockup (2026-11-16): the microphone, "Your
  // stage is ready", Open song and Add folder, and the microphone's settings
  // in the stage's own bar. The readiness row with its own pitch lane went
  // with the header row above the tab.
  it('offers real local import actions in the empty state', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    // Nothing about being empty until the question has been answered. Last
    // session's playlist is read back a moment after the tab opens, and for
    // that moment this drew a microphone and "drop a folder here" over a
    // playlist that was about to appear.
    expect(
      container.querySelector('.karaoke-workspace__restoring'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        container.querySelector('.karaoke-workspace__restoring'),
      ).not.toBeInTheDocument(),
    );

    expect(container.querySelector('.karaoke-workspace')).toHaveClass(
      'is-empty',
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Your stage is ready' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open song' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add folder' })).toBeVisible();
    // No strip, chords or song switches without a song.
    expect(container.querySelector('.karaoke-pitch')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'What the stage shows' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Enter full screen' }),
    ).toBeVisible();
    expect(
      container.querySelector('.karaoke-workspace__microphone-art'),
    ).toBeVisible();
    expect(
      container.querySelector('.karaoke-workspace__disc'),
    ).not.toBeInTheDocument();

    const input = container.querySelector('input[type="file"]');
    // Named members rather than the whole string: the accept list grows every
    // time a format lands, and a test that fails because the picker started
    // offering one more extension is testing the list, not the picker.
    const accept = (input?.getAttribute('accept') ?? '').split(',');
    ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.lrc', '.elrc', '.txt'].forEach(
      (extension) => expect(accept).toContain(extension),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Microphone settings' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Microphone settings' }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: 'Turn on mic' }),
    ).not.toHaveLength(0);
  });

  // The stage bar's Pitch / Chords / Words only (the K1 mockup), which
  // replaced the pitch guide's own Hide and Show; the microphone is not
  // touched by it.
  it('shows the pitch strip, the chords alone or the words alone, and remembers which', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [new File(['audio'], 'bare-song.mp3', { type: 'audio/mpeg' })],
        },
      },
    );
    expect(await findSongTitle('bare song')).toBeVisible();
    const shows = within(
      screen.getByRole('group', { name: 'What the stage shows' }),
    );
    expect(shows.getByRole('button', { name: 'Pitch' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(container.querySelector('.karaoke-pitch')).toBeInTheDocument();
    expect(
      screen.getByRole('separator', { name: 'Resize pitch lane' }),
    ).toBeInTheDocument();

    fireEvent.click(shows.getByRole('button', { name: 'Words only' }));
    expect(container.querySelector('.karaoke-pitch')).not.toBeInTheDocument();
    expect(
      container.querySelector('.karaoke-stage__guides'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('separator', { name: 'Resize pitch lane' }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem('fluideq-karaoke-stage-guides')).toBe(
      'words',
    );
    // The microphone keeps its own switch.
    expect(
      screen.getByRole('button', { name: 'Microphone settings' }),
    ).toBeVisible();

    fireEvent.click(shows.getByRole('button', { name: 'Pitch' }));
    expect(container.querySelector('.karaoke-pitch')).toBeInTheDocument();
    expect(window.localStorage.getItem('fluideq-karaoke-stage-guides')).toBe(
      'pitch',
    );
  });

  const background = () =>
    within(screen.getByRole('group', { name: 'Background' }));

  // The positive control for the test below: without it, "no toggle did
  // anything" and "the stage never had artwork" look identical.
  it('offers Art disabled when the song has no artwork', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);

    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [new File(['audio'], 'bare-song.mp3', { type: 'audio/mpeg' })],
        },
      },
    );
    expect(await findSongTitle('bare song')).toBeVisible();

    const art = background().getByRole('button', { name: 'Art' });
    expect(art).toBeDisabled();
    expect(art).toHaveAttribute('title', 'This song has no cover art');
    // With nothing chosen the stage is flat: no lights of its own (K1).
    expect(container.querySelector('.karaoke-stage-media')).toBeNull();
  });

  // Pressing the lit one gives the bare stage (the K1 mockup).
  it('hides and restores cover art, and remembers which', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);

    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'painted-song.mp3', { type: 'audio/mpeg' }),
            new File(['image'], 'painted-song.jpg', { type: 'image/jpeg' }),
          ],
        },
      },
    );
    expect(await findSongTitle('painted song')).toBeVisible();
    expect(container.querySelector('.karaoke-stage-media')).toBeInTheDocument();

    const art = background().getByRole('button', { name: 'Art' });
    expect(art).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(art);

    expect(container.querySelector('.karaoke-stage-media')).toBeNull();
    expect(art).toHaveAttribute('aria-pressed', 'false');
    expect(
      window.localStorage.getItem('fluideq-karaoke-stage-background'),
    ).toBe('none');

    fireEvent.click(art);

    expect(container.querySelector('.karaoke-stage-media')).toBeInTheDocument();
    expect(
      window.localStorage.getItem('fluideq-karaoke-stage-background'),
    ).toBe('cover');
  });

  it('switches exclusively between the art, the scene and a bare stage', async () => {
    const { container, rerender } = render(
      <KaraokeWorkspace isHidden={false} />,
    );
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'painted-song.mp3', { type: 'audio/mpeg' }),
            new File(['image'], 'painted-song.jpg', { type: 'image/jpeg' }),
          ],
        },
      },
    );
    await findSongTitle('painted song');
    const audio = container.querySelector('audio');
    expect(
      container.querySelector('.karaoke-stage-media__still'),
    ).toBeInTheDocument();
    const scene = () => background().getByRole('button', { name: 'Scene' });
    const art = () => background().getByRole('button', { name: 'Art' });

    expect(scene()).toHaveAttribute(
      'title',
      "Use the graph's scene or style as background",
    );
    fireEvent.click(scene());
    expect(
      container.querySelector('.karaoke-stage-media__still'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.karaoke-graph-background'),
    ).toBeInTheDocument();
    expect(art()).toHaveAttribute('aria-pressed', 'false');
    expect(scene()).toHaveAttribute('aria-pressed', 'true');
    expect(
      window.localStorage.getItem('fluideq-karaoke-stage-background'),
    ).toBe('graph');

    fireEvent.click(art());
    expect(
      container.querySelector('.karaoke-stage-media__still'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.karaoke-graph-background'),
    ).not.toBeInTheDocument();
    fireEvent.click(scene());
    expect(scene()).toHaveAttribute('title', 'Turn off the scene background');
    fireEvent.click(scene());
    expect(container.querySelector('.karaoke-stage-media')).toBeNull();
    expect(
      container.querySelector('.karaoke-graph-background'),
    ).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem('fluideq-karaoke-stage-background'),
    ).toBe('none');
    expect(container.querySelector('audio')).toBe(audio);

    fireEvent.click(scene());
    rerender(<KaraokeWorkspace isHidden={false} isFullScreen />);
    expect(
      container.querySelector('.karaoke-graph-background'),
    ).toBeInTheDocument();
    rerender(<KaraokeWorkspace isHidden />);
    expect(
      container.querySelector('.karaoke-graph-background'),
    ).not.toBeInTheDocument();
    rerender(<KaraokeWorkspace isHidden={false} />);
    expect(
      container.querySelector('.karaoke-graph-background'),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open in Maker' }));
    });
    expect(
      container.querySelector('.karaoke-graph-background'),
    ).not.toBeInTheDocument();
  });

  it('toggles full screen from the Karaoke surface without hijacking controls', async () => {
    const toggleFullScreen = jest.fn();
    const { container, rerender } = render(
      <KaraokeWorkspace
        isHidden={false}
        onToggleFullScreen={toggleFullScreen}
      />,
    );
    await act(async () => Promise.resolve());
    const stage = container.querySelector(
      '.karaoke-workspace__stage',
    ) as HTMLElement;

    fireEvent.doubleClick(stage);
    expect(toggleFullScreen).toHaveBeenCalledTimes(1);

    rerender(
      <KaraokeWorkspace
        isHidden={false}
        isFullScreen
        onToggleFullScreen={toggleFullScreen}
      />,
    );
    fireEvent.doubleClick(
      container.querySelector('.karaoke-workspace__stage') as HTMLElement,
    );
    expect(toggleFullScreen).toHaveBeenCalledTimes(2);

    fireEvent.doubleClick(
      screen.getByRole('button', { name: 'Exit full screen' }),
    );
    expect(toggleFullScreen).toHaveBeenCalledTimes(2);
  });

  it('moves the actions into the lyric surface in full screen', async () => {
    const toggleTopBar = jest.fn();
    const { container } = render(
      <KaraokeWorkspace
        isHidden={false}
        isFullScreen
        hasFullScreenTopBar={false}
        onToggleFullScreenTopBar={toggleTopBar}
      />,
    );

    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'A stage built around your music',
      }),
    ).not.toBeInTheDocument();
    const emptyToolbar = screen.getByRole('toolbar', {
      name: 'Karaoke actions',
    });
    expect(emptyToolbar).toHaveClass('karaoke-stage-bar');
    expect(emptyToolbar.parentElement).toHaveClass('karaoke-workspace__stage');

    fireEvent.click(
      screen.getByRole('button', { name: 'Show the FluidEQ header' }),
    );
    expect(toggleTopBar).toHaveBeenCalledTimes(1);

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['audio'], 'Full screen.mp3', { type: 'audio/mpeg' })],
      },
    });

    expect(await findSongTitle('Full screen')).toBeVisible();
    const lyricToolbar = screen.getByRole('toolbar', {
      name: 'Karaoke actions',
    });
    expect(lyricToolbar.parentElement).toHaveClass('karaoke-workspace__stage');
  });
});
