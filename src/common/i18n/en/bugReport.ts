/**
 * The "Report a problem" dialog. See
 * `src/renderer/components/BugReportDialog.tsx`; its close button reuses
 * `support.close`.
 *
 * The report itself is not here, and neither is the email's subject: both stay
 * in English because they are written for whoever reads the issue or the email,
 * not for the person sending it (`common/bugReport.ts`).
 */
const bugReport = {
  'bugReport.title': 'Report a problem',
  'bugReport.descriptionLabel': 'What went wrong?',
  'bugReport.descriptionPlaceholder':
    'What were you doing, and what happened instead?',
  'bugReport.reportLabel':
    'This is exactly what will be sent. Read it, and delete anything you would rather not share.',
  'bugReport.logsUnreadable':
    'The logs could not be read, so this report has none. It is still worth sending.',
  'bugReport.privacy':
    'Account names, paths and email addresses are removed automatically. Nothing is sent until you press one of these. The issue is public.',
  'bugReport.privacyWithEmail':
    'Account names, paths and email addresses are removed automatically. Nothing is sent until you press one of these. The email goes only to the developer; the issue is public.',
  'bugReport.openIssue': 'Open a GitHub issue',
  'bugReport.email': 'Email it privately',
  'bugReport.copy': 'Copy',
  'bugReport.copied': 'Report copied.',
  'bugReport.issuePaste':
    'Report copied — paste it into the issue that just opened.',
  'bugReport.emailOpening': 'Report copied. Opening your email app…',
  'bugReport.emailOpened':
    'Report copied and passed to your email app. Check the new email, then send it.',
  'bugReport.emailOpenedPartial':
    'Report copied and passed to your email app. The email carries only the start — paste the full report into it before sending.',
  // Followed by the support address, on its own and selectable.
  'bugReport.emailNotOpened':
    'Report copied, but no email app could be opened. Paste it into an email to:',
} as const;

export default bugReport;
