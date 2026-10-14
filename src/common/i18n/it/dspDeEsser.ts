/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The De-esser's page. See `en/dspDeEsser.ts`. */
export default {
  'dsp.deEsser.title': 'De-esser',
  'dsp.deEsser.description':
    'Abbassa le S, T e SC taglienti di una voce solo mentre suonano, e lascia in pace i piatti e il resto degli acuti.',
  'dsp.deEsser.isolate': 'Isola',
  'dsp.deEsser.isolateHint': 'Ascolta solo ciò che il De-esser toglie.',
  'dsp.deEsser.isolateOn':
    'Suona solo ciò che il De-esser toglie. Se ci senti i piatti, sta togliendo troppo.',

  'dsp.deEsser.group.find': 'Trova',
  'dsp.deEsser.group.findHint':
    'La sensibilità si misura rispetto al livello del brano stesso, così un pezzo piano e uno forte sono trattati allo stesso modo.',
  'dsp.deEsser.group.reduce': 'Riduci',
  'dsp.deEsser.group.timing': 'Tempi',
  'dsp.deEsser.group.timingHint':
    'Prendi l’inizio reagisce appena prima di ogni S, così il suo primo fronte non si perde. Rilascia decide quanto in fretta tornano gli acuti dopo.',
  'dsp.deEsser.group.where': 'Dove',

  'dsp.deEsser.sensitivity': 'Sensibilità',
  'dsp.deEsser.lowHz': 'Da',
  'dsp.deEsser.highHz': 'A',
  'dsp.deEsser.rangeDb': 'Fino a',
  'dsp.deEsser.widthOct': 'Ampiezza',
  'dsp.deEsser.attackMs': 'Prendi l’inizio',
  'dsp.deEsser.releaseMs': 'Rilascia',
  'dsp.deEsser.keepCymbals': 'Risparmia i piatti',

  'dsp.deEsser.mode.label': 'Come riduce',
  'dsp.deEsser.mode.spectral': 'Spettrale',
  'dsp.deEsser.mode.treble': 'Acuti',
  'dsp.deEsser.mode.whole': 'Voce intera',
  'dsp.deEsser.mode.spectralHint':
    'Abbassa solo le frequenze di cui è fatta la S, e la segue quando si sposta.',
  'dsp.deEsser.mode.trebleHint':
    'Abbassa tutto ciò che sta sopra la S, come la maggior parte dei de-esser. Più deciso, un po’ più spento.',
  'dsp.deEsser.mode.wholeHint':
    'Abbassa tutto il suono per la durata di ogni S. Naturale sul parlato, troppo sulla musica.',

  'dsp.deEsser.where.label': 'Quale parte dell’immagine stereo',
  'dsp.deEsser.where.centre': 'Centro',
  'dsp.deEsser.where.all': 'Tutto',
  'dsp.deEsser.where.centreHint':
    'Le voci stanno al centro e gli hi-hat di solito ai lati, quindi ascolta e taglia al centro.',
  'dsp.deEsser.where.allHint':
    'Ascolta tutta l’immagine stereo. Per dischi mono, parlato e registrazioni dal vivo.',

  'dsp.deEsser.graph.s': 'S a',
  'dsp.deEsser.graph.cut': 'Taglio',
  'dsp.deEsser.graph.isolate': 'Solo ciò che viene tolto',
  'dsp.deEsser.graph.spared': 'Piatti risparmiati',
  'dsp.deEsser.graph.now': 'ora',
  'dsp.deEsser.graph.voice': 'Voce',
  'dsp.deEsser.graph.notVoice': 'Non è una voce',
  'dsp.deEsser.graph.threshold': 'Dove inizia',
  'dsp.deEsser.engineOld':
    'Il FluidEQ Engine installato qui è precedente al De-esser, quindi questo stadio non si sente ancora. Il resto del rack suona come prima.',
  'dsp.deEsser.upTo': 'fino a {db}',

  'dsp.deEsserPresetGroup.music': 'Musica',
  'dsp.deEsserPresetGroup.speech': 'Parlato',
  'dsp.deEsserPreset.gentle': 'Delicato',
  'dsp.deEsserPreset.vocalMusic': 'Musica cantata',
  'dsp.deEsserPreset.brightHeadphones': 'Cuffie brillanti',
  'dsp.deEsserPreset.harshStreams': 'Stream aspri',
  'dsp.deEsserPreset.live': 'Registrazioni dal vivo',
  'dsp.deEsserPreset.podcast': 'Podcast e parlato',
} as const;
