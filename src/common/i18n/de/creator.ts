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
    'Stripe kann Creator in den USA, im Vereinigten Königreich, in Kanada, der Schweiz und dem Europäischen Wirtschaftsraum bezahlen, und das Land lässt sich später nicht ändern. Nicht in der Liste? Mitglieder können Ihre Szenen trotzdem kaufen, und je zwei Verkäufe bringen Ihnen stattdessen einen Credit.',
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
    'Alles in Ihren Szenen muss Ihnen gehören, damit Sie es verkaufen dürfen. Szenen werden weiterhin geprüft, und eine, die gegen die Bedingungen verstößt, kann entfernt werden.',
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
  'creator.admin.creators': 'Creator: {count}',
  'creator.admin.available': 'Verfügbar bei Stripe',
  'creator.admin.availableNote': 'woraus die Überweisungen kommen',
  'creator.admin.short':
    'Das verfügbare Guthaben von FluidEQ bei Stripe liegt unter dem fälligen Betrag. Überweisungen darüber hinaus scheitern und werden beim nächsten Lauf erneut gesendet.',
  'creator.admin.list': 'Wer bezahlt wird',
  'creator.admin.none':
    'Noch ist niemand fällig. Creator erscheinen hier, sobald Stripe sie bezahlen kann und genug ihrer Einnahmen die Haltefrist hinter sich hat.',
  'creator.admin.rules':
    'Auszahlungen gehen am 1. und 16. von selbst raus: zuerst an Creator, dann Ihr Anteil auf Ihr Konto. Jede Auszahlung wird einmal gesendet: Ein Lauf, der mittendrin stoppte, wird vom nächsten beendet, nie doppelt gesendet.',
  'creator.admin.lastPaid': 'Zuletzt ausgezahlt: {date}',
  'creator.admin.neverPaid': 'Noch keine Auszahlung',
  'creator.admin.nextDue': 'nächste automatische Auszahlung: {date}',
  'creator.notice.title': 'Creator-Auszahlung am {date}',
  'creator.notice.body':
    '{amount} gehen automatisch raus. Zu bezahlende Creator: {count}.',
  'creator.notice.later': 'Später',
  'creator.notice.open': 'Auszahlungen öffnen',
  'creator.notice.shortTitle':
    'Zu wenig Guthaben bei Stripe für die Auszahlung am {date}',
  'creator.notice.shortBody':
    'Fällig: {amount}. Zu bezahlende Creator: {count}. Stripe hält {available}; Überweisungen darüber hinaus scheitern und warten auf die nächste Auszahlung.',
  'creator.admin.owed': 'Creatorn geschuldet',
  'creator.admin.owedNote': 'zurückgehalten {held} · bereit {ready}',
  'creator.admin.sending': 'wird gesendet {amount}',
  'creator.admin.onItsWay': '+ {amount} unterwegs',
  'creator.admin.yours': 'Ihr Anteil',
  'creator.admin.yoursNote':
    'geht nach jedem Lauf von selbst auf Ihr Konto; {reserve} bleiben für Erstattungen',
  'creator.admin.lastToYou': 'zuletzt auf Ihr Konto: {amount}, {date}',
  'creator.admin.yoursShort':
    'Creatorn stehen {amount} mehr zu, als Stripe hält',
  'creator.admin.next': 'Nächste Auszahlung',
  'creator.admin.manual':
    'Stripe überweist noch Ihr ganzes Guthaben von selbst auf Ihr Konto, das Geld der Creator inklusive, deshalb hält FluidEQ Ihren Anteil zurück. Stellen Sie in Stripe unter Settings → Payouts den Zeitplan einmal auf Manual: Dann sendet FluidEQ nach jedem Lauf von selbst nur Ihren Anteil.',
  'creator.admin.pendingLine':
    'Von einem früheren Lauf unvollendete Auszahlungen: {count}. Der nächste Lauf schließt sie zuerst ab.',
};

export default creator;
