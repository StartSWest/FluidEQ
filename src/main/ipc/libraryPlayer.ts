/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's way to the core's Library player: its presses, what its own
 * element reports while that is the deck, the rack it hands over, its old
 * copy of the session, and a request for the view again. Every message is
 * checked against the main window's top frame and parsed whole
 * (`common/library/playerWire.ts`) — the window is the half of this app that
 * loads remote pages.
 */
import type { BrowserWindow, IpcMainEvent, WebContents } from 'electron';
import {
  PLAYER_RACK_CHANNEL,
  parsePlayerRackCopy,
} from '../../common/library/playerRack';
import {
  LIBRARY_PLAYER_CHANNEL,
  parseDeckReport,
  parsePlayerCommand,
} from '../../common/library/playerWire';
import { ErrorCode } from '../../common/errors';
import isRequestId from '../../common/ipcRequestId';
import type { ILibraryPlayer } from '../libraryPlayer/libraryPlayerTypes';
import onWindowMessage from './windowMessages';

const registerLibraryPlayerIpc = ({
  getMainWindow,
  player,
}: {
  getMainWindow: () => BrowserWindow | null;
  player: ILibraryPlayer;
}): (() => void) => {
  const fromWindow = (event: IpcMainEvent) => {
    const window = getMainWindow();
    return (
      !!window &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    );
  };
  const first = (arg: unknown): unknown =>
    Array.isArray(arg) ? arg[0] : undefined;
  /**
   * A page that goes — reloaded, crashed, closed — puts its Library player
   * away without running anything to say so. The song plays on in the core
   * either way; only a paused host is let go.
   */
  let watched: WebContents | undefined;
  const watchPage = (page: WebContents) => {
    if (watched === page) {
      return;
    }
    watched = page;
    const away = () => player.away();
    page.once('destroyed', away);
    page.on('render-process-gone', away);
    page.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
      if (mainFrame && !inPlace) {
        away();
      }
    });
  };
  const stops = [
    onWindowMessage(
      LIBRARY_PLAYER_CHANNEL.command,
      (event, arg: unknown, requestId: unknown) => {
        const command = fromWindow(event)
          ? parsePlayerCommand(first(arg))
          : undefined;
        const answer = command ? player.command(command) : undefined;
        // Only an add waits for an answer: how many songs joined. A press is
        // answered by the view the player sends anyway.
        if (!isRequestId(requestId)) {
          return;
        }
        event.reply(
          LIBRARY_PLAYER_CHANNEL.command,
          answer
            ? { result: answer.joined ?? 0 }
            : { errorCode: ErrorCode.FAILURE },
        );
      },
    ),
    onWindowMessage(LIBRARY_PLAYER_CHANNEL.deck, (event, arg: unknown) => {
      const report = fromWindow(event)
        ? parseDeckReport(first(arg))
        : undefined;
      if (report) {
        player.deckReport(report);
      }
    }),
    onWindowMessage(PLAYER_RACK_CHANNEL, (event, arg: unknown) => {
      const copy = fromWindow(event)
        ? parsePlayerRackCopy(first(arg))
        : undefined;
      if (copy) {
        watchPage(event.sender);
        player.rackCopy(copy);
      }
    }),
    onWindowMessage(LIBRARY_PLAYER_CHANNEL.legacy, (event, arg: unknown) => {
      if (fromWindow(event)) {
        player.legacy(first(arg));
      }
    }),
    onWindowMessage(LIBRARY_PLAYER_CHANNEL.away, (event) => {
      if (fromWindow(event)) {
        player.away();
      }
    }),
    onWindowMessage(LIBRARY_PLAYER_CHANNEL.ask, (event) => {
      if (fromWindow(event)) {
        player.ask();
      }
    }),
  ];
  return () => stops.forEach((stop) => stop());
};

export default registerLibraryPlayerIpc;
