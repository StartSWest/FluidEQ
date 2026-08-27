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
  'dsp.preset.lossyRepair': 'Reparar comprimido',
  'dsp.preset.loud': 'Alto',
  'dsp.preset.broadcast': 'Radiofónico',
  'dsp.bypassed': 'Ignorado',
  'dsp.enabled': 'Ligado',

  'dsp.normalizer.title': 'Normalizador',
  'dsp.normalizer.description':
    'Mede uma vez a fonte completa e aplica um único ganho estéreo ligado antes do Exciter e do EQ. Sem bombeamento nem seguidor RMS móvel.',
  'dsp.normalizer.mode': 'Modo de normalização',
  'dsp.normalizer.off': 'Desligado',
  'dsp.normalizer.truePeak': 'Pico real',
  'dsp.normalizer.loudness': 'Sonoridade',
  'dsp.normalizer.ceiling': 'Teto de pico',
  'dsp.normalizer.target': 'Alvo de sonoridade',
  'dsp.normalizer.analysis': 'Análise da fonte',
  'dsp.normalizer.analyzing': 'Analisando a faixa completa · {progress}%',
  'dsp.normalizer.unavailable':
    'Não foi possível analisar esta fonte. Ela será reproduzida no nível original.',
  'dsp.normalizer.waiting': 'Reproduza uma faixa da Biblioteca para medi-la.',
  'dsp.normalizer.measuredPeak': 'Pico medido',
  'dsp.normalizer.measuredLoudness': 'Sonoridade integrada',
  'dsp.normalizer.appliedGain': 'Ganho aplicado',
  'dsp.normalizer.limitedByCeiling':
    '{{requested}} necessários — limitado pelo teto de pico',
  'dsp.normalizer.limitedByMaxGain':
    '{{requested}} necessários — ganho máximo atingido',
  'dsp.normalizer.limitedByMinGain':
    '{{requested}} necessários — atenuação máxima atingida',
  'dsp.normalizer.limitedByGate':
    'Silencioso demais para medir — nenhum ganho aplicado',
  'dsp.normalizer.liveMeter': 'Antes / depois ao vivo',
  'dsp.normalizer.before': 'Antes',
  'dsp.normalizer.after': 'Depois',
  'dsp.normalizer.liveMeterHint':
    'Picos de amostra reais medidos diretamente antes e depois do Normalizador. A marca zero é 0 dBFS.',
  'dsp.normalizer.honesty':
    'Evita sobrecarga posterior; não pode reconstruir distorção já gravada no arquivo.',

  'dsp.crossfade.title': 'Transição cruzada',
  'dsp.crossfade.description':
    'Sobrepõe as faixas de saída e entrada após a normalização, antes do Exciter e EQ.',
  'dsp.crossfade.outgoing': 'Saindo',
  'dsp.crossfade.incoming': 'Entrando',
  'dsp.crossfade.duration': 'Duração',
  'dsp.crossfade.curve': 'Curva da transição',
  'dsp.crossfade.equalPower': 'Potência igual',
  'dsp.crossfade.smooth': 'Suave',
  'dsp.crossfade.linear': 'Linear',
  'dsp.crossfade.hint':
    'Aplica-se ao Próximo manual e aos finais naturais. A busca continua imediata.',

  'dsp.eqPreset.custom': 'Personalizado',
  'dsp.eqPreset.label': 'Predefinição',
  'dsp.eqPreset.saved': 'Os teus',
  'dsp.eqPresetGroup.basic': 'Básicos',
  'dsp.eqPresetGroup.genre': 'Géneros',
  'dsp.eqPresetGroup.voice': 'Voz',
  'dsp.eqPresetGroup.scene': 'Situação',
  'dsp.eqPresetGroup.device': 'Dispositivo',
  'dsp.eqPresetGroup.character': 'Carácter',
  'dsp.eqPresetGroup.repair': 'Correções',
  'dsp.eqPreset.default': 'Predefinição',
  'dsp.eqPreset.reset': 'Repor',
  'dsp.eqPreset.previous': 'Predefinição anterior',
  'dsp.eqPreset.next': 'Predefinição seguinte',
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
  'dsp.eqPreset.deEss': 'De-esser',
  'dsp.eqPreset.tameBoom': 'Domar o ronco',
  'dsp.eqPreset.tape': 'Fita',
  'dsp.eqPreset.vinyl': 'Vinil',
  'dsp.eqPreset.liveVocal': 'Voz ao vivo',
  'dsp.eqPreset.orchestra': 'Orquestra',
  'dsp.eqPreset.metal': 'Metal',
  'dsp.eqPreset.punk': 'Punk',
  'dsp.eqPreset.reggae': 'Reggae',
  'dsp.eqPreset.country': 'Country',
  'dsp.eqPreset.blues': 'Blues',
  'dsp.eqPreset.lofi': 'Lo-fi',
  'dsp.eqPreset.ambient': 'Ambiente',
  'dsp.eqPreset.trap': 'Trap',
  'dsp.eqPreset.drumBass': 'Drum & bass',
  'dsp.eqPreset.piano': 'Piano',
  'dsp.eqPreset.strings': 'Cordas',
  'dsp.eqPreset.sibilance': 'Sibilância',
  'dsp.eqPreset.mudCut': 'Tirar lama',
  'dsp.eqPreset.harshTamer': 'Domar dureza',
  'dsp.eqPreset.earbuds': 'Auriculares in-ear',
  'dsp.eqPreset.laptop': 'Portátil',
  'dsp.eqPreset.openBack': 'Auscultadores abertos',
  'dsp.eqPreset.audiobook': 'Audiolivro',
  'dsp.eqPreset.nightMovie': 'Cinema à noite',

  'dsp.eqPreset.import': 'Importar',
  'dsp.eqPreset.export': 'Exportar',
  'dsp.eqSave.title': 'Guardar predefinição',
  'dsp.eqSave.hint': 'Guarda o rack tal como está.',
  'dsp.eqSave.placeholder': 'Nome',
  'dsp.eqSave.save': 'Guardar',
  'dsp.eqSave.delete': 'Eliminar',
  'dsp.eqSave.overwrite':
    'Já existe uma predefinição com esse nome e será substituída.',
  'dsp.eqSave.saved': 'Guardado como {name}.',
  'dsp.eqSave.deleted': 'Eliminado {name}.',
  'dsp.eqSave.imported': 'Importado {name}.',
  'dsp.eqShare.share': 'Partilhar',
  'dsp.eqShare.hint': 'Guarda este rack como ficheiro que outros podem abrir.',
  'dsp.eqShare.saved': 'Ficheiro de predefinição guardado.',
  'dsp.eqShare.failed': 'Não foi possível guardar o ficheiro de predefinição.',
  'dsp.eq.isolate': 'Isolar',
  'dsp.eq.isolateHint': 'Ouvir apenas o que o EQ altera.',
  'dsp.eq.isolateOn':
    'O sinal seco foi removido — apenas as alterações do EQ são audíveis.',
  'dsp.eqPreset.imported': '{count} filtros carregados.',
  'dsp.eqPreset.importSkipped':
    '{count} filtros carregados, {skipped} ignorados.',
  'dsp.eqPreset.importEmpty':
    'Este equalizador não conseguiu ler nenhum filtro.',
  'dsp.eqPreset.importFailed': 'Não foi possível ler esse ficheiro.',
  'dsp.eq.rack': 'Bandas',
  'dsp.eqModel.label': 'Caráter',
  'dsp.eqModel.clean': 'Nenhum',
  'dsp.eqModel.proportional': 'Focado',
  'dsp.eqModel.wide': 'Amplo',
  'dsp.eqEngine.label': 'Motor',
  'dsp.eqPhase.label': 'Fase',
  'dsp.eqPhase.minimum': 'Mínima',
  'dsp.eqPhase.linear': 'Linear',
  'dsp.eqPhase.linearLatency': 'Linear (+{ms} ms)',
  'dsp.eqEngine.serial': 'Em série',
  'dsp.eqEngine.parallel': 'Em paralelo',
  'dsp.eqStereo.label': 'Aplica a',
  'dsp.eqStereo.stereo': 'Estéreo',
  'dsp.eqStereo.mid': 'Só centro',
  'dsp.eqStereo.side': 'Só lados',
  'dsp.eqOversample.label': 'Sobreamostragem',
  'dsp.eqOversample.off': 'Não',
  'dsp.eqOversample.on': '2x',
  'dsp.eqImport.title': 'Importar uma curva de EQ',
  'dsp.eqImport.hint':
    'Cola uma curva do Squiglink, AutoEq ou Equalizer APO — ou escolhe o ficheiro que a contém.',
  'dsp.eqImport.placeholder': 'Filter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
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
  'dsp.eq.trim': 'Ajuste auto',
  'dsp.eq.adaptive': 'Adaptativo',
  'dsp.eq.trimFixed': 'Fixo',
  'dsp.eq.trimOff': 'Sem ajuste',
  'dsp.eq.adaptiveHint':
    'Mede a música e devolve a margem que não é precisa. Desligado mantém o nível totalmente estável.',
  'dsp.eq.trimHint':
    'Margem reservada antes das bandas para esta curva não saturar.',
  'dsp.eq.overUnity': '{gain} dB acima',
  'dsp.eq.character': 'Caráter',
  'dsp.eq.subsonic': 'Subgraves',
  'dsp.eq.fuzz': 'Fuzz',
  'dsp.eq.monoBelow': 'Mono abaixo',
  'dsp.eq.phase': 'Fase',
  'dsp.eq.phaseOff': 'Desligado',
  'dsp.eq.phaseNeedle': 'Correlação',
  'dsp.eq.phaseScope': 'Goniómetro',
  'dsp.eq.quality': 'Largura',
  'dsp.eq.threshold': 'Limiar',
  'dsp.eq.legend.curve': 'Curva',
  'dsp.eq.legend.spectrum': 'Saída',
  'dsp.eq.legend.atRest': 'Em repouso',
  'dsp.eq.legend.threshold': 'Limiar',
  'dsp.eq.legend.subsonic': 'Subgraves',
  'dsp.eq.legend.input': 'Entrada',
  'dsp.eq.inputMark': 'entrada {gain} dB',
  'dsp.eq.legend.gain': 'ganho',
  'dsp.eq.legend.level': 'nível por banda',
  'dsp.eq.thresholdMark': 'limiar {level} dBFS',
  'dsp.eq.dynamic': 'Dinâmico',
  'dsp.eq.dynamicOn': 'Dinâmico ON',
  'dsp.eq.dynamicHint':
    'Age apenas enquanto esta banda ultrapassa o seu limiar.',

  'dsp.exciter.title': 'Excitador',
  'dsp.exciter.description':
    'Gera harmónicos que nunca estiveram no sinal. Três bandas, cada uma escolhendo ordens pares para corpo ou ímpares para ar — mais Orgânico, para a densidade que um equalizador não consegue acrescentar.',
  'dsp.exciter.bandFreq': 'Freq.',
  'dsp.exciter.bandRange': 'Alcance',
  'dsp.exciter.drive': 'Intensidade',
  'dsp.exciter.mix': 'Quantidade',
  'dsp.exciter.band.low': 'Graves',
  'dsp.exciter.band.mid': 'Médios',
  'dsp.exciter.band.high': 'Agudos',
  'dsp.exciter.texture': 'Textura',
  'dsp.exciter.organic': 'Orgânico',
  'dsp.exciter.organicHint':
    'Adiciona corpo suave de harmónicos pares na região escolhida. Ideal para tornar uma apresentação limpa e metálica, inclusive com drivers de titânio, mais quente e orgânica sem perder detalhe.',
  'dsp.exciter.organicAmount': 'Corpo',
  'dsp.exciter.organicFocus': 'Foco',
  'dsp.exciter.organicRange': 'Alcance',
  'dsp.exciter.align': 'Tempo',
  'dsp.exciter.alignHint':
    'Deixa os agudos chegarem primeiro e atrasa suavemente médios e graves para ataques claros e impacto redondo. Não adiciona harmónicos.',
  'dsp.exciter.alignAmount': 'Quantidade',
  'dsp.exciter.isolate': 'Isolar',
  'dsp.exciter.isolateHint':
    'Ouve apenas os harmónicos que esta etapa acrescenta.',
  'dsp.exciter.isolateOn':
    'Sinal direto desligado — ouves apenas o que isto acrescenta.',

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

  'dsp.master.title': 'Master',
  'dsp.master.description':
    'Controlo transparente da saída final após todos os processadores. Não altera o nível que alimenta o EQ, o Exciter ou as outras etapas.',
  'dsp.master.outputTrim': 'Ganho de saída',
  'dsp.master.autoHeadroom': 'Margem automática',
  'dsp.master.autoHeadroomHint':
    'Reduz suavemente apenas os picos que se aproximam do teto de pico verdadeiro estéreo escolhido.',
  'dsp.master.ceiling': 'Teto',
  'dsp.master.release': 'Liberação',
  'dsp.master.loudnessMaximize': 'Maximizar LUFS',
  'dsp.master.loudnessMaximizeHint':
    'Aplica {gain} dB com base na medição da faixa completa e mantém o pico real final abaixo do teto. O ganho é constante; apenas os picos são controlados.',
  'dsp.master.loudnessTarget': 'Alvo de sonoridade',
  'dsp.master.meter': 'Saída final',
  'dsp.master.safetyHint':
    'Deteção de pico verdadeiro {factor}× · teto de {ceiling} dBTP · joelho suave de {knee} dB · ligação estéreo.',
  'dsp.master.manualHint':
    'Saída manual: sem redução de picos. Níveis acima de 0 dBFS irão saturar.',
  'dsp.master.truePeak': 'TP entrada',
  'dsp.master.gainReduction': 'Redução de ganho',
  'dsp.master.devBackend': 'Motor A/B',
  'dsp.master.devBackendNative': 'Nativo (C++)',
  'dsp.master.devBackendTypescript': 'TypeScript',
  'dsp.master.devBackendHint':
    'Apenas em desenvolvimento: alterna toda a cadeia de DSP entre o worklet TypeScript e o motor nativo, para comparar os dois na mesma faixa.',
  'dsp.master.devSafety': 'Segurança A/B',
  'dsp.master.devSafetyHint':
    'Apenas desenvolvimento: ignora toda a proteção final para ouvir exatamente o que ela altera.',
  'dsp.master.devSafetySpec':
    'Proteção de emergência acima de +10 dBTP · 2 ms de antecipação · correção sem liberação · proteção DC a 3 Hz · reparação de amostras inválidas',
  'dsp.master.dcCorrection': 'Deslocamento DC',
  'dsp.master.faults': 'Falhas',
  'dsp.master.graph.spectrum': 'Espectro final',
  'dsp.master.graph.trim': 'Ganho de saída',
  'dsp.master.graph.applied': 'Ganho aplicado',
  'dsp.master.graph.trimLine': 'Ganho {gain} dB',
  'dsp.master.graph.appliedLine': 'Aplicado {gain} dB',
  'dsp.master.graph.dcGuard': 'Proteção DC',
  'dsp.master.graph.peakWarning': 'Aviso · saída a {peak} dBTP acima do teto',
  'dsp.master.graph.peakFixed': 'Pico controlado · {gain} dB de redução',
  'dsp.master.graph.peakSafe': 'Pico verdadeiro dentro do teto',
  'dsp.master.graph.dcFixed': 'Deslocamento DC removido · {amount}',
  'dsp.master.graph.dcClean': 'Deslocamento DC limpo',
  'dsp.master.graph.faultFixed':
    'Reparadas {count} amostras inválidas ou com falha',
  'dsp.master.graph.faultClean': 'Amostras válidas',
  'dsp.master.graph.safetyActive': 'Proteções ativas',
  'dsp.master.graph.safetyBypassed': 'Aviso · proteções ignoradas',
  'dsp.master.graph.loudnessActive':
    'Maximizar LUFS · +{gain} dB rumo a {target} LUFS',

  'tabs.dsp': 'DSP',
};

export default dsp;
