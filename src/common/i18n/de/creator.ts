/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const creator: Partial<Dictionary> = {
  'creator.title': 'Auszahlungen für Creator',
  'creator.badge.active': 'Aktiv',
  'creator.badge.checking': 'Wird geprüft',
  'creator.invite':
    'Veröffentlichen Sie Szenen in der Galerie und werden Sie bezahlt, wenn Mitglieder sie kaufen: {share} % jedes Verkaufs, von Stripe auf Ihr Bankkonto überwiesen.',
  'creator.unfinished':
    'Ihre Anmeldung bei Stripe ist noch nicht abgeschlossen. Machen Sie dort weiter, wo Sie aufgehört haben.',
  'creator.newTerms':
    'Die Bedingungen für Creator haben sich geändert. Lesen und akzeptieren Sie sie, um weiter bezahlt zu werden.',
  'creator.checking':
    'Stripe prüft Ihre Angaben. Das dauert meist ein paar Minuten, manchmal ein paar Tage.',
  'creator.paidLine': 'Bisher {sales} Ihrer Szenen.',
  'creator.sales.one': '{count} Verkauf',
  'creator.sales.few': '{count} Verkäufe',
  'creator.sales.many': '{count} Verkäufe',
  'creator.sales.other': '{count} Verkäufe',
  'creator.ready': 'Zur Auszahlung bereit',
  'creator.held': 'Zurückgehalten',
  'creator.paid': 'Bisher ausgezahlt',
  'creator.paidHint':
    'Jeder Verkauf wird für den Fall einer Erstattung {days} Tage zurückgehalten. Creator werden alle {every} Tage bezahlt, sobald {amount} bereitstehen.',
  'creator.opened':
    'Die Seite von Stripe ist in Ihrem Browser geöffnet. Schließen Sie dort ab; diese Karte aktualisiert sich, wenn Sie zurückkommen.',
  'creator.setUp': 'Auszahlungen einrichten',
  'creator.finish': 'Einrichtung abschließen',
  'creator.readTerms': 'Neue Bedingungen lesen',
  'creator.checkAgain': 'Erneut prüfen',
  'creator.dashboard': 'Stripe-Dashboard',
  'creator.dialog.title': 'Für Ihre Szenen bezahlt werden',
  'creator.dialog.lead':
    'Stripe bezahlt Sie und verwahrt Ihre Identitäts-, Bank- und Steuerdaten. FluidEQ sieht sie nie.',
  'creator.dialog.step1':
    'Wählen Sie hier Ihr Land und akzeptieren Sie die Bedingungen.',
  'creator.dialog.step2':
    'Melden Sie sich im Browser auf der Seite von Stripe an.',
  'creator.dialog.step3':
    'Kehren Sie zu FluidEQ zurück: Ihre Einnahmen erscheinen hier.',
  'creator.dialog.country': 'Land, in dem Sie leben',
  'creator.dialog.search': 'Länder suchen',
  'creator.dialog.choose': 'Land wählen',
  'creator.dialog.countryHint':
    'Stripe kann Creator in den USA, im Vereinigten Königreich, in Kanada, der Schweiz und dem Europäischen Wirtschaftsraum bezahlen, und das Land lässt sich später nicht ändern. Nicht in der Liste? Mitglieder können Ihre Szenen trotzdem kaufen, und jeder Verkauf bringt Ihnen stattdessen ein Guthaben.',
  'creator.dialog.cancel': 'Abbrechen',
  'creator.dialog.go': 'Zustimmen und weiter zu Stripe',
  'creator.dialog.opening': 'Stripe wird geöffnet…',
  'creator.terms.title': 'Bedingungen für Creator',
  'creator.terms.share':
    'Sie erhalten {share} % dessen, was jeder Verkauf Ihrer Szenen nach den Gebühren von Stripe einbringt. FluidEQ behält den Rest.',
  'creator.terms.paidCredits':
    'Nur Szenen, die mit bezahlten Guthaben gekauft werden, bringen Geld. Kostenlose Guthaben und FluidEQs eigene Szenen bringen nichts.',
  'creator.terms.hold':
    'Jeder Verdienst wird {days} Tage zurückgehalten, damit eine Erstattung oder ein Einspruch ihn noch rückgängig machen kann. Wird er nach der Auszahlung rückgängig gemacht, wird er von Ihrer nächsten Auszahlung abgezogen.',
  'creator.terms.minimum':
    'FluidEQ bezahlt Creator alle {every} Tage, sobald {amount} oder mehr bereitstehen. Stripe überweist es dann nach Ihrem eigenen Zeitplan auf Ihr Bankkonto.',
  'creator.terms.stripe':
    'Stripe fragt nach Ihren Identitäts-, Bank- und Steuerdaten und zeigt Ihnen seine eigenen Bedingungen. Auszahlungen enden, wenn Stripe Sie nicht mehr bezahlen kann.',
  'creator.terms.rights':
    'Alles in Ihren Szenen muss Ihnen gehören, damit Sie es verkaufen dürfen. Szenen werden weiterhin geprüft, und eine, die gegen die Plus-Bedingungen verstößt, kann entfernt werden.',
  'creator.terms.taxes':
    'Steuern auf Ihre Einnahmen müssen Sie dort angeben, wo Sie leben.',
  'creator.terms.changes':
    'Diese Bedingungen können sich ändern. Sie werden in der App informiert und gebeten, neue zu akzeptieren, bevor Sie wieder bezahlt werden.',
  'creator.error.signedOut':
    'Melden Sie sich erneut an, um Ihre Auszahlungen zu verwalten.',
  'creator.error.unconfirmed':
    'Bestätigen Sie zuerst Ihre E-Mail-Adresse. Der Code ist in Ihrem Posteingang.',
  'creator.error.offline':
    'FluidEQ ist nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
  'creator.error.unavailable':
    'Auszahlungen für Creator sind noch nicht freigeschaltet. Versuchen Sie es später erneut.',
  'creator.error.agreementOutdated':
    'Die Bedingungen für Creator haben sich geändert. Lesen Sie sie erneut und stimmen Sie zu.',
  'creator.error.country':
    'Stripe kann Creator in diesem Land noch nicht bezahlen.',
  'creator.error.banned': 'Dieses Konto kann nicht für Szenen bezahlt werden.',
  'creator.error.server':
    'Bei uns ist etwas schiefgelaufen. Nichts wurde geändert; versuchen Sie es gleich noch einmal.',
  'creator.admin.tab': 'Auszahlungen',
  'creator.admin.plan': 'Über Stripe bezahlte Creator',
  'creator.admin.loading': 'Ermittle, was Creatorn zusteht',
  'creator.admin.due': 'Jetzt fällig',
  'creator.admin.creators': 'Creator: {count}',
  'creator.admin.available': 'Verfügbar bei Stripe',
  'creator.admin.availableNote': 'woraus die Überweisungen kommen',
  'creator.admin.pending': 'Unvollendet',
  'creator.admin.pendingNote': 'vom nächsten Lauf zuerst abgeschlossen',
  'creator.admin.short':
    'Das verfügbare Guthaben von FluidEQ bei Stripe liegt unter dem fälligen Betrag. Überweisungen darüber hinaus scheitern und warten auf den nächsten Lauf; zahlen Sie, sobald sich das Guthaben gesetzt hat.',
  'creator.admin.list': 'Wer bezahlt wird',
  'creator.admin.none':
    'Noch ist niemand fällig. Creator erscheinen hier, sobald Stripe sie bezahlen kann und genug ihrer Einnahmen die Haltefrist hinter sich hat.',
  'creator.admin.payLead':
    'Alle in der Liste bezahlen: insgesamt {amount}, über Stripe.',
  'creator.admin.confirm':
    '{amount} jetzt senden? Das bewegt echtes Geld aus dem Stripe-Guthaben von FluidEQ und lässt sich nicht rückgängig machen.',
  'creator.admin.pay': 'Creator bezahlen',
  'creator.admin.payNow': 'Ja, jetzt zahlen',
  'creator.admin.paying': 'Wird bezahlt…',
  'creator.admin.ran': 'Bezahlt: {paid}. Nicht bezahlt: {failed}.',
  'creator.admin.rules':
    'Jede Auszahlung wird nur einmal gesendet: Ein abgebrochener Lauf wird vom nächsten abgeschlossen, nie erneut gesendet. Creator legen in ihrem eigenen Stripe-Dashboard fest, wann Stripe sie aufs Bankkonto überweist.',
  'creator.admin.lastPaid': 'Zuletzt ausgezahlt: {date}',
  'creator.admin.neverPaid': 'Noch keine Auszahlung',
  'creator.admin.nextDue': 'nächste: {date}',
  'creator.admin.dueNow': 'eine Auszahlung ist jetzt fällig',
  'creator.notice.title': 'Creator warten auf ihre Auszahlung',
  'creator.notice.body':
    '{amount} stehen zur Auszahlung bereit. Zu bezahlende Creator: {count}. Auszahlungen gehen alle {every} Tage raus.',
  'creator.notice.later': 'Später',
  'creator.notice.open': 'Auszahlungen öffnen',
};

export default creator;
