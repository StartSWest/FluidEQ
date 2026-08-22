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
    'Aplica-se à música tocada dentro do FluidEQ. Não altera o Spotify, o YouTube nem outros aplicativos.',
  'dsp.unavailable':
    'O processamento de áudio não conseguiu iniciar nesta máquina.',
  'dsp.presets': 'Predefinições',
  'dsp.preset.flat': 'Desligado',
  'dsp.preset.lossyRepair': 'Reparar comprimido',
  'dsp.preset.loud': 'Alto',
  'dsp.enabled': 'Ligado',

  'dsp.exciter.title': 'Excitador',
  'dsp.exciter.description':
    'Gera os harmônicos agudos que um codec com perdas descartou. Ele os inventa; não os recupera.',
  'dsp.exciter.crossover': 'Acima de',
  'dsp.exciter.drive': 'Intensidade',
  'dsp.exciter.mix': 'Quantidade',

  'dsp.compressor.title': 'Compressor multibanda',
  'dsp.compressor.description':
    'Nivela o volume em três faixas de frequência de forma independente.',
  'dsp.compressor.band.low': 'Graves',
  'dsp.compressor.band.mid': 'Médios',
  'dsp.compressor.band.high': 'Agudos',
  'dsp.compressor.crossoverLow': 'Corte graves / médios',
  'dsp.compressor.crossoverHigh': 'Corte médios / agudos',
  'dsp.compressor.threshold': 'Limiar',
  'dsp.compressor.ratio': 'Proporção',
  'dsp.compressor.attack': 'Ataque',
  'dsp.compressor.release': 'Liberação',
  'dsp.compressor.makeup': 'Compensação',

  'dsp.maximizer.title': 'Maximizador',
  'dsp.maximizer.description':
    'Eleva o nível geral sem deixar os picos passarem do teto.',
  'dsp.maximizer.ceiling': 'Teto',
  'dsp.maximizer.lookAhead': 'Antecipação',
  'dsp.maximizer.release': 'Liberação',
  'dsp.maximizer.headroomHint':
    'O teto deixa espaço para os {gain} dB que o seu perfil de saída adiciona depois.',

  'tabs.dsp': 'DSP',
};

export default dsp;
