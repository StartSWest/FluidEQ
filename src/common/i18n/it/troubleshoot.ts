const troubleshoot = {
  'troubleshoot.title': 'Risolvi i problemi audio',
  'troubleshoot.description':
    'Segui l’elenco dall’alto e fermati al primo passaggio che funziona. Ognuno è più invasivo del precedente, e il primo risolve la maggior parte dei problemi.',
  'troubleshoot.footer':
    'Ancora qualcosa non va dopo tutto questo? Usa **{report}** nello stesso menu: raccoglie i log, toglie tutto ciò che potrebbe identificarti e te li mostra per intero prima di inviarli.',
  'troubleshoot.tried': 'Provato',
  'troubleshoot.restart.title': 'Riavvia l’audio di Windows',
  'troubleshoot.restart.when':
    'Il suono si è fermato, oppure il grafico resta piatto mentre qualcosa è in riproduzione. È la soluzione in quasi tutti i casi, e la prima da provare.',
  'troubleshoot.restart.cost':
    'Qualche secondo di silenzio. Windows chiede l’autorizzazione.',
  'troubleshoot.apo.reselect.title':
    'Riseleziona i dispositivi in Equalizer APO',
  'troubleshoot.apo.reselect.when':
    'Un dispositivo viene equalizzato e un altro no, oppure delle cuffie appena collegate vengono ignorate. Equalizer APO si collega a ogni uscita separatamente, e un nuovo dispositivo non è collegato finché non lo selezioni.',
  'troubleshoot.apo.reselect.cost':
    'Apre il Device Selector di Equalizer APO. Poi serve un riavvio.',
  'troubleshoot.apo.openSelector': 'Apri Device Selector',
  'troubleshoot.apo.mode.title': 'Prova l’altra modalità di installazione',
  'troubleshoot.apo.mode.when':
    'Un dispositivo è selezionato nel Device Selector ma non ha effetto, oppure selezionarlo lo fa smettere del tutto di suonare. Equalizer APO può collegarsi all’audio di Windows in due modi diversi, e alcuni dispositivi funzionano solo con uno dei due.',
  'troubleshoot.apo.mode.cost':
    'Un riavvio. È reversibile: torna indietro nello stesso modo.',
  'troubleshoot.apo.mode.detail':
    'Nel Device Selector apri **Troubleshooting options**. L’impostazione predefinita è installare come **APO**, che funziona sulla maggior parte dei computer. **Install as SFX/EFX** è l’alternativa, da usare con i dispositivi i cui driver hanno effetti propri: molto audio di portatili e da gaming. Se un dispositivo ha smesso di funzionare dopo averlo selezionato, prova l’altra modalità prima di concludere che non si può equalizzare.',
  'troubleshoot.apo.reinstall.title': 'Reinstalla Equalizer APO',
  'troubleshoot.apo.reinstall.when':
    'I primi due passaggi non hanno cambiato nulla, oppure Windows si è aggiornato e da allora l’equalizzatore non funziona. Il suo programma di installazione è anche lo strumento di riparazione: registra di nuovo il componente audio e riapre l’elenco dei dispositivi.',
  'troubleshoot.apo.reinstall.cost':
    'Serve l’autorizzazione di amministratore, e poi il computer deve riavviarsi. I tuoi profili e preset di FluidEQ non vengono toccati.',
  'troubleshoot.apo.readd.title':
    'Rimuovi il dispositivo, riavvia, aggiungilo di nuovo',
  'troubleshoot.apo.readd.when':
    'Solo se un dispositivo specifico non va ancora dopo la reinstallazione. Deselezionalo nel Device Selector, riavvia il computer, poi selezionalo di nuovo e riavvia ancora una volta.',
  'troubleshoot.apo.readd.cost': 'Due riavvii.',
  'troubleshoot.apo.readd.detail':
    'I due riavvii non sono superstizione. Equalizer APO si collega a un endpoint audio all’avvio del computer, quindi un dispositivo scollegato mentre Windows è in funzione resta collegato a metà fino al riavvio, e aggiungerlo di nuovo prima riporta subito lo stato difettoso.',
  'troubleshoot.engine.enable.title':
    'Rimetti il motore FluidEQ sulle tue uscite',
  'troubleshoot.engine.enable.when':
    'Un dispositivo viene equalizzato e un altro no, oppure delle cuffie appena collegate vengono ignorate. Il motore si collega a ogni uscita separatamente, e un aggiornamento di Windows può scollegarlo da una su cui era già.',
  'troubleshoot.engine.permission':
    'Windows chiede l’autorizzazione e l’audio si riavvia per un attimo. Nessun riavvio del computer.',
  'troubleshoot.engine.remove.title':
    'Rimuovi il motore FluidEQ da questa uscita',
  'troubleshoot.engine.remove.when':
    'Solo questa uscita ha un problema che nessun passaggio sopra risolve, oppure vuoi restituirla a un altro programma audio. Il motore viene tolto dall’uscita su cui Windows sta suonando ora, e ciò che aveva sostituito torna al suo posto.',
  'troubleshoot.engine.remove.cost':
    'Windows chiede l’autorizzazione e l’audio si riavvia per un attimo. Le altre uscite non vengono toccate, e il passaggio sopra lo rimette.',
  'troubleshoot.engine.remove.action': 'Rimuovi da questa uscita',
} as const;

export default troubleshoot;
