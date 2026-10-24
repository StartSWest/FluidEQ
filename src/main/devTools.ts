/* FluidEQ — GPL-3.0-or-later */
import type { WebContents } from 'electron';

type TInspector = Pick<
  WebContents,
  'openDevTools' | 'closeDevTools' | 'toggleDevTools' | 'isDevToolsOpened'
>;

export const openWindowDevTools = (
  contents: Pick<TInspector, 'openDevTools'>,
) => {
  // Linux switches wait for the page to reach the native window size. A
  // docked inspector permanently removes part of that viewport. Detach mode
  // keeps inspection in its own window and disables docking into the amp.
  if (process.platform === 'linux') {
    contents.openDevTools({ mode: 'detach' });
  } else {
    contents.openDevTools();
  }
};

export const toggleWindowDevTools = (contents: TInspector) => {
  if (process.platform !== 'linux') {
    contents.toggleDevTools();
  } else if (contents.isDevToolsOpened()) {
    contents.closeDevTools();
  } else {
    openWindowDevTools(contents);
  }
};
