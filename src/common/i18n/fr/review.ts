/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.sent': 'Envoyée le {date}',
  'review.reason.flashing': 'Flashs ou effet stroboscopique',
  'review.reason.rights': 'L’œuvre de quelqu’un d’autre',
  'review.reason.offensive': 'Choquante',
  'review.reason.broken': 'Cassée ou trop lourde',
  'review.reason.other': 'Autre chose',
  'review.state.pending': 'En examen',
  'review.state.pendingUpdate': 'Version {version} en examen',
  'review.state.rejected': 'Non approuvée',
  'review.state.rejectedUpdate': 'Version {version} non approuvée',
  'review.withdraw': 'Retirer',
  'review.withdrawConfirm': 'La retirer de l’examen ?',
  'review.remove': 'Enlever',
  'review.removeConfirm': 'L’enlever de cette liste ?',
  'review.withdrawn': '{name} a été retirée.',
  'review.notice.approved': '{name} est dans la galerie',
  'review.notice.approvedBody':
    'Elle a été approuvée. Elle joue désormais gratuitement pour vous partout, et tout le monde peut l’obtenir.',
  'review.notice.approvedUpdate':
    'La version {version} de {name} est dans la galerie',
  'review.notice.approvedUpdateBody':
    'Elle a été approuvée. Tous ceux qui ont la scène reçoivent la nouvelle version.',
  'review.notice.rejected': '{name} n’a pas été approuvée',
  'review.notice.rejectedUpdate':
    'La version {version} de {name} n’a pas été approuvée',
  'review.notice.keepsLive': 'Ceux qui l’ont gardent la version {version}.',
  'review.notice.gotIt': 'Compris',
  'review.notice.openStudio': 'Ouvrir le Studio',
  'review.notice.openMine': 'Vos scènes',
} as const;

export default review;
