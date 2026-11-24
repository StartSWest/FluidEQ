/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': 'Microfono',
  'mic.label': 'Microfono',
  'mic.pickHint': 'Scegli il microfono di cui modellare il suono',
  'mic.list.heading': 'Microfoni su questo PC',
  'mic.list.on': 'Attivo',
  'mic.list.off': 'Non configurato',
  'mic.live': 'Live in ogni app',
  'mic.notSetUp': 'Non ancora configurato su questo microfono',
  'mic.state.opening': 'Apertura del microfono…',
  'mic.state.noInput':
    'Windows non mostra alcun ingresso per questo microfono ora',
  'mic.state.blocked':
    'Windows non ha permesso a FluidEQ di aprire questo microfono',
  'mic.state.waiting':
    'Microfono aperto · in attesa che il motore parta su di esso',
  'mic.meter.gateOpen': 'Voce che passa',
  'mic.meter.gateClosed': 'Gate chiuso',
  'mic.meter.compressor': 'Compressore',
  'mic.meter.limiter': 'Limiter',
  'mic.monitor.label': 'Ascolta il risultato finale',
  'mic.monitor.hint':
    'Riproduce ciò che sentono gli altri sull’uscita che stai ascoltando',
  'mic.monitor.warning':
    'Usa le cuffie: dagli altoparlanti la tua voce rientra nel microfono e fischia.',
  'mic.effectsOff.short':
    'I miglioramenti audio di Windows sono disattivati per questo microfono',
  'mic.effectsOff.title': 'I miglioramenti audio sono disattivati per {mic}',
  'mic.effectsOff.body':
    'Finché sono disattivati, Windows non applica alcun effetto a questo microfono e FluidEQ non può elaborarlo. Attiva «Miglioramenti audio» nelle proprietà del microfono.',
  'mic.effectsOff.button': 'Apri le impostazioni audio di Windows',
  'mic.picture.label':
    'La tua voce: tenue ciò che il microfono capta, brillante ciò che sentono gli altri',
  'mic.picture.raw': 'Il tuo microfono',
  'mic.picture.heard': 'Ciò che sentono gli altri',
  'mic.picture.gate': 'Gate',
  'mic.profile.label': 'Profilo microfono',
  'mic.profile.pickHint':
    'Parti da un profilo pensato per come usi il microfono',
  'mic.profile.group.use': 'Per uso',
  'mic.profile.group.mic': 'Per microfono',
  'mic.profile.tuned': 'regolato',
  'mic.profile.stream': 'Streaming',
  'mic.profile.stream.hint': 'Caldo, vicino e costante per Twitch e YouTube',
  'mic.profile.podcast': 'Podcast',
  'mic.profile.podcast.hint': 'Una voce naturale, controllata con delicatezza',
  'mic.profile.chat': 'Chat di gioco',
  'mic.profile.chat.hint':
    'Chiara e in primo piano su Discord e nella chat di squadra, niente tra le parole',
  'mic.profile.sing': 'Canto',
  'mic.profile.sing.hint':
    'Aperto e arioso, niente pompaggio, ogni respiro conservato',
  'mic.profile.broadcast': 'Radio',
  'mic.profile.broadcast.hint': 'Voce da radio: bassi pieni, compatta e densa',
  'mic.profile.noisy': 'Stanza rumorosa',
  'mic.profile.noisy.hint':
    'Ventole, bambini, traffico: pulitore e gate al massimo',
  'mic.profile.meet': 'Riunioni',
  'mic.profile.meet.hint':
    'Teams e Zoom: parole chiare, il resto della pulizia lo fanno loro',
  'mic.profile.laptop': 'Microfono del portatile',
  'mic.profile.laptop.hint':
    'Sottile, lontano e riverberante: taglio bassi alto, pulitore deciso',
  'mic.profile.headset': 'Microfono della cuffia',
  'mic.profile.headset.hint':
    'Una piccola capsula vicino alla bocca: torna il calore, via le plosive',
  'mic.reset': 'Ripristina {profile}',
  'mic.setup.title': 'Il FluidEQ Engine non è ancora attivo su {mic}.',
  'mic.setup.body':
    'Windows chiede il permesso una sola volta. Le tue uscite continuano a suonare durante la configurazione.',
  'mic.setup.button': 'Configura su questo microfono',
  'mic.setup.working': 'Configurazione…',
  'mic.setup.declined':
    'Windows non ha dato il permesso, quindi non è cambiato nulla.',
  'mic.setup.failed': 'Non è stato possibile configurarlo su questo microfono.',
  'mic.notFluid.title':
    'Il suono di un microfono viene riprodotto dal FluidEQ Engine.',
  'mic.notFluid.body':
    'Il suo suono resta salvato e si sentirà appena il FluidEQ Engine sarà quello scelto.',
  'mic.empty.backTitle': 'Windows sta ripristinando i tuoi microfoni',
  'mic.empty.backBody':
    'Compaiono qui non appena Windows li elenca di nuovo, di solito poco dopo il riavvio del suo audio.',
  'mic.empty.lookAgain': 'Cerca di nuovo',
  'mic.empty.title': 'Nessun microfono trovato',
  'mic.empty.body':
    'Collega un microfono, oppure aggiorna il FluidEQ Engine perché possa elencarli.',
  'mic.stage.lowCut': 'Taglio bassi',
  'mic.stage.cleaner': 'Cancellazione del rumore',
  'mic.stage.gate': 'Gate',
  'mic.stage.deEsser': 'De-esser',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'Compressore',
  'mic.stage.limiter': 'Limiter',
  'mic.lowCut.title': 'Taglio bassi',
  'mic.lowCut.description':
    'Toglie rombo, colpi sulla scrivania e la ventola sotto la voce, prima che il pulitore li senta.',
  'mic.lowCut.group.below': 'Sotto la voce',
  'mic.lowCut.group.belowHint':
    'Vicino al microfono toglie i bassi in più che una voce prende a pochi centimetri dalla capsula.',
  'mic.lowCut.cut': 'Taglia sotto',
  'mic.lowCut.proximity': 'Vicino al microfono',
  'mic.lowCut.group.pops': 'Plosive',
  'mic.lowCut.group.popsHint':
    'Attenua il colpo di una P o di una B e lascia intatta una voce costante.',
  'mic.lowCut.plosive': 'Anti-pop',
  'mic.gate.title': 'Gate',
  'mic.gate.description':
    'Chiude il microfono tra le parole, così stanza, ventola e tastiera restano fuori. Con un intervallo ridotto diventa un expander delicato.',
  'mic.gate.group.level': 'Quando si apre',
  'mic.gate.group.levelHint':
    'Osserva la linea tratteggiata nell’immagine: la tua voce deve superarla, la stanza deve restarci sotto.',
  'mic.gate.threshold': 'Si apre a',
  'mic.gate.range': 'Attenua di',
  'mic.gate.group.time': 'Quanto veloce',
  'mic.gate.group.timeHint':
    'Il mantenimento lo tiene aperto tra le sillabe, così la fine delle parole non viene mai tagliata.',
  'mic.gate.attack': 'Si apre in',
  'mic.gate.hold': 'Mantenimento',
  'mic.gate.release': 'Si chiude in',
  'mic.monitor.on': 'Ascolto del risultato finale',
  'mic.delay.label': 'Ritardo',
  'mic.delay.measured':
    'misurato dal motore su questo microfono, dalla capsula a ogni app',
  'mic.delay.unknown': 'il motore non ha ancora misurato questo microfono',
  'mic.delay.windows': 'Windows',
  'mic.rail.master': 'Elaborazione del microfono',
  'mic.rail.note':
    'Ogni interruttore spegne del tutto il suo stadio: nessun cambio di suono, nessun ritardo. Il numero accanto a uno stadio è il ritardo che aggiunge.',
  'mic.meter.noise': 'Rumore tolto',
  'mic.cleaner.description':
    'Toglie tastiera, ventole e stanza da sotto la tua voce mentre parli.',
  'mic.cleaner.strength': 'Intensità',
  'mic.cleaner.neverCuts': 'Non taglia mai',
  'mic.cleaner.neverCutsHint':
    'Se il modello è in ritardo, la voce mantiene il livello dell’ultimo istante pulito e si unisce senza clic, mai con la stanza grezza. Questi istanti sono contati qui.',
  'mic.cleaner.lateMinute': 'blocchi in ritardo nell’ultimo minuto',
  'mic.gate.live.title': 'La tua voce e il gate',
  'mic.gate.live.hint':
    'Trascina la linea in alto o in basso. I tratti grigi sono dove il gate ha abbassato la stanza.',
  'mic.gate.live.opens': 'apre a {db} dB',
  'mic.live.ago': '−{seconds} s',
  'mic.live.now': 'ora',
  'mic.gate.live.stateOpen': 'Aperto',
  'mic.gate.live.stateClosed': 'Chiuso',
  'mic.gate.live.waiting': 'In attesa della tua voce',
  'mic.gate.live.keyLevel': 'Ciò che sente il gate',
  'mic.gate.live.keyClosed': 'Abbassato',
  'mic.gate.live.keyOpens': 'Apre',
  'mic.gate.live.keyCloses': 'Chiude',
  'mic.gate.live.label':
    'Il livello che il gate sente negli ultimi cinque secondi, rispetto a dove apre e dove chiude',
  'mic.gate.live.openShare': 'Aperto, ultimi {seconds} s',
  'mic.lowCut.live.title': 'Dove sta la tua voce',
  'mic.lowCut.live.keyKept': 'La tua voce, tenuta',
  'mic.lowCut.live.keyTaken': 'Tolto',
  'mic.lowCut.live.keyCut': 'Il taglio',
  'mic.lowCut.live.label':
    'La tua voce come arriva, con ciò che il taglio bassi toglie',
  'mic.lowCut.live.chip': '{hz} Hz · {slope} dB/ott',
  'mic.lowCut.live.hum': 'ronzio {hz} Hz',
  'mic.lowCut.live.taken': 'Rimbombo tolto ora',
  'mic.lowCut.live.lowest': 'La nota più grave della tua voce',
  'mic.lowCut.live.hint':
    'Trascina il punto a sinistra o a destra e tienilo sotto la tua nota più grave.',
  'mic.cleaner.live.title': 'Voce e stanza, ora',
  'mic.cleaner.live.keyBefore': 'Ciò che sente il microfono',
  'mic.cleaner.live.keyAfter': 'Dopo la pulizia',
  'mic.cleaner.live.label':
    'La tua voce e la tua stanza prima e dopo la pulizia',
  'mic.cleaner.live.roomBefore': 'Stanza prima',
  'mic.cleaner.live.roomAfter': 'Stanza dopo',
  'mic.cleaner.live.taken': 'Stanza tolta',
  'mic.cleaner.live.over': 'Voce sopra la stanza',
  'mic.cleaner.live.hint':
    'Il grigio è la tua stanza come la sente il microfono; il colore è ciò che lascia la pulizia.',
  'mic.cleaner.strengthHint':
    'Quanta parte della stanza toglie la pulizia. Oltre l’80% una voce inizia a suonare elaborata.',
};
