/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The pages themselves are not what is under test, only which of them is
// fetched when: each is a stub, so loading one costs nothing. Written out in
// each call because the calls are hoisted above anything declared here.
jest.mock('../../../renderer/EqPresetsPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/ConvolutionPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/games/GamesPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/components/ConfigInspector', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/dsp/DspPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/remoteAudio/RemoteAudioPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/community/CommunityPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/forum/ForumPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/video/VideoBrowser', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/library/LibraryWorkspace', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/karaoke/KaraokeWorkspace', () => ({
  __esModule: true,
  default: () => null,
}));

type TPages = typeof import('../../../renderer/workspacePages');

/** A fresh copy of the module, so each test starts with nothing fetched. */
const freshPages = (): TPages => {
  let pages: TPages | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require -- a fresh instance per test
    pages = require('../../../renderer/workspacePages');
  });
  if (!pages) {
    throw new Error('workspacePages did not load');
  }
  return pages;
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('which pages the window fetches before its first frame', () => {
  it('fetches the page it opens on and the player it restores, and no other', async () => {
    window.localStorage.setItem('fluideq.workspaceTab', 'forum');
    window.localStorage.setItem('fluideq.transport.lastOwner', 'karaoke');
    const pages = freshPages();
    expect(pages.isTabReady('forum')).toBe(false);

    await pages.preloadLaunchPages();

    expect(pages.isTabReady('forum')).toBe(true);
    expect(pages.isTabReady('karaoke')).toBe(true);
    // Neither the tab nor the owner: still waiting for its first opening.
    expect(pages.isTabReady('library')).toBe(false);
    expect(pages.isTabReady('dsp')).toBe(false);
  });

  it('has nothing to fetch for the equaliser, which is in the main bundle', async () => {
    const pages = freshPages();
    expect(pages.isTabReady('eq')).toBe(true);
    await pages.preloadLaunchPages();
    expect(pages.isTabReady('presets')).toBe(false);
  });

  it('fetches a tab on its approach, the way a hover or focus does', async () => {
    const pages = freshPages();
    expect(pages.isTabReady('presets')).toBe(false);
    await pages.preloadTab('presets');
    expect(pages.isTabReady('presets')).toBe(true);
    expect(pages.isTabReady('convolution')).toBe(false);
  });
});
