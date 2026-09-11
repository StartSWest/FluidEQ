const account = {
  'account.menu': 'Account',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Account',
  'account.close': 'Chiudi',

  'account.optional':
    'Accedere è facoltativo. FluidEQ funziona esattamente come sempre senza account: tutto gira su questa macchina e nulla viene tracciato. Un account serve solo per le parti che ne hanno davvero bisogno.',

  'account.signIn': 'Accedi',
  'account.signUp': 'Crea account',
  'account.signInHint':
    'La tua password va direttamente al servizio account e non viene conservata da nessuna parte nell’app.',
  'account.signUpHint':
    'A quell’indirizzo arriva un codice di sei cifre. Inseriscilo qui per completare.',
  'account.working': 'Un momento…',
  'account.signOut': 'Esci',
  'account.signedIn': 'Accesso effettuato',
  'account.backToSignIn': 'Torna all’accesso',

  'account.field.email': 'Email',
  'account.field.emailHint':
    'mai mostrata a nessuno — solo per accedere e per i codici',
  'account.field.password': 'Password',
  'account.field.passwordHint': 'almeno {count} caratteri',
  'account.field.name': 'Nome',
  'account.field.optional': 'facoltativo',
  'account.field.code': 'Codice ricevuto via email',

  'account.code.sent': 'Abbiamo inviato un codice di sei cifre a {email}.',
  'account.code.confirm': 'Conferma',
  'account.code.sendAgain': 'Invia di nuovo il codice',
  'account.code.sentAgain': 'Inviato di nuovo',
  'account.code.otherEmail': 'Usa un’altra email',
  'account.code.hint':
    'Non è arrivato nulla? Controlla lo spam. E se con questo indirizzo esisteva già un account, nessun codice viene inviato: accedi invece.',

  'account.forgot.link': 'Password dimenticata?',
  'account.forgot.lead':
    'Inserisci l’indirizzo con cui ti sei registrato e lì arriverà un codice.',
  'account.forgot.submit': 'Invia codice di reimpostazione',
  'account.reset.sent':
    'Abbiamo inviato un codice di sei cifre a {email}. Inseriscilo qui con la nuova password.',
  'account.reset.submit': 'Imposta nuova password',

  'account.unavailable': 'L’accesso non è disponibile su questo sistema',
  'account.unavailableHint':
    'Su questa macchina non c’è un posto sicuro dove conservare un accesso, quindi FluidEQ non ne salva alcuno. Tutto il resto funziona normalmente.',

  'account.error.network':
    'Impossibile raggiungere il servizio account. Controlla la connessione e riprova.',
  'account.error.rejected':
    'Il servizio account ha rifiutato. Riprova tra un momento.',
  'account.error.expired': 'Questo accesso non è più valido. Accedi di nuovo.',
  'account.error.signedOutElsewhere':
    'Questo computer è stato disconnesso perché il tuo account ha effettuato l’accesso su un altro. Plus funziona su un massimo di 5 computer alla volta: accedi di nuovo per usarlo qui e verrà disconnesso quello usato meno di recente.',
  'account.error.malformed':
    'Il servizio account ha inviato qualcosa che FluidEQ non è riuscito a leggere.',
  'account.error.wrongCredentials': 'Email o password errati.',
  'account.error.unconfirmed':
    'Questo account non è ancora confermato. Inserisci il codice ricevuto via email per completare.',
  'account.error.weakPassword':
    'Questa password è troppo facile da indovinare. Provane una più lunga, e che non hai già usato.',
  'account.error.badCode':
    'Il codice è errato o è scaduto. Richiedine uno nuovo.',
  'account.error.rateLimited':
    'Troppi tentativi in poco tempo. Aspetta un minuto e riprova.',
  'account.error.invalidEmail': 'Non sembra un indirizzo email.',
  'account.error.alreadyRegistered':
    'Esiste già un account con questo indirizzo. Accedi invece.',

  'account.plus.eyebrow': 'FluidEQ Plus',
  'account.plus.pitch':
    'Visualizzatori che non esistono da nessun’altra parte, lo Studio per creare i tuoi, la classifica — e ogni novità da qui in avanti, prima per i membri. Tutto ciò che oggi è gratuito resta gratuito.',
  'account.plus.upgrade': 'Passa a Plus',
  'account.plus.opening': 'Apertura…',
  'account.plus.checkoutHint':
    'Apre Buy Me a Coffee nel browser. Paga con la stessa email di questo account così FluidEQ la riconosce; l’app non vede mai la tua carta.',
  'account.plus.active': 'Attivo',
  'account.plus.renews': 'Si rinnova il {date}',
  'account.plus.ends': 'Termina il {date}',
  'account.plus.manage': 'Gestisci abbonamento',
  'account.plus.grace':
    'Non è stato possibile confermare l’abbonamento. Resta attivo fino al {date}: connettiti a internet prima di allora per conservarlo.',
  'account.plus.checkAgain': 'Controlla di nuovo',
  'account.plus.perMonth': '{price} / mese',
  'account.plus.perYear': '{price} / anno',
  'account.plus.priceChoice': '{monthly} o {yearly}',
  'account.plus.checkoutOpened':
    'Buy Me a Coffee è aperto nel browser. Torna qui dopo aver pagato e Plus si attiva.',
  'account.plus.error.rejected':
    'Impossibile aprire la pagina di pagamento. Riprova tra un momento.',

  'account.dev.label': 'Sviluppo',
  'account.dev.start': 'Simula un pagamento',
  'account.dev.cancel': 'Simula una disdetta',
  'account.dev.working': 'Invio…',

  'account.perk.looks': 'Look Plus, disegnati dalla scheda grafica.',
  'account.perk.visualizers':
    'Visualizzatori: le scene create dai membri, aperte a ogni account.',
  'account.perk.board': 'Una classifica di chi ascolta di più.',
} as const;

export default account;
