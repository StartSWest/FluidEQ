/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

/**
 * Turning a problem into something somebody else can act on.
 *
 * Two jobs, and the first one is the one that matters: **nothing personal
 * leaves this machine**. A bug report is written by somebody who is already
 * annoyed and is about to paste it into a public issue tracker, so it has to be
 * safe by construction rather than safe if they read it carefully first.
 *
 * Kept free of Electron and of the DOM so the redaction can be tested properly.
 * A privacy guarantee that is only exercised by clicking through a dialog is
 * not a guarantee.
 */

import { ISSUES_URL, PRODUCT_NAME } from './branding';

/**
 * Where reports are meant to go.
 *
 * Re-exported rather than moved: the address is part of the project's identity
 * and belongs in `branding`, but this is the module every caller already
 * imports it from, and a redirect is cheaper than touching all of them.
 */
export { ISSUES_URL };

/**
 * How much log to carry.
 *
 * The tail, because a fault is at the end of the file — the beginning is
 * whatever the app did when it started three days ago. Enough lines to include
 * what led up to it, few enough that a person can actually read what they are
 * about to publish.
 */
export const LOG_TAIL_LINES = 120;

/**
 * GitHub's issue URL carries the body as a query parameter, and a URL that
 * long is refused by the browser or truncated by the server. Past this the
 * report is put on the clipboard and the issue opens empty with instructions
 * to paste, which is worse but honest — silently sending half a log is not.
 */
export const MAX_URL_BODY = 6000;

/**
 * Everything that has to come out, in the order it has to come out in.
 *
 * Order matters: the home directory is replaced before the bare account name,
 * because the account name occurs INSIDE the home directory and replacing it
 * first would leave `C:\Users\<user>` behind in a form the path rule no longer
 * recognises.
 */
