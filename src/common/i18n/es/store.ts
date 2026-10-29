/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const store: Partial<Dictionary> = {
  'store.credit.one': '{count} crédito',
  'store.credit.few': '{count} créditos',
  'store.credit.many': '{count} créditos',
  'store.credit.other': '{count} créditos',
  'store.credits.unit.one': 'crédito',
  'store.credits.unit.few': 'créditos',
  'store.credits.unit.many': 'créditos',
  'store.credits.unit.other': 'créditos',
  'store.credits.title': 'Créditos',
  'store.credits.buyTitle': 'Conseguir créditos',
  'store.credits.lead':
    'Un crédito guarda una escena para siempre. Pagas una vez y nada se renueva.',
  'store.credits.what':
    'Cada crédito guarda para siempre una escena de la galería: en la gráfica, tu escritorio y tus luces.',
  'store.credits.half':
    'Tienes medio crédito en espera: la próxima escena tuya que alguien consiga con un crédito pagado lo completa.',
  'store.credits.buy': 'Conseguir créditos',
  'store.credits.getFree': 'Obtener créditos gratis',
  'store.error.offline':
    'No se pudo conectar con FluidEQ. Revisa tu conexión e inténtalo de nuevo.',
  'store.error.signedOut': 'Vuelve a iniciar sesión para usar tus créditos.',
  'store.error.unavailable':
    'La tienda de escenas aún no está abierta. Inténtalo más tarde.',
  'store.error.server':
    'Algo falló de nuestro lado. No se gastó nada; inténtalo de nuevo en un momento.',
  'store.error.unconfirmed':
    'Primero confirma tu correo. El código está en tu bandeja de entrada.',
  'store.error.notOnSale': 'Ese paquete no está a la venta ahora. Elige otro.',
  'store.error.noCredits': 'Te quedaste sin créditos.',
  'store.error.alreadyOwned': 'Esta escena ya es tuya.',
  'store.error.gone': 'Esta escena ya no está en la galería.',
  'store.error.negative':
    'Un reembolso dejó tu saldo por debajo de cero. Un paquete lo recupera.',
  'store.error.banned': 'Esta cuenta no puede conseguir escenas.',
  'store.pack.each': '{price} por escena',
  'store.pack.best': 'Mejor precio',
  'store.buy.title': '¿Guardar {name} para siempre?',
  'store.buy.lead':
    'Pasa a ser tuya: en la gráfica, tu escritorio y tus luces, en cada computadora donde inicies sesión.',
  'store.buy.keep':
    'Tuya para siempre, con cada actualización que publique quien la hizo.',
  'store.buy.balance': 'Tienes {credits}. Después: {after}.',
  'store.buy.final':
    'Esto no se puede deshacer. El crédito se gasta en cuanto confirmes.',
  'store.buy.buying': 'Consiguiéndola…',
  'store.buy.use': 'Usar {credits}',
  'store.loading': 'Leyendo tus créditos…',
  'store.packs.title': 'Necesitas un crédito',
  'store.packs.lead':
    'Cada crédito guarda una escena para siempre. Consigue un paquete y {name} estará a un clic.',
  'store.packs.negative':
    'Un reembolso retiró créditos que ya habías usado, así que tu saldo es {credits}. Un paquete lo devuelve por encima de cero.',
  'store.packs.choose': 'Elige un paquete',
  'store.packs.waiting':
    'Termina de pagar en tu navegador. Tus créditos aparecen aquí en cuanto se confirma el pago.',
  'store.packs.fine':
    'Pago seguro con Stripe. Un solo pago; nada se renueva. Los créditos no tienen valor en dinero. Al pagar aceptas las condiciones de FluidEQ.',
  'store.packs.arrived': '{credits} en tu cuenta. ¡Gracias!',
  'store.packs.again': 'Abrir de nuevo la página de pago',
  'store.packs.pay': 'Pagar {price}',
  'store.packs.none': 'No hay paquetes a la venta ahora. Inténtalo más tarde.',
  'store.cancel': 'Cancelar',
  'store.done': 'Listo',
  'store.starter.title': '{credits} gratis para empezar',
  'store.starter.body': 'Una vez por cuenta, con un correo confirmado.',
  'store.starter.claim': 'Obtener {credits}',
  'store.get': 'Conseguir · {credits}',
  'store.scene.tasted':
    'Eso fue una muestra de {seconds} segundos. Consíguela para seguir viéndola, para siempre.',
  'store.scene.locked': 'Consíguela para verla aquí con tu música.',
  'store.scene.yours': 'Tuya para siempre',
  'store.scene.keep': 'Guárdala para siempre',
  'store.scene.fine':
    'Una escena que consigues es tuya para siempre, en tu cuenta. Nadie puede revenderla.',
  'store.official.fine':
    'Parte de la colección de FluidEQ: tuya para siempre en cuanto la consigas.',
  'store.like.ownersOnly':
    '{count} me gusta. Consigue la escena para darle me gusta.',
  'store.scene.free': 'Gratis para todos',
  'store.error.termsOutdated':
    'Las condiciones han cambiado. Actualiza FluidEQ para leer la nueva versión antes de comprar créditos.',
};

export default store;
