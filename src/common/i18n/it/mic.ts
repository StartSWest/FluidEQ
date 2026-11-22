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
  'mic.live': 'Live in ogni app · bassa latenza {ms} ms',
  'mic.notSetUp': 'Non ancora configurato su questo microfono',
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
  'mic.empty.title': 'Nessun microfono trovato',
  'mic.empty.body':
    'Collega un microfono, oppure aggiorna il FluidEQ Engine perché possa elencarli.',
  'mic.stage.lowCut': 'Taglio bassi',
  'mic.stage.cleaner': 'Pulitore vocale',
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
};
