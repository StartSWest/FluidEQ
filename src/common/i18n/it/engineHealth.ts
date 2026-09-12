const engineHealth = {
  'engineHealth.offTitle': 'Il motore FluidEQ non è in funzione su {device}',
  'engineHealth.offBody':
    'Questa uscita sta suonando senza il tuo EQ. Riavviare l’audio di Windows di solito fa ripartire il motore, e nel frattempo tutto il resto di FluidEQ continua a funzionare.',
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
  'engineHealth.useApo': 'Usa Equalizer APO…',
} as const;

export default engineHealth;
