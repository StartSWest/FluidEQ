import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ILibraryTrack } from '../../common/library/types';
import type { ITransportSource } from '../../renderer/audio/transportSource';
import { useSongEqRecording } from '../../renderer/audio/songEqSession';
import IdleTransportBar from '../../renderer/library/player/IdleTransportBar';
import NowPlayingBar from '../../renderer/library/player/NowPlayingBar';
import SourceTransportBar from '../../renderer/library/player/SourceTransportBar';
import { I18nProvider } from '../../renderer/utils/I18nContext';

// Automocked so the badge tests can set exactly the recording status they
// need without the real module's timers and module-level state. Every test
// in this file renders a bar that now always mounts `SongEqBadge`, so the
// default below has to stand in for every test that never mentions it, not
// only the ones about the badge itself.
jest.mock('../../renderer/audio/songEqSession');
const mockUseSongEqRecording = useSongEqRecording as jest.Mock;

const track: ILibraryTrack = {
  id: 't1',
  rootId: 'r',
  path: 'C:\\Music\\a.mp3',
  kind: 'audio',
  isPlayable: true,
  title: 'Blue',
  artist: 'Miles',
  durationMs: 92000,
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
};

const bar = (over: Partial<React.ComponentProps<typeof NowPlayingBar>> = {}) =>
  render(
    <I18nProvider>
      <NowPlayingBar
        track={track}
        isPlaying
        positionMs={0}
        durationMs={92000}
        repeat="off"
        isShuffled={false}
        onToggle={jest.fn()}
        onSkip={jest.fn()}
        onStop={jest.fn()}
        onSeek={jest.fn()}
        onShuffle={jest.fn()}
        onRepeat={jest.fn()}
        onVolume={jest.fn()}
        // The whole point of this helper is letting each test override one
        // or two of the props above without repeating the other ten.
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...over}
      />
    </I18nProvider>,
  );

describe('the now playing bar', () => {
  beforeEach(() => {
    // Off, and nothing open — the quiet default every test that is not
    // about the badge gets, so the badge does not show up uninvited in
    // assertions ("names what is playing" etc.) that never mention it.
    mockUseSongEqRecording.mockReturnValue({
      isSaveOn: false,
      listenedMs: 0,
      willSave: false,
    });
  });

  it('names what is playing', () => {
    bar();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Miles')).toBeInTheDocument();
  });

  it('offers pause while playing and play while paused', async () => {
    const onToggle = jest.fn();
    bar({ onToggle });
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onToggle).toHaveBeenCalled();
    bar({ isPlaying: false });
    expect(
      screen.getAllByRole('button', { name: 'Play' }).length,
    ).toBeGreaterThan(0);
  });

  it('skips in both directions', async () => {
    const onSkip = jest.fn();
    bar({ onSkip });
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSkip).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onSkip).toHaveBeenCalledWith(-1);
  });

  it('renders nothing at all when nothing is loaded', () => {
    const { container } = render(
      <I18nProvider>
        <NowPlayingBar
          track={undefined}
          isPlaying={false}
          positionMs={0}
          durationMs={0}
          repeat="off"
          isShuffled={false}
          onToggle={jest.fn()}
          onSkip={jest.fn()}
          onStop={jest.fn()}
          onSeek={jest.fn()}
          onShuffle={jest.fn()}
          onRepeat={jest.fn()}
          onVolume={jest.fn()}
        />
      </I18nProvider>,
    );
    // A permanent empty strip across every tab is a worse tax than the bar is
    // a benefit. It appears with the music and leaves with it.
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a Stop that clears the queue entirely (blocker 1)', async () => {
    // The state-machine bug this guards: a video queue that reaches either
    // end with `repeat: 'off'` has nothing that ever clears `videoTrackId`
    // (see `LibraryWorkspace`'s gating and `advanceQueue`'s hold-at-the-edge
    // behaviour) except this control. A happy-path render assertion would
    // never see that — only a real click on Stop proves the bar exposes a
    // way out at all.
    const onStop = jest.fn();
    bar({ onStop });
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe('the song-eq badge', () => {
  /** A fixture with nothing open to record — the `willSave` and
   * `listenedMs` values do not matter here, and are set anyway so this test
   * cannot be read as passing merely because the fixture happened to look
   * like "off" in every field at once. */
  const recording = (
    over: Partial<{
      isSaveOn: boolean;
      listenedMs: number;
      title?: string;
      willSave: boolean;
    }> = {},
  ) => ({
    isSaveOn: false,
    listenedMs: 30_000,
    title: 'Blue',
    willSave: true,
    ...over,
  });

  /**
   * Fails if `SongEqBadge`'s guard drops the `isSaveOn` half of its check —
   * e.g. gating on `title === undefined` alone — since `title` and
   * `willSave` here are both set exactly as the positive control below sets
   * them; only `isSaveOn` differs between the two tests.
   */
  it('shows no learning badge while the tick is off', () => {
    mockUseSongEqRecording.mockReturnValue(recording({ isSaveOn: false }));
    bar();
    expect(
      screen.queryByLabelText(/smart eq is learning this song/i),
    ).toBeNull();
  });

  /**
   * Positive control for the test above: the same fixture with only
   * `isSaveOn` flipped. Fails if `SongEqBadge` is never rendered from
   * `NowPlayingBar` at all, or if the guard is inverted and hides the badge
   * exactly when it should show.
   */
  it('shows the learning badge while a song is being recorded', () => {
    mockUseSongEqRecording.mockReturnValue(recording({ isSaveOn: true }));
    bar();
    expect(
      screen.getByLabelText(/smart eq is learning this song/i),
    ).toBeVisible();
  });

  /**
   * Fails if `SourceTransportBar` never mounts `SongEqBadge` — the second of
   * the two bars this task adds it to, and the one a duplicated-markup
   * mistake would most likely leave behind.
   */
  it('shows the same badge on the other bar the app draws when a source owns playback', () => {
    mockUseSongEqRecording.mockReturnValue(recording({ isSaveOn: true }));
    const source: ITransportSource = {
      owner: 'karaoke',
      title: 'Warm-up',
      isPlaying: true,
      positionMs: 0,
      durationMs: 0,
      toggle: jest.fn(),
    };
    render(
      <I18nProvider>
        <SourceTransportBar source={source} />
      </I18nProvider>,
    );
    expect(
      screen.getByLabelText(/smart eq is learning this song/i),
    ).toBeVisible();
  });

  /**
   * Fails the moment anyone adds `<SongEqBadge />` to `IdleTransportBar`: the
   * recording status here is the exact positive-control fixture that makes
   * the badge appear on the other two bars, so a badge showing up here too
   * would not be a mock left on its default — it would be this bar drawing
   * one it was specified never to draw.
   */
  it('never shows a badge on the idle bar, even while something elsewhere is recording', () => {
    mockUseSongEqRecording.mockReturnValue(recording({ isSaveOn: true }));
    render(
      <I18nProvider>
        <IdleTransportBar />
      </I18nProvider>,
    );
    expect(
      screen.queryByLabelText(/smart eq is learning this song/i),
    ).toBeNull();
  });
});
