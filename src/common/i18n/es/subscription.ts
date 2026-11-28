/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription: Partial<Dictionary> = {
  'subscription.name': 'Plus',
  'subscription.get': 'Hazte Plus',
  'subscription.getAgain': 'Recuperar Plus',
  'subscription.manage': 'Gestionar Plus',
  'subscription.included': 'Incluida con Plus',

  'subscription.plan.monthly': 'Mensual',
  'subscription.plan.yearly': 'Anual',
  'subscription.plan.perMonth': '{price} al mes',
  'subscription.plan.perYear': '{price} al año',
  'subscription.plan.both': '{monthly} al mes o {yearly} al año',
  'subscription.plan.cancelAnytime': 'Cancela cuando quieras.',
  'subscription.plan.monthlyEquivalent': 'Sale a {price} al mes.',
  'subscription.plan.save': 'Ahorra un {percent}%',

  'subscription.status.grace':
    'FluidEQ no pudo comprobar tu Plus con el servidor. Sigue funcionando hasta el {date}.',
  'subscription.status.waiting':
    'Esperando a que Stripe confirme tu pago. Plus se activa aquí solo.',

  'subscription.ways.title': '¿Plus o créditos?',
  'subscription.ways.credits.each': 'Una escena a la vez, {credits} cada una',
  'subscription.ways.credits.keep': 'Tuya para siempre, incluso sin Plus',
  'subscription.ways.plus.every':
    'Todas las escenas de Escenas, también las nuevas',
  'subscription.ways.plus.while': 'Mientras seas miembro',

  'subscription.scene.twoWays': 'Dos formas de tenerla',
  'subscription.scene.keep.title': 'Guarda esta escena',
  'subscription.scene.keep.body':
    'Tuya para siempre, con cada actualización. {credits}.',
  'subscription.scene.plus.title': 'Todas las escenas con Plus',
  'subscription.scene.plus.body':
    'Esta y todas las demás, mientras seas miembro. {prices}.',
  'subscription.scene.member.note':
    'Se reproduce en tu gráfica, tu escritorio y tus luces mientras tengas Plus.',
  'subscription.scene.member.keep':
    '¿La quieres aunque termine Plus? Guárdala con un crédito, tuya para siempre.',
  'subscription.scene.member.keepButton': 'Guardar para siempre · {credits}',

  'subscription.lapse.title': 'Tu membresía Plus terminó',
  'subscription.lapse.body':
    'Estas escenas se reproducían con Plus y sus descargas se borraron de este equipo. Consigue una con un crédito para guardarla para siempre, o recupera Plus para tenerlas todas.',
  'subscription.lapse.more': '+{count} más',
  'subscription.lapse.find': 'Buscarla',
  'subscription.lapse.notNow': 'Ahora no',

  'subscription.sheet.eyebrow': 'Escenas',
  'subscription.sheet.description':
    'Todas las escenas de Escenas, las de FluidEQ y las de la comunidad.',
  'subscription.sheet.heading': 'Todas las escenas, mientras tengas Plus',
  'subscription.sheet.lead':
    'Se reproducen en tu gráfica, tu escritorio y tus luces, aquí y en FluidWallpapers, en cada equipo donde inicies sesión.',
  'subscription.sheet.choose': 'Cómo pagar',
  'subscription.sheet.renews':
    'Plus se renueva hasta que lo canceles. Cancela cuando quieras en la página de Stripe.',
  'subscription.sheet.ends':
    'Cuando termina Plus, las escenas que reproducía se detienen y sus descargas se borran de este equipo.',
  'subscription.sheet.pay': 'Continuar al pago · {price}',
  'subscription.sheet.again': 'Abrir otra vez la página de Stripe',
  'subscription.sheet.waiting':
    'Termina en la página de Stripe en tu navegador. Plus se activa aquí solo.',
  'subscription.sheet.fine':
    'Al continuar se registra que aceptas los términos. Pagas en la página de Stripe; FluidEQ nunca ve tu tarjeta.',
  'subscription.sheet.notNow': 'Ahora no',
  'subscription.sheet.done.title': 'Plus está activo',
  'subscription.sheet.done.body':
    'Todas las escenas de Escenas se reproducen para ti ahora.',
  'subscription.sheet.done.see': 'Ver las escenas',

  'subscription.error.termsChanged':
    'Los términos se actualizaron. Léelos y luego continúa.',
  'subscription.error.needsEmail':
    'Confirma primero tu correo electrónico y vuelve a intentarlo.',
  'subscription.error.needsUpdate': 'Actualiza FluidEQ para hacerte Plus.',
  'subscription.error.alreadySubscribed': 'Esta cuenta ya tiene Plus.',
  'subscription.error.notOnSale': 'Plus no está a la venta ahora.',
  'subscription.error.banned': 'Esta cuenta no puede tener Plus ahora.',
  'subscription.error.signedOut': 'Inicia sesión de nuevo para hacerte Plus.',
  'subscription.error.failed':
    'No se pudo abrir la página de Stripe. Revisa tu conexión e inténtalo de nuevo.',

  'subscription.manage.opened': 'La página de Stripe se abrió en tu navegador.',
  'subscription.manage.none':
    'Esta cuenta no tiene una membresía Plus que gestionar.',
  'subscription.manage.signedOut':
    'Inicia sesión de nuevo para gestionar Plus.',
  'subscription.manage.failed':
    'No se pudo abrir la página de Stripe. Revisa tu conexión e inténtalo de nuevo.',

  'subscription.cardGet': 'Conseguir',
  'subscription.makeScenes': 'Crea tus propias escenas en FluidWallpapers',
  'subscription.banner.title': 'Plus: todas las escenas de la galería',
  'subscription.banner.body':
    'Reprodúcelas y añádelas todas, también las nuevas. Una sola suscripción para FluidEQ y FluidWallpapers.',
  'subscription.banner.credit':
    '¿Quieres una escena aunque no tengas Plus? Consíguela con un crédito y es tuya para siempre.',
  'subscription.banner.or': 'o {price}',
  'subscription.line.renews':
    'Todas las escenas son tuyas · se renueva el {date} · también en FluidWallpapers',
  'subscription.line.ends':
    'Todas las escenas son tuyas hasta el {date} · también en FluidWallpapers',
  'subscription.line.plain':
    'Todas las escenas son tuyas · también en FluidWallpapers',
  'subscription.sheet.both':
    'Una sola suscripción para FluidEQ y FluidWallpapers: hazte Plus en cualquiera de las dos y vale en ambas.',
  'subscription.sheet.keepOne':
    'O quédate solo {name} para siempre, aunque no tengas Plus:',
};

export default subscription;
