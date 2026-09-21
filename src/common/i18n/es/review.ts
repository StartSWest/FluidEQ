/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.tab': 'Por aprobar',
  'review.tabCount': 'Esperando aprobación: {count}',
  'review.badge': 'Esperándote: {count}',
  'review.hint':
    'Cada escena que publica un miembro, y cada versión nueva de una, espera aquí hasta que la apruebes. Nadie más la ve hasta entonces.',
  'review.empty.title': 'Nada esperando',
  'review.empty.hint':
    'Las escenas nuevas y las versiones nuevas aparecen aquí cuando los miembros las publican.',
  'review.kind.new': 'Escena nueva',
  'review.kind.update': 'Actualización · v{from} → v{to}',
  'review.sent': 'Enviada el {date}',
  'review.open': 'Revisar',
  'review.back': 'Todo lo que espera',
  'review.flag.takenDown': 'Retirada de la galería',
  'review.flag.takenDownHint':
    'Retirada de la galería: restáurala desde Denunciadas para aprobar una versión nueva',
  'review.flag.reports':
    'Denuncias abiertas sobre la versión publicada: {count}',
  'review.note.title': 'Lo que su autor dice que es nuevo',
  'review.note.none': 'Su autor no escribió nada sobre esta versión.',
  'review.sceneFailed': 'No se pudo abrir esta escena para verla.',
  'review.changed':
    'La escena cambió mientras la veías: su autor envió una versión más nueva o la retiró. La lista muestra lo que espera ahora.',
  'review.approve': 'Aprobar y publicar',
  'review.approving': 'Aprobando…',
  'review.reject': 'No aprobar',
  'review.reject.title': '¿Por qué no se aprueba?',
  'review.reject.lead':
    'Su autor recibe el motivo, y tu línea si escribes una.',
  'review.reject.noteLabel': 'Una línea para su autor (opcional)',
  'review.reject.notePlaceholder':
    'Por ejemplo: el destello blanco del drop es demasiado fuerte',
  'review.reject.cancel': 'Atrás',
  'review.reject.send': 'Enviar la respuesta',
  'review.reject.sending': 'Enviando…',
  'review.reason.flashing': 'Destellos o parpadeo',
  'review.reason.rights': 'Obra de otra persona',
  'review.reason.offensive': 'Ofensiva',
  'review.reason.broken': 'Rota o demasiado pesada',
  'review.reason.other': 'Otra cosa',
  'review.done.approved': '{name} ya está en la galería.',
  'review.done.rejected': '{name} no se aprobó. Su autor sabrá por qué.',
  'review.failed': 'La respuesta no se envió. Inténtalo de nuevo.',
  'review.versionRaised': 'La galería ya tiene esta versión o una más nueva.',
  'review.takenDown':
    'Se retiró de la galería mientras tanto, así que no admite versiones nuevas. Restáurala primero desde Denunciadas.',
  'review.deleted':
    'Se eliminó para siempre, así que no admite versiones nuevas.',
  'review.filesFailed':
    'Aprobada, pero sus archivos no llegaron a la galería. Pulsa Aprobar y publicar otra vez para terminar.',
  'review.forbidden': 'Solo el administrador de FluidEQ puede aprobar escenas.',
  'review.fine.new':
    'Aprobarla la pone en la galería en la versión {version}: la ve cualquiera con sesión iniciada y los miembros de Plus pueden añadirla.',
  'review.fine.update':
    'Aprobarla sustituye la versión {version} para todos los que tienen la escena. Si no la apruebas, la versión {version} se queda como está.',
  'review.state.pending': 'En revisión',
  'review.state.pendingUpdate': 'Versión {version} en revisión',
  'review.state.rejected': 'No aprobada',
  'review.state.rejectedUpdate': 'Versión {version} no aprobada',
  'review.withdraw': 'Retirar',
  'review.withdrawConfirm': '¿Retirarla de la revisión?',
  'review.remove': 'Quitar',
  'review.removeConfirm': '¿Quitarla de esta lista?',
  'review.withdrawn': '{name} se retiró.',
  'review.notice.waitingOne': 'Una escena espera tu aprobación',
  'review.notice.waitingMany': '{count} escenas esperan tu aprobación',
  'review.notice.waitingWho': '{name}, de {maker}',
  'review.notice.waitingNewest': 'La más reciente: {name}, de {maker}',
  'review.notice.later': 'Más tarde',
  'review.notice.review': 'Revisar ahora',
  'review.notice.approved': '{name} está en la galería',
  'review.notice.approvedBody':
    'Se aprobó. Los miembros de Plus ya pueden añadirla.',
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
