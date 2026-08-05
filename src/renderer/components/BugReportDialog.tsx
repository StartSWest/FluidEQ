/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
} from 'common/bugReport';
import { gatherBugReport } from '../utils/equalizerApi';
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
  const dialogRef = useRef<HTMLDivElement>(null);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const report = facts
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

  const say = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 2600);
  }, []);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(report);
    say('Report copied.');
  }, [report, say]);

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
        aria-label="Report a problem"
        ref={dialogRef}
      >
        <div className="bug-report__head">
          <h2>Report a problem</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

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
            This is exactly what will be sent. Read it, and delete anything you
            would rather not share.
          </span>
          <textarea
            id="bug-report-body"
            className="bug-report__body"
            value={report}
            rows={14}
            readOnly={!facts && !failed}
            onChange={() => {
              // Editing the composed report is deliberately not wired up: it
              // is rebuilt from the description and the facts on every
              // keystroke, so an edit here would be silently reverted. Copy it
              // and edit it where it lands instead, which is the honest
              // behaviour rather than a box that fights back.
            }}
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
        </p>

        <div className="bug-report__actions">
          <button
            type="button"
            className="bug-report__primary"
            onClick={openIssue}
          >
            Open a GitHub issue
          </button>
          <button type="button" onClick={copy}>
            Copy
          </button>
        </div>

        {notice && (
          <p className="bug-report__notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
