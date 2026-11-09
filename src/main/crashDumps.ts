/* FluidEQ — GPL-3.0-or-later */
import { app, crashReporter } from 'electron';

/**
 * A minidump of every FluidEQ process that crashes, kept on this computer and
 * sent nowhere.
 *
 * A native crash of the window's process leaves only Chromium's exit code
 * behind. On 2026-11-08 the development window's process died nine times on
 * 0xC0000005 (an access violation) and once on 0xC0000409 (a fail-fast), and
 * neither the app's log nor Windows' event log said where: Chromium's
 * sandboxed processes never reach Windows Error Reporting, and Electron runs
 * no crash handler of its own unless it is started. With Crashpad running,
 * each crash writes a minidump that names the faulting module and its stack,
 * which is the only evidence such a crash can leave.
 *
 * Nothing is uploaded: there is no submit address and `uploadToServer` is
 * false. Crashpad prunes its own folder (past 128 MB, or a year).
 *
 * Started at module scope, before the app is ready, because a process
 * launched before the handler exists is a process whose crash goes
 * unrecorded — the GPU process and the window's renderer included.
 */
export const startCrashDumps = () => {
  crashReporter.start({ uploadToServer: false });
};

/**
 * Where the dumps land, for the log line that reports a crash: a crash with
 * its dump folder beside it can be read; one without is an exit code.
 */
export const crashDumpFolder = () => app.getPath('crashDumps');
