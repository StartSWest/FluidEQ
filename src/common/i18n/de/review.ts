/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.tab': 'Zu genehmigen',
  'review.tabCount': 'Warten auf Genehmigung: {count}',
  'review.badge': 'Warten auf Sie: {count}',
  'review.hint':
    'Jede Szene, die ein Mitglied veröffentlicht, und jede neue Version einer Szene wartet hier, bis Sie sie genehmigen. Bis dahin sieht sie niemand sonst.',
  'review.empty.title': 'Nichts wartet',
  'review.empty.hint':
    'Neue Szenen und neue Versionen erscheinen hier, wenn Mitglieder sie veröffentlichen.',
  'review.kind.new': 'Neue Szene',
  'review.kind.update': 'Update · v{from} → v{to}',
  'review.sent': 'Gesendet am {date}',
  'review.open': 'Prüfen',
  'review.back': 'Alles, was wartet',
  'review.flag.takenDown': 'Aus der Galerie entfernt',
  'review.flag.takenDownHint':
    'Aus der Galerie entfernt: Stellen Sie sie unter „Gemeldet“ wieder her, um eine neue Version zu genehmigen',
  'review.flag.reports':
    'Offene Meldungen zur veröffentlichten Version: {count}',
  'review.note.title': 'Was laut Urheber neu ist',
  'review.note.none': 'Der Urheber hat zu dieser Version nichts geschrieben.',
  'review.sceneFailed': 'Diese Szene konnte zum Ansehen nicht geöffnet werden.',
  'review.changed':
    'Die Szene hat sich geändert, während Sie sie angesehen haben: Der Urheber hat eine neuere Version gesendet oder sie zurückgezogen. Die Liste zeigt, was jetzt wartet.',
  'review.approve': 'Genehmigen und veröffentlichen',
  'review.approving': 'Wird genehmigt…',
  'review.reject': 'Nicht genehmigen',
  'review.reject.title': 'Warum wird sie nicht genehmigt?',
  'review.reject.lead':
    'Der Urheber erfährt den Grund und Ihre Zeile, falls Sie eine schreiben.',
  'review.reject.noteLabel': 'Eine Zeile an den Urheber (optional)',
  'review.reject.notePlaceholder':
    'Zum Beispiel: Der weiße Blitz beim Drop ist zu stark',
  'review.reject.cancel': 'Zurück',
  'review.reject.send': 'Antwort senden',
  'review.reject.sending': 'Wird gesendet…',
  'review.reason.flashing': 'Blitze oder Stroboskop',
  'review.reason.rights': 'Werk einer anderen Person',
  'review.reason.offensive': 'Anstößig',
  'review.reason.broken': 'Defekt oder zu aufwendig',
  'review.reason.other': 'Etwas anderes',
  'review.done.approved': '{name} ist jetzt in der Galerie.',
  'review.done.rejected':
    '{name} wurde nicht genehmigt. Der Urheber erfährt, warum.',
  'review.failed': 'Die Antwort ist nicht angekommen. Bitte erneut versuchen.',
  'review.versionRaised':
    'Die Galerie hat diese oder eine neuere Version bereits.',
  'review.takenDown':
    'Sie wurde inzwischen entfernt und nimmt daher keine neue Version an. Stellen Sie sie zuerst unter „Gemeldet“ wieder her.',
  'review.deleted':
    'Sie wurde endgültig gelöscht und nimmt daher keine neue Version an.',
  'review.filesFailed':
    'Genehmigt, aber die Dateien haben die Galerie nicht erreicht. Klicken Sie noch einmal auf „Genehmigen und veröffentlichen“, um es abzuschließen.',
  'review.forbidden': 'Nur der FluidEQ-Admin kann Szenen genehmigen.',
  'review.fine.new':
    'Genehmigen stellt sie als Version {version} in die Galerie: Alle Angemeldeten sehen sie, und Plus-Mitglieder können sie hinzufügen.',
  'review.fine.update':
    'Genehmigen ersetzt Version {version} für alle, die die Szene haben. Ohne Genehmigung bleibt Version {version}, wie sie ist.',
  'review.state.pending': 'In Prüfung',
  'review.state.pendingUpdate': 'Version {version} in Prüfung',
  'review.state.rejected': 'Nicht genehmigt',
  'review.state.rejectedUpdate': 'Version {version} nicht genehmigt',
  'review.withdraw': 'Zurückziehen',
  'review.withdrawConfirm': 'Aus der Prüfung zurückziehen?',
  'review.remove': 'Entfernen',
  'review.removeConfirm': 'Aus dieser Liste entfernen?',
  'review.withdrawn': '{name} wurde zurückgezogen.',
  'review.notice.waitingOne': 'Eine Szene wartet auf Ihre Genehmigung',
  'review.notice.waitingMany': '{count} Szenen warten auf Ihre Genehmigung',
  'review.notice.waitingWho': '{name} von {maker}',
  'review.notice.waitingNewest': 'Neueste: {name} von {maker}',
  'review.notice.later': 'Später',
  'review.notice.review': 'Jetzt prüfen',
  'review.notice.approved': '{name} ist in der Galerie',
  'review.notice.approvedBody':
    'Sie wurde genehmigt. Plus-Mitglieder können sie jetzt hinzufügen.',
  'review.notice.approvedUpdate':
    'Version {version} von {name} ist in der Galerie',
  'review.notice.approvedUpdateBody':
    'Sie wurde genehmigt. Alle, die die Szene haben, erhalten die neue Version.',
  'review.notice.rejected': '{name} wurde nicht genehmigt',
  'review.notice.rejectedUpdate':
    'Version {version} von {name} wurde nicht genehmigt',
  'review.notice.keepsLive': 'Wer sie hat, behält Version {version}.',
  'review.notice.gotIt': 'Verstanden',
  'review.notice.openStudio': 'Studio öffnen',
  'review.notice.openMine': 'Ihre Szenen',
} as const;

export default review;
