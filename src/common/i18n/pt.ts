/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/** Portuguese. Brazilian spelling, which is the larger readership by far. */
const pt: Partial<Dictionary> = {
  'app.tagline': 'Seu som. Em todo dispositivo. Automaticamente.',
  'app.actions': 'Ações do FluidEQ',
  'app.actions.title': 'Ações de áudio',
  'app.status.ready': 'Conectado ao Equalizer APO',
  'app.status.checking': 'Verificando o Equalizer APO…',
  'app.status.error': 'O Equalizer APO não está respondendo',
  'app.menu.importEq': 'Importar configurações de EQ…',
  'app.menu.importConvolution': 'Importar resposta ao impulso…',
  'app.menu.restartAudio': 'Reiniciar o áudio do Windows',
  'app.menu.reconfigure': 'Reconfigurar o Equalizer APO',
  'app.menu.apoSettings': 'Configurações do Equalizer APO',
  'app.menu.support': 'Apoie o projeto',
  'whatsNew.eyebrow': 'NOTAS DA VERSÃO',
  'whatsNew.title': 'Novidades do FluidEQ',
  'whatsNew.loading': 'Carregando as notas da versão…',
  'whatsNew.missing':
    'As notas da versão não foram encontradas nesta compilação. Elas também estão no GitHub.',
  'app.menu.whatsNew': 'Novidades',
  'app.menu.language': 'Idioma',
  'app.window.minimize': 'Minimizar',
  'app.window.maximize': 'Maximizar',
  'app.window.restore': 'Restaurar',
  'app.window.close': 'Fechar',
  'app.window.minimizeApp': 'Minimizar o FluidEQ',
  'app.window.maximizeApp': 'Maximizar o FluidEQ',
  'app.window.restoreApp': 'Restaurar o FluidEQ',
  'app.window.closeApp': 'Fechar o FluidEQ',
  'app.media.previous': 'Faixa anterior',
  'app.media.playPause': 'Reproduzir ou pausar',
  'app.media.next': 'Próxima faixa',
  'app.media.previousAria':
    'Faixa anterior, em qualquer parte deste computador',
  'app.media.playPauseAria':
    'Reproduzir ou pausar, em qualquer parte deste computador',
  'app.media.nextAria': 'Próxima faixa, em qualquer parte deste computador',
  'app.dismiss': 'Dispensar',

  'tabs.aria': 'Área de trabalho de som',
  'tabs.eq': 'EQ',
  'tabs.autoeq': 'AutoEQ',
  'tabs.voicing': 'Caráter',
  'tabs.convolution': 'Convolução',
  'tabs.config': 'Config',
  'tabs.media': 'Mídia',
  'tabs.karaoke': 'Karaokê',

  'karaoke.eyebrow': 'KARAOKÊ LOCAL',
  'karaoke.title': 'Um palco feito para sua música',
  'karaoke.intro':
    'Este espaço reunirá músicas, letras sincronizadas, monitoramento do microfone e orientação de afinação, tudo localmente no seu computador.',
  'karaoke.fullscreen.enter': 'Entrar em tela cheia',
  'karaoke.fullscreen.exit': 'Sair da tela cheia',
  'karaoke.fullscreen.hideHeader': 'Ocultar o cabeçalho do FluidEQ',
  'karaoke.fullscreen.showHeader': 'Mostrar o cabeçalho do FluidEQ',
  'karaoke.actions': 'Ações do karaokê',
  'karaoke.readiness.resize':
    'Redimensionar os painéis de microfone e afinação',
  'karaoke.empty.title': 'Seu palco está pronto',
  'karaoke.empty.body':
    'Abra áudios com letras opcionais ou adicione uma pasta inteira. O FluidEQ associa arquivos com o mesmo nome em uma lista.',
  'karaoke.import.pending': 'A seguir: importar músicas',
  'karaoke.import.open': 'Abrir música',
  'karaoke.import.replace': 'Trocar música',
  'karaoke.import.addFiles': 'Adicionar arquivos',
  'karaoke.import.folder': 'Adicionar pasta',
  'karaoke.import.clear': 'Remover',
  'karaoke.import.loading': 'Preparando a música…',
  'karaoke.import.formats':
    'Áudio: MP3, WAV, OGG, FLAC ou M4A · Letras: LRC, eLRC ou TXT UltraStar',
  'karaoke.import.drop': 'Solte músicas, letras ou pastas aqui',
  'karaoke.error.missingAudio':
    'Adicione um arquivo de áudio junto com esse arquivo de letra.',
  'karaoke.error.ambiguous':
    'Há mais de uma combinação possível. Selecione um áudio e, opcionalmente, um arquivo de letra.',
  'karaoke.error.unsupported':
    'Nenhum desses arquivos é ainda um formato de áudio ou letra Karaoke compatível.',
  'karaoke.error.read':
    'O FluidEQ não conseguiu ler os arquivos locais selecionados.',
  'karaoke.error.playback':
    'Esta versão do Chromium não conseguiu reproduzir o arquivo ou codec de áudio.',
  'karaoke.warning.lyrics':
    'não pôde ser interpretado; o áudio continua disponível sem letra sincronizada.',
  'karaoke.song.unknownArtist': 'Música local',
  'karaoke.playlist.title': 'Lista de reprodução',
  'karaoke.playlist.select': 'Selecionar {title}',
  'karaoke.playlist.moveUp': 'Mover {title} para cima',
  'karaoke.playlist.moveDown': 'Mover {title} para baixo',
  'karaoke.playlist.remove': 'Remover {title}',
  'karaoke.playlist.resize': 'Redimensionar playlist e palco',
  'karaoke.playlist.collapse': 'Recolher playlist',
  'karaoke.playlist.expand': 'Expandir playlist',
  'karaoke.source.audioOnly': 'Somente áudio',
  'karaoke.source.lrc': 'LRC · tempo por linha',
  'karaoke.source.elrc': 'eLRC · tempo por palavra',
  'karaoke.source.ultrastar': 'UltraStar · sílabas + afinação',
  'karaoke.lyrics.none':
    'Nenhuma letra sincronizada foi escolhida. A reprodução e o afinador continuam disponíveis.',
  'karaoke.lyrics.line': 'Linha da letra {number}',
  'karaoke.lyrics.previous': 'Letra anterior',
  'karaoke.lyrics.next': 'Próxima letra',
  'karaoke.lyrics.follow': 'Seguir a letra',
  'karaoke.lyrics.textSize': 'Tamanho do texto da letra',
  'karaoke.countIn.ready': 'Prepare-se — a música começa depois de VAI',
  'karaoke.chords.aria':
    'Acordes de guitarra estimados da faixa de acompanhamento',
  'karaoke.chords.analyzing': 'A procurar acordes… {percent}%',
  'karaoke.chords.estimate': 'Acorde estimado',
  'karaoke.chords.next': 'Seguinte',
  'karaoke.chords.in': 'em {seconds}s',
  'karaoke.chords.none': 'Nenhum acorde estável encontrado',
  'karaoke.chords.confidence': 'Confiança da estimativa de áudio: {percent}%',
  'karaoke.transport.title': 'Controles de reprodução do Karaoke',
  'karaoke.transport.restart': 'Reiniciar música',
  'karaoke.transport.play': 'Reproduzir',
  'karaoke.transport.pause': 'Pausar',
  'karaoke.transport.seek': 'Posição da música',
  'karaoke.transport.volume': 'Volume',
  'karaoke.mic.title': 'Microfone',
  'karaoke.mic.settings': 'Configurações do microfone',
  'karaoke.mic.off': 'Desligado',
  'karaoke.mic.hint':
    'Escolha uma entrada. O FluidEQ só pede acesso ao microfone quando você o ativa.',
  'karaoke.mic.select': 'Entrada do microfone',
  'karaoke.mic.default': 'Padrão do sistema',
  'karaoke.mic.unnamed': 'Microfone {number}',
  'karaoke.mic.turnOn': 'Ativar microfone',
  'karaoke.mic.turnOff': 'Desativar microfone',
  'karaoke.mic.requesting': 'Conectando…',
  'karaoke.mic.live': 'Ativo',
  'karaoke.mic.denied': 'Permissão negada',
  'karaoke.mic.unavailable': 'Sem microfone',
  'karaoke.mic.disconnected': 'Desconectado',
  'karaoke.mic.error': 'Não foi possível iniciar',
  'karaoke.mic.level': 'Nível de entrada do microfone',
  'karaoke.mic.levelValue': 'Nível de entrada do microfone: {percent}%',
  'karaoke.mic.privacy':
    'Somente análise local de nível e afinação. O FluidEQ não grava nem reproduz o microfone nos alto-falantes.',
  'karaoke.mic.volume': 'Volume do microfone',
  'karaoke.mic.volumeValue': 'Volume do microfone: {percent}%',
  'karaoke.pitch.title': 'Faixa de afinação',
  'karaoke.pitch.resize': 'Redimensionar a faixa de afinação',
  'karaoke.pitch.guide': 'Guia melódico',
  'karaoke.pitch.toneGuide': 'Tom da melodia',
  'karaoke.pitch.toneEnable': 'Reproduzir o tom da melodia',
  'karaoke.pitch.toneDisable': 'Parar o tom da melodia',
  'karaoke.pitch.toneVolume': 'Volume do tom da melodia',
  'karaoke.pitch.scrubHint':
    'Arraste para a esquerda ou direita para percorrer a música; solte para manter pausado.',
  'karaoke.pitch.viewSelector': 'Exibição de afinação',
  'karaoke.pitch.viewNotes': 'Notas',
  'karaoke.pitch.viewWave': 'Curva',
  'karaoke.pitch.waveCanvas':
    'Curva em tempo real da afinação do cantor sobre as notas da música',
  'karaoke.pitch.waveSong': 'Música',
  'karaoke.pitch.waveVoice': 'Sua voz',
  'karaoke.pitch.waveFooter':
    'Os blocos azuis são as notas da música; a curva fina ao vivo é a afinação captada pelo microfone.',
  'karaoke.pitch.review': 'Avaliação da apresentação',
  'karaoke.pitch.reviewCount': '{count} trechos para praticar',
  'karaoke.pitch.issueHigh': 'Afinação alta em {time}. Pratique este trecho.',
  'karaoke.pitch.issueLow': 'Afinação baixa em {time}. Pratique este trecho.',
  'karaoke.pitch.issueMissed':
    'Notas não cantadas em {time}. Pratique este trecho.',
  'karaoke.practice.go': 'VAI!',
  'karaoke.practice.ready': 'Prepare-se para cantar novamente',
  'karaoke.pitch.canvas':
    'Faixa de afinação ao vivo do microfone e das notas-alvo',
  'karaoke.pitch.micOff': 'Ligue o microfone para ver sua afinação.',
  'karaoke.pitch.loading': 'Iniciando análise de afinação…',
  'karaoke.pitch.unavailable':
    'A análise de afinação não está disponível. O nível do microfone continua funcionando.',
  'karaoke.pitch.noSignal': 'Cante no microfone para traçar sua afinação.',
  'karaoke.pitch.empty':
    'As notas-alvo só aparecerão quando a música importada realmente as fornecer.',
  'karaoke.pitch.high': 'Alto',
  'karaoke.pitch.tuned': 'Afinado',
  'karaoke.pitch.low': 'Baixo',
  'karaoke.pitch.ultrastar':
    'As barras azuis são as notas-alvo; o traço indica se a sua voz está alta, afinada ou baixa.',

  'graph.resize': 'Arraste para redimensionar o gráfico',
  'graph.meter.aria':
    'Nível de saída ao vivo, em decibéis reais abaixo do fundo de escala',
  'graph.meter.left': 'E',
  'graph.meter.right': 'D',
  'graph.meter.mono': 'M',
  'video.sites': 'Sites de vídeo',
  'video.back': 'Voltar',
  'video.forward': 'Avançar',
  'video.reload': 'Recarregar',
  'video.stop': 'Parar',
  'video.searchAria': 'Buscar no site atual',
  'video.searchOn': 'Pesquisar no {site}',
  'video.searchGo': 'Pesquisar',
  'video.searchClear': 'Limpar a pesquisa',
  'video.searchRecent': 'Pesquisas recentes',
  'video.searchForget': 'Esquecer “{term}”',
  'video.searchForgetAll': 'Limpar as pesquisas recentes',
  'video.adBlock': 'Bloquear anúncios',
  'video.adBlockHint':
    'Pula os anúncios em vídeo e esconde os espaços de anúncio no YouTube.',
  'video.signOut': 'Sair de todos os sites',
  'video.signOutBusy': 'Saindo…',
  'video.signOutHint':
    'Apaga todos os cookies, logins e páginas em cache que o player guarda.',
  'video.signOutDone': 'Sessões encerradas',
  'video.signOutFailed': 'Não foi possível sair',
  'video.blockedTitle': 'Esse link leva para fora do player',
  'video.openInBrowser': 'Abrir no navegador',
  'video.resize': 'Arraste para redimensionar o player',

  'notice.apoReconfigured':
    'O Equalizer APO foi instalado ou reconfigurado. Se ficar sem som, reinicie o serviço de áudio do Windows em vez de reiniciar o computador.',
  'notice.restartNow': 'Reiniciar o áudio agora',
  'notice.importComplete': 'Importação concluída',
  'notice.restartConfirm':
    'O áudio vai parar por alguns segundos e o Windows vai pedir permissão de administrador. Continuar?',
  'update.title': 'Atualização do FluidEQ',
  'update.available': 'A versão {version} está disponível. Baixando agora.',
  'update.downloading': 'Baixando a atualização… {percent}%',
  'update.ready':
    'A versão {version} está pronta. Reinicie o FluidEQ para concluir.',
  'update.restart': 'Reiniciar agora',
  'update.restarting': 'Reiniciando…',
  'notice.restartDone':
    'O áudio do Windows foi reiniciado. Reabra qualquer aplicativo que continuar mudo.',

  'sidebar.engine': 'MOTOR',
  'sidebar.systemEq': 'EQ do sistema',
  'sidebar.preamp': 'Pré-amplificação',
  'sidebar.preampAria': 'Ganho de pré-amplificação (dB)',
  'sidebar.preampAuto':
    'É ajustado sozinho. Desligue Normalizar automaticamente para mudar.',
  'sidebar.headroom': 'MARGEM DO APO',
  'sidebar.autoPreamp': 'Normalizar automaticamente',
  'sidebar.visualizer': 'VISUALIZADOR',
  'sidebar.graphView': 'Gráfico de resposta',

  'output.eyebrow': 'ACOMPANHA SUA SAÍDA',
  'output.title': 'Perfil automático',
  'output.device': 'Dispositivo de saída',
  'output.active': 'ATIVO',
  'output.none': 'Nenhuma saída ativa encontrada',
  'output.mapping': 'Vínculo automático',
  'output.mapping.neutral': 'Saída neutra',
  'output.mapping.live': 'Ajuste ao vivo vinculado',
  'output.mapping.hint':
    'Mexa em qualquer controle do EQ para salvá-lo e vinculá-lo automaticamente a esta saída.',
  'output.hint':
    'O FluidEQ usa o identificador estável do dispositivo, então este som o acompanha sempre que o Windows o seleciona.',

  'extraOutput.eyebrow': 'TOCA EM DOIS LUGARES',
  'extraOutput.title': 'Segunda saída',
  'extraOutput.target': 'Espelhar em',
  'extraOutput.off': 'Desligado',
  'extraOutput.none': 'Nenhuma outra saída encontrada',
  'extraOutput.active': 'ESPELHANDO',
  'extraOutput.volume': 'Volume',
  'extraOutput.latency':
    'O som espelhado chega cerca de um quinto de segundo depois. Serve para música em outro cômodo, é inútil para vídeo ou jogos, e vira eco se você ouvir as duas ao mesmo tempo.',
  'extraOutput.virtual':
    'Há um driver de roteamento instalado. Aponte seus aplicativos para ele e as duas saídas ficam em sincronia; depois dê a cada uma o seu próprio perfil acima.',
  'extraOutput.ambiguous':
    'Duas saídas têm este mesmo nome, então o FluidEQ não consegue saber qual você quer. Renomeie uma nas configurações de som do Windows.',
  'extraOutput.unmatched':
    'O Windows lista esta saída, mas o FluidEQ não consegue alcançá-la, então não dá para espelhar nela.',
  'extraOutput.labelsHidden':
    'O FluidEQ ainda não consegue ler os nomes das saídas e por isso não consegue combiná-las. Permita o acesso ao microfone para o FluidEQ e abra este painel de novo.',
  'extraOutput.hint':
    'O espelhamento toca o que você já ouve em um segundo dispositivo. Funciona apenas enquanto o FluidEQ está aberto.',

  'driver.eyebrow': 'NO QUE VOCÊ OUVE',
  'driver.title': 'Tipo de driver',
  'driver.none': 'Sem compensação',
  'driver.none.hint': 'Apenas suas bandas e o caráter',
  'driver.strength': 'Intensidade',
  'driver.range': '±1,5 dB',

  'profiles.eyebrow': 'SEU SOM',
  'profiles.title': 'Perfis salvos',
  'profiles.name': 'Nome do perfil',
  'profiles.nameAria': 'Nome do perfil',
  'profiles.new': 'Novo perfil',
  'profiles.newAria': 'Criar um perfil novo com o EQ atual',
  'profiles.untitled': 'Perfil sem título',
  'profiles.save': 'Salvar como novo',
  'profiles.update': 'Atualizar',
  'profiles.saveAria': 'Salvar as configurações no perfil',
  'profiles.restore': 'Restaurar',
  'profiles.restoring': 'Restaurando…',
  'profiles.restoreAria':
    'Restaurar a última versão salva manualmente deste perfil',
  'profiles.attached': 'ATV',
  'profiles.attachedTitle': 'Tocando nesta saída',
  'profiles.detecting': 'Detectando sua saída…',
  'profiles.empty': 'Ainda não há perfis. Crie o seu primeiro som.',
  'profiles.error.empty': 'O nome do perfil não pode ficar vazio.',
  'profiles.error.restricted': 'Nome inválido, escolha outro.',
  'profiles.error.duplicate': 'Esse nome já existe, escolha outro.',
  'profiles.edit': 'Editar o nome do perfil',

  'autoeq.page.eyebrow': 'AJUSTE AOS SEUS FONES',
  'autoeq.page.title': 'Correção de fones',
  'autoeq.page.intro':
    'Diga com que fones você está ouvindo e o FluidEQ aplica a correção publicada para eles. Ela entra como uma camada própria, com intensidade e chave próprias, então as suas bandas de EQ nunca são tocadas. Cada medição foi feita em uma bancada real e publicada por alguém; nada é adivinhado a partir do nome do modelo.',
  'autoeq.source.hint':
    'De qual banco de dados vêm as medições. «Todos os bancos de dados» procura em todos ao mesmo tempo.',
  'autoeq.model.hint':
    'Procure por marca ou modelo. Se o seu não foi medido, um parente próximo da mesma linha costuma chegar bem perto.',
  'autoeq.target.hint':
    'A maioria dos modelos é medida mais de uma vez — bancadas diferentes, curvas-alvo diferentes — e não soam igual. Vale a pena experimentar mais de uma.',
  'autoeq.eyebrow': 'COMECE POR UMA REFERÊNCIA',
  'autoeq.title': 'Biblioteca AutoEQ',
  'autoeq.selectSource': 'Escolha uma origem',
  'autoeq.applied': 'Aplicado: {name}',
  'autoeq.notApplied': 'Nenhuma referência aplicada',
  'autoeq.source': 'Origem da medição',
  'autoeq.model': 'Modelo de fone',
  'autoeq.target': 'Medição / alvo',
  'autoeq.apply': 'Aplicar EQ do modelo',
  'autoeq.applying': 'Aplicando…',
  'autoeq.applyAria': 'Aplicar o EQ do modelo selecionado',
  'autoeq.checking': 'Verificando o banco de dados oficial…',
  'autoeq.updateAvailable': 'Atualização disponível ({count} modelos)',
  'autoeq.upToDate': 'Banco de dados em dia — {count} modelos',
  'autoeq.updateUnknown': 'Não foi possível verificar a atualização',
  'autoeq.update': 'Atualizar banco de dados',
  'autoeq.updating': 'Atualizando…',
  'autoeq.updateAria': 'Atualizar o banco de dados do AutoEq',
  'autoeq.allDatabases': 'Todos os bancos de dados',
  'autoeq.allDatabases.hint': 'Busca no banco de dados oficial do AutoEq.',
  'autoeq.pickDevice': 'Escolha um modelo primeiro 🎧',
  'autoeq.noResponses': 'Nenhuma medição compatível 😞',
  'autoeq.pickResponse': 'Escolha uma medição! 🔊',
  'autoeq.selectSourcePlaceholder': 'Escolha uma origem…',
  'autoeq.searchSources': 'Buscar origens…',
  'autoeq.noModel': 'Nenhum modelo medido corresponde à sua busca.',
  'autoeq.searchModels': 'Buscar por marca ou modelo…',
  'squigImport.eyebrow': 'BRING YOUR CURVE WITH YOU',
  'squigImport.title': 'Import a Squiglink EQ',
  'squigImport.intro':
    'Use Squiglink’s calculator, then import its EQ export here.',
  'squigImport.open': 'Open Squiglink',
  'squigImport.stepOne': 'Choose a headset and target',
  'squigImport.stepTwo': 'Export the EQ text',
  'squigImport.stepThree': 'Paste it here and apply',
  'squigImport.pasteLabel': 'EQ export',
  'squigImport.placeholder': 'Paste the ParametricEQ or GraphicEQ text here…',
  'squigImport.fileAria': 'Choose an EQ export text file',
  'squigImport.chooseFile': 'Choose a .txt file',
  'squigImport.applyAria': 'Apply this imported EQ',
  'squigImport.importing': 'Applying…',
  'squigImport.apply': 'Apply imported EQ',
  'squigImport.applied': 'Applied curve',
  'squigImport.livePreview': 'Live preview',
  'squigImport.notApplied': 'Not applied',
  'squigImport.currentText': 'Current EQ text',
  'squigImport.flatPreview': 'Flat preview',
  'squigImport.flatCurve': 'No curve applied · 0 dB',
  'squigImport.bands': 'bands',
  'squigImport.clear': 'Remove import',
  'squigImport.chartAria': 'Frequency response of the imported EQ',
  'squigImport.emptyTitle': 'Your imported curve will appear here',
  'squigImport.emptyHint': 'Paste an export to preview its shape here.',
  'voicing.quickAria': 'Caráter: {name}',
  'voicing.quickNone': 'Caráter: nenhum',
  'voicing.quickTitle': 'Nenhum caráter aplicado',
  'voicing.quickLabel': 'Caráter',
  'voicing.quickNoneHint': 'Apenas suas bandas de EQ',

  'eq.eyebrow': 'AJUSTE FINO',
  'eq.title': 'EQ paramétrico',
  'eq.smart': 'EQ inteligente',
  'eq.smart.cancel': 'Cancelar',
  'eq.smart.aria': 'EQ inteligente a partir da saída ao vivo',
  'eq.smart.cancelAria': 'Cancelar a medição do EQ inteligente',
  'eq.smart.continuous': 'Contínuo',
  'eq.smart.continuousAria':
    'Continuar a medir e ajustar o EQ enquanto a música toca',
  'eq.smart.modeAria': 'Escolher como o EQ inteligente mede',
  'eq.smart.mode.once.note': 'Uma medição, aplicada de uma vez',
  'eq.smart.mode.detail': 'Detalhe',
  'eq.smart.mode.detail.note': 'Continua a medir · apenas picos e falhas',
  'eq.smart.mode.balance': 'Equilíbrio',
  'eq.smart.mode.balance.note':
    'Continua a medir · uniformiza também brilho e calor',
  'eq.smart.mode.target': 'Alvo',
  'eq.smart.mode.target.note':
    'Continua a medir · cada gravação para a mesma curva',
  'eq.layers': 'Também aplicado',
  'eq.layers.aria': 'Outros ajustes que afetam esta saída',
  'eq.layers.eq': 'EQ',
  'eq.layers.eq.modified': '(modificado)',
  'eq.layers.eq.bands': '{count} bandas',
  'eq.layers.convolution': 'Convolução',
  'eq.layers.voicing': 'Caráter',
  'eq.layers.driver': 'Driver',
  'eq.layers.headphone': 'Auscultadores',
  'eq.layers.custom': 'FX personalizado',
  'eq.layers.disable': 'Desliga {layer} sem a remover',
  'eq.layers.enable': 'Liga {layer} novamente',
  'eq.layers.smart': 'EQ inteligente',
  'eq.layers.smart.fullRange': 'Medido · faixa inteira',
  'eq.layers.smart.range': 'Medido · de {low} a {high}',
  'eq.layers.remove': 'Remover a camada de {layer}',
  'eq.layers.clearBands': 'Repor todas as bandas a 0 dB',
  'eq.layers.clearReference': 'Remover a correção dos auscultadores',
  'eq.layers.clearSmart':
    'Remover a correção medida. Suas bandas e a referência permanecem.',
  'eq.layers.clearCustom': 'Limpar filtros e texto do FX personalizado',
  'eq.clear': 'Limpar EQ',
  'eq.addBand': 'Adicionar banda',
  'eq.addBandAria': 'Adicionar uma banda de EQ',
  'eq.quickLayouts': 'Layouts rápidos',
  'eq.bandCount': '{count} bandas',
  'eq.selected': 'Banda selecionada',
  'eq.filter': 'Filtro',
  'eq.frequency': 'Frequência',
  'eq.gain': 'Ganho',
  'eq.gainDisabled': 'Ganho · n/d',
  'eq.quality': 'Fator Q',
  'eq.delete': 'Excluir banda',
  'eq.deleteAria': 'Excluir a banda de EQ selecionada',

  // As orações são substantivos com «de», que não concordam em gênero: «realce
  // de ar» e «realce de presença» são ambos corretos, enquanto um particípio
  // posposto («ar realçado», «presença realçada») exigiria flexionar o nome da
  // faixa dentro do espaço reservado.
  'eq.smart.range.deepBass': 'graves profundos',
  'eq.smart.range.bass': 'graves',
  'eq.smart.range.lowMids': 'médios baixos',
  'eq.smart.range.mids': 'médios',
  'eq.smart.range.upperMids': 'médios altos',
  'eq.smart.range.presence': 'presença',
  'eq.smart.range.treble': 'agudos',
  'eq.smart.range.highTreble': 'agudos altos',
  'eq.smart.range.air': 'ar',
  'eq.smart.range.separator': ', ',
  'eq.smart.shape.lifted': 'realce de {range}',
  'eq.smart.shape.eased': 'redução de {range}',
  'eq.smart.need.more': 'falta de {range}',
  'eq.smart.need.less': 'excesso de {range}',
  'eq.smart.status.listening': 'Ouvindo',
  'eq.smart.status.listeningPercent': 'Ouvindo {percent}%',
  'eq.smart.status.settling': 'Ouvindo {percent}% - estabilizando',
  'eq.smart.status.waitingOn': 'Ouvindo {percent}% - esperando {ranges}',
  'eq.smart.status.waitingOnMore':
    'Ouvindo {percent}% - esperando {ranges} +{count}',
  'eq.smart.status.paused': 'Em pausa',
  'eq.smart.status.pausedResume': 'Em pausa - retome para terminar',
  'eq.smart.status.pausedSilent': 'Em pausa - nada tocando',
  'eq.smart.status.waitingForSound': 'Esperando som',
  'eq.smart.status.soundChanged': 'O som mudou - medindo de novo',
  'eq.smart.status.keptChanging': 'O som não parou de mudar - interrompido',
  'eq.smart.status.notEnoughRange': 'Faixa insuficiente para medir',
  'eq.smart.status.alreadyBalanced': 'Já está equilibrado',
  'eq.smart.status.applying': 'Aplicando…',
  'eq.smart.status.cancelled': 'Cancelado - nada mudou',
  'eq.smart.status.failed': 'Não foi possível medir a saída.',
  'eq.smart.result.fullRange': 'Equilibrado - faixa completa',
  'eq.smart.result.range': 'Equilibrado - só de {low} a {high}',
  'eq.smart.result.withShape': '{result} · {shape}',
  'eq.smart.frequency.hz': '{value} Hz',
  'eq.smart.frequency.khz': '{value} kHz',
  'eq.smart.error.noCapture':
    'A captura de áudio não está disponível neste ambiente.',
  'eq.smart.error.noLoopback':
    'A captura da saída do sistema não está disponível neste ambiente.',
  'eq.smart.error.streamStopped': 'A saída parou antes de a medição terminar.',
  'eq.smart.error.analyserPaused':
    'O analisador está em pausa, então a medição parou.',
  'eq.smart.error.noSound':
    'Nada estava tocando. Coloque uma música e meça de novo.',
  'eq.smart.error.noAudioTrack':
    'O Windows não forneceu um sinal de áudio do sistema.',
  'eq.smart.error.formatChanged':
    'O formato da saída mudou durante a medição. Tente de novo.',
  'eq.smart.error.deviceChanged':
    'O dispositivo de áudio mudou durante a medição. Tente de novo.',
  'eq.smart.error.captureFailed':
    'Não foi possível capturar a saída processada do sistema.',
  'eq.smart.error.analyserOff':
    'O analisador de saída ao vivo não está rodando, então não há o que medir.',
  'eq.smart.error.alreadyRunning': 'Já existe uma medição em andamento.',
  'eq.smart.error.timedOut': 'A medição demorou demais. Tente de novo.',
  'eq.smart.error.closed': 'O FluidEQ encerrou a medição.',
  // «Não conta» em vez de «ignorado»: o particípio concordaria com o nome da
  // faixa, e no espaço reservado cabe só uma forma.
  'eq.smart.presence.ignoredBelow': 'não conta abaixo de {db} dB',
  'eq.smart.presence.trustedAbove': 'fiável acima de {db} dB',
  'eq.smart.presence.reset': 'Repor {range} neste modo',
  'eq.smart.limit.label': 'Limite Smart EQ {db} dB',
  'eq.smart.gap.title':
    '{range}: quanto discorda, face ao necessário para agir',
  'eq.smart.gap.countdown': 'escreve em {seconds}s',

  'convolution.eyebrow': 'RESPOSTAS AO IMPULSO DO APO',
  'convolution.title': 'Biblioteca de convolução',
  'convolution.intro':
    'Baixe um impulso de fase mínima verificado para o seu fone e aplique-o antes do EQ paramétrico. O gráfico abaixo mostra as duas curvas.',
  'convolution.import': 'Importar um WAV…',
  'convolution.importing': 'Importando…',
  'convolution.applied': 'Aplicado a esta saída',
  'convolution.clear': 'Remover',
  'convolution.search': 'Buscar modelos de fone',
  'convolution.searchPlaceholder':
    'Tente “Kraken”, “HD 650” ou o nome de um laboratório',
  'convolution.notice':
    'O catálogo para download é fornecido pelo AutoEq. Os arquivos são importados como WAV de 48 kHz porque o Equalizer APO exige que a resposta ao impulso corresponda à taxa de amostragem da saída ativa.',
  'convolution.loading': 'Carregando o catálogo oficial…',
  'convolution.empty':
    'Nenhuma resposta ao impulso corresponde. Tente um nome mais curto.',
  'convolution.source': 'Origem',
  'convolution.apply': 'Baixar e aplicar',
  'convolution.downloading': 'Baixando…',
  'convolution.isApplied': 'Aplicado',
  'convolution.none':
    'Nenhuma convolução carregada. A aba de EQ continua totalmente independente.',

  'voicing.eyebrow': 'CURVAS-ALVO',
  'voicing.title': 'Caráter',
  'voicing.intro':
    'Um alvo ajustado para o que você realmente está fazendo. Cada um é escrito como uma camada própria depois das suas bandas, então o seu ajuste nunca é tocado e voltar para Nenhum o restaura exatamente.',
  'voicing.refused': 'Não foi possível mudar o voicing',
  'voicing.groupPurpose': 'Para quê',
  'voicing.groupGenre': 'Género',
  'voicing.none': 'Nenhum',
  'voicing.none.hint': 'Apenas suas bandas de EQ, sem nada por cima',
  'voicing.strength': 'Intensidade',
  'voicing.off': 'Nada',
  'voicing.full': 'Total',
  'voicing.inert': 'Com 0% de intensidade este caráter não faz nada.',
  'voicing.headroom':
    'Adiciona até +{peak} dB. Normalizar automaticamente reserva a margem; deixe ligado a menos que você ajuste a pré-amplificação na mão.',

  'config.eyebrow': 'O QUE O MOTOR LÊ',
  'config.title': 'Configuração do Equalizer APO',
  'config.lede': 'O que está no disco agora, não o que o FluidEQ pretende.',
  'config.reload': 'Recarregar',
  'config.reloadTitle': 'Ler a configuração do disco outra vez',
  'config.reading': 'Lendo…',
  'config.absent':
    'O FluidEQ ainda não escreveu nada nesta instalação do Equalizer APO.',
  'config.status.notIncluded':
    'O Equalizer APO não está incluindo esta configuração. Nada do que está abaixo é aplicado.',
  'config.status.engineOff':
    'O motor do FluidEQ está desligado: esta configuração não nomeia nenhuma saída, então o Equalizer APO não aplica nada dela.',
  'config.status.active':
    'Ativa: o Equalizer APO está aplicando esta configuração.',
  'config.outputsAria': 'Saídas na configuração do Equalizer APO',
  'config.filters.one': '{count} filtro',
  'config.filters.many': '{count} filtros',
  'config.impulse': 'impulso',
  'config.playingNow': 'Tocando agora',
  'config.liveTitle': 'O EQ contínuo mantém esta medição em dia',
  'config.layer.on': 'ativo',
  'config.layer.off': 'inativo',
  'config.layers.noFile': 'Sem arquivo próprio',
  'config.layers.inFile': 'Escrito neste arquivo, não em um próprio.',
  'config.empty': 'Nada incluído: esta saída fica intocada.',
  'config.file.missing': 'ausente',
  'config.export': 'Exportar cadeia',
  'config.import': 'Importar cadeia',
  'config.import.hint': 'A importação aplica-se à saída que estás a ouvir.',
  'config.import.customSkipped':
    'O arquivo próprio do remetente foi ignorado: uma linha Include: ou Plugin: carregaria código no áudio do Windows.',
  'config.file.yours': 'seu',
  'config.hint.custom': 'É seu. Nunca é sobrescrito.',
  'config.hint.generated': 'Gerado: reescrito na próxima alteração.',
  'config.hint.saving':
    'Salvar grava o arquivo; o Equalizer APO o assume em seguida.',
  'config.edit': 'Editar',
  'config.cancel': 'Cancelar',
  'config.save': 'Salvar',

  'support.eyebrow': 'TOTALMENTE OPCIONAL',

  'support.petHint': 'Pressione espaço para fazê-lo pular',

  'support.game.hint': 'Toque no ritmo quando o pico chegar à linha',

  'support.game.howTo':
    'Toque no bichinho ou pressione espaço a cada batida. Continue e algo acontece no ×10.',

  'support.game.thanks':
    'Se algo aqui te fez sorrir, ideias e apoio são o que mantêm isto vivo.',

  'support.game.noAudio': 'Toque algo e o ritmo aparece aqui',

  'support.game.listening': 'Procurando o ritmo…',

  'support.game.share': 'Partilhar',

  'support.game.shareEuphoria': 'Partilhar o arco-íris',

  'support.game.shareTitle': 'Partilhe a sua pontuação',

  'support.game.shareUnlock':
    'Chegue a ×10 e este cartão passa a modo arco-íris, com todo o espetro.',

  'support.game.shareNote':
    'Guarde o cartão e anexe-o à publicação: nenhuma destas redes consegue tirar uma imagem de um link.',

  'support.game.shareSave': 'Guardar cartão',

  'support.game.shareCopyCard': 'Copiar cartão',

  'support.game.shareCardCopied': 'Copiado — cole-o',

  'support.game.shareCopy': 'Copiar texto',

  'support.game.shareCopied': 'Copiado',

  'support.game.shareLinkOnly':
    'Partilha apenas o link: cole o texto você mesmo',

  'support.game.euphoria': 'Modo arco-íris',

  'support.game.euphoriaToggle': 'Ligar ou desligar o modo arco-íris',

  'support.game.perfect': 'Perfeito',

  'support.game.great': 'Muito bom',

  'support.game.good': 'Bom',

  'support.game.miss': 'Errou',
  'support.title': 'Apoie o projeto',
  'support.close': 'Fechar',
  'support.pitch':
    'O FluidEQ é livre e de código aberto, e vai continuar assim: nada aqui está atrás de um paywall e nada é rastreado. Se ele conquistou um lugar no seu setup, uma contribuição financia o tempo que o mantém e as próximas ideias que saírem da mesma oficina.',
  'support.craft':
    'Isto é o trabalho de uma pessoa só, feito com muito carinho e um cuidado com os detalhes que beira o exagero. Cada painel foi desenhado à mão e discutido: como a curva se lê num relance, como um menu se abre, o que um botão giratório faz quando você gira devagar, que palavras entram num botão. Aqui não há componente de prateleira com um tema por cima.',
  'support.card': 'Cartão ou carteira',
  'support.card.hint':
    'Pagamento seguro hospedado pela Stripe. Abre no seu navegador — o aplicativo nunca vê os dados do cartão.',
  'support.coffee': 'Me pague um café',
  'support.coffee.hint':
    'Uma contribuição única, sem precisar de conta. Clique para abrir no navegador ou escaneie o código com o celular.',
  'support.verify': 'Confira o endereço antes de enviar.',
  'support.copy': 'Copiar endereço',
  'support.copied': 'Copiado',
  'support.openWallet': 'Abrir na carteira',
  'support.contributed': 'Eu contribuí — libere a estrela e a dança',
  'support.thanks': 'Obrigado — seu bichinho ganhou a estrela e agora dança.',
  'support.releaseNotes': 'Veja as novidades desta versão',
  'support.footerBefore':
    'Prefere contribuir com tempo? Issues e pull requests são igualmente bem-vindos no',

  'language.title': 'Idioma',
  'language.aria': 'Idioma da interface',
  'waveform.style': 'Mudar o estilo do medidor',
};

export default pt;
