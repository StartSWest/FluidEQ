/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { app, BrowserWindow, clipboard, shell } from 'electron';
import log from 'electron-log';
import { PRODUCT_NAME } from '../common/branding';
import {
  buildBugReport,
  buildIssueUrl,
  buildMailtoUrl,
  REPORT_EMAIL,
} from '../common/bugReport';
import {
  LocaleCode,
  loadLocale,
  resolveLocale,
  translate,
  TranslationKey,
} from '../common/i18n';
import { appVersion } from './appVersion';
import gatherBugReportFacts from './bugReportFacts';
import { writeBugReportMark } from './bugReportMark';
import openExternalIfSafe, { openSupportEmail } from './safeExternal';
import {
  appRelaunchArguments,
  clearStartFailures,
  readStartFailures,
} from './startFailures';

/**
 * THE WINDOW A START THAT KEEPS FAILING ENDS ON (Ivan, 2026-11-14: "if the
 * app cannot restart, perhaps show a report-send modal so the user can send
 * us the log, but only if the main cannot restart").
 *
 * This process was relaunched for it alone (`startFailures.ts`) and starts
 * nothing of the app: one small window, written here as one page, because
 * the renderer bundle is the very thing that may not be able to run. Its
 * buttons are links to `fluideq-start:<action>`, refused as navigations and
 * answered here, so the page needs no preload and no Node.
 *
 * Send report is the bug report's own flow (`common/bugReport.ts`): the
 * report gathered with every log since the last delivered one, redacted,
 * put on the clipboard whole, then the private mail route where the build
 * has one, else a GitHub issue with as much as fits. Delivered, it moves the
 * mark as the dialog's own delivery does.
 */
const ACTION_SCHEME = 'fluideq-start:';

export type TStartReportAction = 'send' | 'logs' | 'retry' | 'quit';

const ACTIONS: readonly TStartReportAction[] = [
  'send',
  'logs',
  'retry',
  'quit',
];

/** The action a link stands for, or nothing for any other address. */
export const startReportAction = (
  url: string,
): TStartReportAction | undefined => {
  if (!url.startsWith(ACTION_SCHEME)) {
    return undefined;
  }
  const action = url.slice(ACTION_SCHEME.length).replace(/^\/+/, '');
  return ACTIONS.find((known) => known === action);
};

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

type TStartKey = Extract<TranslationKey, `startFailure.${string}`>;

/**
 * The page, whole. The app's own floor, accent and type, written out because
 * no stylesheet of the app is loaded here: the default theme's base surface,
 * its cyan, its text colours, the system font stack the app uses.
 */
