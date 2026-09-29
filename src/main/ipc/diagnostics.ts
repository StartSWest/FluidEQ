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

import log from 'electron-log';
import os from 'os';
import type { TAudioEngine } from '../../common/audioEngine';
import { redact } from '../../common/bugReport';
import ChannelEnum from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import gatherBugReportFacts from '../bugReportFacts';
import { writeBugReportMark } from '../bugReportMark';
import { recordFailure } from '../crashRecovery';
import { openSupportEmail } from '../safeExternal';
import type { TReplySink } from '../updatePath';
import onWindowMessage from './windowMessages';

export interface IDiagnosticsIpcDeps {
  userDataDir: string;
  getEngine: () => TAudioEngine | null;
  handleError: (
    event: TReplySink,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    detail?: string,
  ) => void;
}

/**
 * Everything the window has to say, redacted on the way in.
 *
 * Redacted here rather than in the renderer so it is one rule in one place,
 * applied to every line that reaches the file. A stack trace is nothing but
 * paths, and in a packaged build those paths run through the user's profile
 * directory — which carries their account name, and would end up in every bug
 * report emailed to a stranger. `redact` is the same function the report
 * itself uses; the log has to be clean before it is written, not when it is
 * read, because the file is on disk either way.
 */
const REDACT_AS = os.userInfo().username;

/** The bug report, and the window's own lines on their way to the log. */
const registerDiagnosticsIpc = ({
  userDataDir,
  getEngine,
  handleError,
}: IDiagnosticsIpcDeps) => {
  // The report went out: its gather moment is where the next one's logs start.
  // Written only on delivery — a dialog closed without copying, mailing or
  // opening an issue must not move it, or the lines it showed would be in no
  // report at all. Nothing waits on this.
  onWindowMessage(ChannelEnum.BUG_REPORT_DELIVERED, (_event, args) => {
    const gatheredAt = Array.isArray(args) ? args[0] : undefined;
    if (typeof gatheredAt !== 'string') {
      log.warn('A bug report delivery carried no gather time');
      return;
    }
    writeBugReportMark(userDataDir, gatheredAt).catch((error) =>
      log.warn('The bug report mark could not be written', error),
    );
  });

  onWindowMessage(ChannelEnum.GATHER_BUG_REPORT, async (event) => {
    const channel = ChannelEnum.GATHER_BUG_REPORT;
    try {
      const facts = await gatherBugReportFacts(getEngine(), userDataDir);
      event.reply(channel, { result: facts });
    } catch (e) {
      log.error('Could not gather a bug report', e);
      handleError(event, channel, ErrorCode.FAILURE, (e as Error).message);
    }
  });

  // Always answered, refused or not: the dialog waits on this with no
  // deadline, because a mail app can take a while to start and that is not a
  // failure.
  onWindowMessage(ChannelEnum.OPEN_SUPPORT_EMAIL, async (event, args) => {
    const [url] = Array.isArray(args) ? args : [];
    const opened = typeof url === 'string' && (await openSupportEmail(url));
    event.reply(ChannelEnum.OPEN_SUPPORT_EMAIL, { result: opened });
  });

  onWindowMessage(ChannelEnum.LOG_ERROR, (_event, args) => {
    const [context, detail] = (args as string[]) ?? [];
    const safeContext = `[renderer] ${redact(String(context ?? ''), REDACT_AS)}`;
    const safeDetail = redact(String(detail ?? ''), REDACT_AS);
    log.error(safeContext, safeDetail);
    // Also into the journal the debug recovery dialog prints: the React error
    // that took the window down is the entry a developer is looking for.
    recordFailure(safeContext, safeDetail);
  });

  onWindowMessage(ChannelEnum.LOG_INFO, (_event, args) => {
    const [message] = (args as string[]) ?? [];
    log.info(`[renderer] ${redact(String(message ?? ''), REDACT_AS)}`);
  });
};

export default registerDiagnosticsIpc;
