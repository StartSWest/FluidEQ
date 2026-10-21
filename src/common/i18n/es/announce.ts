/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const announce = {
  'announce.eyebrow': 'Novedades en Visualizadores · {count} escenas',
  'announce.try': 'Probarlas ahora',
  'announce.later': 'Más tarde',
  'announce.previewNote': 'Vista previa. No se ha enviado ni registrado nada.',
  'announce.untitled': 'Escenas nuevas',
  'announce.tab': 'Anuncios',
  'announce.pageHint':
    'Cada persona ve un anuncio una sola vez, en grande, sobre lo que tenga abierto. Los miembros cuya prueba termina en los próximos dos días ven además una línea sobre conservar Plus.',
  'announce.field.title': 'Título',
  'announce.field.titlePlaceholder': 'Por ejemplo: Ruta nocturna',
  'announce.field.body': 'Qué es',
  'announce.field.bodyPlaceholder':
    'Por ejemplo: seis escenas nuevas de ciudad de noche que se mueven con tus graves y tus agudos.',
  'announce.field.scenes':
    'Escenas incluidas: {count} de {most}. La primera es el marco grande.',
  'announce.field.noScenes':
    'Las escenas de FluidEQ todavía no se han cargado. Abre Visualizadores una vez y vuelve.',
  'announce.field.when': 'Se publica',
  'announce.field.audience': 'Quién lo ve',
  'announce.audience.everyone': 'Todos los que hayan iniciado sesión',
  'announce.audience.everyoneLine':
    'Miembros Plus, pruebas y cuentas gratuitas. Las cuentas gratuitas van a Visualizadores para probar las escenas.',
  'announce.audience.members': 'Miembros Plus y pruebas',
  'announce.audience.membersLine':
    'Todos los que ya pueden reproducir las escenas.',
  'announce.audience.trialEnding': 'Solo pruebas que terminan en 2 días',
  'announce.audience.trialEndingLine':
    'Los miembros que están a punto de decidir si pagan.',
  'announce.trials.dayAfter':
    '{count} pruebas terminan el {date}, el día siguiente.',
  'announce.trials.twoAfter': '{count} más el día después.',
  'announce.preview': 'Vista previa',
  'announce.schedule': 'Programar',
  'announce.saveChanges': 'Guardar cambios',
  'announce.stopEditing': 'Dejar de editar',
  'announce.done': 'Programado. Se publica el {date}.',
  'announce.listTitle': 'Programados y visibles',
  'announce.listEmpty': 'Nada programado.',
  'announce.state.out': 'Visible',
  'announce.state.later': 'Programado',
  'announce.edit': 'Editar',
  'announce.cancel': 'Cancelarlo',
  'announce.cancelAsk': '¿Cancelar este anuncio?',
  'announce.cancelOut': '¿Dejar de mostrarlo a quien todavía no lo haya visto?',
  'announce.keep': 'Mantenerlo',
} as const;

export default announce;
