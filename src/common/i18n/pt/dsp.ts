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
  'dsp.idle':
    'Inicia quando você toca algo da Biblioteca. Ele processa o reprodutor do próprio FluidEQ, então não tem nada a fazer até carregar uma faixa.',
  'dsp.unavailable':
    'O processamento de áudio não conseguiu iniciar. A reprodução não é afetada.',
  'dsp.presets': 'Predefinições',
  'dsp.preset.flat': 'Desligado',
  'dsp.preset.lossyRepair': 'Reparar comprimido',
  'dsp.preset.loud': 'Alto',
  'dsp.bypassed': 'Ignorado',
  'dsp.enabled': 'Ligado',

  'dsp.eqPreset.custom': 'Personalizado',
  'dsp.eqPreset.label': 'Predefinição',
  'dsp.eqPreset.flat': 'Plano',
  'dsp.eqPreset.vShape': 'Forma em V',
  'dsp.eqPreset.rock': 'Rock',
  'dsp.eqPreset.pop': 'Pop',
  'dsp.eqPreset.jazz': 'Jazz',
  'dsp.eqPreset.classical': 'Clássica',
  'dsp.eqPreset.electronic': 'Eletrônica',
  'dsp.eqPreset.hiphop': 'Hip-hop',
  'dsp.eqPreset.acoustic': 'Acústica',
  'dsp.eqPreset.vocal': 'Voz',
  'dsp.eqPreset.podcast': 'Podcast',
  'dsp.eqPreset.bassBoost': 'Reforço de graves',
  'dsp.eqPreset.trebleBoost': 'Reforço de agudos',
  'dsp.eqPreset.loudness': 'Loudness',
  'dsp.eqPreset.lateNight': 'Tarde da noite',
  'dsp.eqPreset.smallSpeakers': 'Alto-falantes pequenos',
  'dsp.eqPreset.car': 'Carro',
  'dsp.eqPreset.gaming': 'Jogos',
  'dsp.eqPreset.movie': 'Cinema',
  'dsp.eqPreset.warm': 'Quente',
  'dsp.eqPreset.air': 'Ar',

  'dsp.eqPreset.import': 'Importar',
  'dsp.eqPreset.export': 'Exportar',
  'dsp.eqPreset.imported': '{count} filtros carregados.',
  'dsp.eqPreset.importSkipped':
    '{count} filtros carregados, {skipped} ignorados.',
  'dsp.eqPreset.importEmpty':
    'Este equalizador não conseguiu ler nenhum filtro.',
  'dsp.eqPreset.importFailed': 'Não foi possível ler esse ficheiro.',
  'dsp.eqPreset.importPreamp': 'Pré-amplificação definida para {gain} dB.',

  'dsp.eq.rack': 'Bandas',
  'dsp.eqModel.label': 'Caráter',
  'dsp.eqModel.clean': 'Nenhum',
  'dsp.eqModel.proportional': 'Focado',
  'dsp.eqModel.wide': 'Amplo',
  'dsp.eqEngine.label': 'Motor',
  'dsp.eqEngine.serial': 'Em série',
  'dsp.eqEngine.parallel': 'Em paralelo',
  'dsp.eqOversample.label': 'Sobreamostragem',
  'dsp.eqOversample.off': 'Não',
  'dsp.eqOversample.on': '2x',
  'dsp.eqImport.title': 'Importar uma curva de EQ',
  'dsp.eqImport.hint':
    'Cola uma curva do Squiglink, AutoEq ou Equalizer APO — ou escolhe o ficheiro que a contém.',
  'dsp.eqImport.placeholder':
    'Preamp: -5.4 dB\nFilter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
  'dsp.eqImport.chooseFile': 'Escolher ficheiro',
  'dsp.eqImport.apply': 'Importar',
  'dsp.eqImport.cancel': 'Cancelar',

  'dsp.eq.title': 'Equalizador',
  'dsp.eq.description':
    'Quinze bandas paramétricas, desenhadas como os filtros realmente respondem e não como foram pedidos.',
  'dsp.eq.band': 'Banda',
  'dsp.eq.bands': 'Bandas',
  'dsp.eq.shape': 'Tipo de banda',
  'dsp.eq.bandOff': 'Desligada',
  'dsp.eq.addLeft': 'Adicionar uma banda abaixo desta',
  'dsp.eq.addRight': 'Adicionar uma banda acima desta',
  'dsp.eq.type.peak': 'Sino',
  'dsp.eq.type.lowShelf': 'Shelf grave',
  'dsp.eq.type.highShelf': 'Shelf agudo',
  'dsp.eq.type.notch': 'Notch',
  'dsp.eq.type.lowPass': 'Passa-baixa',
  'dsp.eq.type.highPass': 'Passa-alta',
  'dsp.eq.type.bandPass': 'Passa-banda',
  'dsp.eq.frequency': 'Freq',
  'dsp.eq.gain': 'Ganho',
  'dsp.eq.preamp': 'Pré-amp',
  'dsp.eq.character': 'Caráter',
  'dsp.eq.subsonic': 'Subgraves',
  'dsp.eq.quality': 'Largura',

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
