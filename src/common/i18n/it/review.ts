/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.tab': 'Da approvare',
  'review.tabCount': 'In attesa di approvazione: {count}',
  'review.badge': 'In attesa di te: {count}',
  'review.hint':
    'Ogni scena che un membro pubblica, e ogni nuova versione di una scena, aspetta qui finché non la approvi. Nessun altro la vede fino ad allora.',
  'review.empty.title': 'Niente in attesa',
  'review.empty.hint':
    'Le nuove scene e le nuove versioni compaiono qui quando i membri le pubblicano.',
  'review.kind.new': 'Nuova scena',
  'review.kind.update': 'Aggiornamento · v{from} → v{to}',
  'review.sent': 'Inviata il {date}',
  'review.open': 'Esamina',
  'review.back': 'Tutto ciò che aspetta',
  'review.flag.takenDown': 'Ritirata dalla galleria',
  'review.flag.takenDownHint':
    'Ritirata dalla galleria: ripristinala da Segnalate per approvare una nuova versione',
  'review.flag.reports':
    'Segnalazioni aperte sulla versione pubblicata: {count}',
  'review.note.title': 'Cosa dice di nuovo il suo autore',
  'review.note.none': 'Il suo autore non ha scritto nulla su questa versione.',
  'review.sceneFailed': 'Impossibile aprire questa scena per guardarla.',
  'review.changed':
    'La scena è cambiata mentre guardavi: il suo autore ha inviato una versione più nuova o l’ha ritirata. L’elenco mostra ciò che attende ora.',
  'review.approve': 'Approva e pubblica',
  'review.approving': 'Approvazione…',
  'review.reject': 'Non approvare',
  'review.reject.title': 'Perché non viene approvata?',
  'review.reject.lead':
    'Il suo autore riceve il motivo, e la tua riga se ne scrivi una.',
  'review.reject.noteLabel': 'Una riga per il suo autore (facoltativa)',
  'review.reject.notePlaceholder':
    'Per esempio: il lampo bianco sul drop è troppo forte',
  'review.reject.cancel': 'Indietro',
  'review.reject.send': 'Invia la risposta',
  'review.reject.sending': 'Invio…',
  'review.reason.flashing': 'Lampi o effetto stroboscopico',
  'review.reason.rights': 'Opera di qualcun altro',
  'review.reason.offensive': 'Offensiva',
  'review.reason.broken': 'Non funziona o è troppo pesante',
  'review.reason.other': 'Altro',
  'review.done.approved': '{name} ora è nella galleria.',
  'review.done.rejected':
    '{name} non è stata approvata. Il suo autore saprà perché.',
  'review.failed': 'La risposta non è stata inviata. Riprova.',
  'review.versionRaised': 'La galleria ha già questa versione o una più nuova.',
  'review.takenDown':
    'Nel frattempo è stata ritirata, quindi non accetta nuove versioni. Ripristinala prima da Segnalate.',
  'review.deleted':
    'È stata eliminata per sempre, quindi non accetta nuove versioni.',
  'review.filesFailed':
    'Approvata, ma i suoi file non sono arrivati nella galleria. Premi di nuovo Approva e pubblica per completare.',
  'review.forbidden':
    'Solo l’amministratore di FluidEQ può approvare le scene.',
  'review.fine.new':
    'Approvarla la mette nella galleria alla versione {version}: chiunque abbia effettuato l’accesso la vede, e i membri Plus possono aggiungerla.',
  'review.fine.update':
    'Approvarla sostituisce la versione {version} per tutti quelli che hanno la scena. Non approvarla lascia la versione {version} com’è.',
  'review.state.pending': 'In revisione',
  'review.state.pendingUpdate': 'Versione {version} in revisione',
  'review.state.rejected': 'Non approvata',
  'review.state.rejectedUpdate': 'Versione {version} non approvata',
  'review.withdraw': 'Ritira',
  'review.withdrawConfirm': 'Ritirarla dalla revisione?',
  'review.remove': 'Rimuovi',
  'review.removeConfirm': 'Rimuoverla da questo elenco?',
  'review.withdrawn': '{name} è stata ritirata.',
  'review.notice.waitingOne': 'Una scena aspetta la tua approvazione',
  'review.notice.waitingMany': '{count} scene aspettano la tua approvazione',
  'review.notice.waitingWho': '{name}, di {maker}',
  'review.notice.waitingNewest': 'La più recente: {name}, di {maker}',
  'review.notice.later': 'Più tardi',
  'review.notice.review': 'Esamina ora',
  'review.notice.approved': '{name} è nella galleria',
  'review.notice.approvedBody':
    'È stata approvata. I membri Plus possono già aggiungerla.',
  'review.notice.approvedUpdate':
    'La versione {version} di {name} è nella galleria',
  'review.notice.approvedUpdateBody':
    'È stata approvata. Tutti quelli che hanno la scena ricevono la nuova versione.',
  'review.notice.rejected': '{name} non è stata approvata',
  'review.notice.rejectedUpdate':
    'La versione {version} di {name} non è stata approvata',
  'review.notice.keepsLive': 'Chi ce l’ha mantiene la versione {version}.',
  'review.notice.gotIt': 'Ho capito',
  'review.notice.openStudio': 'Apri lo Studio',
  'review.notice.openMine': 'Le tue scene',
} as const;

export default review;
