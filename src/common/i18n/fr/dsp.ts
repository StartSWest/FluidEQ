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
    "S'applique à la musique lue dans FluidEQ. Cela ne change rien à Spotify, YouTube ni aux autres applications.",
  'dsp.idle':
    "Démarre quand vous lisez quelque chose depuis la Bibliothèque. Il traite le lecteur de FluidEQ, il n'a donc rien à faire tant qu'aucun morceau n'est chargé.",
  'dsp.unavailable':
    "Le traitement audio n'a pas pu démarrer. La lecture n'est pas affectée.",
  'dsp.presets': 'Préréglages',
  'dsp.preset.flat': 'Désactivé',
  'dsp.preset.lossyRepair': 'Réparer le compressé',
  'dsp.preset.loud': 'Fort',
  'dsp.bypassed': 'Contourné',
  'dsp.enabled': 'Activé',

  'dsp.eqPreset.custom': 'Personnalisé',
  'dsp.eqPreset.label': 'Préréglage',
  'dsp.eqPreset.default': 'Par défaut',
  'dsp.eqPreset.reset': 'Réinitialiser',
  'dsp.eqPreset.flat': 'Plat',
  'dsp.eqPreset.vShape': 'Forme en V',
  'dsp.eqPreset.rock': 'Rock',
  'dsp.eqPreset.pop': 'Pop',
  'dsp.eqPreset.jazz': 'Jazz',
  'dsp.eqPreset.classical': 'Classique',
  'dsp.eqPreset.electronic': 'Électronique',
  'dsp.eqPreset.hiphop': 'Hip-hop',
  'dsp.eqPreset.acoustic': 'Acoustique',
  'dsp.eqPreset.vocal': 'Voix',
  'dsp.eqPreset.podcast': 'Podcast',
  'dsp.eqPreset.bassBoost': 'Renfort de basses',
  'dsp.eqPreset.trebleBoost': 'Renfort d’aigus',
  'dsp.eqPreset.loudness': 'Loudness',
  'dsp.eqPreset.lateNight': 'Tard le soir',
  'dsp.eqPreset.smallSpeakers': 'Petits haut-parleurs',
  'dsp.eqPreset.car': 'Voiture',
  'dsp.eqPreset.gaming': 'Jeux',
  'dsp.eqPreset.movie': 'Cinéma',
  'dsp.eqPreset.warm': 'Chaud',
  'dsp.eqPreset.air': 'Air',

  'dsp.eqPreset.import': 'Importer',
  'dsp.eqPreset.export': 'Exporter',
  'dsp.eqPreset.imported': '{count} filtres chargés.',
  'dsp.eqPreset.importSkipped': '{count} filtres chargés, {skipped} ignorés.',
  'dsp.eqPreset.importEmpty': 'Cet égaliseur n’a pu lire aucun filtre.',
  'dsp.eqPreset.importFailed': 'Ce fichier n’a pas pu être lu.',
  'dsp.eqPreset.importPreamp':
    'Ses {gain} dB de marge sont mesurés ici à la place.',

  'dsp.eq.rack': 'Bandes',
  'dsp.eqModel.label': 'Caractère',
  'dsp.eqModel.clean': 'Aucun',
  'dsp.eqModel.proportional': 'Focalisé',
  'dsp.eqModel.wide': 'Large',
  'dsp.eqEngine.label': 'Moteur',
  'dsp.eqPhase.label': 'Phase',
  'dsp.eqPhase.minimum': 'Minimale',
  'dsp.eqPhase.linear': 'Linéaire',
  'dsp.eqPhase.linearLatency': 'Linéaire (+{ms} ms)',
  'dsp.eqEngine.serial': 'Série',
  'dsp.eqEngine.parallel': 'Parallèle',
  'dsp.eqStereo.label': 'Agit sur',
  'dsp.eqStereo.stereo': 'Stéréo',
  'dsp.eqStereo.mid': 'Centre seul',
  'dsp.eqStereo.side': 'Côtés seuls',
  'dsp.eqOversample.label': 'Suréchantillonnage',
  'dsp.eqOversample.off': 'Non',
  'dsp.eqOversample.on': '2x',
  'dsp.eqImport.title': 'Importer une courbe d’égalisation',
  'dsp.eqImport.hint':
    'Collez une courbe de Squiglink, AutoEq ou Equalizer APO — ou choisissez le fichier qui la contient.',
  'dsp.eqImport.placeholder':
    'Preamp: -5.4 dB\nFilter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
  'dsp.eqImport.chooseFile': 'Choisir un fichier',
  'dsp.eqImport.apply': 'Importer',
  'dsp.eqImport.cancel': 'Annuler',

  'dsp.eq.title': 'Égaliseur',
  'dsp.eq.description':
    'Quinze bandes paramétriques, tracées comme les filtres répondent réellement et non comme on les a demandés.',
  'dsp.eq.band': 'Bande',
  'dsp.eq.bands': 'Bandes',
  'dsp.eq.shape': 'Forme de bande',
  'dsp.eq.bandOff': 'Désactivée',
  'dsp.eq.addLeft': 'Ajouter une bande en dessous de celle-ci',
  'dsp.eq.addRight': 'Ajouter une bande au-dessus de celle-ci',
  'dsp.eq.type.peak': 'Cloche',
  'dsp.eq.type.lowShelf': 'Shelf grave',
  'dsp.eq.type.highShelf': 'Shelf aigu',
  'dsp.eq.type.notch': 'Coupe-bande',
  'dsp.eq.type.lowPass': 'Passe-bas',
  'dsp.eq.type.highPass': 'Passe-haut',
  'dsp.eq.type.bandPass': 'Passe-bande',
  'dsp.eq.frequency': 'Fréq',
  'dsp.eq.gain': 'Gain',
  'dsp.eq.preamp': 'Préampli',
  'dsp.eq.trim': 'Réglage auto',
  'dsp.eq.overUnity': '{gain} dB au-dessus',
  'dsp.eq.trimHint':
    'Marge prise avant les bandes pour que cette courbe ne sature pas.',
  'dsp.eq.character': 'Caractère',
  'dsp.eq.subsonic': 'Subsonique',
  'dsp.eq.fuzz': 'Fuzz',
  'dsp.eq.monoBelow': 'Mono sous',
  'dsp.eq.phase': 'Phase',
  'dsp.eq.quality': 'Largeur',
  'dsp.eq.threshold': 'Seuil',
  'dsp.eq.dynamic': 'Dynamique',
  'dsp.eq.dynamicOn': 'Dynamique ON',
  'dsp.eq.dynamicHint':
    'Agit seulement tant que cette bande dépasse son seuil.',

  'dsp.exciter.title': 'Exciteur',
  'dsp.exciter.description':
    "Génère les harmoniques aiguës qu'un encodeur avec perte a supprimées. Il les invente, il ne les restaure pas.",
  'dsp.exciter.crossover': 'Au-dessus de',
  'dsp.exciter.drive': 'Intensité',
  'dsp.exciter.mix': 'Quantité',

  'dsp.compressor.title': 'Compresseur multibande',
  'dsp.compressor.description':
    'Égalise le niveau dans trois bandes de fréquences indépendamment.',
  'dsp.compressor.band.low': 'Graves',
  'dsp.compressor.band.mid': 'Médiums',
  'dsp.compressor.band.high': 'Aigus',
  'dsp.compressor.crossoverLow': 'Coupure graves / médiums',
  'dsp.compressor.crossoverHigh': 'Coupure médiums / aigus',
  'dsp.compressor.threshold': 'Seuil',
  'dsp.compressor.ratio': 'Ratio',
  'dsp.compressor.attack': 'Attaque',
  'dsp.compressor.release': 'Relâchement',
  'dsp.compressor.makeup': 'Compensation',

  'dsp.maximizer.title': 'Maximiseur',
  'dsp.maximizer.description':
    'Augmente le niveau global sans laisser les crêtes dépasser le plafond.',
  'dsp.maximizer.ceiling': 'Plafond',
  'dsp.maximizer.lookAhead': 'Anticipation',
  'dsp.maximizer.release': 'Relâchement',

  'tabs.dsp': 'DSP',
};

export default dsp;
