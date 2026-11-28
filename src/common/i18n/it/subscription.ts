/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription: Partial<Dictionary> = {
  'subscription.name': 'Plus',
  'subscription.get': 'Passa a Plus',
  'subscription.getAgain': 'Riattiva Plus',
  'subscription.manage': 'Gestisci Plus',
  'subscription.included': 'Inclusa in Plus',

  'subscription.plan.monthly': 'Mensile',
  'subscription.plan.yearly': 'Annuale',
  'subscription.plan.perMonth': '{price} al mese',
  'subscription.plan.perYear': '{price} all’anno',
  'subscription.plan.both': '{monthly} al mese o {yearly} all’anno',
  'subscription.plan.cancelAnytime': 'Disdici quando vuoi.',
  'subscription.plan.monthlyEquivalent': 'Sono {price} al mese.',
  'subscription.plan.save': 'Risparmi il {percent}%',

  'subscription.status.grace':
    'FluidEQ non è riuscito a verificare il tuo Plus con il server. Continua a funzionare fino al {date}.',
  'subscription.status.waiting':
    'In attesa che Stripe confermi il pagamento. Plus si attiva qui da solo.',

  'subscription.ways.title': 'Plus o crediti?',
  'subscription.ways.credits.each': 'Una scena alla volta, {credits} ciascuna',
  'subscription.ways.credits.keep': 'Tua per sempre, anche senza Plus',
  'subscription.ways.plus.every': 'Tutte le scene di Scene, anche le nuove',
  'subscription.ways.plus.while': 'Finché sei membro',

  'subscription.scene.twoWays': 'Due modi per averla',
  'subscription.scene.keep.title': 'Tieni questa scena',
  'subscription.scene.keep.body':
    'Tua per sempre, con ogni aggiornamento. {credits}.',
  'subscription.scene.plus.title': 'Tutte le scene con Plus',
  'subscription.scene.plus.body':
    'Questa e tutte le altre, finché sei membro. {prices}.',
  'subscription.scene.member.note':
    'Si vede sul tuo grafico, sul desktop e sulle tue luci finché hai Plus.',
  'subscription.scene.member.keep':
    'La vuoi anche se Plus finisce? Tienila con un credito, tua per sempre.',
  'subscription.scene.member.keepButton': 'Tienila per sempre · {credits}',

  'subscription.lapse.title': 'Il tuo abbonamento Plus è terminato',
  'subscription.lapse.body':
    'Queste scene funzionavano con Plus e i loro download sono stati rimossi da questo computer. Ottienine una con un credito per tenerla per sempre, o riattiva Plus per averle tutte.',
  'subscription.lapse.more': 'altre {count}',
  'subscription.lapse.find': 'Cercala',
  'subscription.lapse.notNow': 'Non ora',

  'subscription.sheet.eyebrow': 'Scene',
  'subscription.sheet.description':
    'Tutte le scene di Scene, quelle di FluidEQ e quelle della community.',
  'subscription.sheet.heading': 'Tutte le scene, finché hai Plus',
  'subscription.sheet.lead':
    'Si vedono sul tuo grafico, sul desktop e sulle tue luci, qui e in FluidWallpapers, su ogni computer in cui accedi.',
  'subscription.sheet.choose': 'Come pagare',
  'subscription.sheet.renews':
    'Plus si rinnova finché non lo disdici. Disdici quando vuoi sulla pagina di Stripe.',
  'subscription.sheet.ends':
    'Quando Plus termina, le scene che riproduceva si fermano e i loro download vengono rimossi da questo computer.',
  'subscription.sheet.pay': 'Continua al pagamento · {price}',
  'subscription.sheet.again': 'Riapri la pagina di Stripe',
  'subscription.sheet.waiting':
    'Completa sulla pagina di Stripe nel browser. Plus si attiva qui da solo.',
  'subscription.sheet.fine':
    'Continuando registri il tuo consenso ai termini. Paghi sulla pagina di Stripe; FluidEQ non vede mai la tua carta.',
  'subscription.sheet.notNow': 'Non ora',
  'subscription.sheet.done.title': 'Plus è attivo',
  'subscription.sheet.done.body': 'Ora puoi usare tutte le scene di Scene.',
  'subscription.sheet.done.see': 'Vedi le scene',

  'subscription.error.termsChanged':
    'I termini sono stati aggiornati. Leggili, poi continua.',
  'subscription.error.needsEmail':
    'Conferma prima il tuo indirizzo email, poi riprova.',
  'subscription.error.needsUpdate': 'Aggiorna FluidEQ per passare a Plus.',
  'subscription.error.alreadySubscribed': 'Questo account ha già Plus.',
  'subscription.error.notOnSale': 'Plus non è in vendita al momento.',
  'subscription.error.banned': 'Questo account non può avere Plus al momento.',
  'subscription.error.signedOut': 'Accedi di nuovo per passare a Plus.',
  'subscription.error.failed':
    'Impossibile aprire la pagina di Stripe. Controlla la connessione e riprova.',

  'subscription.manage.opened': 'La pagina di Stripe si è aperta nel browser.',
  'subscription.manage.none':
    'Questo account non ha un abbonamento Plus da gestire.',
  'subscription.manage.signedOut': 'Accedi di nuovo per gestire Plus.',
  'subscription.manage.failed':
    'Impossibile aprire la pagina di Stripe. Controlla la connessione e riprova.',

  'subscription.cardGet': 'Ottieni',
  'subscription.makeScenes': 'Crea le tue scene in FluidWallpapers',
  'subscription.banner.title': 'Plus: tutte le scene della galleria',
  'subscription.banner.body':
    'Avviale e aggiungile tutte, anche le nuove. Un solo abbonamento per FluidEQ e FluidWallpapers.',
  'subscription.banner.credit':
    'Vuoi una scena anche senza Plus? Ottienila con un credito e resta tua per sempre.',
  'subscription.banner.or': 'o {price}',
  'subscription.line.renews':
    'Tutte le scene sono tue · si rinnova il {date} · anche in FluidWallpapers',
  'subscription.line.ends':
    'Tutte le scene sono tue fino al {date} · anche in FluidWallpapers',
  'subscription.line.plain':
    'Tutte le scene sono tue · anche in FluidWallpapers',
  'subscription.sheet.both':
    'Un solo abbonamento per FluidEQ e FluidWallpapers: preso in una delle due app, vale in entrambe.',
  'subscription.sheet.keepOne':
    'Oppure tieni solo {name} per sempre, anche senza Plus:',
};

export default subscription;
