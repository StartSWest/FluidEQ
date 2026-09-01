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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IGatheredFacts,
  buildBugReport,
  buildIssueUrl,
  buildMailtoUrl,
  REPORT_EMAIL,
} from 'common/bugReport';
import { PRODUCT_NAME } from 'common/branding';
import { gatherBugReport } from '../utils/equalizerApi';
import DialogHeader from './DialogHeader';
import '../styles/BugReport.scss';

interface IBugReportDialogProps {
  onClose: () => void;
}

/**
 * Report a problem, without giving anything away.
 *
 * The report is shown in full, in an editable box, before it can go anywhere.
 * That is not a nicety — it is the guarantee. Redaction is done in the main
 * process and covered by tests, but no automatic rule can know that a preset is
 * named after somebody's child, so the last check is a person reading it.
 * Nothing here sends anything on its own.
 */
export default function BugReportDialog({ onClose }: IBugReportDialogProps) {
  const [description, setDescription] = useState('');
  const [facts, setFacts] = useState<IGatheredFacts>();
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  // Undefined means the preview is still following the generated report.
  // Once the user edits it, their redactions become the source used by every
  // action below instead of being silently rebuilt away.
  const [reportOverride, setReportOverride] = useState<string>();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    gatherBugReport()
      .then((gathered) => {
        if (alive) {
          setFacts(gathered);
        }
        return gathered;
      })
      .catch(() => {
        // A report without logs is still a report. Losing the diagnostics is
        // far better than refusing to let somebody tell us what went wrong.
        if (alive) {
          setFailed(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const generatedReport = facts
    ? buildBugReport({ ...facts, description })
    : buildBugReport({
        appVersion: '',
        platform: '',
        arch: '',
        electron: '',
        isEqualizerApoInstalled: false,
        description,
        appLog: '',
        installLog: '',
      });
  const report = reportOverride ?? generatedReport;

  const say = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 2600);
  }, []);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(report);
    say('Report copied.');
  }, [report, say]);

  /**
   * The private route, for anyone who would rather not post in public.
   *
   * The full report goes on the clipboard FIRST, every time. A mail client
   * cannot be attached to, truncates a long body without saying so, and on the
   * many Windows machines with no desktop mail client the link does nothing at
   * all — so the clipboard is the part that always works, and the mail window
   * is the convenience on top of it.
   */
  const sendEmail = useCallback(async () => {
    await navigator.clipboard.writeText(report);
    const { url, isTruncated } = buildMailtoUrl(report, facts?.appVersion);
    say(
      isTruncated
        ? 'Report copied — paste it into the email, which only carries the start.'
        : 'Report copied, and an email opened. No mail app? Just paste it.',
    );
    // `_blank`, never `_self`. Main installs a window-open handler that passes
    // the URL to the operating system and denies the navigation; `_self` does
    // not reach that handler at all — it navigates this window, and the app
    // would disappear behind a mailto the renderer cannot load.
    window.open(url, '_blank', 'noopener');
  }, [facts?.appVersion, report, say]);

  const openIssue = useCallback(async () => {
    const { url, needsPaste } = buildIssueUrl(report);
    if (needsPaste) {
      // Too long to travel in a URL. Copied instead, and said out loud —
      // opening an empty issue without explaining why would look broken.
      await navigator.clipboard.writeText(report);
      say('Report copied — paste it into the issue that just opened.');
    }
    window.open(url, '_blank', 'noopener');
  }, [report, say]);

  return (
    <div
      className="bug-report-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bug-report"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
      >
        <DialogHeader
          eyebrow={PRODUCT_NAME}
          title="Report a problem"
          titleId="bug-report-title"
          closeLabel="Close"
          onClose={onClose}
          closeRef={closeRef}
        />

        <div className="bug-report__body-wrap">
          <label className="bug-report__field" htmlFor="bug-report-description">
            <span>What went wrong?</span>
            <textarea
              id="bug-report-description"
              value={description}
              rows={3}
              placeholder="What were you doing, and what happened instead?"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          {/* The whole point. Shown, editable, and nothing is sent from here —
              the buttons below copy it or hand it to a browser, and the person
              reading it is the last line of defence that no rule can replace. */}
          <label className="bug-report__field" htmlFor="bug-report-body">
            <span>
              This is exactly what will be sent. Read it, and delete anything
              you would rather not share.
            </span>
            <textarea
              id="bug-report-body"
              className="bug-report__body"
              value={report}
              rows={14}
              readOnly={!facts && !failed}
              onChange={(event) => setReportOverride(event.target.value)}
            />
          </label>

          {failed && (
            <p className="bug-report__warn">
              The logs could not be read, so this report has none. It is still
              worth sending.
            </p>
          )}

          <p className="bug-report__privacy">
            Account names, paths and email addresses are removed automatically.
            Nothing is sent until you press one of these.
            {REPORT_EMAIL
              ? ' The email goes only to the developer; the issue is public.'
              : ' The issue is public.'}
          </p>
        </div>

        <div className="bug-report__footer">
          {notice && (
            <p className="bug-report__notice" role="status">
              {notice}
            </p>
          )}

          <div className="bug-report__actions">
            <button
              type="button"
              className="bug-report__primary"
              onClick={openIssue}
            >
              Open a GitHub issue
            </button>
            {/* Only when this build has an address. A mailto with none opens an
                empty compose window, which looks like it worked and is a report
                nobody ever receives. */}
            {REPORT_EMAIL && (
              <button type="button" onClick={sendEmail}>
                Email it privately
              </button>
            )}
            <button type="button" onClick={copy}>
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
