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
  'mic.live': 'Ao vivo em todos os apps',
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
  'mic.monitor.label': 'Ouvir o resultado final',
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
    'Ventiladores, crianças, trânsito: o limpador no máximo e um gate suave',
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
  'mic.empty.backTitle': 'O Windows está trazendo seus microfones de volta',
  'mic.empty.backBody':
    'Eles aparecem aqui assim que o Windows voltar a listá-los, normalmente logo depois de reiniciar o áudio.',
  'mic.empty.lookAgain': 'Procurar de novo',
  'mic.stage.level': 'Nível da voz',
  'mic.level.title': 'Nível da voz',
  'mic.level.description':
    'Leva sua voz a um nível estável enquanto você fala: sobe quando você fala baixo ou longe do microfone, desce quando você grita. Nunca levanta a sala entre as palavras.',
  'mic.level.group': 'O nível',
  'mic.level.groupHint':
    'Alvo é onde sua voz é mantida. Elevação máxima é o quanto uma voz baixa pode ser elevada.',
  'mic.level.target': 'Alvo',
  'mic.level.maxLift': 'Elevação máx.',
  'mic.level.live.title': 'Sua voz, nivelada',
  'mic.level.live.label':
    'Sua voz nos últimos dez segundos como chega e nivelada, diante do alvo',
  'mic.level.live.keyArrives': 'Como chega',
  'mic.level.live.keyLevelled': 'Nivelada',
  'mic.level.live.keyTarget': 'Alvo',
  'mic.level.live.target': 'alvo {db} dB',
  'mic.level.live.lifted': 'Ganho agora',
  'mic.level.live.state': 'Agora',
  'mic.level.live.following': 'Seguindo sua voz',
  'mic.level.live.holding': 'Mantendo o nível',
  'mic.preset.lowCut.speech': 'Fala',
  'mic.preset.lowCut.deep': 'Voz grave',
  'mic.preset.lowCut.headset': 'Headset perto',
  'mic.preset.lowCut.rumble': 'Contra ronco',
  'mic.preset.lowCut.distant': 'Microfone de mesa à distância',
  'mic.preset.denoise.light': 'Leve',
  'mic.preset.denoise.studio': 'Estúdio',
  'mic.preset.denoise.home': 'Escritório em casa',
  'mic.preset.denoise.noisy': 'Sala barulhenta',
  'mic.preset.denoise.fan': 'Ventilador e ar',
  'mic.preset.gate.gentle': 'Suave',
  'mic.preset.gate.calls': 'Chamadas',
  'mic.preset.gate.podcast': 'Podcast',
  'mic.preset.gate.stream': 'Streaming',
  'mic.preset.gate.tight': 'Justo',
  'mic.preset.level.gentle': 'Suave',
  'mic.preset.level.calls': 'Chamadas',
  'mic.preset.level.podcast': 'Podcast',
  'mic.preset.level.stream': 'Streaming',
  'mic.preset.level.soft': 'Voz baixa',
  'mic.picture.taken': 'O cinza que aparece = o que os filtros tiraram',
  'mic.preset.level.everyday': 'Voz do dia a dia',
  'mic.stage.reverb': 'Reverb',
  'mic.reverb.title': 'Reverb',
  'mic.reverb.description':
    'Coloca sua voz em um espaço: uma placa para cantar, uma sala pequena para um pouco de ar. Só a cauda é adicionada, então sua voz mantém o tempo.',
  'mic.reverb.group.type': 'Espaço',
  'mic.reverb.type.plate': 'Placa',
  'mic.reverb.type.vocalPlate': 'Placa vocal',
  'mic.reverb.type.room': 'Sala',
  'mic.reverb.type.chamber': 'Câmara',
  'mic.reverb.type.hall': 'Salão',
  'mic.reverb.typeHint.plate':
    'Brilhante e densa desde o primeiro instante, o som clássico atrás de uma voz cantada.',
  'mic.reverb.typeHint.vocalPlate':
    'Mais escura e curta: fica atrás da voz sem cobri-la.',
  'mic.reverb.typeHint.room':
    'Pequena e próxima: um pouco de ar ao redor da voz, nunca um eco.',
  'mic.reverb.typeHint.chamber':
    'Quente e redonda, com um começo mais suave que uma placa.',
  'mic.reverb.typeHint.hall':
    'Grande e de crescimento lento, com uma cauda longa para baladas.',
  'mic.reverb.group.tail': 'A cauda',
  'mic.reverb.group.tailHint':
    'Mix é o quanto a cauda soa ao lado da sua voz. O pré-delay deixa um espaço para as palavras continuarem claras.',
  'mic.reverb.mix': 'Mix',
  'mic.reverb.decay': 'Decaimento',
  'mic.reverb.predelay': 'Pré-delay',
  'mic.reverb.group.colour': 'Cor',
  'mic.reverb.group.colourHint':
    'Tom escurece a cauda, Corte de graves tira o embolado da voz, Largura a espalha em um microfone estéreo.',
  'mic.reverb.tone': 'Tom',
  'mic.reverb.lowCut': 'Corte de graves',
  'mic.reverb.width': 'Largura',
  'mic.reverb.group.duck': 'Enquanto você fala',
  'mic.reverb.group.duckHint':
    'A cauda recua enquanto você fala e floresce nas pausas, para cada palavra continuar clara.',
  'mic.reverb.duckDb': 'Recuo',
  'mic.reverb.tail.title': 'A forma da cauda',
  'mic.reverb.tail.label':
    'Sua voz e a cauda do reverb depois dela, do seu nível até 60 dB abaixo ao longo do decaimento',
  'mic.reverb.tail.keyVoice': 'Sua voz',
  'mic.reverb.tail.keyTail': 'A cauda',
  'mic.reverb.tail.keyDucked': 'Enquanto você fala',
  'mic.reverb.tail.voice': 'voz',
  'mic.reverb.tail.mix': '{db} dB',
  'mic.reverb.tail.decay': '−60 dB em {time}',
  'mic.reverb.tail.ducked': '−{db} dB enquanto você fala',
  'mic.preset.reverb.plate': 'Placa',
  'mic.preset.reverb.vocalPlate': 'Placa vocal',
  'mic.preset.reverb.intimate': 'Sala íntima',
  'mic.preset.reverb.chamber': 'Câmara',
  'mic.preset.reverb.hall': 'Sala de concerto',
  'mic.preset.reverb.streamAir': 'Ar para streaming',
  'mic.profile.group.singing': 'Canto',
  'mic.profile.group.fx': 'Efeitos de voz',
  'mic.profile.singPlate': 'Canto · Placa',
  'mic.profile.singPlate.hint': 'Canto com uma placa brilhante atrás',
  'mic.profile.singHall': 'Canto · Salão',
  'mic.profile.singHall.hint': 'Canto em um salão grande com cauda longa',
  'mic.profile.singRoom': 'Canto · Sala',
  'mic.profile.singRoom.hint': 'Canto em uma sala íntima',
  'mic.profile.streamAir': 'Streaming · Ar',
  'mic.profile.streamAir.hint':
    'Streaming com um pouco de sala que recua enquanto você fala',
  'mic.profile.radio': 'Rádio AM',
  'mic.profile.radio.hint':
    'Um receptor antigo: a banda AM e um nível apertado',
  'mic.profile.phone': 'Telefone',
  'mic.profile.phone.hint': 'A banda do telefone, estreita nas duas pontas',
  'mic.profile.whisper': 'Sussurro',
  'mic.profile.whisper.hint': 'Um sussurro trazido à frente, com ar em cima',
  'mic.profile.megaphone': 'Megafone',
  'mic.profile.megaphone.hint':
    'Médios estreitos e empurrados e um tapa curto de sala',
  'mic.stage.own': 'Efeitos próprios do microfone',
  'mic.own.title': 'Efeitos próprios do microfone',
  'mic.own.description':
    'O processamento que o fabricante do seu microfone aplica antes de o FluidEQ ouvir sua voz. Tire-o e só o FluidEQ processa sua voz; coloque-o de volta e fica exatamente como estava.',
  'mic.own.group.brings': 'O que seu microfone traz',
  'mic.own.group.taken': 'Removidos',
  'mic.own.group.how': 'O que muda',
  'mic.own.how':
    'O Windows pede permissão toda vez, e o som dele para por um momento enquanto reinicia. Todo app que usa este microfone ouve a mudança.',
  'mic.own.none':
    'Este microfone não traz efeitos próprios: só o FluidEQ o processa.',
  'mic.own.unknown':
    'Atualize o FluidEQ Engine para ver os efeitos próprios deste microfone.',
  'mic.own.unnamed': 'Efeito sem nome',
  'mic.own.kind.stream': 'Atua na gravação de cada app',
  'mic.own.kind.mode': 'Atua em um tipo de gravação, como chamadas',
  'mic.own.kind.endpoint': 'Atua em tudo o que este microfone grava',
  'mic.own.windows': 'Parte do Windows',
  'mic.own.makerUnknown': 'Fabricante não registrado',
  'mic.own.fileVersion': '{file}, versão {version}',
  'mic.own.source':
    'Nomes, fabricantes e arquivos como o Windows os tem registrados.',
  'mic.own.stateOn': 'Ligado',
  'mic.own.stateOff': 'Removido',
  'mic.own.prompt': 'O Windows vai pedir permissão.',
  'mic.own.working': 'Aguardando o Windows…',
  'mic.own.declined': 'O Windows não deu permissão, então nada mudou.',
  'mic.own.failed': 'Não foi possível mudar neste microfone.',
  'mic.empty.title': 'Nenhum microfone encontrado',
  'mic.empty.body':
    'Conecte um microfone ou atualize o FluidEQ Engine para que ele consiga listá-los.',
  'mic.stage.lowCut': 'Corte graves',
  'mic.stage.cleaner': 'Cancelamento de ruído',
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
  'mic.monitor.on': 'Ouvindo o resultado final',
  'mic.delay.label': 'Atraso',
  'mic.delay.measured':
    'medido pelo motor neste microfone, da cápsula até cada app',
  'mic.delay.unknown': 'o motor ainda não mediu este microfone',
  'mic.rail.master': 'Processar o microfone',
  'mic.rail.note':
    'Cada chave desliga sua etapa por completo: sem mudança de som, sem atraso. O número ao lado de uma etapa é o atraso que ela adiciona.',
  'mic.meter.noise': 'Ruído retirado',
  'mic.cleaner.description':
    'Retira teclado, ventiladores e o ambiente de baixo da sua voz enquanto você fala.',
  'mic.cleaner.strength': 'Intensidade',
  'mic.gate.live.title': 'Sua voz e o gate',
  'mic.gate.live.hint':
    'Arraste a linha para cima ou para baixo. Os trechos cinza são onde o gate abaixou a sala.',
  'mic.gate.live.opens': 'abre em {db} dB',
  'mic.live.ago': '−{seconds} s',
  'mic.live.now': 'agora',
  'mic.gate.live.stateOpen': 'Aberto',
  'mic.gate.live.stateClosed': 'Fechado',
  'mic.gate.live.waiting': 'Esperando sua voz',
  'mic.gate.live.keyLevel': 'O que o gate ouve',
  'mic.gate.live.keyClosed': 'Abaixado',
  'mic.gate.live.keyOpens': 'Abre',
  'mic.gate.live.keyCloses': 'Fecha',
  'mic.gate.live.label':
    'O nível que o gate ouve nos últimos cinco segundos, contra onde ele abre e onde fecha',
  'mic.gate.live.openShare': 'Aberto, últimos {seconds} s',
  'mic.lowCut.live.title': 'Onde sua voz fica',
  'mic.lowCut.live.keyKept': 'Sua voz, mantida',
  'mic.lowCut.live.keyTaken': 'Retirado',
  'mic.lowCut.live.keyCut': 'O corte',
  'mic.lowCut.live.label':
    'Sua voz como chega, com o que o corte de graves retira',
  'mic.lowCut.live.chip': '{hz} Hz · {slope} dB/oit',
  'mic.lowCut.live.hum': 'zumbido {hz} Hz',
  'mic.lowCut.live.taken': 'Ronco retirado agora',
  'mic.lowCut.live.lowest': 'A nota mais grave da sua voz',
  'mic.lowCut.live.hint':
    'Arraste o ponto para a esquerda ou a direita e mantenha-o abaixo da sua nota mais grave.',
  'mic.cleaner.live.title': 'Voz e sala, agora',
  'mic.cleaner.live.keyBefore': 'O que o microfone ouve',
  'mic.cleaner.live.keyAfter': 'Depois da limpeza',
  'mic.cleaner.live.label': 'Sua voz e sua sala antes e depois da limpeza',
  'mic.cleaner.live.roomBefore': 'Sala antes',
  'mic.cleaner.live.roomAfter': 'Sala depois',
  'mic.cleaner.live.taken': 'Sala retirada',
  'mic.cleaner.live.over': 'Voz acima da sala',
  'mic.cleaner.live.hint':
    'O cinza é sua sala como o microfone ouve; a cor é o que a limpeza deixa.',
  'mic.cleaner.strengthHint':
    'Quanto da sala a limpeza retira. Acima de 80% a voz começa a soar processada.',
  'mic.preset.limiter.catch': 'Segurar picos',
  'mic.preset.limiter.calls': 'Chamadas',
  'mic.preset.limiter.stream': 'Streaming',
  'mic.preset.limiter.loud': 'Alto sobre o jogo',
  'mic.preset.dynamics.gentle': 'Voz suave',
  'mic.preset.dynamics.broadcast': 'Voz de rádio',
  'mic.preset.dynamics.callouts': 'Avisos na partida',
  'mic.preset.dynamics.singing': 'Canto',
  'mic.preset.deEsser.soft': 'Suave',
  'mic.preset.deEsser.podcast': 'Podcast',
  'mic.preset.deEsser.bright': 'Microfone brilhante',
  'mic.preset.eq.warm': 'Voz quente',
  'mic.preset.eq.clear': 'Voz clara',
  'mic.preset.eq.radio': 'Rádio',
  'mic.preset.eq.headset': 'Correção de headset',
  'mic.preset.eq.thin': 'Encorpar microfone fino',
};
