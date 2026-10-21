/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const store: Partial<Dictionary> = {
  'store.credit.one': '{count} Credit',
  'store.credit.few': '{count} Credits',
  'store.credit.many': '{count} Credits',
  'store.credit.other': '{count} Credits',
  'store.credits.unit.one': 'Credit',
  'store.credits.unit.few': 'Credits',
  'store.credits.unit.many': 'Credits',
  'store.credits.unit.other': 'Credits',
  'store.credits.title': 'Credits',
  'store.credits.buyTitle': 'Credits holen',
  'store.credits.lead':
    'Ein Credit behält eine Szene für immer. Sie zahlen einmal, nichts verlängert sich.',
  'store.credits.owned': 'Ihre Szenen: {count}',
  'store.credits.what':
    'Jeder Credit behält eine Szene aus der Galerie für immer: im Diagramm, auf Ihrem Desktop und an Ihren Lichtern.',
  'store.credits.buy': 'Credits holen',
  'store.credits.getFree': 'Gratis-Credits holen',
  'store.error.offline':
    'FluidEQ war nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
  'store.error.signedOut':
    'Melden Sie sich erneut an, um Ihre Credits zu nutzen.',
  'store.error.unavailable':
    'Der Szenen-Shop ist noch nicht geöffnet. Versuchen Sie es später erneut.',
  'store.error.server':
    'Bei uns ist etwas schiefgelaufen. Es wurde nichts ausgegeben; versuchen Sie es gleich noch einmal.',
  'store.error.unconfirmed':
    'Bestätigen Sie zuerst Ihre E-Mail-Adresse. Der Code ist in Ihrem Posteingang.',
  'store.error.notOnSale':
    'Dieses Paket ist gerade nicht erhältlich. Wählen Sie ein anderes.',
  'store.error.noCredits': 'Sie haben keine Credits mehr.',
  'store.error.alreadyOwned': 'Diese Szene gehört Ihnen bereits.',
  'store.error.gone': 'Diese Szene ist nicht mehr in der Galerie.',
  'store.error.negative':
    'Eine Erstattung hat Ihr Guthaben unter null gebracht. Ein Paket gleicht es aus.',
  'store.error.banned': 'Dieses Konto kann keine Szenen erhalten.',
  'store.pack.each': '{price} pro Szene',
  'store.pack.best': 'Bester Preis',
  'store.buy.title': '{name} für immer behalten?',
  'store.buy.lead':
    'Sie gehört dann Ihnen: im Diagramm, auf Ihrem Desktop und an Ihren Lichtern, auf jedem Computer, an dem Sie sich anmelden.',
  'store.buy.keep':
    'Für immer Ihre, mit jedem Update, das ihr Ersteller veröffentlicht.',
  'store.buy.balance': 'Sie haben {credits}. Danach: {after}.',
  'store.buy.final':
    'Das lässt sich nicht rückgängig machen. Der Credit wird ausgegeben, sobald Sie bestätigen.',
  'store.buy.buying': 'Wird geholt…',
  'store.buy.use': '{credits} verwenden',
  'store.loading': 'Ihre Credits werden gelesen…',
  'store.packs.title': 'Sie brauchen einen Credit',
  'store.packs.lead':
    'Jeder Credit behält eine Szene für immer. Holen Sie ein Paket, und {name} ist einen Klick entfernt.',
  'store.packs.negative':
    'Eine Erstattung hat bereits genutzte Credits zurückgenommen, Ihr Guthaben beträgt daher {credits}. Ein Paket bringt es wieder über null.',
  'store.packs.choose': 'Paket wählen',
  'store.packs.waiting':
    'Schließen Sie die Zahlung im Browser ab. Ihre Credits erscheinen hier, sobald die Zahlung durch ist.',
  'store.packs.fine':
    'Sicher bezahlt über Stripe. Eine Zahlung; nichts verlängert sich. Credits haben keinen Geldwert. Mit der Zahlung stimmen Sie den Bedingungen von FluidEQ zu.',
  'store.packs.arrived': '{credits} auf Ihrem Konto. Vielen Dank!',
  'store.packs.again': 'Zahlungsseite erneut öffnen',
  'store.packs.pay': '{price} bezahlen',
  'store.packs.none':
    'Gerade sind keine Pakete erhältlich. Versuchen Sie es später erneut.',
  'store.cancel': 'Abbrechen',
  'store.done': 'Fertig',
  'store.starter.title': '{credits} gratis zum Start',
  'store.starter.body': 'Einmal pro Konto, für eine bestätigte E-Mail-Adresse.',
  'store.starter.claim': '{credits} holen',
  'store.get': 'Holen · {credits}',
  'store.scene.tasted':
    'Das war eine Kostprobe von {seconds} Sekunden. Holen Sie sie, um weiterzuschauen – für immer.',
  'store.scene.locked':
    'Holen Sie sie, um sie hier zu Ihrer Musik laufen zu sehen.',
  'store.scene.yours': 'Für immer Ihre',
  'store.scene.keep': 'Für immer behalten',
  'store.scene.fine':
    'Eine Szene, die Sie holen, gehört für immer Ihnen, in Ihrem Konto. Niemand darf sie weiterverkaufen.',
  'store.official.fine':
    'Teil der FluidEQ-Sammlung: für immer Ihre, sobald Sie sie holen.',
  'store.like.ownersOnly':
    '{count} „Gefällt mir“. Holen Sie die Szene, um sie zu markieren.',
  'store.scene.free': 'Für alle kostenlos',
  'store.admin.freeTitle': 'Für alle kostenlos',
  'store.admin.freeOn':
    'Jedes angemeldete Konto nutzt sie, ohne einen Credit auszugeben.',
  'store.admin.freeOff':
    'Ein Credit, wie jede andere Szene. Schalten Sie es ein, um sie allen zu geben.',
  'store.error.termsOutdated':
    'Die Bedingungen haben sich geändert. Aktualisieren Sie FluidEQ, um die neue Fassung zu lesen, bevor Sie Credits kaufen.',
};

export default store;
