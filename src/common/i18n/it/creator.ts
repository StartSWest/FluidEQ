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
    'Stripe può pagare i creatori negli Stati Uniti, nel Regno Unito, in Canada, in Svizzera e nello Spazio economico europeo, e la scelta non si può cambiare dopo. Non è nell’elenco? I membri possono comunque acquistare le tue scene, e ogni due vendite ti danno invece un credito.',
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
    'Tutto ciò che è nelle tue scene deve essere tuo da vendere. Le scene vengono comunque revisionate, e una che viola le condizioni può essere rimossa.',
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
};

export default creator;
