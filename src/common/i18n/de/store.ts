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
  'store.credits.what':
    'Jeder Credit behält eine Szene aus der Galerie für immer: im Diagramm, auf Ihrem Desktop und an Ihren Lichtern.',
  'store.credits.half':
    'Ein halber Credit wartet: Die nächste Ihrer Szenen, die jemand mit einem bezahlten Credit holt, macht ihn voll.',
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
  'store.notice.refundedBody':
    'Ein Kauf von {name} wurde erstattet; was Sie damit verdient haben, wurde abgezogen.',
  'store.notice.refunded': 'Ein Kauf wurde erstattet',
  'store.notice.restored': '{name} ist wieder in der Galerie.',
  'store.notice.blockScene':
    'Sie können sie {count} Tage lang nicht erneut veröffentlichen.',
  'store.notice.blockAccount':
    'Sie können {count} Tage lang nichts veröffentlichen.',
  'store.notice.takenDownBody':
    'Wir haben {name} aus der Galerie genommen, weil die Szene gegen die Regeln verstößt. Wer sie gekauft hat, hat seinen Credit zurückerhalten, und was Sie mit diesen Käufen verdient haben, wurde abgezogen.',
  'store.notice.takenDown': '{name} ist nicht mehr in der Galerie',
  'store.notice.returnedBody': 'Ihr Credit dafür wurde Ihnen zurückgegeben.',
  'store.notice.returned': 'Diese Szene ist nicht mehr verfügbar.',
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
  'store.welcome.title.one': 'Sie haben {count} Gratis-Credit',
  'store.welcome.title.few': 'Sie haben {count} Gratis-Credits',
  'store.welcome.title.many': 'Sie haben {count} Gratis-Credits',
  'store.welcome.title.other': 'Sie haben {count} Gratis-Credits',
  'store.welcome.claimedTitle.one': '{count} Credit gehört Ihnen',
  'store.welcome.claimedTitle.few': '{count} Credits gehören Ihnen',
  'store.welcome.claimedTitle.many': '{count} Credits gehören Ihnen',
  'store.welcome.claimedTitle.other': '{count} Credits gehören Ihnen',
  'store.welcome.cardTitle.one': '{count} Gratis-Credit wartet auf Sie',
  'store.welcome.cardTitle.few': '{count} Gratis-Credits warten auf Sie',
  'store.welcome.cardTitle.many': '{count} Gratis-Credits warten auf Sie',
  'store.welcome.cardTitle.other': '{count} Gratis-Credits warten auf Sie',
  'store.welcome.cardClaimedTitle.one': '{count} Credit bereit zum Ausgeben',
  'store.welcome.cardClaimedTitle.few': '{count} Credits bereit zum Ausgeben',
  'store.welcome.cardClaimedTitle.many': '{count} Credits bereit zum Ausgeben',
  'store.welcome.cardClaimedTitle.other': '{count} Credits bereit zum Ausgeben',
  'store.welcome.eyebrow': 'Willkommen bei FluidEQ',
  'store.welcome.body':
    'Jeder Credit bringt Ihnen eine Szene aus dem Tab „{visualizers}“, die Sie für immer behalten. Holen Sie sie jetzt ab und wählen Sie Ihre ersten Szenen.',
  'store.welcome.fine':
    'Einmal pro Konto. Jede Szene können Sie ein paar Sekunden ansehen, bevor Sie einen Credit ausgeben.',
  'store.welcome.later': 'Später',
  'store.welcome.claimedBody':
    'Wählen Sie Ihre ersten Szenen. „{notMine}“ ist an, also zeigt der Tab „{visualizers}“ nur Szenen, die Sie noch nicht haben.',
  'store.welcome.pick': 'Meine ersten Szenen wählen',
  'store.welcome.cardBody':
    'Holen Sie sie ab und wählen Sie Ihre ersten Szenen zum Behalten.',
  'store.welcome.cardClaimedBody':
    'Hier sehen Sie Szenen, die Sie noch nicht haben. Sehen Sie sich jede ein paar Sekunden an und holen Sie sie dann für einen Credit.',
  'store.welcome.gotIt': 'Verstanden',
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
  'store.error.termsOutdated':
    'Die Bedingungen haben sich geändert. Aktualisieren Sie FluidEQ, um die neue Fassung zu lesen, bevor Sie Credits kaufen.',
};

export default store;
