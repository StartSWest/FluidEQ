import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ILibraryTrack } from '../../common/library/types';
import NowPlayingBar from '../../renderer/library/player/NowPlayingBar';
import { I18nProvider } from '../../renderer/utils/I18nContext';

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
