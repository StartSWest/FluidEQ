/* FluidEQ — GPL-3.0-or-later */
import type { BrowserWindow } from 'electron';
import log from 'electron-log';
import { SOURCE_ANALYSIS_CHANNEL } from '../../common/dsp/sourceAnalysis';
import { ErrorCode } from '../../common/errors';
import type { ISourceAnalysisPublisher } from '../sourceAnalysis';
import onWindowMessage from './windowMessages';

export const registerSourceAnalysisIpc = (
  getWindow: () => BrowserWindow | null,
  publisher: ISourceAnalysisPublisher,
): (() => void) => {
  let owner: BrowserWindow['webContents'] | undefined;
  return onWindowMessage(
    SOURCE_ANALYSIS_CHANNEL,
    async (event, args: unknown) => {
      const window = getWindow();
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !Array.isArray(args)
      ) {
        event.reply(SOURCE_ANALYSIS_CHANNEL, { result: false });
        return;
      }
      if (owner !== event.sender) {
        owner = event.sender;
        const release = () => {
          publisher.release().catch(() => undefined);
        };
        owner.once('destroyed', release);
        owner.on('render-process-gone', release);
        owner.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
          if (mainFrame && !inPlace) {
            release();
          }
        });
      }
      try {
        const [action, update] = args;
        let result = false;
        if (action === 'publish') {
          await publisher.publish(update);
          result = true;
        }
        if (action === 'capable') {
          result = await publisher.capable();
        }
        if (action === 'prepare') {
          result = await publisher.prepare(update);
        }
        if (action === 'fallback') {
          result = await publisher.fallback(update);
        }
        if (action === 'release') {
          await publisher.release();
          result = true;
        }
        event.reply(SOURCE_ANALYSIS_CHANNEL, { result });
      } catch (error) {
        log.warn(
          'Library source preparation failed; keeping the player rack.',
          error,
        );
        event.reply(SOURCE_ANALYSIS_CHANNEL, { errorCode: ErrorCode.FAILURE });
      }
    },
  );
};
