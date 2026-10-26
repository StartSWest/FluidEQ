/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.sent': 'Inviata il {date}',
  'review.reason.flashing': 'Lampi o effetto stroboscopico',
  'review.reason.rights': 'Opera di qualcun altro',
  'review.reason.offensive': 'Offensiva',
  'review.reason.broken': 'Non funziona o è troppo pesante',
  'review.reason.other': 'Altro',
  'review.state.pending': 'In revisione',
  'review.state.pendingUpdate': 'Versione {version} in revisione',
  'review.state.rejected': 'Non approvata',
  'review.state.rejectedUpdate': 'Versione {version} non approvata',
  'review.withdraw': 'Ritira',
  'review.withdrawConfirm': 'Ritirarla dalla revisione?',
  'review.remove': 'Rimuovi',
  'review.removeConfirm': 'Rimuoverla da questo elenco?',
  'review.withdrawn': '{name} è stata ritirata.',
  'review.notice.approved': '{name} è nella galleria',
  'review.notice.approvedBody':
    'È stata approvata. Ora suona gratis per te ovunque, e chiunque può ottenerla.',
  'review.notice.approvedUpdate':
    'La versione {version} di {name} è nella galleria',
  'review.notice.approvedUpdateBody':
    'È stata approvata. Tutti quelli che hanno la scena ricevono la nuova versione.',
  'review.notice.rejected': '{name} non è stata approvata',
  'review.notice.rejectedUpdate':
    'La versione {version} di {name} non è stata approvata',
  'review.notice.keepsLive': 'Chi ce l’ha mantiene la versione {version}.',
  'review.notice.gotIt': 'Ho capito',
  'review.notice.openStudio': 'Apri lo Studio',
  'review.notice.openMine': 'Le tue scene',
} as const;

export default review;
