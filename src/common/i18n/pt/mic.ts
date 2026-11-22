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
  'mic.tab': 'Microfone',
  'mic.label': 'Microfone',
  'mic.pickHint': 'Escolha o microfone cujo som você quer moldar',
  'mic.list.heading': 'Microfones neste PC',
  'mic.list.on': 'Ativo',
  'mic.list.off': 'Não configurado',
  'mic.live': 'Ao vivo em todos os apps · baixa latência {ms} ms',
  'mic.notSetUp': 'Ainda não configurado neste microfone',
  'mic.state.opening': 'Abrindo o microfone…',
  'mic.state.noInput':
    'O Windows não mostra nenhuma entrada para este microfone agora',
  'mic.state.blocked': 'O Windows não deixou o FluidEQ abrir este microfone',
  'mic.state.waiting': 'Microfone aberto · aguardando o motor iniciar nele',
  'mic.meter.gateOpen': 'Voz passando',
  'mic.meter.gateClosed': 'Gate fechado',
  'mic.meter.compressor': 'Compressor',
  'mic.meter.limiter': 'Limitador',
  'mic.monitor.label': 'Ouvir a mim mesmo',
  'mic.monitor.hint':
    'Toca o que os outros ouvem na saída que você está ouvindo',
  'mic.monitor.warning':
    'Use fones de ouvido: nas caixas de som, sua voz volta para o microfone e microfona.',
  'mic.effectsOff.short':
    'Os aprimoramentos de áudio do Windows estão desativados neste microfone',
  'mic.effectsOff.title':
    'Os aprimoramentos de áudio estão desativados em {mic}',
  'mic.effectsOff.body':
    'Desativados, o Windows não aplica nenhum efeito a este microfone e o FluidEQ não consegue processá-lo. Ative “Aprimoramentos de áudio” nas propriedades do microfone.',
  'mic.effectsOff.button': 'Abrir as configurações de som do Windows',
  'mic.picture.label':
    'Sua voz: apagado o que o microfone capta, brilhante o que os outros ouvem',
  'mic.picture.raw': 'Seu microfone',
  'mic.picture.heard': 'O que os outros ouvem',
  'mic.picture.gate': 'Gate',
  'mic.profile.label': 'Perfil do microfone',
  'mic.profile.pickHint':
    'Comece por um perfil feito para o jeito como você usa o microfone',
  'mic.profile.group.use': 'Por uso',
  'mic.profile.group.mic': 'Por microfone',
  'mic.profile.tuned': 'ajustado',
  'mic.profile.stream': 'Streaming',
  'mic.profile.stream.hint': 'Quente, próximo e estável para Twitch e YouTube',
  'mic.profile.podcast': 'Podcast',
  'mic.profile.podcast.hint': 'Uma voz natural, com controle suave',
  'mic.profile.chat': 'Chat de jogo',
  'mic.profile.chat.hint':
    'Clara e à frente no Discord e no chat da equipe, nada entre as palavras',
  'mic.profile.sing': 'Canto',
  'mic.profile.sing.hint':
    'Aberto e arejado, nada que bombeie, cada respiração mantida',
  'mic.profile.broadcast': 'Rádio',
  'mic.profile.broadcast.hint':
    'Voz de rádio: graves encorpados, firme e densa',
  'mic.profile.noisy': 'Ambiente barulhento',
  'mic.profile.noisy.hint':
    'Ventiladores, crianças, trânsito: limpador e gate no máximo',
  'mic.profile.meet': 'Reuniões',
  'mic.profile.meet.hint':
    'Teams e Zoom: palavras claras, deixando a limpeza por conta deles',
  'mic.profile.laptop': 'Microfone do notebook',
  'mic.profile.laptop.hint':
    'Fino, distante e com reverberação: corte de graves alto, limpador forte',
  'mic.profile.headset': 'Microfone do headset',
  'mic.profile.headset.hint':
    'Uma cápsula pequena perto da boca: o calor de volta, as plosivas fora',
  'mic.reset': 'Voltar a {profile}',
  'mic.setup.title': 'O FluidEQ Engine ainda não está em {mic}.',
  'mic.setup.body':
    'O Windows pede permissão uma única vez. Suas saídas continuam tocando durante a configuração.',
  'mic.setup.button': 'Configurar neste microfone',
  'mic.setup.working': 'Configurando…',
  'mic.setup.declined': 'O Windows não deu permissão, então nada foi alterado.',
  'mic.setup.failed': 'Não foi possível configurar neste microfone.',
  'mic.notFluid.title':
    'O som próprio de um microfone é tocado pelo FluidEQ Engine.',
  'mic.notFluid.body':
    'O som dele fica guardado e passa a tocar assim que o FluidEQ Engine for o escolhido.',
  'mic.empty.title': 'Nenhum microfone encontrado',
  'mic.empty.body':
    'Conecte um microfone ou atualize o FluidEQ Engine para que ele consiga listá-los.',
  'mic.stage.lowCut': 'Corte graves',
  'mic.stage.cleaner': 'Limpador de voz',
  'mic.stage.gate': 'Gate',
  'mic.stage.deEsser': 'De-esser',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'Compressor',
  'mic.stage.limiter': 'Limitador',
  'mic.lowCut.title': 'Corte graves',
  'mic.lowCut.description':
    'Tira o ronco, as batidas na mesa e o ventilador abaixo da voz, antes que o limpador os ouça.',
  'mic.lowCut.group.below': 'Abaixo da voz',
  'mic.lowCut.group.belowHint':
    'Perto do microfone tira o grave extra que uma voz ganha a poucos centímetros da cápsula.',
  'mic.lowCut.cut': 'Corta abaixo',
  'mic.lowCut.proximity': 'Perto do microfone',
  'mic.lowCut.group.pops': 'Plosivas',
  'mic.lowCut.group.popsHint':
    'Suaviza o impacto de um P ou de um B e deixa uma voz estável em paz.',
  'mic.lowCut.plosive': 'Anti-pop',
  'mic.gate.title': 'Gate',
  'mic.gate.description':
    'Fecha o microfone entre as palavras para que o ambiente, o ventilador e o teclado fiquem de fora. Com uma faixa pequena, vira um expansor suave.',
  'mic.gate.group.level': 'Quando abre',
  'mic.gate.group.levelHint':
    'Observe a linha tracejada na imagem: sua voz deve passar dela, o ambiente deve ficar abaixo.',
  'mic.gate.threshold': 'Limiar',
  'mic.gate.range': 'Atenua',
  'mic.gate.group.time': 'Velocidade',
  'mic.gate.group.timeHint':
    'A retenção o mantém aberto entre as sílabas, para que o fim das palavras nunca seja cortado.',
  'mic.gate.attack': 'Abre em',
  'mic.gate.hold': 'Retenção',
  'mic.gate.release': 'Fecha em',
};
