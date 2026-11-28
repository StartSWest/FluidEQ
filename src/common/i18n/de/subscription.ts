/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription: Partial<Dictionary> = {
  'subscription.name': 'Plus',
  'subscription.get': 'Plus holen',
  'subscription.getAgain': 'Plus wieder holen',
  'subscription.manage': 'Plus verwalten',
  'subscription.included': 'In Plus enthalten',

  'subscription.rail.blurb': 'Alle Szenen, solange Sie Mitglied sind',
  'subscription.rail.get': 'Plus holen',
  'subscription.rail.member': 'Mitglied',

  'subscription.plan.monthly': 'Monatlich',
  'subscription.plan.yearly': 'Jährlich',
  'subscription.plan.perMonth': '{price} pro Monat',
  'subscription.plan.perYear': '{price} pro Jahr',
  'subscription.plan.both': '{monthly} pro Monat oder {yearly} pro Jahr',
  'subscription.plan.cancelAnytime': 'Jederzeit kündbar.',
  'subscription.plan.monthlyEquivalent': 'Das sind {price} pro Monat.',
  'subscription.plan.save': '{percent} % sparen',

  'subscription.page.lead':
    'Alle Szenen in Szenen laufen für Sie, hier und in FluidWallpapers.',
  'subscription.page.new': 'Neu mit Plus',

  'subscription.status.member': 'Mitglied',
  'subscription.status.renews': '{plan} · Verlängert sich am {date}',
  'subscription.status.ends': '{plan} · Endet am {date}',
  'subscription.status.renewsNote':
    'Tarif oder Karte ändern oder kündigen: auf der Seite von Stripe.',
  'subscription.status.endsNote':
    'An diesem Tag stoppen die Szenen, die es abspielt. Szenen, die Sie mit Credits geholt haben, bleiben Ihre. Um Plus zu behalten, verlängern Sie es unter Plus verwalten.',
  'subscription.status.grace':
    'FluidEQ konnte Ihr Plus nicht beim Server prüfen. Es läuft weiter bis zum {date}.',
  'subscription.status.waiting':
    'Warten auf die Zahlungsbestätigung von Stripe. Plus schaltet sich hier von selbst ein.',
  'subscription.status.ended.title': 'Ihre Plus-Mitgliedschaft ist beendet',
  'subscription.status.ended.body':
    'Die Szenen, die sie abgespielt hat, sind gestoppt, und ihre Downloads wurden von diesem Computer entfernt. Szenen, die Sie mit Credits geholt haben, bleiben Ihre.',

  'subscription.ways.title': 'Plus oder Credits?',
  'subscription.ways.credits.have': 'Credits · Sie haben {credits}',
  'subscription.ways.credits.body':
    'Holen Sie eine Szene und behalten Sie sie für immer, auch nach Plus.',
  'subscription.ways.credits.each': 'Eine Szene nach der anderen, je {credits}',
  'subscription.ways.credits.keep': 'Für immer Ihre, auch ohne Plus',
  'subscription.ways.plus.body':
    'Alle Szenen, solange Sie Mitglied sind. Fügen Sie jede hinzu, ohne Credits.',
  'subscription.ways.plus.every': 'Alle Szenen in Szenen, auch die neuen',
  'subscription.ways.plus.while': 'Solange Sie Mitglied sind',

  'subscription.choice.credits.title': 'Credits: eine Szene',
  'subscription.choice.credits.body': 'Für immer Ihre. Je {credits}.',
  'subscription.choice.or': 'oder',
  'subscription.choice.plus.title': 'Plus: alle Szenen',
  'subscription.choice.plus.body': 'Solange Sie Mitglied sind. {price}.',
  'subscription.choice.hide': 'Ausblenden',

  'subscription.scene.twoWays': 'Zwei Wege, sie zu haben',
  'subscription.scene.keep.title': 'Diese Szene behalten',
  'subscription.scene.keep.body':
    'Für immer Ihre, mit jedem Update. {credits}.',
  'subscription.scene.plus.title': 'Alle Szenen mit Plus',
  'subscription.scene.plus.body':
    'Diese und alle anderen, solange Sie Mitglied sind. {prices}.',
  'subscription.scene.member.note':
    'Läuft auf Ihrem Graphen, Ihrem Desktop und Ihren Lichtern, solange Sie Plus haben.',
  'subscription.scene.member.keep':
    'Sie wollen sie auch nach dem Ende von Plus? Behalten Sie sie mit einem Credit, für immer Ihre.',
  'subscription.scene.member.keepButton': 'Für immer behalten · {credits}',

  'subscription.lapse.title': 'Ihre Plus-Mitgliedschaft ist beendet',
  'subscription.lapse.body':
    'Diese Szenen liefen mit Plus, und ihre Downloads wurden von diesem Computer entfernt. Holen Sie eine mit einem Credit, um sie für immer zu behalten, oder holen Sie Plus wieder für alle Szenen.',
  'subscription.lapse.more': '+{count} weitere',
  'subscription.lapse.find': 'Suchen',
  'subscription.lapse.notNow': 'Nicht jetzt',

  'subscription.sheet.eyebrow': 'Szenen',
  'subscription.sheet.description':
    'Alle Szenen in Szenen, die von FluidEQ und die der Community.',
  'subscription.sheet.heading': 'Alle Szenen, solange Sie Plus haben',
  'subscription.sheet.lead':
    'Sie laufen auf Ihrem Graphen, Ihrem Desktop und Ihren Lichtern, hier und in FluidWallpapers, auf jedem Computer, an dem Sie sich anmelden.',
  'subscription.sheet.choose': 'Zahlweise',
  'subscription.sheet.renews':
    'Plus verlängert sich, bis Sie kündigen. Kündigen Sie jederzeit auf der Seite von Stripe.',
  'subscription.sheet.ends':
    'Wenn Plus endet, stoppen die Szenen, die es abgespielt hat, und ihre Downloads werden von diesem Computer entfernt.',
  'subscription.sheet.pay': 'Weiter zur Zahlung · {price}',
  'subscription.sheet.again': 'Seite von Stripe erneut öffnen',
  'subscription.sheet.waiting':
    'Schließen Sie den Vorgang auf der Seite von Stripe in Ihrem Browser ab. Plus schaltet sich hier von selbst ein.',
  'subscription.sheet.fine':
    'Mit dem Fortfahren wird Ihre Zustimmung zu den Bedingungen gespeichert. Sie zahlen auf der Seite von Stripe; FluidEQ sieht Ihre Karte nie.',
  'subscription.sheet.notNow': 'Nicht jetzt',
  'subscription.sheet.done.title': 'Plus ist aktiv',
  'subscription.sheet.done.body': 'Alle Szenen in Szenen laufen jetzt für Sie.',
  'subscription.sheet.done.see': 'Szenen ansehen',

  'subscription.error.termsChanged':
    'Die Bedingungen wurden aktualisiert. Lesen Sie sie und fahren Sie dann fort.',
  'subscription.error.needsEmail':
    'Bestätigen Sie zuerst Ihre E-Mail-Adresse und versuchen Sie es dann erneut.',
  'subscription.error.needsUpdate':
    'Aktualisieren Sie FluidEQ, um Plus zu holen.',
  'subscription.error.alreadySubscribed': 'Dieses Konto hat Plus bereits.',
  'subscription.error.notOnSale': 'Plus ist gerade nicht erhältlich.',
  'subscription.error.banned': 'Dieses Konto kann Plus gerade nicht haben.',
  'subscription.error.signedOut':
    'Melden Sie sich erneut an, um Plus zu holen.',
  'subscription.error.failed':
    'Die Seite von Stripe konnte nicht geöffnet werden. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',

  'subscription.manage.opened':
    'Die Seite von Stripe wurde in Ihrem Browser geöffnet.',
  'subscription.manage.none':
    'Dieses Konto hat keine Plus-Mitgliedschaft zu verwalten.',
  'subscription.manage.signedOut':
    'Melden Sie sich erneut an, um Plus zu verwalten.',
  'subscription.manage.failed':
    'Die Seite von Stripe konnte nicht geöffnet werden. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
};

export default subscription;
