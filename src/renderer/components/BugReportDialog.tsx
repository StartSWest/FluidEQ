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
import Glyph from '../community/Glyph';
import { gatherBugReport, openSupportEmail } from '../utils/equalizerApi';
import { useTranslation } from '../utils/I18nContext';
import DialogHeader from './DialogHeader';
import '../styles/BugReport.scss';

interface IBugReportDialogProps {
  onClose: () => void;
}

/**
 * What each thing the dialog can say back is.
 *
 * `done` leaves on its own once the line along its foot has drained. `waiting`
 * is replaced by the answer it waits for, and `problem` stays: it carries what
 * to do instead, and a notice that left before it was read would be no answer.
 */
const NOTICE_TONES = {
  copied: 'done',
  issuePaste: 'done',
  emailOpening: 'waiting',
  emailOpened: 'done',
  emailOpenedPartial: 'done',
  emailNotOpened: 'problem',
} as const;

type TNoticeKind = keyof typeof NOTICE_TONES;

interface INotice {
  /** Remounts the notice, so a new one starts its own line from full. */
  id: number;
  kind: TNoticeKind;
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
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [facts, setFacts] = useState<IGatheredFacts>();
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<INotice>();
  const [isEmailing, setIsEmailing] = useState(false);
  // Undefined means the preview is still following the generated report.
  // Once the user edits it, their redactions become the source used by every
  // action below instead of being silently rebuilt away.
  const [reportOverride, setReportOverride] = useState<string>();
  const closeRef = useRef<HTMLButtonElement>(null);
  const noticeCount = useRef(0);

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
        audioEngine: null,
        isEqualizerApoInstalled: false,
        fluidEngineInstalled: false,
        description,
        appLog: '',
        installLog: '',
      });
  const report = reportOverride ?? generatedReport;

  const say = useCallback((kind: TNoticeKind) => {
    noticeCount.current += 1;
    setNotice({ id: noticeCount.current, kind });
  }, []);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(report);
    say('copied');
  }, [report, say]);

  /**
   * The private route, for anyone who would rather not post in public.
   *
   * The full report goes on the clipboard FIRST, every time. A mail client
   * cannot be attached to, truncates a long body without saying so, and on the
   * many Windows machines with no desktop mail client the link does nothing at
   * all — so the clipboard is the part that always works, and the mail window
   * is the convenience on top of it.
   *
   * The email is said to have opened only once main answers that the operating
   * system took the link. It used to be said before anything was tried, and
   * the link went through `window.open`, whose handler opens only the web — so
   * every press announced an email that never appeared.
   */
  const sendEmail = useCallback(async () => {
    await navigator.clipboard.writeText(report);
    const { url, isTruncated } = buildMailtoUrl(report, facts?.appVersion);
    setIsEmailing(true);
    say('emailOpening');
    let opened: boolean;
    try {
      opened = await openSupportEmail(url);
    } catch {
      // The bridge would not send it, so nothing reached a mail app either.
      opened = false;
    }
    setIsEmailing(false);
    if (opened) {
      say(isTruncated ? 'emailOpenedPartial' : 'emailOpened');
    } else {
      say('emailNotOpened');
    }
  }, [facts?.appVersion, report, say]);

  const openIssue = useCallback(async () => {
    const { url, needsPaste } = buildIssueUrl(report);
    if (needsPaste) {
      // Too long to travel in a URL. Copied instead, and said out loud —
      // opening an empty issue without explaining why would look broken.
      await navigator.clipboard.writeText(report);
      say('issuePaste');
    }
    window.open(url, '_blank', 'noopener');
  }, [report, say]);

  const tone = notice ? NOTICE_TONES[notice.kind] : undefined;

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
          title={t('bugReport.title')}
          titleId="bug-report-title"
          closeLabel={t('support.close')}
          onClose={onClose}
          closeRef={closeRef}
        />

        <div className="bug-report__body-wrap">
          <label className="bug-report__field" htmlFor="bug-report-description">
            <span>{t('bugReport.descriptionLabel')}</span>
            <textarea
              id="bug-report-description"
              value={description}
              rows={3}
              placeholder={t('bugReport.descriptionPlaceholder')}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          {/* The whole point. Shown, editable, and nothing is sent from here —
              the buttons below copy it or hand it to a browser, and the person
              reading it is the last line of defence that no rule can replace. */}
          <label className="bug-report__field" htmlFor="bug-report-body">
            <span>{t('bugReport.reportLabel')}</span>
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
            <p className="bug-report__warn">{t('bugReport.logsUnreadable')}</p>
          )}

          <p className="bug-report__privacy">
            {REPORT_EMAIL
              ? t('bugReport.privacyWithEmail')
              : t('bugReport.privacy')}
          </p>
        </div>

        <div className="bug-report__footer">
          {/* The live region stays mounted and only what is inside it changes,
              which is what a screen reader needs to announce each notice. */}
          <div className="bug-report__notice-slot" role="status">
            {notice && tone && (
              <p
                key={notice.id}
                className={`bug-report__notice bug-report__notice--${tone}`}
              >
                <span className="bug-report__notice-mark" aria-hidden="true">
                  {tone !== 'waiting' && (
                    <Glyph name={tone === 'problem' ? 'alert' : 'check'} />
                  )}
                </span>
                <span className="bug-report__notice-text">
                  {t(`bugReport.${notice.kind}`)}
                  {notice.kind === 'emailNotOpened' && (
                    <>
                      {' '}
                      <span className="bug-report__address is-selectable">
                        {REPORT_EMAIL}
                      </span>
                    </>
                  )}
                </span>
                {tone === 'done' && (
                  <span
                    className="bug-report__notice-life"
                    aria-hidden="true"
                    // Nothing inside it animates, so every end heard here is
                    // its own line running out.
                    onAnimationEnd={() =>
                      setNotice((current) =>
                        current?.id === notice.id ? undefined : current,
                      )
                    }
                  />
                )}
              </p>
            )}
          </div>

          <div className="bug-report__actions">
            <button
              type="button"
              className="bug-report__primary"
              onClick={openIssue}
            >
              {t('bugReport.openIssue')}
            </button>
            {/* Only when this build has an address. A mailto with none opens an
                empty compose window, which looks like it worked and is a report
                nobody ever receives. */}
            {REPORT_EMAIL && (
              <button
                type="button"
                onClick={sendEmail}
                disabled={isEmailing}
                aria-busy={isEmailing}
              >
                {t('bugReport.email')}
              </button>
            )}
            <button type="button" onClick={copy}>
              {t('bugReport.copy')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
