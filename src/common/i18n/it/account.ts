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
  'account.working': 'Un momento…',
  'account.signOut': 'Esci',
  'account.signOut.confirm': 'Uscire da questo account?',
  'account.signOut.detail': 'Puoi accedere di nuovo quando vuoi.',
  'account.suspended.failed':
    'Non è stato possibile chiedere il rimborso. Riprova.',
  'account.suspended.until': 'fino al {date}',
  'account.suspended.daysLeft.other': 'Mancano {count} giorni',
  'account.suspended.daysLeft.many': 'Mancano {count} giorni',
  'account.suspended.daysLeft.few': 'Mancano {count} giorni',
  'account.suspended.daysLeft.one': 'Manca {count} giorno',
  'account.suspended.asked':
    'Rimborso richiesto: {amount}. Ti arriverà il {date}, quando l’account verrà eliminato.',
  'account.suspended.ask': 'Chiedi il rimborso',
  'account.suspended.maker':
    'Le tue scene non sono più nella galleria, e ciò che dovevi ancora ricevere è stato annullato.',
  'account.suspended.paid': 'Hai pagato in quei giorni',
  'account.suspended.bodyAsked':
    'Il tuo account è sospeso per aver violato le regole. Non puoi più usarlo né acquistare.',
  'account.suspended.bodyNothing':
    'Il tuo account è sospeso per aver violato le regole. Non puoi più usarlo né acquistare. Il {until} il tuo account verrà eliminato.',
  'account.suspended.body':
    'Il tuo account è sospeso per aver violato le regole. Non puoi più usarlo né acquistare. Puoi chiedere il rimborso di quanto hai pagato tra il {from} e il {to} entro il {until}. Quel giorno il tuo account verrà eliminato.',
  'account.suspended.title': 'Account sospeso',
  'account.suspended.eyebrow': 'Account',
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
  'account.scenes.unpublished': 'Ritirata',
  'account.scenes.unpublishedHint':
    'Chi l’ha creata l’ha tolta dalla galleria. Resta tua.',
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
  'account.field.code': 'Codice ricevuto via email',

  'account.code.sent': 'Abbiamo inviato un codice di sei cifre a {email}.',
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

  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Continua con Google',
  'account.google.waiting': 'Completa l’accesso con Google nel browser.',
  'account.google.cancel': 'Annulla',
  // The sign-in screens Ivan approved on 2026-11-13 (`AccountWelcome`).
  'account.welcome.createTitle.one': 'La tua {count} scena ti aspetta',
  'account.welcome.createTitle.few': 'Le tue {count} scene ti aspettano',
  'account.welcome.createTitle.many': 'Le tue {count} scene ti aspettano',
  'account.welcome.createTitle.other': 'Le tue {count} scene ti aspettano',
  'account.welcome.createLine.one':
    'Un account gratuito parte con {count} credito. Ti dà una scena da tenere per sempre.',
  'account.welcome.createLine.few':
    'Un account gratuito parte con {count} crediti. Ognuno ti dà una scena da tenere per sempre.',
  'account.welcome.createLine.many':
    'Un account gratuito parte con {count} crediti. Ognuno ti dà una scena da tenere per sempre.',
  'account.welcome.createLine.other':
    'Un account gratuito parte con {count} crediti. Ognuno ti dà una scena da tenere per sempre.',
  'account.welcome.step.create': 'Crea il tuo account',
  'account.welcome.step.confirm': 'Conferma la tua email',
  'account.welcome.step.pick.one': 'Scegli la tua {count} scena',
  'account.welcome.step.pick.few': 'Scegli le tue {count} scene',
  'account.welcome.step.pick.many': 'Scegli le tue {count} scene',
  'account.welcome.step.pick.other': 'Scegli le tue {count} scene',
  'account.welcome.backTitle': 'Eccoti di nuovo',
  'account.welcome.backLine':
    'Le tue scene, i tuoi crediti e i tuoi progetti dello Studio sono dove li hai lasciati.',
  'account.welcome.back.scenes':
    'Le tue scene funzionano su ogni computer in cui accedi',
  'account.welcome.back.credits': 'I tuoi crediti, pronti da spendere',
  'account.welcome.back.studio': 'Le tue scene dello Studio e la galleria',
  'account.welcome.free':
    'L’equalizzatore e l’audio di FluidEQ restano gratuiti, con o senza account.',
  'account.google.note':
    'Il modo più veloce: un clic, nessuna password da ricordare.',
  'account.or.email': 'oppure con la tua email',
  'account.signUp.withEmail': 'Crea account con email',
  'account.signIn.withEmail': 'Accedi con email',
  'account.signUp.terms':
    'Creando un account accetti le Condizioni e l’Informativa sulla privacy.',
  'account.code.step': 'Passo 2 di 3',
  'account.code.title': 'Controlla la tua email',
  'account.code.confirmEmail': 'Conferma la mia email',
  'account.error.googleUnfinished':
    'L’accesso con Google non è stato completato. Riprova o usa la tua email.',
  'account.google.doneTitle': 'Hai effettuato l’accesso',
  'account.google.doneBody': 'Puoi chiudere questa scheda e tornare a FluidEQ.',
  'account.google.failedTitle': 'L’accesso non è stato completato',
  'account.google.failedBody':
    'Torna a FluidEQ per riprovare o accedi con la tua email.',
} as const;

export default account;
