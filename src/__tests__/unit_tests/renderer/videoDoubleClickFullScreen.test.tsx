/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a double-click on an Online Media video does, with and without a Plus
 * visualizer on the graph.
 *
 * Without one it is the graph's full screen, as Ctrl+F is (the whole app's
 * test holds that path end to end). With one, it is the video's OWN full
 * screen, in and out: the graph's would put the visualizer over the video,
 * and in the video's own the page stands over the visualizer instead
 * (`VideoSceneBackdrop`). Only the choice is tested here, on the component
 * that makes it; everything drawn around it is a stand-in.
 */

import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import WorkspacePlayers, {
  type IWorkspacePlayersProps,
} from '../../../renderer/shell/WorkspacePlayers';
import { toggleGraphFullScreen } from '../../../renderer/utils/graphStyle';

type TMediaPageProps = { onRequestGraphFullScreen: () => void };

let mediaPage: TMediaPageProps | undefined;

jest.mock('../../../renderer/workspacePages', () => ({
  MediaPage: {
    Page: (props: TMediaPageProps) => {
      mediaPage = props;
      return null;
    },
  },
  LibraryPage: { Page: () => null },
  KaraokePage: { Page: () => null },
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  exitGraphFullScreen: jest.fn(),
  toggleFullScreenTopBar: jest.fn(),
  toggleGraphFullScreen: jest.fn(),
}));
jest.mock('../../../renderer/audio/TaskbarTransport', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/library/LibraryStageArt', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/library/SystemStageArt', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/library/LibraryContext', () => ({
  LibraryProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../../renderer/library/PlaylistContext', () => ({
  PlaylistProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../../renderer/library/player/LibraryPlayerContext', () => ({
  LibraryPlayerProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../../renderer/shell/TransportBars', () => ({
  ConnectedNowPlayingBar: () => null,
  IdleTransportBarSlot: () => null,
  TAB_TRANSPORT: {},
  TabTransportBar: () => null,
}));

/** The Online Media page open, with a Plus visualizer on the graph or not. */
const openPlayers = ({
  isSceneOnGraph,
  isVideoFullScreen,
}: {
  isSceneOnGraph: boolean;
  isVideoFullScreen: boolean;
}) => {
  const applyMediaFullScreen = jest.fn();
  const releaseMediaSurface = jest.fn();
  const setActiveTabGraphVisibility = jest.fn();
  const mounts = {
    hasOpenedVideo: true,
    keepVideoMounted: true,
    showsMediaGraphBackdrop: false,
    isSceneOnGraph,
  } as unknown as IWorkspacePlayersProps['mounts'];
  const fullScreen = {
    mediaFullScreenOwner: isVideoFullScreen ? 'video' : undefined,
    isMediaFullScreen: isVideoFullScreen,
    isAppFullScreen: isVideoFullScreen,
    isChromeIdle: false,
    isPointerNearChrome: true,
    hasFullScreenTopBar: false,
    applyMediaFullScreen,
    releaseMediaSurface,
  } as unknown as IWorkspacePlayersProps['fullScreen'];
  render(
    <WorkspacePlayers
      activeTab="video"
      isAmp={false}
      isGraphBackdropMode={false}
      mounts={mounts}
      fullScreen={fullScreen}
      isKaraokeSurfaceFullScreen={false}
      isKaraokeGraphFullScreen={false}
      onGoToTab={jest.fn()}
      setActiveTabGraphVisibility={setActiveTabGraphVisibility}
    />,
  );
  const doubleClick = () => {
    if (!mediaPage) {
      throw new Error('Online Media was not drawn');
    }
    const page = mediaPage;
    act(() => page.onRequestGraphFullScreen());
  };
  return {
    doubleClick,
    applyMediaFullScreen,
    releaseMediaSurface,
    setActiveTabGraphVisibility,
  };
};

beforeEach(() => {
  mediaPage = undefined;
  jest.mocked(toggleGraphFullScreen).mockClear();
});

describe('a double-click on an Online Media video', () => {
  it('takes the video to its own full screen when a Plus visualizer is on the graph', () => {
    const players = openPlayers({
      isSceneOnGraph: true,
      isVideoFullScreen: false,
    });
    players.doubleClick();
    expect(players.applyMediaFullScreen).toHaveBeenCalledTimes(1);
    expect(players.applyMediaFullScreen).toHaveBeenCalledWith('video');
    // Never the graph's full screen, which would cover the video.
    expect(toggleGraphFullScreen).not.toHaveBeenCalled();
    expect(players.setActiveTabGraphVisibility).not.toHaveBeenCalled();
  });

  it('brings the video back out of its own full screen on the next one', () => {
    const players = openPlayers({
      isSceneOnGraph: true,
      isVideoFullScreen: true,
    });
    players.doubleClick();
    expect(players.applyMediaFullScreen).toHaveBeenCalledTimes(1);
    expect(players.applyMediaFullScreen).toHaveBeenCalledWith(undefined);
    expect(toggleGraphFullScreen).not.toHaveBeenCalled();
    expect(players.releaseMediaSurface).not.toHaveBeenCalled();
  });

  it('is the graph’s full screen when no Plus visualizer is on it', () => {
    const players = openPlayers({
      isSceneOnGraph: false,
      isVideoFullScreen: false,
    });
    players.doubleClick();
    expect(players.setActiveTabGraphVisibility).toHaveBeenCalledWith(true);
    expect(toggleGraphFullScreen).toHaveBeenCalledTimes(1);
    expect(players.applyMediaFullScreen).not.toHaveBeenCalled();
  });

  it('hands the window from the video to the graph without leaving full screen first', () => {
    const players = openPlayers({
      isSceneOnGraph: false,
      isVideoFullScreen: true,
    });
    players.doubleClick();
    expect(players.releaseMediaSurface).toHaveBeenCalledTimes(1);
    expect(toggleGraphFullScreen).toHaveBeenCalledTimes(1);
    expect(
      players.releaseMediaSurface.mock.invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(toggleGraphFullScreen).mock.invocationCallOrder[0],
    );
    expect(players.applyMediaFullScreen).not.toHaveBeenCalled();
  });
});
