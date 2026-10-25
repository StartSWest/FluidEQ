/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const creator: Partial<Dictionary> = {
  'creator.title': 'Pagos a creadores',
  'creator.badge.active': 'Activo',
  'creator.badge.checking': 'En revisión',
  'creator.invite':
    'Publica escenas en la galería y cobra cuando los miembros las compren: el {share}% de cada venta, enviado a tu banco por Stripe.',
  'creator.unfinished':
    'Tu registro en Stripe no está terminado. Continúa donde lo dejaste.',
  'creator.newTerms':
    'Los términos para creadores han cambiado. Léelos y acéptalos para seguir cobrando.',
  'creator.checking':
    'Stripe está revisando tus datos. Suele tardar unos minutos, a veces unos días.',
  'creator.paidLine': '{sales} de tus escenas hasta ahora.',
  'creator.sales.one': '{count} venta',
  'creator.sales.few': '{count} ventas',
  'creator.sales.many': '{count} ventas',
  'creator.sales.other': '{count} ventas',
  'creator.ready': 'Listo para pagar',
  'creator.held': 'Retenido',
  'creator.paid': 'Pagado hasta ahora',
  'creator.paidHint':
    'Cada venta se retiene {days} días por si hay un reembolso. Los creadores cobran cada {every} días, cuando hay {amount} listos.',
  'creator.opened':
    'La página de Stripe está abierta en tu navegador. Termina allí; esta tarjeta se actualiza cuando vuelvas.',
  'creator.setUp': 'Configurar pagos',
  'creator.finish': 'Terminar la configuración',
  'creator.readTerms': 'Leer los nuevos términos',
  'creator.checkAgain': 'Comprobar de nuevo',
  'creator.dashboard': 'Panel de Stripe',
  'creator.dialog.title': 'Cobra por tus escenas',
  'creator.dialog.lead':
    'Stripe te paga y guarda tus datos de identidad, bancarios y fiscales. FluidEQ nunca los ve.',
  'creator.dialog.step1': 'Elige tu país y acepta los términos aquí.',
  'creator.dialog.step2': 'Regístrate en la página de Stripe en tu navegador.',
  'creator.dialog.step3': 'Vuelve a FluidEQ: tus ganancias se ven aquí.',
  'creator.dialog.country': 'País donde vives',
  'creator.dialog.search': 'Buscar países',
  'creator.dialog.choose': 'Elige un país',
  'creator.dialog.countryHint':
    'Stripe puede pagar a creadores en EE. UU., el Reino Unido, Canadá, Suiza y el Espacio Económico Europeo, y no se puede cambiar después. ¿No está en la lista? Los miembros pueden comprar tus escenas igualmente, y cada dos ventas te dan un crédito.',
  'creator.dialog.cancel': 'Cancelar',
  'creator.dialog.go': 'Aceptar y continuar a Stripe',
  'creator.dialog.opening': 'Abriendo Stripe…',
  'creator.terms.title': 'Términos para creadores',
  'creator.terms.share':
    'Recibes el {share}% de lo que deja cada venta de tus escenas después de las comisiones de Stripe. FluidEQ se queda el resto.',
  'creator.terms.paidCredits':
    'Solo las escenas compradas con créditos pagados generan dinero. Los créditos gratuitos, y las escenas propias de FluidEQ, no generan nada.',
  'creator.terms.hold':
    'Cada ganancia se retiene {days} días, para que un reembolso o una disputa aún puedan anularla. Si se anula después de pagarte, se descuenta de tu próximo pago.',
  'creator.terms.minimum':
    'FluidEQ paga a los creadores cada {every} días, cuando hay {amount} o más listos. Después Stripe lo envía a tu banco según tu propio calendario.',
  'creator.terms.stripe':
    'Stripe te pide tus datos de identidad, bancarios y fiscales y te muestra sus propios términos. Los pagos se detienen si Stripe ya no puede pagarte.',
  'creator.terms.rights':
    'Todo lo que hay en tus escenas debe ser tuyo para venderlo. Las escenas se siguen revisando, y una que incumpla las condiciones puede retirarse.',
  'creator.terms.taxes':
    'Los impuestos sobre lo que ganas te corresponde declararlos donde vives.',
  'creator.terms.changes':
    'Estos términos pueden cambiar. Se te avisa en la app y se te pide aceptar los nuevos antes de volver a cobrar.',
  'creator.error.signedOut':
    'Vuelve a iniciar sesión para gestionar tus pagos.',
  'creator.error.unconfirmed':
    'Primero confirma tu correo. El código está en tu bandeja de entrada.',
  'creator.error.offline':
    'No se pudo conectar con FluidEQ. Revisa tu conexión e inténtalo de nuevo.',
  'creator.error.unavailable':
    'Los pagos a creadores aún no están abiertos. Inténtalo más tarde.',
  'creator.error.agreementOutdated':
    'Los términos para creadores han cambiado. Vuelve a leerlos y acéptalos.',
  'creator.error.country': 'Stripe aún no puede pagar a creadores en ese país.',
  'creator.error.banned': 'Esta cuenta no puede cobrar por escenas.',
  'creator.error.server':
    'Algo salió mal por nuestra parte. No se cambió nada; inténtalo de nuevo en un momento.',
};

export default creator;
