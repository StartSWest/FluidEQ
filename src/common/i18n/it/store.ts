/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const store: Partial<Dictionary> = {
  'store.credit.one': '{count} credito',
  'store.credit.few': '{count} crediti',
  'store.credit.many': '{count} crediti',
  'store.credit.other': '{count} crediti',
  'store.credits.unit.one': 'credito',
  'store.credits.unit.few': 'crediti',
  'store.credits.unit.many': 'crediti',
  'store.credits.unit.other': 'crediti',
  'store.credits.title': 'Crediti',
  'store.credits.buyTitle': 'Ottieni crediti',
  'store.credits.lead':
    'Un credito tiene una scena per sempre. Paghi una volta e nulla si rinnova.',
  'store.credits.what':
    'Ogni credito tiene per sempre una scena della galleria: sul grafico, sul desktop e sulle tue luci.',
  'store.credits.half':
    'Hai mezzo credito in attesa: la prossima tua scena ottenuta con un credito pagato lo completa.',
  'store.credits.buy': 'Ottieni altri crediti',
  'store.credits.getFree': 'Ricevi crediti gratuiti',
  'store.error.offline':
    'Impossibile raggiungere FluidEQ. Controlla la connessione e riprova.',
  'store.error.signedOut': 'Accedi di nuovo per usare i tuoi crediti.',
  'store.error.unavailable':
    'Il negozio di scene non è ancora aperto. Riprova più tardi.',
  'store.error.server':
    'Qualcosa è andato storto da parte nostra. Non è stato speso nulla; riprova tra poco.',
  'store.error.unconfirmed':
    'Prima conferma il tuo indirizzo email. Il codice è nella tua casella di posta.',
  'store.error.notOnSale':
    'Quel pacchetto non è in vendita ora. Scegline un altro.',
  'store.error.noCredits': 'Hai finito i crediti.',
  'store.error.alreadyOwned': 'Questa scena è già tua.',
  'store.error.gone': 'Questa scena non è più nella galleria.',
  'store.error.negative':
    'Un rimborso ha portato il tuo saldo sotto zero. Un pacchetto lo ripristina.',
  'store.error.banned': 'Questo account non può ottenere scene.',
  'store.notice.refundedBody':
    'Un acquisto di {name} è stato rimborsato; ciò che avevi guadagnato con esso ti è stato detratto.',
  'store.notice.refunded': 'Un acquisto è stato rimborsato',
  'store.notice.restored': '{name} è di nuovo nella galleria.',
  'store.notice.blockScene': 'Non potrai ripubblicarla per {count} giorni.',
  'store.notice.blockAccount': 'Non potrai pubblicare per {count} giorni.',
  'store.notice.takenDownBody':
    'Abbiamo tolto {name} dalla galleria perché viola le regole. Chi l’ha acquistata ha riavuto il credito, e ciò che hai guadagnato con quegli acquisti ti è stato detratto.',
  'store.notice.takenDown': '{name} è uscita dalla galleria',
  'store.notice.returnedBody':
    'Il credito che avevi speso ti è stato restituito.',
  'store.notice.returned': 'Questa scena non è più disponibile.',
  'store.pack.each': '{price} a scena',
  'store.pack.best': 'Prezzo migliore',
  'store.buy.title': 'Tenere {name} per sempre?',
  'store.buy.lead':
    'Diventa tua: sul grafico, sul desktop e sulle tue luci, su ogni computer in cui accedi.',
  'store.buy.keep':
    'Tua per sempre, con ogni aggiornamento che il suo autore pubblica.',
  'store.buy.balance': 'Hai {credits}. Dopo: {after}.',
  'store.buy.final':
    'Non si può annullare. Il credito viene speso appena confermi.',
  'store.buy.buying': 'Ottenimento…',
  'store.buy.use': 'Usa {credits}',
  'store.loading': 'Lettura dei tuoi crediti…',
  'store.packs.title': 'Ti serve un credito',
  'store.packs.lead':
    'Ogni credito tiene una scena per sempre. Prendi un pacchetto e {name} è a un clic.',
  'store.packs.negative':
    'Un rimborso ha ripreso crediti che avevi già usato, quindi il tuo saldo è {credits}. Un pacchetto lo riporta sopra zero.',
  'store.packs.choose': 'Scegli un pacchetto',
  'store.packs.waiting':
    'Completa il pagamento nel browser. I tuoi crediti compaiono qui appena il pagamento va a buon fine.',
  'store.packs.fine':
    'Pagamento sicuro tramite Stripe. Un solo pagamento; nulla si rinnova. I crediti non hanno valore in denaro. Pagando accetti le condizioni di FluidEQ.',
  'store.packs.arrived': '{credits} sul tuo account. Grazie!',
  'store.packs.again': 'Riapri la pagina di pagamento',
  'store.packs.pay': 'Paga {price}',
  'store.packs.none': 'Nessun pacchetto è in vendita ora. Riprova più tardi.',
  'store.cancel': 'Annulla',
  'store.done': 'Fatto',
  'store.starter.title': '{credits} gratis per iniziare',
  'store.starter.body':
    'Una volta per account, con un indirizzo email confermato.',
  'store.starter.claim': 'Ricevi {credits}',
  'store.welcome.title.one': 'Hai {count} credito gratuito',
  'store.welcome.title.few': 'Hai {count} crediti gratuiti',
  'store.welcome.title.many': 'Hai {count} crediti gratuiti',
  'store.welcome.title.other': 'Hai {count} crediti gratuiti',
  'store.welcome.claimedTitle.one': '{count} credito è tuo',
  'store.welcome.claimedTitle.few': '{count} crediti sono tuoi',
  'store.welcome.claimedTitle.many': '{count} crediti sono tuoi',
  'store.welcome.claimedTitle.other': '{count} crediti sono tuoi',
  'store.welcome.cardTitle.one': '{count} credito gratuito ti aspetta',
  'store.welcome.cardTitle.few': '{count} crediti gratuiti ti aspettano',
  'store.welcome.cardTitle.many': '{count} crediti gratuiti ti aspettano',
  'store.welcome.cardTitle.other': '{count} crediti gratuiti ti aspettano',
  'store.welcome.cardClaimedTitle.one': '{count} credito pronto da usare',
  'store.welcome.cardClaimedTitle.few': '{count} crediti pronti da usare',
  'store.welcome.cardClaimedTitle.many': '{count} crediti pronti da usare',
  'store.welcome.cardClaimedTitle.other': '{count} crediti pronti da usare',
  'store.welcome.eyebrow': 'Benvenuto in FluidEQ',
  'store.welcome.body':
    'Ogni credito ti dà una scena della scheda {visualizers} da tenere per sempre. Riscattali ora e scegli le tue prime scene.',
  'store.welcome.fine':
    'Una volta per account. Puoi guardare ogni scena per qualche secondo prima di spendere un credito.',
  'store.welcome.later': 'Più tardi',
  'store.welcome.claimedBody':
    'Scegli le tue prime scene. “{notMine}” è attivo, quindi la scheda {visualizers} mostra solo le scene che non hai.',
  'store.welcome.pick': 'Scegli le mie prime scene',
  'store.welcome.cardBody': 'Riscattali e scegli le tue prime scene da tenere.',
  'store.welcome.cardClaimedBody':
    'Ecco le scene che non hai ancora. Guardane una per qualche secondo, poi prendila per un credito.',
  'store.welcome.gotIt': 'Capito',
  'store.get': 'Ottieni · {credits}',
  'store.scene.tasted':
    'Era un assaggio di {seconds} secondi. Ottienila per continuare a guardarla, per sempre.',
  'store.scene.locked': 'Ottienila per vederla suonare qui con la tua musica.',
  'store.scene.yours': 'Tua per sempre',
  'store.scene.keep': 'Tienila per sempre',
  'store.scene.fine':
    'Una scena che ottieni è tua per sempre, sul tuo account. Nessuno può rivenderla.',
  'store.official.fine':
    'Fa parte della collezione FluidEQ: tua per sempre appena la ottieni.',
  'store.like.ownersOnly':
    '{count} mi piace. Ottieni la scena per mettere mi piace.',
  'store.scene.free': 'Gratis per tutti',
  'store.error.termsOutdated':
    'Le condizioni sono cambiate. Aggiorna FluidEQ per leggere la nuova versione prima di comprare crediti.',
};

export default store;
