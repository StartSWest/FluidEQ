/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ComponentProps } from 'react';
import type { TPlaybackOwner } from './audio/playbackOwner';
import { readRememberedTransportOwner } from './audio/transportSource';
import lazyPage, { type ILazyPage } from './utils/lazyPage';
import { readWorkspaceTab, type TWorkspaceTab } from './workspaceTabs';
// Types only, erased from the bundle: a value import of any of these would
// pull the page back into the main chunk. Named for the pages that take props,
// whose inferred types would otherwise name interfaces their files keep
// private (`declaration` in tsconfig refuses that).
import type DspPanel from './dsp/DspPanel';
import type CommunityPanel from './community/CommunityPanel';
import type VideoBrowser from './video/VideoBrowser';
import type LibraryWorkspace from './library/LibraryWorkspace';
import type KaraokeWorkspace from './karaoke/KaraokeWorkspace';

/**
 * Every page but the equaliser's, each in a chunk of its own.
 *
 * The window used to compile all of them before its first frame, whichever
 * page it opened on. The EQ page stays in the main bundle: it is where the app
 * opens unless it was left elsewhere, and the pages below are what it no
 * longer waits for.
 *
 * Only the code moves. Every stylesheet stays in the one sheet the window
 * loads at the start, in the order it always had (`styles/cascade.ts`), so a
 * page arriving later cannot change how anything already on screen is drawn.
 */
export const PresetsPage = lazyPage(
  () => import(/* webpackChunkName: "page-presets" */ './EqPresetsPanel'),
);
export const ConvolutionPage = lazyPage(
  () => import(/* webpackChunkName: "page-convolution" */ './ConvolutionPanel'),
);
export const GamesPage = lazyPage(
  () => import(/* webpackChunkName: "page-games" */ './games/GamesPanel'),
);
export const ConfigPage = lazyPage(
  () =>
    import(
      /* webpackChunkName: "page-config" */ './components/ConfigInspector'
    ),
);
export const DspPanelPage: ILazyPage<ComponentProps<typeof DspPanel>> =
  lazyPage(() => import(/* webpackChunkName: "page-dsp" */ './dsp/DspPanel'));
export const SharePage = lazyPage(
  () =>
    import(
      /* webpackChunkName: "page-share" */ './remoteAudio/RemoteAudioPanel'
    ),
);
export const PlusPage: ILazyPage<ComponentProps<typeof CommunityPanel>> =
  lazyPage(
    () =>
      import(/* webpackChunkName: "page-plus" */ './community/CommunityPanel'),
  );
export const ForumPage = lazyPage(
  () => import(/* webpackChunkName: "page-forum" */ './forum/ForumPanel'),
);
export const MediaPage: ILazyPage<ComponentProps<typeof VideoBrowser>> =
  lazyPage(
    () => import(/* webpackChunkName: "page-media" */ './video/VideoBrowser'),
  );
export const LibraryPage: ILazyPage<ComponentProps<typeof LibraryWorkspace>> =
  lazyPage(
    () =>
      import(
        /* webpackChunkName: "page-library" */ './library/LibraryWorkspace'
      ),
  );
export const KaraokePage: ILazyPage<ComponentProps<typeof KaraokeWorkspace>> =
  lazyPage(
    () =>
      import(
        /* webpackChunkName: "page-karaoke" */ './karaoke/KaraokeWorkspace'
      ),
  );

interface IPreloadable {
  preload: () => Promise<void>;
  isLoaded: () => boolean;
}

/** What each tab draws that is not in the main bundle. The EQ has nothing. */
const PAGE_OF_TAB: Partial<Record<TWorkspaceTab, IPreloadable>> = {
  presets: PresetsPage,
  convolution: ConvolutionPage,
  games: GamesPage,
  config: ConfigPage,
  dsp: DspPanelPage,
  share: SharePage,
  community: PlusPage,
  forum: ForumPage,
  video: MediaPage,
  library: LibraryPage,
  karaoke: KaraokePage,
};

/** The player a remembered transport restores, which mounts at launch. */
const PAGE_OF_OWNER: Partial<Record<TPlaybackOwner, IPreloadable>> = {
  media: MediaPage,
  library: LibraryPage,
  karaoke: KaraokePage,
};

/** Whether showing `tab` now would draw it at once. */
export const isTabReady = (tab: TWorkspaceTab): boolean =>
  PAGE_OF_TAB[tab]?.isLoaded() ?? true;

/** Fetches what `tab` draws; for a hover, a focus, or the press itself. */
export const preloadTab = (tab: TWorkspaceTab): Promise<void> =>
  PAGE_OF_TAB[tab]?.preload() ?? Promise.resolve();

/**
 * What the first frame needs: the page the window was left on, and the
 * player whose transport it restores (`restoredOwner` in `App.tsx`), which
 * mounts hidden at launch and has to describe itself to the bar at once or
 * the bar opens on "Nothing playing" and changes under the pointer.
 */
export const preloadLaunchPages = (): Promise<void> => {
  const owner = readRememberedTransportOwner();
  const ownerPage = owner === undefined ? undefined : PAGE_OF_OWNER[owner];
  return Promise.all([
    preloadTab(readWorkspaceTab()),
    ownerPage?.preload(),
  ]).then(() => undefined);
};
