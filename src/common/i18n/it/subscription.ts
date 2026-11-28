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

  'subscription.rail.blurb': 'Tutte le scene, finché sei membro',
  'subscription.rail.get': 'Passa a Plus',
  'subscription.rail.member': 'Membro',

  'subscription.plan.monthly': 'Mensile',
  'subscription.plan.yearly': 'Annuale',
  'subscription.plan.perMonth': '{price} al mese',
  'subscription.plan.perYear': '{price} all’anno',
  'subscription.plan.both': '{monthly} al mese o {yearly} all’anno',
  'subscription.plan.cancelAnytime': 'Disdici quando vuoi.',
  'subscription.plan.monthlyEquivalent': 'Sono {price} al mese.',
  'subscription.plan.save': 'Risparmi il {percent}%',

  'subscription.page.lead':
    'Puoi usare tutte le scene di Scene, qui e in FluidWallpapers.',
  'subscription.page.new': 'Novità con Plus',

  'subscription.status.member': 'Membro',
  'subscription.status.renews': '{plan} · Si rinnova il {date}',
  'subscription.status.ends': '{plan} · Termina il {date}',
  'subscription.status.renewsNote':
    'Cambia piano o carta, o disdici, sulla pagina di Stripe.',
  'subscription.status.endsNote':
    'Quel giorno le scene che riproduce si fermano. Le scene ottenute con i crediti restano tue. Per tenere Plus, rinnovalo da Gestisci Plus.',
  'subscription.status.grace':
    'FluidEQ non è riuscito a verificare il tuo Plus con il server. Continua a funzionare fino al {date}.',
  'subscription.status.waiting':
    'In attesa che Stripe confermi il pagamento. Plus si attiva qui da solo.',
  'subscription.status.ended.title': 'Il tuo abbonamento Plus è terminato',
  'subscription.status.ended.body':
    'Le scene che riproduceva si sono fermate e i loro download sono stati rimossi da questo computer. Le scene ottenute con i crediti restano tue.',

  'subscription.ways.title': 'Plus o crediti?',
  'subscription.ways.credits.have': 'Crediti · ne hai {credits}',
  'subscription.ways.credits.body':
    'Ottieni una scena e tienila per sempre, anche dopo Plus.',
  'subscription.ways.credits.each': 'Una scena alla volta, {credits} ciascuna',
  'subscription.ways.credits.keep': 'Tua per sempre, anche senza Plus',
  'subscription.ways.plus.body':
    'Tutte le scene, finché sei membro. Aggiungi quelle che vuoi, senza crediti.',
  'subscription.ways.plus.every': 'Tutte le scene di Scene, anche le nuove',
  'subscription.ways.plus.while': 'Finché sei membro',

  'subscription.choice.credits.title': 'Crediti: una scena',
  'subscription.choice.credits.body': 'Tua per sempre. {credits} ciascuna.',
  'subscription.choice.or': 'o',
  'subscription.choice.plus.title': 'Plus: tutte le scene',
  'subscription.choice.plus.body': 'Finché sei membro. {price}.',
  'subscription.choice.hide': 'Nascondi',

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
};

export default subscription;
