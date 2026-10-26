/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.sent': 'Enviada el {date}',
  'review.reason.flashing': 'Destellos o parpadeo',
  'review.reason.rights': 'Obra de otra persona',
  'review.reason.offensive': 'Ofensiva',
  'review.reason.broken': 'Rota o demasiado pesada',
  'review.reason.other': 'Otra cosa',
  'review.state.pending': 'En revisión',
  'review.state.pendingUpdate': 'Versión {version} en revisión',
  'review.state.rejected': 'No aprobada',
  'review.state.rejectedUpdate': 'Versión {version} no aprobada',
  'review.withdraw': 'Retirar',
  'review.withdrawConfirm': '¿Retirarla de la revisión?',
  'review.remove': 'Quitar',
  'review.removeConfirm': '¿Quitarla de esta lista?',
  'review.withdrawn': '{name} se retiró.',
  'review.notice.approved': '{name} está en la galería',
  'review.notice.approvedBody':
    'Se aprobó. Ahora suena gratis para ti en todas partes, y cualquiera puede conseguirla.',
  'review.notice.approvedUpdate':
    'La versión {version} de {name} está en la galería',
  'review.notice.approvedUpdateBody':
    'Se aprobó. Todos los que tienen la escena reciben la versión nueva.',
  'review.notice.rejected': '{name} no se aprobó',
  'review.notice.rejectedUpdate': 'La versión {version} de {name} no se aprobó',
  'review.notice.keepsLive': 'Quien la tiene conserva la versión {version}.',
  'review.notice.gotIt': 'Entendido',
  'review.notice.openStudio': 'Abrir el Estudio',
  'review.notice.openMine': 'Tus escenas',
} as const;

export default review;
