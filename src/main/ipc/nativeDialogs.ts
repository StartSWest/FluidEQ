/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { BrowserWindow, dialog, ipcMain } from 'electron';
import { PRODUCT_NAME } from '../../common/branding';

/**
 * The two one-line dialogs the renderer needs: tell, and ask.
 *
 * They were `window.alert` and `window.confirm`. Electron does answer those
 * with a native box, but a box with no owner and no title: it floats free of
 * the window, and its title bar reads the page origin. Owned by the window
 * and titled with the product, through the same API the file pickers use.
 */
const registerNativeDialogsIpc = () => {
  ipcMain.handle('native-message', async (event, message: string) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = { type: 'info' as const, title: PRODUCT_NAME, message };
    await (owner
      ? dialog.showMessageBox(owner, options)
      : dialog.showMessageBox(options));
  });

  ipcMain.handle(
    'native-confirm',
    async (event, message: string, ok: string, cancel: string) => {
      // The button labels come from the renderer, in the language the window
      // that asks is showing.
      const owner = BrowserWindow.fromWebContents(event.sender);
      const options = {
        type: 'question' as const,
        title: PRODUCT_NAME,
        message,
        buttons: [ok, cancel],
        defaultId: 0,
        cancelId: 1,
      };
      const { response } = await (owner
        ? dialog.showMessageBox(owner, options)
        : dialog.showMessageBox(options));
      return response === 0;
    },
  );
};

export default registerNativeDialogsIpc;
