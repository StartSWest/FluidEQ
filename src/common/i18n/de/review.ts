/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.sent': 'Gesendet am {date}',
  'review.reason.flashing': 'Blitze oder Stroboskop',
  'review.reason.rights': 'Werk einer anderen Person',
  'review.reason.offensive': 'Anstößig',
  'review.reason.broken': 'Defekt oder zu aufwendig',
  'review.reason.other': 'Etwas anderes',
  'review.state.pending': 'In Prüfung',
  'review.state.pendingUpdate': 'Version {version} in Prüfung',
  'review.state.rejected': 'Nicht genehmigt',
  'review.state.rejectedUpdate': 'Version {version} nicht genehmigt',
  'review.withdraw': 'Zurückziehen',
  'review.withdrawConfirm': 'Aus der Prüfung zurückziehen?',
  'review.remove': 'Entfernen',
  'review.removeConfirm': 'Aus dieser Liste entfernen?',
  'review.withdrawn': '{name} wurde zurückgezogen.',
  'review.notice.approved': '{name} ist in der Galerie',
  'review.notice.approvedBody':
    'Sie wurde freigegeben. Sie läuft jetzt überall kostenlos für Sie, und jeder kann sie holen.',
  'review.notice.approvedUpdate':
    'Version {version} von {name} ist in der Galerie',
  'review.notice.approvedUpdateBody':
    'Sie wurde genehmigt. Alle, die die Szene haben, erhalten die neue Version.',
  'review.notice.rejected': '{name} wurde nicht genehmigt',
  'review.notice.rejectedUpdate':
    'Version {version} von {name} wurde nicht genehmigt',
  'review.notice.keepsLive': 'Wer sie hat, behält Version {version}.',
  'review.notice.gotIt': 'Verstanden',
  'review.notice.openStudio': 'Studio öffnen',
  'review.notice.openMine': 'Ihre Szenen',
} as const;

export default review;
