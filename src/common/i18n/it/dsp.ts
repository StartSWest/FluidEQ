/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const dsp = {
  'dsp.title': 'DSP',
  'dsp.scopeNotice':
    'Si applica alla musica riprodotta dentro FluidEQ. Non cambia Spotify, YouTube o altre app.',
  'dsp.idle':
    'Si avvia quando riproduci qualcosa dalla Libreria. Elabora il lettore di FluidEQ, quindi non ha nulla da fare finché non carichi un brano.',
  'dsp.unavailable':
    "L'elaborazione audio non è riuscita ad avviarsi. La riproduzione non è interessata.",
  'dsp.presets': 'Preimpostazioni',
  'dsp.preset.flat': 'Spento',
  'dsp.preset.lossyRepair': 'Ripara compresso',
  'dsp.preset.loud': 'Forte',
  'dsp.bypassed': 'Bypassato',
  'dsp.enabled': 'Attivo',

  'dsp.eqPreset.custom': 'Personalizzato',
  'dsp.eqPreset.label': 'Preimpostazione',
  'dsp.eqPreset.flat': 'Piatto',
  'dsp.eqPreset.vShape': 'Forma a V',
  'dsp.eqPreset.rock': 'Rock',
  'dsp.eqPreset.pop': 'Pop',
  'dsp.eqPreset.jazz': 'Jazz',
  'dsp.eqPreset.classical': 'Classica',
  'dsp.eqPreset.electronic': 'Elettronica',
  'dsp.eqPreset.hiphop': 'Hip-hop',
  'dsp.eqPreset.acoustic': 'Acustica',
  'dsp.eqPreset.vocal': 'Voce',
  'dsp.eqPreset.podcast': 'Podcast',
  'dsp.eqPreset.bassBoost': 'Più bassi',
  'dsp.eqPreset.trebleBoost': 'Più alti',
  'dsp.eqPreset.loudness': 'Loudness',
  'dsp.eqPreset.lateNight': 'A tarda notte',
  'dsp.eqPreset.smallSpeakers': 'Diffusori piccoli',
  'dsp.eqPreset.car': 'Auto',
  'dsp.eqPreset.gaming': 'Gaming',
  'dsp.eqPreset.movie': 'Film',
  'dsp.eqPreset.warm': 'Caldo',
  'dsp.eqPreset.air': 'Aria',

  'dsp.eqPreset.import': 'Importa',
  'dsp.eqPreset.export': 'Esporta',
  'dsp.eqPreset.imported': 'Caricati {count} filtri.',
  'dsp.eqPreset.importSkipped': 'Caricati {count} filtri, {skipped} ignorati.',
  'dsp.eqPreset.importEmpty': 'Questo equalizzatore non ha letto alcun filtro.',
  'dsp.eqPreset.importFailed': 'Impossibile leggere quel file.',
  'dsp.eqPreset.importPreamp': 'Preamplificazione impostata a {gain} dB.',

  'dsp.eq.rack': 'Bande',
  'dsp.eqModel.label': 'Caratt.',
  'dsp.eqModel.clean': 'Nessuno',
  'dsp.eqModel.proportional': 'Focalizzato',
  'dsp.eqModel.wide': 'Ampio',
  'dsp.eqEngine.label': 'Motore',
  'dsp.eqEngine.serial': 'In serie',
  'dsp.eqEngine.parallel': 'In parallelo',
  'dsp.eqStereo.label': 'Agisce su',
  'dsp.eqStereo.stereo': 'Stereo',
  'dsp.eqStereo.mid': 'Solo centro',
  'dsp.eqStereo.side': 'Solo lati',
  'dsp.eqOversample.label': 'Sovracampionamento',
  'dsp.eqOversample.off': 'No',
  'dsp.eqOversample.on': '2x',
  'dsp.eqImport.title': 'Importa una curva EQ',
  'dsp.eqImport.hint':
    'Incolla una curva da Squiglink, AutoEq o Equalizer APO — oppure scegli il file che la contiene.',
  'dsp.eqImport.placeholder':
    'Preamp: -5.4 dB\nFilter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
  'dsp.eqImport.chooseFile': 'Scegli file',
  'dsp.eqImport.apply': 'Importa',
  'dsp.eqImport.cancel': 'Annulla',

  'dsp.eq.title': 'Equalizzatore',
  'dsp.eq.description':
    'Quindici bande parametriche, disegnate come rispondono davvero i filtri e non come sono state richieste.',
  'dsp.eq.band': 'Banda',
  'dsp.eq.bands': 'Bande',
  'dsp.eq.shape': 'Tipo di banda',
  'dsp.eq.bandOff': 'Spenta',
  'dsp.eq.addLeft': 'Aggiungi una banda sotto questa',
  'dsp.eq.addRight': 'Aggiungi una banda sopra questa',
  'dsp.eq.type.peak': 'Campana',
  'dsp.eq.type.lowShelf': 'Shelf bassi',
  'dsp.eq.type.highShelf': 'Shelf alti',
  'dsp.eq.type.notch': 'Notch',
  'dsp.eq.type.lowPass': 'Passa-basso',
  'dsp.eq.type.highPass': 'Passa-alto',
  'dsp.eq.type.bandPass': 'Passa-banda',
  'dsp.eq.frequency': 'Freq',
  'dsp.eq.gain': 'Guadagno',
  'dsp.eq.preamp': 'Preamp',
  'dsp.eq.character': 'Carattere',
  'dsp.eq.subsonic': 'Subsonico',
  'dsp.eq.fuzz': 'Fuzz',
  'dsp.eq.monoBelow': 'Mono sotto',
  'dsp.eq.quality': 'Larghezza',

  'dsp.exciter.title': 'Exciter',
  'dsp.exciter.description':
    'Genera le armoniche acute che un codec con perdita ha scartato. Le inventa, non le recupera.',
  'dsp.exciter.crossover': 'Sopra',
  'dsp.exciter.drive': 'Intensità',
  'dsp.exciter.mix': 'Quantità',

  'dsp.compressor.title': 'Compressore multibanda',
  'dsp.compressor.description':
    'Uniforma il livello in tre bande di frequenza in modo indipendente.',
  'dsp.compressor.band.low': 'Bassi',
  'dsp.compressor.band.mid': 'Medi',
  'dsp.compressor.band.high': 'Alti',
  'dsp.compressor.crossoverLow': 'Taglio bassi / medi',
  'dsp.compressor.crossoverHigh': 'Taglio medi / alti',
  'dsp.compressor.threshold': 'Soglia',
  'dsp.compressor.ratio': 'Rapporto',
  'dsp.compressor.attack': 'Attacco',
  'dsp.compressor.release': 'Rilascio',
  'dsp.compressor.makeup': 'Compensazione',

  'dsp.maximizer.title': 'Maximizer',
  'dsp.maximizer.description':
    'Alza il livello generale senza lasciare che i picchi superino il tetto.',
  'dsp.maximizer.ceiling': 'Tetto',
  'dsp.maximizer.lookAhead': 'Anticipo',
  'dsp.maximizer.release': 'Rilascio',
  'dsp.maximizer.headroomHint':
    'Il tetto lascia spazio ai {gain} dB che il tuo profilo di uscita aggiunge dopo.',

  'tabs.dsp': 'DSP',
};

export default dsp;
