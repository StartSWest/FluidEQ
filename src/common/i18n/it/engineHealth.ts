const engineHealth = {
  'engineHealth.offTitle': 'Il motore FluidEQ non è in funzione su {device}',
  'engineHealth.offBody':
    'Questa uscita sta suonando senza il tuo EQ. Riavviare l’audio di Windows di solito fa ripartire il motore, e nel frattempo tutto il resto di FluidEQ continua a funzionare.',
  'engineHealth.neverRanTitle': 'Windows non ha mai avviato il motore FluidEQ',
  'engineHealth.neverRanBody':
    'Il motore è installato e attivo su {device}, e Windows non lo ha caricato nemmeno una volta lì: riavviare l’audio non lo riporterà indietro. FluidEQ ha già sistemato tutto quello a cui può arrivare; se resta così, è il tuo software di sicurezza o il driver della scheda audio a impedirlo. Nel frattempo Equalizer APO elabora il tuo suono.',
  'engineHealth.bypassedTitle':
    'Il tuo audio non passa per FluidEQ su {device}',
  'engineHealth.bypassedBody':
    "Il motore è installato e attivo per questa uscita, e Windows riproduce la musica senza farla passare di lì: non gli è arrivato alcun suono. Un'uscita ha più posti in cui può stare un effetto, e Windows ne sceglie uno diverso per ogni tipo di riproduzione; FluidEQ si trova in uno dove questa musica non passa. Spostarlo altrove richiede un permesso di Windows e un secondo di silenzio.",
  'engineHealth.tryAnotherSlot': 'Prova un altro posto',
  'engineHealth.partlyOff': 'IN PARTE DISATT.',
  'engineHealth.problemsTitle': 'Parte del tuo suono non arriva a {device}',
  'engineHealth.problem.convolution':
    'La convoluzione è disattivata: il motore non è riuscito a caricare la risposta all’impulso. Prova un altro file.',
  'engineHealth.problem.eq-phase':
    'L’EQ a fase lineare non si è avviato; i filtri originali restano attivi.',
  'engineHealth.problem.graphic-eq':
    'L’EQ grafico è disattivato: il motore non è riuscito a costruirne la curva.',
  'engineHealth.problem.dsp-rack':
    'Gli effetti DSP sono disattivati: il motore non è riuscito ad avviarli.',
  'engineHealth.problem.reload-failed':
    'La tua ultima modifica non è stata caricata, quindi è ancora attiva quella precedente.',
  'engineHealth.problem.unwatched':
    'Il motore non vede le modifiche che fai per questa uscita.',
  'engineHealth.problem.other':
    'Un’altra cosa chiesta al motore non è in esecuzione.',
  'engineHealth.engineIsOld':
    'Il motore FluidEQ installato su questo PC non è quello che questa versione di FluidEQ porta con sé.',
  'engineHealth.rackNeedsEngine':
    'Gli effetti DSP girano dentro il motore stesso, quindi riavviare l’audio di Windows riavvia lo stesso motore. A sistemare le cose è mettere il motore di FluidEQ: un permesso di Windows e un secondo di silenzio.',
  'engineHealth.useApo': 'Usa Equalizer APO…',
} as const;

export default engineHealth;
