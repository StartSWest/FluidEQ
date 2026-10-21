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
  'insights.chip.unpublished': 'Sin publicar',
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
  'insights.server.tab': 'Servidor',
  'insights.server.loading': 'Midiendo el servidor',
  'insights.server.plan': 'Plan gratis de Supabase',
  'insights.server.measured': 'Medido a las {time}',
  'insights.server.database': 'Base de datos',
  'insights.server.files': 'Archivos',
  'insights.server.active': 'Cuentas activas, 30 días',
  'insights.server.activeNote': '{accounts} cuentas en total',
  'insights.server.of': 'de {limit}',
  'insights.server.used': '{share} usado',
  'insights.server.requests': 'Peticiones, últimos 7 días',
  'insights.server.unlimited': 'sin límite en el plan gratis',
  'insights.server.kind.rest': 'Base de datos',
  'insights.server.kind.auth': 'Inicio de sesión',
  'insights.server.kind.storage': 'Archivos',
  'insights.server.kind.realtime': 'En vivo',
  'insights.server.noToken':
    'El recuento de peticiones no está activado en este servidor.',
  'insights.server.tokenRefused':
    'El servidor no pudo leer el recuento de peticiones.',
  'insights.server.tables': 'Tablas más grandes',
  'insights.server.buckets': 'Archivos por carpeta',
  'insights.server.bucketFiles': '{count} archivos',
  'insights.server.noFiles': 'Todavía no hay archivos guardados.',
  'insights.server.egress': 'Datos enviados',
  'insights.server.egressBody':
    'El plan gratis incluye {limit} al mes, y suele ser el primer límite que se alcanza: cuenta cada escena e imagen que descarga un miembro. Ninguna API lo informa; Supabase lo muestra en la página Usage del proyecto.',
  'insights.server.openSupabase': 'Abrir Supabase',
  'insights.server.limit.warn': 'El servidor se está llenando',
  'insights.server.limit.full': 'El servidor está casi lleno',
  'insights.server.limit.body':
    '{what} está al {share} del plan gratuito de Supabase. Pasa el proyecto a un plan de pago antes de que se llene, o las funciones en línea de FluidEQ empezarán a fallar.',
  'insights.server.limit.database': 'La base de datos',
  'insights.server.limit.files': 'El almacenamiento de archivos',
  'insights.server.limit.accounts': 'Las cuentas activas',
  'insights.server.limit.later': 'Más tarde',
  'insights.server.limit.open': 'Abrir la página del servidor',
  'insights.server.limit.badge': '{share} del plan gratuito usado',
  'insights.server.rules':
    'El plan gratis no tiene fecha de fin. Pasar un límite trae un correo y un periodo de gracia; si sigue, Supabase responde a las peticiones con “payment required” hasta el mes siguiente o una mejora de plan. Un proyecto sin peticiones durante {days} días se pausa, algo que el propio tráfico de FluidEQ impide.',
} as const;

export default insights;
