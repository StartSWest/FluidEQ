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
  'dsp.unavailable':
    "Le traitement audio n'a pas pu démarrer sur cette machine.",
  'dsp.presets': 'Préréglages',
  'dsp.preset.flat': 'Désactivé',
  'dsp.preset.lossyRepair': 'Réparer le compressé',
  'dsp.preset.loud': 'Fort',
  'dsp.enabled': 'Activé',

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
  'dsp.maximizer.headroomHint':
    'Le plafond laisse la place aux {gain} dB que votre profil de sortie ajoute ensuite.',

  'tabs.dsp': 'DSP',
};

export default dsp;