const alwaysRedact = (text: string): string =>
  text
    // Windows user profile in any of the shapes a path can take, including the
    // doubled backslashes that survive a JSON-encoded log line.
    .replace(/[A-Za-z]:\\+Users\\+[^\\/\s"'<>|]+/gi, 'C:\\Users\\<user>')
    .replace(/\/Users\/[^\\/\s"'<>|]+/g, '/Users/<user>')
    // UNC shares carry a machine name and often a person's name with it.
    .replace(/\\\\[^\\/\s"'<>|]+\\+[^\\/\s"'<>|]+/g, '\\\\<host>\\<share>')
    // Anything shaped like an address, wherever it turns up.
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    // Product keys and licence-shaped strings, which nobody should be pasting
    // anywhere and which occasionally end up in logs.
    .replace(/\b([A-Z0-9]{5}-){4}[A-Z0-9]{5}\b/g, '<redacted>');

/**
 * Remove this machine's own account name wherever it appears.
 *
 * Separate from the rules above because it needs to be told what the name is.
 * A username is not a recognisable shape — it is an ordinary word — so it can
 * only be found by looking for the one this computer actually uses, and it
 * turns up in places no path rule would catch: a preset called after its owner,
 * a device named "Ivan's headphones", an error quoting a bare directory name.
 */
export const redact = (text: string, userName?: string): string => {
  const cleaned = alwaysRedact(text);
  if (!userName || userName.length < 3) {
    // Below three characters the risk runs the other way: replacing every "a"
    // in the log would destroy it and protect nobody.
    return cleaned;
  }
  const escaped = userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return cleaned.replace(new RegExp(escaped, 'gi'), '<user>');
};

/** The tail of a log, redacted. */
export const takeLogTail = (
  contents: string,
  userName?: string,
  lines = LOG_TAIL_LINES,
): string => {
  const all = contents.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return redact(all.slice(-lines).join('\n'), userName);
};

/**
 * What the main process collects, before the user's own words are added.
 *
 * Lives here rather than beside the code that gathers it, because the renderer
 * needs the shape too and must never import from main.
 */
export interface IGatheredFacts {
  appVersion: string;
  platform: string;
  arch: string;
  electron: string;
  isEqualizerApoInstalled: boolean;
  /** Already tailed and redacted, in main, before crossing the bridge. */
  appLog: string;
  installLog: string;
}

export interface IBugReportFacts extends IGatheredFacts {
  /** The user's own words. */
  description: string;
}

/**
 * The report itself, as markdown, because it is going into a GitHub issue.
 *
 * Everything is passed in rather than read here: this file must stay pure so
 * the redaction can be proven by tests, and reaching for `os` or `fs` would end
 * that.
 */
export const buildBugReport = (facts: IBugReportFacts): string => {
  const {
    appVersion,
    platform,
    arch,
    electron,
    isEqualizerApoInstalled,
    description,
    appLog,
    installLog,
  } = facts;

  const sections = [
    '### What happened',
    '',
    description.trim() || '_(no description given)_',
    '',
    '### Setup',
    '',
    `| | |`,
    `| --- | --- |`,
    `| ${PRODUCT_NAME} | ${appVersion} |`,
    `| Windows | ${platform} ${arch} |`,
    `| Electron | ${electron} |`,
    `| Equalizer APO | ${isEqualizerApoInstalled ? 'installed' : 'NOT installed'} |`,
  ];

  if (installLog.trim()) {
    sections.push('', '### Setup log', '', '```', installLog.trim(), '```');
  }
  if (appLog.trim()) {
    sections.push('', '### Application log', '', '```', appLog.trim(), '```');
  }

  return sections.join('\n');
};

/**
 * Where the "open an issue" button goes.
 *
 * Returns the body separately when it will not fit in a URL, so the caller can
 * put it on the clipboard and say so. Truncating it silently would produce
 * reports that look complete and are missing the part that mattered.
 */
export const buildIssueUrl = (
  report: string,
  title = 'Bug report',
): { url: string; needsPaste: boolean } => {
  const base = `${ISSUES_URL}/new?title=${encodeURIComponent(title)}`;
  if (report.length > MAX_URL_BODY) {
    return { url: base, needsPaste: true };
  }
  return {
    url: `${base}&body=${encodeURIComponent(report)}`,
    needsPaste: false,
  };
};

/**
 * Where a private report goes, from the build rather than from this file.
 *
 * It used to be a literal here, which put a personal address in a public
 * repository and inside every binary built from it — including forks, who would
 * have been sending their own bugs to a stranger. It is public by nature, so it
 * belongs with the other public build values rather than in a secret.
 *
 * Empty when unset, and callers must treat that as "no private route". A
 * `mailto:` with no address opens an empty compose window, which looks like the
 * app working and is a report nobody receives.
 */
export const REPORT_EMAIL = process.env.FLUIDEQ_SUPPORT_EMAIL || '';

/**
 * A `mailto:` body has to be far shorter than a URL query string.
 *
 * Windows hands the whole thing to the registered handler as a command line,
 * and the practical ceiling across Outlook, Thunderbird and the various webmail
 * shims is somewhere near two thousand characters — with no error when it is
 * exceeded, just a silently truncated message. So the body carries the
 * description and the setup table, and the logs are left to the clipboard.
 */
export const MAX_MAILTO_BODY = 1500;

/**
 * The private route: the user's own mail client, pre-addressed.
 *
 * `mailto:` cannot attach a file and cannot be relied on to exist — plenty of
 * Windows machines have no desktop mail client at all, and there the link does
 * nothing. So this is never the only option offered, and the caller always puts
 * the full report on the clipboard first: whatever the mail client does with
 * the body, the complete text is one paste away.
 *
 * A relay service would avoid all of this, but it would mean credentials, and
 * credentials in a public repository are credentials somebody else is using by
 * the end of the week.
 */
export const buildMailtoUrl = (
  report: string,
  version = '',
): { url: string; isTruncated: boolean } => {
  const subject = `${PRODUCT_NAME} bug report${version ? ` (${version})` : ''}`;
  const isTruncated = report.length > MAX_MAILTO_BODY;
  const body = isTruncated
    ? `${report.slice(0, MAX_MAILTO_BODY)}\n\n[...] The full report is on your clipboard — paste it here.`
    : report;
  return {
    url: `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`,
    isTruncated,
  };
};
