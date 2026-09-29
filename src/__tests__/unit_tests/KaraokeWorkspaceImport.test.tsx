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
} from '@testing-library/react';
import { setKaraokeRelativePath } from '../../common/karaoke/files';
import { setTransportSlot } from '../../renderer/audio/transportSlot';
import KaraokeWorkspace from '../../renderer/karaoke/KaraokeWorkspace';
import {
  createKaraokeAudioClock,
  IKaraokeAudioClock,
} from '../../renderer/karaoke/karaokeAudioClock';
import { FakeClockContext, openFakeClock } from '../utils/fakeAudioClock';

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

/** An animation's end, named, as the element's own or bubbled from a child. */
const animationEnd = (element: Element, animationName: string) => {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  act(() => {
    element.dispatchEvent(event);
  });
};

/**
 * Moves the sound card's clock on, once any waiting `resume()` has settled,
 * and lets what the cues set off — a `play()` that resolves — land inside
 * `act` as well.
 */
const advanceAudioClock = async (seconds: number) => {
  await act(async () => undefined);
  await act(async () => {
    mockClockContext.advance(seconds);
  });
};

describe('KaraokeWorkspace imports and the stage', () => {
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

  /**
   * The two things this tab has to say, and which is which.
   *
   * `getByRole('status')` was unambiguous while there was one notice. There
   * are two now and they answer different questions: the import's own line is
   * about the folder that was just opened — a `.srt` nothing here reads, two
   * lyric files matching one song — while the lyric line sits beside the
   * words and is about the song on the stage. A bare role query matches both.
   */
  const importNotice = (container: HTMLElement) =>
    container.querySelector(
      '.karaoke-workspace__notice.is-warning',
    ) as HTMLElement;

  const lyricNotice = (container: HTMLElement) =>
    container.querySelector('.karaoke-lyrics__notice') as HTMLElement;

  const finishCountIn = async (container: HTMLElement) => {
    const cue = () =>
      container.querySelector('.karaoke-count-in strong') as HTMLElement;
    await waitFor(() => expect(cue()).toHaveTextContent('1'));
    await advanceAudioClock(0.551);
    expect(cue()).toHaveTextContent('2');
    await advanceAudioClock(0.55);
    expect(cue()).toHaveTextContent('3');
    await advanceAudioClock(0.55);
    expect(cue()).toHaveTextContent('GO');
  };

  it("counts in on the sound card's clock, never a timer", async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [new File(['audio'], 'Counting.mp3', { type: 'audio/mpeg' })],
        },
      },
    );
    expect(
      await screen.findByRole('heading', { name: 'Counting' }),
    ).toBeVisible();
    // Each beat was a `setTimeout` started when the one before it fired.
    const timers = jest.spyOn(window, 'setTimeout');
    const cue = () => container.querySelector('.karaoke-count-in strong');
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
      expect(cue()).toHaveTextContent('1');
      await advanceAudioClock(0.549);
      expect(cue()).toHaveTextContent('1');
      await advanceAudioClock(0.002);
      expect(cue()).toHaveTextContent('2');
      await advanceAudioClock(0.55);
      expect(cue()).toHaveTextContent('3');
      expect(play).not.toHaveBeenCalled();
      await advanceAudioClock(0.55);
      // The song on "GO", and "GO" up while it comes in.
      expect(cue()).toHaveTextContent('GO');
      expect(play).toHaveBeenCalledTimes(1);
      await advanceAudioClock(0.597);
      expect(cue()).toHaveTextContent('GO');
      await advanceAudioClock(0.003);
      expect(cue()).toBeNull();

      expect(timers).not.toHaveBeenCalled();
      // The control: the spy sees a timer when one is set.
      window.setTimeout(() => undefined, 0);
      expect(timers).toHaveBeenCalledTimes(1);
    } finally {
      // A spied `setTimeout` reads to Testing Library as fake timers.
      timers.mockRestore();
    }
  });

  it('moves the redesigned pitch lane beside the mic in a compact window', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        media: '(min-width: 1120px)',
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      } as MediaQueryList),
    });
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(['audio'], 'compact.mp3', { type: 'audio/mpeg' })],
      },
    });

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(
      container.querySelector('.karaoke-workspace__stage .karaoke-pitch'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.karaoke-workspace__readiness .karaoke-pitch'),
    ).toBeVisible();
    expect(
      container.querySelector('.karaoke-workspace__stage'),
    ).not.toHaveClass('has-stage-pitch');
    const readiness = container.querySelector(
      '.karaoke-workspace__readiness',
    ) as HTMLElement;
    const transport = container.querySelector(
      '.karaoke-transport',
    ) as HTMLElement;
    expect(readiness.nextElementSibling).toBe(transport);
    expect(
      container.querySelector('.karaoke-workspace__stage .karaoke-transport'),
    ).not.toBeInTheDocument();
  });

  it('keeps audio usable when a malformed lyric file is selected', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['audio'], 'voice.ogg', { type: 'audio/ogg' }),
          new File(['not timed'], 'voice.lrc', { type: 'text/plain' }),
        ],
      },
    });

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(lyricNotice(container)).toHaveTextContent(
      'voice.lrc carries no timings FluidEQ could read. The audio remains available without timed lyrics.',
    );
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });

  // Every lyric failure used to reach the user as the same sentence, so a
  // duet, a mis-encoded pack and a plain untimed sheet were indistinguishable.
  // `KaraokeParseError` has carried the reason the whole time.
  it('names the BPM an UltraStar file never declared', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'beatless.mp3', { type: 'audio/mpeg' }),
            new File(
              ['#TITLE:Beatless\n#GAP:0\n: 0 4 0 Hello\nE'],
              'beatless.txt',
              { type: 'text/plain' },
            ),
          ],
        },
      },
    );

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(lyricNotice(container)).toHaveTextContent(
      'beatless.txt declares no BPM, which an UltraStar file needs. The audio remains available without timed lyrics.',
    );
  });

  it('points at the row a malformed UltraStar note sits on', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'broken.mp3', { type: 'audio/mpeg' }),
            new File(
              [
                // A row that announces itself as a note and then carries two
                // numbers where four belong: skipped prose would not be worth
                // rejecting a file over, this is.
                '#TITLE:Broken Row\n#ARTIST:Test\n#BPM:120\n#GAP:0\n: 0 4 0 Hello\n: 1 2\nE',
              ],
              'broken.txt',
              { type: 'text/plain' },
            ),
          ],
        },
      },
    );

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(lyricNotice(container)).toHaveTextContent(
      'broken.txt has a note row FluidEQ could not read. Line 6. The audio remains available without timed lyrics.',
    );
  });

  // `selectKaraokePlaylist` has computed `ignored` since it was written and
  // nothing read it: `Song.mp3` beside `Song.srt` played with no lyrics and no
  // explanation, which is what a broken feature looks like.
  it('names the formats an import set aside instead of dropping them silently', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Sing Along.mp3', { type: 'audio/mpeg' }),
            new File(['subtitles'], 'Sing Along.srt', { type: 'text/plain' }),
            new File(['graphics'], 'Sing Along.cdg'),
          ],
        },
      },
    );

    expect(
      await screen.findByRole('heading', { name: 'Sing Along' }),
    ).toBeVisible();
    expect(importNotice(container)).toHaveTextContent(
      'FluidEQ has no karaoke reader for these files yet, so they were set aside: CDG, SRT.',
    );
  });

  // Said once and then gone (Ivan, 2026-09-27: "this warning needs to be
  // closable and to auto disappear after a few seconds"): its own fade's end
  // takes it away, and so does its cross. Only that fade: an animation of
  // another name ending on it (an arrival) leaves it standing.
  it('lets the set-aside notice go by its cross or by its own fade', async () => {
    const importSetAside = (container: HTMLElement) =>
      fireEvent.change(
        container.querySelector('input[type="file"]') as HTMLInputElement,
        {
          target: {
            files: [
              new File(['audio'], 'Sing Along.mp3', { type: 'audio/mpeg' }),
              new File(['graphics'], 'Sing Along.cdg'),
            ],
          },
        },
      );
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    importSetAside(container);
    await screen.findByRole('heading', { name: 'Sing Along' });

    const notice = importNotice(container) as HTMLElement;
    animationEnd(notice, 'rise-in');
    expect(importNotice(container)).toBeInTheDocument();
    animationEnd(notice, 'karaoke-notice-leave');
    expect(importNotice(container)).not.toBeInTheDocument();

    importSetAside(container);
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(importNotice(container)).not.toBeInTheDocument();
  });

  it('says two lyric files matched one song, so neither was used', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Twin.mp3', { type: 'audio/mpeg' }),
            new File(['[00:01.00]Hello'], 'Twin.lrc', { type: 'text/plain' }),
            new File(
              ['#TITLE:Twin\n#BPM:120\n#GAP:0\n: 0 4 0 Hello\nE'],
              'Twin.txt',
              { type: 'text/plain' },
            ),
          ],
        },
      },
    );

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(importNotice(container)).toHaveTextContent(
      'Two lyric files matched the same song, so neither was used: Twin.lrc, Twin.txt.',
    );
  });

  it('stops claiming two lyric files matched a song that has been removed', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Twin.mp3', { type: 'audio/mpeg' }),
            new File(['[00:01.00]Hello'], 'Twin.lrc', { type: 'text/plain' }),
            new File(
              ['#TITLE:Twin\n#BPM:120\n#GAP:0\n: 0 4 0 Hello\nE'],
              'Twin.txt',
              { type: 'text/plain' },
            ),
          ],
        },
      },
    );

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(importNotice(container)).toHaveTextContent(
      'Two lyric files matched the same song, so neither was used: Twin.lrc, Twin.txt.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Twin' }));

    // The song those two files were competing over has gone, so the sentence
    // that named it is no longer true. It used to survive the removal word for
    // word, naming a match against a library entry that no longer existed.
    expect(
      screen
        .queryAllByRole('status')
        .map((node) => node.textContent ?? '')
        .join(' '),
    ).not.toContain('Two lyric files matched the same song');
    expect(importNotice(container)).toHaveTextContent(
      'No audio file matches these lyric files, so they were not used: Twin.lrc, Twin.txt.',
    );
  });

  // The 2000s UltraStar pack the stage's own comments are written about: one
  // AVI, no artwork. The stage drew nothing at all while the art toggle stayed
  // enabled over it.
  it('draws the unplayable-video notice when it is all the stage has', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Retro Pack.mp3', { type: 'audio/mpeg' }),
            new File(['video'], 'Retro Pack [VD#0].avi', {
              type: 'video/x-msvideo',
            }),
          ],
        },
      },
    );

    expect(
      await screen.findByRole('heading', { name: 'Retro Pack' }),
    ).toBeVisible();
    const notice = container.querySelector(
      '.karaoke-stage-media__unsupported',
    ) as HTMLElement;
    expect(notice).toHaveTextContent('AVI video cannot be played here');
    expect(notice).toHaveClass('is-alone');
    // Role queries skip anything under `aria-hidden`, which the whole media
    // layer used to be — the sighted user read the notice and a screen reader
    // was told the stage was empty.
    expect(
      screen.getAllByRole('status').map((node) => node.textContent),
    ).toContain('AVI video cannot be played here');
    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide cover art' }),
    ).toBeEnabled();
  });

  it('lets a picture that will not decode step aside for the gradient', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Broken Art.mp3', { type: 'audio/mpeg' }),
            new File(['not really an image'], 'Broken Art.jpg', {
              type: 'image/jpeg',
            }),
          ],
        },
      },
    );

    expect(
      await screen.findByRole('heading', { name: 'Broken Art' }),
    ).toBeVisible();
    const still = container.querySelector(
      '.karaoke-stage-media__still',
    ) as HTMLImageElement;
    expect(still).toBeInTheDocument();

    fireEvent.error(still);

    // Gone rather than showing the browser's broken-image frame across the
    // whole stage, which is what a truncated or mislabelled picture drew.
    expect(
      container.querySelector('.karaoke-stage-media__still'),
    ).not.toBeInTheDocument();
    // And silently: artwork is scenery at 0.32 opacity behind the words, so
    // the stage now looks exactly like an audio-only song's. A caption over a
    // stage that looks correct is noise the video notice is not.
    expect(
      container.querySelector('.karaoke-stage-media__unsupported'),
    ).not.toBeInTheDocument();
  });

  it('says a supported container failed to decode rather than falling back mutely', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Modern.mp3', { type: 'audio/mpeg' }),
            new File(['video'], 'Modern.mp4', { type: 'video/mp4' }),
          ],
        },
      },
    );

    expect(
      await screen.findByRole('heading', { name: 'Modern' }),
    ).toBeVisible();
    // The extension says playable, so nothing is said until the decoder
    // disagrees — an HEVC or AC-3 MP4 gets this far and then errors.
    expect(
      container.querySelector('.karaoke-stage-media__unsupported'),
    ).not.toBeInTheDocument();

    fireEvent.error(container.querySelector('video') as HTMLVideoElement);

    expect(
      container.querySelector('.karaoke-stage-media__unsupported'),
    ).toHaveTextContent('MP4 video could not be decoded here');
  });

  it('imports a whole folder as a paired, selectable playlist', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const folderInput = container.querySelectorAll(
      'input[type="file"]',
    )[1] as HTMLInputElement;
    const firstAudio = setKaraokeRelativePath(
      new File(['audio'], 'Artist - First.mp3', { type: 'audio/mpeg' }),
      'Album/Artist - First.mp3',
    );
    const firstLyrics = setKaraokeRelativePath(
      new File(
        [
          '#TITLE:Folder First\n#ARTIST:Folder Artist\n#BPM:120\n#GAP:0\n: 0 4 0 Hello\nE',
        ],
        'Artist - First.txt',
        { type: 'text/plain' },
      ),
      'Album/Artist - First.txt',
    );
    const secondAudio = setKaraokeRelativePath(
      new File(['audio'], 'Artist - Second.mp3', { type: 'audio/mpeg' }),
      'Album/Artist - Second.mp3',
    );
    const license = setKaraokeRelativePath(
      new File(['license'], 'License.txt'),
      'Album/License.txt',
    );

    fireEvent.change(folderInput, {
      target: {
        files: [secondAudio, license, firstLyrics, firstAudio],
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Folder First' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Playlist' })).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.queryByText('License')).not.toBeInTheDocument();
    const groupFolders = screen.getByRole('button', {
      name: 'Group by folder',
    });
    expect(groupFolders).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Album')).not.toBeInTheDocument();
    fireEvent.click(groupFolders);
    expect(groupFolders).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Album')).toBeVisible();
    expect(
      window.localStorage.getItem('fluideq-karaoke-playlist-group-by-folder'),
    ).toBe('true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Artist Second' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Artist Second' }),
    ).toBeVisible();
    expect(createObjectURL).toHaveBeenLastCalledWith(secondAudio);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Artist First' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Folder First' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue(
      'Folder First',
    );
    const audio = container.querySelector('audio') as HTMLAudioElement;
    fireEvent.playing(audio);
    fireEvent.ended(audio);
    expect(
      await screen.findByRole('heading', { name: 'Artist Second' }),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue(
      'Artist Second',
    );
    expect(play).not.toHaveBeenCalled();
    await finishCountIn(container);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('attaches a separately dropped lyric file to an existing audio item', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const audio = new File(['audio'], 'Late Lyrics.mp3', {
      type: 'audio/mpeg',
    });
    fireEvent.change(fileInput, { target: { files: [audio] } });
    expect(await screen.findByText('Audio only')).toBeVisible();

    const lyrics = new File(
      [
        '#TITLE:Lyrics Attached\n#ARTIST:Drop Test\n#BPM:120\n#GAP:0\n: 0 4 0 Ready\nE',
      ],
      'Late Lyrics.txt',
      { type: 'text/plain' },
    );
    const workspace = container.querySelector(
      '.karaoke-workspace',
    ) as HTMLElement;
    fireEvent.drop(workspace, {
      dataTransfer: {
        types: ['Files'],
        items: [],
        files: [lyrics],
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Lyrics Attached' }),
    ).toBeVisible();
    expect(screen.getByText('UltraStar · syllables + pitch')).toBeVisible();
    expect(screen.getByText('ultrastar')).toBeVisible();
  });

  it('keeps song playback alive when another FluidEQ tab hides Karaoke', async () => {
    const { container, rerender } = render(
      <KaraokeWorkspace isHidden={false} />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['audio'], 'persistent.wav', { type: 'audio/wav' })],
      },
    });
    expect(await screen.findByText('Audio only')).toBeVisible();
    const audio = container.querySelector('audio') as HTMLAudioElement;
    fireEvent.playing(audio);
    const pausesBeforeTabChange = pause.mock.calls.length;
    const transportBeforeTabChange =
      barSlot?.querySelector('.karaoke-transport');

    rerender(<KaraokeWorkspace isHidden />);

    expect(pause).toHaveBeenCalledTimes(pausesBeforeTabChange);
    expect(audio).toHaveAttribute('src', 'blob:karaoke-song');
    expect(barSlot?.querySelector('.karaoke-transport')).toBe(
      transportBeforeTabChange,
    );
    expect(
      screen.getByRole('button', { name: 'Jump to song start' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Jump to song end' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeVisible();
    audio.currentTime = 4;
    const pausesBeforeStop = pause.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(pause).toHaveBeenCalledTimes(pausesBeforeStop + 1);
    expect(audio.currentTime).toBe(0);
  });

  it('releases the hidden stage DOM when another tab opens', async () => {
    const { container } = render(<KaraokeWorkspace isHidden />);
    await act(async () => Promise.resolve());
    const workspace = container.querySelector('.karaoke-workspace');

    expect(workspace).not.toBeInTheDocument();
    expect(container.querySelector('.karaoke-audio-host')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'A stage built around your music',
      }),
    ).not.toBeInTheDocument();
  });
});
