const account = {
  'account.validation.passwordRequired': 'Inserisci la tua password.',
  'account.validation.passwordShort': 'Usa almeno {count} caratteri.',
  'account.validation.passwordLong': 'Usa al massimo 128 caratteri.',
  'account.validation.nameLong': 'Usa al massimo 80 caratteri.',
  'account.validation.code': 'Inserisci il codice di sei cifre.',
  'account.menu': 'Account',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Account',
  'account.checking': 'Verifica dell’account in corso…',
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
  'account.signOut.confirm': 'Uscire da questo account?',
  'account.signOut.detail': 'Puoi accedere di nuovo quando vuoi.',
  'account.signOut.detailPlus':
    'Le tue scene restano bloccate qui finché non accedi di nuovo.',
  'account.signOut.kept': 'Su questo computer non viene eliminato nulla.',
  'account.cover.onGraph': '{name} sul grafico',
  'account.stats.owned': 'Tue',
  'account.stats.likes': 'Mi piace',
  'account.scenes.title': 'La tua collezione',
  'account.scenes.openGallery': 'Apri la galleria',
  'account.scenes.empty':
    'Le scene che ottieni restano tue e partono sul grafico da qui.',
  'account.scenes.playing': 'In riproduzione',
  'account.scenes.play': 'Avvia {name} sul grafico',
  'account.published.title': 'Pubblicate',
  'account.published.live': 'Nella galleria',
  'account.name.change': 'Cambia nome',
  'account.name.changeTitle': 'Cambia come appari',
  'account.name.changeBody':
    'Il tuo nickname e il tuo nome sulle scene che hai pubblicato. Cambiano ovunque nello stesso momento; la tua email resta privata.',
  'account.name.cancel': 'Annulla',
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
    'Questo computer è stato disconnesso perché il tuo account ha effettuato l’accesso su un altro. Un account resta connesso su un massimo di 5 computer alla volta: accedi di nuovo per usarlo qui, e verrà disconnesso quello usato meno di recente.',
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

  'account.plus.eyebrow': 'FluidEQ',

  'account.perk.looks': 'Scene che sono tue per sempre, un credito ciascuna.',
  'account.perk.visualizers':
    'Visualizzatori: le scene create dai membri, aperte a ogni account.',
  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Continua con Google',
  'account.or': 'oppure',
  'account.google.waiting': 'Completa l’accesso con Google nel browser.',
  'account.google.cancel': 'Annulla',
  'account.error.googleUnfinished':
    'L’accesso con Google non è stato completato. Riprova o usa la tua email.',
  'account.google.doneTitle': 'Hai effettuato l’accesso',
  'account.google.doneBody': 'Puoi chiudere questa scheda e tornare a FluidEQ.',
  'account.google.failedTitle': 'L’accesso non è stato completato',
  'account.google.failedBody':
    'Torna a FluidEQ per riprovare o accedi con la tua email.',
} as const;

export default account;
