/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const creator: Partial<Dictionary> = {
  'creator.title': 'Pagamenti ai creatori',
  'creator.badge.active': 'Attivo',
  'creator.badge.checking': 'In verifica',
  'creator.invite':
    'Pubblica scene nella galleria e vieni pagato quando i membri le acquistano: il {share}% di ogni vendita, inviato sul tuo conto da Stripe.',
  'creator.unfinished':
    'La tua registrazione su Stripe non è completa. Riprendi da dove avevi lasciato.',
  'creator.newTerms':
    'I termini per i creatori sono cambiati. Leggili e accettali per continuare a essere pagato.',
  'creator.checking':
    'Stripe sta verificando i tuoi dati. Di solito servono pochi minuti, a volte qualche giorno.',
  'creator.paidLine': '{sales} delle tue scene finora.',
  'creator.sales.one': '{count} vendita',
  'creator.sales.few': '{count} vendite',
  'creator.sales.many': '{count} vendite',
  'creator.sales.other': '{count} vendite',
  'creator.ready': 'Pronto da pagare',
  'creator.held': 'In attesa',
  'creator.paid': 'Pagato finora',
  'creator.paidHint':
    'Ogni vendita resta in attesa {days} giorni in caso di rimborso. I creatori vengono pagati ogni {every} giorni, quando sono pronti {amount}.',
  'creator.opened':
    'La pagina di Stripe è aperta nel browser. Completa lì; questa scheda si aggiorna quando torni.',
  'creator.setUp': 'Configura i pagamenti',
  'creator.finish': 'Completa la configurazione',
  'creator.readTerms': 'Leggi i nuovi termini',
  'creator.checkAgain': 'Controlla di nuovo',
  'creator.dashboard': 'Dashboard di Stripe',
  'creator.dialog.title': 'Fatti pagare per le tue scene',
  'creator.dialog.lead':
    'Stripe ti paga e conserva i tuoi dati di identità, bancari e fiscali. FluidEQ non li vede mai.',
  'creator.dialog.step1': 'Scegli il tuo paese e accetta i termini qui.',
  'creator.dialog.step2': 'Registrati sulla pagina di Stripe nel browser.',
  'creator.dialog.step3': 'Torna su FluidEQ: i tuoi guadagni compaiono qui.',
  'creator.dialog.country': 'Paese in cui vivi',
  'creator.dialog.search': 'Cerca un paese',
  'creator.dialog.choose': 'Scegli un paese',
  'creator.dialog.countryHint':
    'Stripe può pagare i creatori negli Stati Uniti, nel Regno Unito, in Canada, in Svizzera e nello Spazio economico europeo, e la scelta non si può cambiare dopo. Non è nell’elenco? I membri possono comunque acquistare le tue scene, e ogni vendita ti dà invece un credito.',
  'creator.dialog.cancel': 'Annulla',
  'creator.dialog.go': 'Accetta e continua su Stripe',
  'creator.dialog.opening': 'Apertura di Stripe…',
  'creator.terms.title': 'Termini per i creatori',
  'creator.terms.share':
    'Ricevi il {share}% di quanto rende ogni vendita delle tue scene al netto delle commissioni di Stripe. FluidEQ trattiene il resto.',
  'creator.terms.paidCredits':
    'Solo le scene acquistate con crediti pagati generano denaro. I crediti gratuiti, e le scene di FluidEQ, non generano nulla.',
  'creator.terms.hold':
    'Ogni guadagno resta in attesa {days} giorni, così un rimborso o una contestazione possono ancora annullarlo. Uno annullato dopo il pagamento viene detratto dal pagamento successivo.',
  'creator.terms.minimum':
    'FluidEQ paga i creatori ogni {every} giorni, quando sono pronti {amount} o più. Stripe poi li invia sul tuo conto secondo il tuo calendario.',
  'creator.terms.stripe':
    'Stripe ti chiede i dati di identità, bancari e fiscali e ti mostra i propri termini. I pagamenti si fermano se Stripe non può più pagarti.',
  'creator.terms.rights':
    'Tutto ciò che è nelle tue scene deve essere tuo da vendere. Le scene vengono comunque revisionate, e una che viola i termini di Plus può essere rimossa.',
  'creator.terms.taxes':
    'Le tasse su ciò che guadagni spetta a te dichiararle dove vivi.',
  'creator.terms.changes':
    'Questi termini possono cambiare. Vieni avvisato nell’app e ti viene chiesto di accettare i nuovi prima di essere pagato di nuovo.',
  'creator.error.signedOut': 'Accedi di nuovo per gestire i tuoi pagamenti.',
  'creator.error.unconfirmed':
    'Conferma prima il tuo indirizzo email. Il codice è nella tua casella di posta.',
  'creator.error.offline':
    'Impossibile raggiungere FluidEQ. Controlla la connessione e riprova.',
  'creator.error.unavailable':
    'I pagamenti ai creatori non sono ancora aperti. Riprova più tardi.',
  'creator.error.agreementOutdated':
    'I termini per i creatori sono cambiati. Rileggili e accettali.',
  'creator.error.country':
    'Stripe non può ancora pagare i creatori in quel paese.',
  'creator.error.banned': 'Questo account non può essere pagato per le scene.',
  'creator.error.server':
    'Qualcosa è andato storto da parte nostra. Non è cambiato nulla; riprova tra un momento.',
  'creator.admin.tab': 'Pagamenti',
  'creator.admin.plan': 'Creatori pagati tramite Stripe',
  'creator.admin.loading': 'Lettura di quanto è dovuto ai creatori',
  'creator.admin.due': 'Dovuto ora',
  'creator.admin.creators': 'Creatori: {count}',
  'creator.admin.available': 'Disponibile su Stripe',
  'creator.admin.availableNote': 'da dove escono i trasferimenti',
  'creator.admin.pending': 'Incompleti',
  'creator.admin.pendingNote': 'completati per primi dalla prossima esecuzione',
  'creator.admin.short':
    'Il saldo disponibile di FluidEQ su Stripe è inferiore al dovuto. I trasferimenti oltre il saldo falliscono e aspettano la prossima esecuzione; paga quando il saldo si è assestato.',
  'creator.admin.list': 'Chi viene pagato',
  'creator.admin.none':
    'Ancora nessuno è dovuto. I creatori compaiono qui quando Stripe può pagarli e abbastanza guadagni hanno superato il periodo di attesa.',
  'creator.admin.payLead':
    'Paga subito tutti quelli in elenco invece di aspettare: {amount} in totale, tramite Stripe.',
  'creator.admin.confirm':
    'Inviare {amount} ora? Così si spostano soldi veri dal saldo Stripe di FluidEQ e non si può annullare.',
  'creator.admin.pay': 'Paga i creatori',
  'creator.admin.payNow': 'Sì, paga ora',
  'creator.admin.paying': 'Pagamento…',
  'creator.admin.ran': 'Pagati: {paid}. Non pagati: {failed}.',
  'creator.admin.rules':
    'I pagamenti partono da soli il 1° e il 16; Paga i creatori li invia subito. Ogni pagamento viene inviato una sola volta: un’esecuzione interrotta viene completata dalla successiva, mai inviata di nuovo.',
  'creator.admin.lastPaid': 'Ultimo pagamento: {date}',
  'creator.admin.neverPaid': 'Ancora nessun pagamento',
  'creator.admin.nextDue': 'prossimo pagamento automatico: {date}',
  'creator.notice.title': 'Pagamento ai creatori il {date}',
  'creator.notice.body':
    'Partiranno {amount} automaticamente. Creatori da pagare: {count}.',
  'creator.notice.later': 'Più tardi',
  'creator.notice.open': 'Apri Pagamenti',
  'creator.notice.shortTitle':
    'Saldo Stripe insufficiente per il pagamento del {date}',
  'creator.notice.shortBody':
    'Dovuto: {amount}. Creatori da pagare: {count}. Stripe ha {available}; i trasferimenti oltre il saldo falliranno e aspetteranno il prossimo pagamento.',
};

export default creator;
