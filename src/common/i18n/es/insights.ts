/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'Favoritas',
  'insights.loading': 'Cargando las escenas que ven los miembros',
  'insights.period': 'Periodo',
  'insights.period.week': '7 días',
  'insights.period.month': '30 días',
  'insights.period.quarter': '90 días',
  'insights.period.all': 'Desde siempre',
  'insights.favourites.hint':
    'Cada escena reproducida, añadida o con me gusta en el periodo, ordenada por cuántas personas la reprodujeron y después por tiempo en pantalla. Tus propias pruebas no cuentan.',
  'insights.favourites.summary': '{scenes} escenas reproducidas durante {time}',
  'insights.favourites.empty':
    'En este periodo no se reprodujo, añadió ni recibió un me gusta ninguna escena.',
  'insights.favourites.kinds': 'Tiempo en pantalla por tipo',
  'insights.favourites.noPlays':
    'Todavía no se ha reproducido nada en este periodo.',
  'insights.favourites.advice':
    '{kind} reúne el {share} de todo el tiempo visto, repartido en {count} escenas. Más escenas de {kind} son la apuesta más segura.',
  'insights.col.rank': 'Puesto',
  'insights.col.scene': 'Escena',
  'insights.col.people': 'Personas',
  'insights.col.time': 'Tiempo',
  'insights.col.perPerson': 'Por persona',
  'insights.col.adds': 'Añadidos',
  'insights.col.likes': 'Me gusta',
  'insights.account.title': 'Escenas',
  'insights.account.empty':
    'Todavía no ha añadido, dado me gusta ni reproducido ninguna escena. El tiempo de reproducción se cuenta en cuanto el miembro usa esta versión de FluidEQ y ha visto las condiciones actualizadas.',
  'insights.account.played': 'Escenas reproducidas',
  'insights.account.time': 'En pantalla',
  'insights.account.added': 'Añadidas',
  'insights.account.liked': 'Con me gusta',
  'insights.account.kind': 'Tipo favorito',
  'insights.account.notPlayed': 'Sin reproducir',
  'insights.account.days': '{days} días · última vez el {date}',
  'insights.by': 'de {maker}',
  'insights.byFluidEQ': 'de FluidEQ',
  'insights.member': 'un miembro',
  'insights.chip.added': 'Añadida el {date}',
  'insights.chip.liked': 'Me gusta',
  'insights.kind.other': 'Sin categoría',
  'insights.time.hoursMinutes': '{hours} {minutes}',
  'insights.error.offline':
    'FluidEQ no pudo conectar con su servidor. Comprueba tu conexión y vuelve a intentarlo.',
  'insights.error.signedOut': 'Vuelve a iniciar sesión para ver esto.',
  'insights.error.server': 'No se pudo cargar. Vuelve a intentarlo.',
  'insights.error.forbidden':
    'Solo el administrador de FluidEQ puede ver esto.',
  'insights.error.notDeployed':
    'El servidor todavía no tiene esto. Llega con la actualización del servidor que acompaña a esta versión de FluidEQ.',
} as const;

export default insights;