export const startReportPage = (
  t: (key: TStartKey) => string,
  cause: string,
): string => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(PRODUCT_NAME)}</title>
<style>
:root{color-scheme:dark}
html,body{margin:0;height:100%;background:#0a1722;color:#e7f3fb;
font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Ubuntu,Cantarell,"Noto Sans","DejaVu Sans",sans-serif;
-webkit-user-select:none;user-select:none}
body{display:flex;flex-direction:column}
main{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:26px 28px 8px}
.mark,h1,p,.cause{flex-shrink:0}
.mark{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;
background:rgba(255,107,107,.14);color:#ff8a8a;font-weight:700;font-size:20px}
h1{margin:0;font-size:18px;font-weight:700}
p{margin:0;color:#a9c0d0}
.cause{box-sizing:border-box;max-height:96px;overflow:auto;padding:10px 12px;border-radius:8px;
background:#071019;border:1px solid rgba(255,255,255,.08);color:#cfe1ee;
font:12px/1.4 ui-monospace,"Cascadia Mono",Consolas,"Ubuntu Mono","Noto Sans Mono","DejaVu Sans Mono",monospace;
-webkit-user-select:text;user-select:text;word-break:break-word}
.note{min-height:20px;color:#6fe3ee;font-size:13px}
nav{flex-shrink:0;display:flex;flex-direction:row-reverse;flex-wrap:wrap-reverse;gap:8px;padding:12px 28px 22px}
a{display:inline-flex;align-items:center;min-height:32px;padding:0 14px;border-radius:8px;
text-decoration:none;font-weight:600;color:#e7f3fb;border:1px solid rgba(255,255,255,.18)}
a:hover{border-color:rgba(255,255,255,.34)}
a:focus-visible{outline:2px solid #32e1eb;outline-offset:2px}
a.primary{background:#32e1eb;border-color:#32e1eb;color:#04121a}
a.primary:hover{background:#5ae8f0}
</style></head><body><main>
<div class="mark" aria-hidden="true">!</div>
<h1>${escapeHtml(t('startFailure.title'))}</h1>
<p>${escapeHtml(t('startFailure.lead'))}</p>
<div class="cause" aria-label="${escapeHtml(t('startFailure.cause'))}">${escapeHtml(cause || t('startFailure.unknown'))}</div>
<p class="note" id="note" role="status"></p>
</main>
<nav>
<a class="primary" href="${ACTION_SCHEME}send">${escapeHtml(t('startFailure.send'))}</a>
<a href="${ACTION_SCHEME}retry">${escapeHtml(t('startFailure.retry'))}</a>
<a href="${ACTION_SCHEME}logs">${escapeHtml(t('startFailure.logs'))}</a>
<a href="${ACTION_SCHEME}quit">${escapeHtml(t('startFailure.quit'))}</a>
</nav></body></html>`;

/** The user's language as Windows states it: the window never ran to say. */
const startLocale = async (): Promise<LocaleCode> => {
  const locale = resolveLocale(app.getLocale());
  await loadLocale(locale).catch(() => undefined);
  return locale;
};

/** Everything since the last delivered report, on the clipboard and sent. */
const sendReport = async (cause: string, userDataDir: string) => {
  const facts = await gatherBugReportFacts(null, userDataDir);
  const report = buildBugReport({
    ...facts,
    description: `${PRODUCT_NAME} could not start: ${cause}`,
  });
  clipboard.writeText(report);
  const opened = REPORT_EMAIL
    ? await openSupportEmail(buildMailtoUrl(report, appVersion()).url)
    : false;
  if (!opened) {
    openExternalIfSafe(
      buildIssueUrl(report, `${PRODUCT_NAME} could not start`).url,
    );
  }
  await writeBugReportMark(userDataDir, facts.gatheredAt);
};

export const showStartFailureReport = async (userDataDir: string) => {
  const { cause = '' } = readStartFailures(userDataDir);
  const locale = await startLocale();
  const t = (key: TStartKey) => translate(locale, key);
  log.warn(`Start failure report shown: ${cause}`);
  const window = new BrowserWindow({
    width: 560,
    height: 400,
    minWidth: 440,
    minHeight: 400,
    show: false,
    title: PRODUCT_NAME,
    backgroundColor: '#0a1722',
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: false,
    },
  });
  window.once('ready-to-show', () => window.show());
  const note = (text: string) => {
    // A status line, rewritten as a page: the page runs no script of its own.
    window
      .loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          startReportPage(t, cause).replace(
            '<p class="note" id="note" role="status"></p>',
            `<p class="note" id="note" role="status">${escapeHtml(text)}</p>`,
          ),
        )}`,
      )
      .catch((error) =>
        log.warn('The start report could not be redrawn', error),
      );
  };
  const act = (action: TStartReportAction) => {
    if (action === 'send') {
      sendReport(cause, userDataDir)
        .then(() => note(t('startFailure.sent')))
        .catch((error) => {
          log.error('The start failure report could not be sent', error);
          note(t('startFailure.sendFailed'));
        });
    } else if (action === 'logs') {
      shell
        .openPath(path.dirname(log.transports.file.getFile().path))
        .catch((error) =>
          log.warn('The log folder could not be opened', error),
        );
    } else if (action === 'retry') {
      clearStartFailures(userDataDir);
      app.relaunch({ args: appRelaunchArguments(process.argv) });
      app.exit(0);
    } else {
      app.quit();
    }
  };
  window.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    const action = startReportAction(url);
    if (action) {
      act(action);
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  await window.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(startReportPage(t, cause))}`,
  );
};
