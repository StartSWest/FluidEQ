/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Ajuda',
  'help.title': 'Guia do usuário',
  'help.subtitle': 'Encontre seu som. Sinta-se em casa.',
  'help.intro':
    'Um guia prático do FluidEQ, ilustrado com capturas reais do app. Comece pela sua primeira sessão de escuta e depois explore cada parte do app no seu ritmo.',
  'help.offline': 'Disponível offline',
  'help.search': 'Buscar no guia',
  'help.searchHint': 'Experimente motor, graves, visualizador…',
  'help.contents': 'Neste guia',
  'help.results': '{count} capítulos',
  'help.resultsOne': '{count} capítulo',
  'help.empty':
    'Nenhum capítulo encontrado. Tente uma frase menor ou limpe a busca.',
  'help.clear': 'Limpar busca',
  'help.close': 'Fechar guia',
  'help.enlarge': 'Ampliar captura: {title}',
  'help.closeImage': 'Fechar captura',
  'help.controlsOf': 'O que cada controle faz: {title}',
  'help.captureNote':
    'Capturas reais do FluidEQ nas versões 1.6 e 1.7. Cores, nomes e posições dos controles podem variar na sua versão. Os ajustes de exemplo são ilustrações, não presets recomendados.',
  'help.steps': 'Experimente',
  'help.tip': 'Vale saber',
  'help.back': 'Voltar ao início',

  'help.group.start': 'Primeiros passos',
  'help.group.sound': 'Modele seu som',
  'help.group.visuals': 'Veja sua música',
  'help.group.plus': 'FluidEQ Plus',
  'help.group.listen': 'Ouça, cante e compartilhe',
  'help.group.help': 'Quando precisar de ajuda',

  'help.start.title': 'Seus primeiros cinco minutos',
  'help.start.intro':
    'Comece com uma música conhecida em um volume confortável. O painel da esquerda liga o FluidEQ e traz a pré-amplificação; o centro é sua área de trabalho; o painel da direita acompanha sua saída e os perfis dela. A barra na parte de baixo da janela controla o que estiver tocando.',
  'help.start.steps':
    'Instale o FluidEQ e mantenha o Motor FluidEQ selecionado quando a instalação perguntar como processar seu som. O Windows pede permissão uma vez, sem reiniciar.\nEscolha seu dispositivo de escuta em Dispositivo de saída. Ative EQ do sistema e deixe Normalizar automaticamente ligado.\nReproduza uma música, abra EQ → Bandas, faça uma pequena mudança e compare com o EQ do sistema desligado e ligado.',
  'help.start.tip':
    'O EQ em todo o sistema precisa do Windows e de um motor de áudio: o Motor FluidEQ ou o Equalizer APO. No macOS e no Linux, o app mostra saídas de demonstração, então um gráfico em movimento ali não prova que algo esteja sendo processado.',
  'help.start.keywords':
    'instalar, instalador, setup, configurar, primeiros passos, começar, como usar, tutorial, passo a passo, iniciante, introdução, básico, início rápido, guia rápido, manual',

  'help.window.title': 'Conheça a janela',
  'help.window.intro':
    'O cabeçalho leva você de uma página do FluidEQ a outra e mostra o som enquanto ele toca. O painel da esquerda traz o interruptor geral do EQ, a pré-amplificação e o medidor de nível; o painel da direita acompanha sua saída e os perfis dela.',
  'help.window.steps':
    'Escolha uma página no cabeçalho: Mídia online, Compartilhar áudio e EQ antes do sinal; DSP, Biblioteca, Karaokê e Plus depois dele.\nAtive EQ do sistema no painel da esquerda e deixe Normalizar automaticamente ligado, para que nenhum reforço sature.\nPressione o sinal ou o medidor de nível para mudar como ele é desenhado, e o Modo arco-íris para que as curvas e os medidores se movam na taxa de atualização total da sua tela.',
  'help.window.tip':
    'O menu Ajuda abre este guia, Novidades, a solução de problemas de áudio e Relatar um problema. O botão de pulso ao lado dele reúne o cartão do motor, sua conta, a importação de configurações de EQ ou de uma resposta ao impulso, o reinício do áudio do Windows e Processos, que mostra o que cada parte do FluidEQ está usando; na parte de baixo dele ficam o tema Claro ou Escuro, as animações, Iniciar com o Windows e o idioma. O botão depois deles transforma a janela no Player compacto.',
  'help.window.keywords':
    'interface, abas, navegação, tela principal, visão geral, barra superior, barra inferior, painel lateral, VU meter, preamp, tema, modo escuro, modo claro, tema escuro, tema claro, dark mode, idioma, língua, iniciar com o windows, iniciar automaticamente, inicialização automática, inicialização, conta',
  'help.window.headerLeftCaption': 'O cabeçalho, até o sinal',
  'help.window.headerRightCaption': 'O cabeçalho, depois do sinal',
  'help.window.railCaption': 'O painel da esquerda',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch e Suno, tocados dentro do FluidEQ com seu EQ aplicado.',
  'help.window.share':
    'Envia o som deste computador para outro, ou toca aqui o som de outro.',
  'help.window.eq':
    'Suas bandas, presets, correção de fones, presets de jogo e a configuração do motor.',
  'help.window.waveName': 'Sinal de áudio',
  'help.window.wave':
    'O que está tocando, enquanto toca. Pressione-o para mudar como ele é desenhado.',
  'help.window.rainbow':
    'Colore a janela e desenha as curvas e os medidores na taxa de atualização total da sua tela.',
  'help.window.dsp':
    'O rack de efeitos: presets, a Sala e cada estágio da cadeia.',
  'help.window.library':
    'Seus arquivos de música, álbuns e a fila de reprodução.',
  'help.window.karaoke':
    'Cante junto e transforme suas próprias músicas em karaokê.',
  'help.window.plus': 'Visualizadores, a galeria, a Classificação e o Estúdio.',
  'help.window.support': 'Formas de apoiar o desenvolvimento do FluidEQ.',
  'help.window.help':
    'Este guia, Novidades, a solução de problemas de áudio e Relatar um problema.',
  'help.window.actions':
    'O motor, sua conta, a importação de configurações de EQ, o reinício do áudio do Windows e Processos; o tema, as animações, Iniciar com o Windows e o idioma.',
  'help.window.systemEq':
    'Liga ou desliga o processamento do FluidEQ para tudo o que o PC toca.',
  'help.window.preamp':
    'Reduz o nível antes do EQ para que os reforços tenham margem. Normalizar automaticamente faz esse ajuste por você.',
  'help.window.autoNormalize':
    'Mantém a pré-amplificação baixa só o necessário para que nada do que você reforçar sature.',
  'help.window.responseGraph': 'Mostra ou oculta o gráfico abaixo da página.',
  'help.window.meterName': 'Medidor de nível',
  'help.window.meter':
    'O nível de saída dos canais esquerdo e direito, em decibéis reais. Pressione-o para mudar o estilo.',
  'help.player.title': 'O Player compacto',
  'help.player.intro':
    'Um botão transforma a janela do FluidEQ no Player compacto: uma coluna estreita com a música, seu equalizador, um visualizador e a fila A seguir, em módulos que você abre e fecha. O que estiver tocando continua tocando, e o mesmo botão traz o app completo de volta na página em que você estava.',
  'help.player.steps':
    'Pressione o botão Player compacto na barra de título, ao lado de Ajuda. No player, o mesmo botão traz o app completo de volta.\nAbra e feche os módulos com EQ, Visual e Fila. A janela cresce e encolhe conforme o que cada um ocupa, e o player lembra o tamanho e a posição dele.\nClique duas vezes na barra do player, ou escolha Recolher em uma linha no menu dele, para recolhê-lo em uma linha; o logo do FluidEQ o expande de novo.\nEscolha o tema próprio do player no menu dele e mantenha-o acima das outras janelas com Sempre visível.\nSolte arquivos de música em A seguir: eles entram na Biblioteca e na fila.',
  'help.player.tip':
    'O volume do player é o do seu computador, o mesmo do Windows, então ele ajusta o nível de tudo o que o computador toca. Se o player acabar fora da tela, clique com o botão direito no ícone do FluidEQ na bandeja do sistema e escolha Recuperar a janela.',
  'help.player.keywords':
    'mini player, miniplayer, player pequeno, player compacto, compacto, modo compacto, reprodutor compacto, winamp, amp, modo player, sempre visível, sempre no topo, sempre por cima, always on top, fixar, recolher, uma linha, fila, a seguir, soltar arquivos, arrastar arquivos, tema, tema claro, tema escuro, modo escuro, modo claro, janela pequena, player flutuante, janela flutuante, volume',
  'help.player.topCaption': 'O topo: a música, e como ela toca',
  'help.player.eqCaption': 'O equalizador',
  'help.player.queueCaption': 'A seguir',
  'help.player.menuCaption': 'O menu do player',
  'help.player.foldedCaption': 'Recolhido em uma linha',
  'help.player.menu':
    'Voltar ao app completo ou a uma das páginas dele, o tema do player, Sempre visível e Recolher em uma linha.',
  'help.player.pin': 'Mantém o player acima de todas as outras janelas.',
  'help.player.switch': 'Voltar ao app completo, na página em que você estava.',
  'help.player.clock': 'Tempo tocado. Clique nele para ver o tempo restante.',
  'help.player.well':
    'O som enquanto toca. Clique nele para alternar entre barras e onda.',
  'help.player.level': 'O nível do som que sai do FluidEQ, em decibéis.',
  'help.player.volume':
    'O volume do seu computador, o mesmo do Windows: ele ajusta o nível de tudo o que o computador toca.',
  'help.player.decksName': 'EQ, Visual e Fila',
  'help.player.decks':
    'Abrem e fecham o equalizador, o visualizador e a fila A seguir. A janela cresce e encolhe conforme o que cada um ocupa.',
  'help.player.seek': 'Onde a música está. Arraste para ir a outro ponto.',
  'help.player.playingName': 'Controles de reprodução',
  'help.player.playing':
    'Anterior, voltar cinco segundos, reproduzir ou pausar, avançar cinco segundos, próximo e parar.',
  'help.player.orderName': 'Aleatório e repetição',
  'help.player.order':
    'Embaralha a fila A seguir e não repete nada, repete tudo ou só esta música.',
  'help.player.lookName': 'Próximo estilo',
  'help.player.look':
    'Muda o estilo do visualizador. Ctrl+clique volta ao anterior, e o clique direito lista todos.',
  'help.player.screen':
    'O que você ouve, desenhado: suas bandas, o EQ inteligente e tudo o mais que estiver aplicado, sobre um estilo do visualizador. Também aplicado lista cada um, e uma etiqueta desliga um deles sem removê-lo.',
  'help.player.bands':
    'Arraste uma banda para cima ou para baixo para reforçá-la ou cortá-la. A frequência dela fica escrita embaixo.',
  'help.player.tone':
    'Bandas mostra todas as bandas; Tom as troca pelos controles Graves, Médios e Agudos.',
  'help.player.upNext':
    'Sua posição na fila, o tempo que falta nela e quanto dela já tocou.',
  'help.player.library': 'Abre a Biblioteca no app completo.',
  'help.player.songsName': 'As músicas',
  'help.player.songs':
    'O que toca a seguir. Clique duas vezes em uma música para tocá-la, ou solte arquivos de música aqui para adicioná-los.',
  'help.player.openIn': 'Abre o app completo em uma das páginas dele.',
  'help.player.theme':
    'O tema Claro ou Escuro do próprio player, separado do tema do app completo.',
  'help.player.fold':
    'Recolhe o player em uma linha. Clicar duas vezes na barra dele faz o mesmo.',
  'help.player.unfold': 'Expande o player. A seta na outra ponta também.',
  'help.player.foldedPlaying':
    'Anterior, reproduzir ou pausar, próximo e parar.',
  'help.player.foldedClock': 'O tempo, e onde a música está.',

  'help.requirements.title': 'O que o seu PC precisa',
  'help.requirements.intro':
    'O FluidEQ roda em qualquer PC com Windows dos últimos dez anos. Duas partes pedem mais que o resto: os visualizadores Plus desenham na placa de vídeo, e o karaokê com IA baixa seus modelos na primeira vez que você o usa.',
  'help.requirements.steps':
    'Veja qual Windows você tem: Windows 10 versão 1803 ou posterior, ou Windows 11, de 64 bits, 4 GB de memória e cerca de 600 MB de disco. Processar tudo o que o PC toca precisa do Motor FluidEQ ou do Equalizer APO, e o Windows pede permissão uma vez durante a instalação.\nAbra um visualizador: qualquer placa de vídeo ou vídeo integrado de 2013 em diante. Em 1080p o vídeo integrado basta; para 4K, ou um plano de fundo em várias telas ao mesmo tempo, uma placa dedicada é melhor. Com a placa ocupada, o FluidEQ desenha a cena menor e solta as que você não está vendo.\nExperimente o karaokê com IA: separar a voz baixa um modelo de 713 MB na primeira vez, o da afinação acrescenta cerca de 180 MB e o de remover ruído, 11 MB. Com uma placa de vídeo com DirectX 12, uma música de quatro minutos é separada em meio minuto; só com o processador leva cerca de quatro minutos. Deixe 2 GB de memória livres enquanto ele trabalha.\nMire nisto se puder: Windows 11, 8 GB de memória, vídeo de 2018 em diante e 3 GB de disco livres se você usar os recursos com IA.',
  'help.requirements.tip':
    'Tudo, menos os modelos de IA, vem no instalador, e eles só são baixados quando você usa o recurso pela primeira vez. Processos, no menu de ações, mostra o que cada parte do FluidEQ está usando na sua máquina agora.',
  'help.requirements.keywords':
    'requisitos mínimos, configuração mínima, recomendado, especificações, hardware, notebook, laptop, GPU, CPU, RAM, armazenamento, espaço em disco, desempenho, performance, lento, travando, lag, PC fraco, consumo, compatibilidade, compatível, Mac, macOS, Linux',

  'help.engine.title': 'O Motor FluidEQ',
  'help.engine.intro':
    'O FluidEQ processa seu som com um motor próprio ou com o Equalizer APO. O Motor FluidEQ roda dentro do serviço de áudio do Windows, depois dos efeitos da sua placa de som, leva seu EQ e o rack DSP a tudo o que o PC toca e sai do caminho assim que o FluidEQ fecha.',
  'help.engine.steps':
    'Abra o menu de ações (o botão de pulso no canto superior direito) e clique no cartão do motor, no topo.\nEscolha Motor FluidEQ e pressione Aplicar. O Windows pede permissão, e o áudio pausa por alguns segundos enquanto reinicia.\nSe uma saída mostrar DESLIG., pressione Ativar no aviso dela. Se um aviso disser que o motor não está funcionando, pressione Reiniciar o áudio do Windows.',
  'help.engine.tip':
    'O Equalizer APO continua disponível para comandos personalizados do APO, Peace e plugins VST. Quando uma atualização traz um motor mais novo, um aviso oferece Atualizar o motor. Sair do FluidEQ pela bandeja do sistema desliga o EQ em todas as saídas.',
  'help.engine.keywords':
    'engine, driver, global, todos os programas, todos os aplicativos, Spotify, Discord, navegador, habilitar, administrador, instalar motor',
  'help.engine.fluid':
    'Recomendado. Os efeitos da sua placa de som continuam funcionando, e o EQ e o rack DSP chegam a todos os apps.',
  'help.engine.apo':
    'Roda comandos personalizados do APO, Peace e plugins VST. O rack DSP fica só na reprodução da Biblioteca.',
  'help.engine.apply':
    'Troca o motor. O Windows pede permissão uma vez, e o áudio reinicia por alguns segundos.',

  'help.eq.title': 'Modele seu som com EQ',
  'help.eq.intro':
    'Frequência define onde a banda atua; Ganho, o reforço ou corte; Q, a largura: Q maior é mais estreito. Sem nenhuma banda selecionada, os controles de Tom — Graves, Médios e Agudos, com Corte graves e Corte agudos nas laterais — moldam o som como uma curva própria e deixam suas bandas como estão. Comece com mudanças pequenas e amplas e compare sempre.',
  'help.eq.steps':
    'Abra EQ → Bandas. Sem nada selecionado, gire Graves, Médios ou Agudos para uma mudança rápida de tom, e Corte graves ou Corte agudos para aparar os extremos. Eles desenham a própria linha de Tom no gráfico.\nClique na frequência de uma banda, ou no ponto dela no gráfico, para selecioná-la. Gire os controles Frequência, Ganho e Fator Q, escolha um Filtro ou desligue-a com Ativa.\nClique com o botão direito em uma banda para redefini-la, desativá-la ou adicionar uma banda ao lado. Pressione Limpar EQ para definir todos os ganhos, e também Graves, Médios e Agudos, em 0 dB mantendo suas bandas. Ele pergunta antes.',
  'help.eq.tip':
    'Em Também aplicado aparece o que molda esta saída além das suas bandas, cada camada com sua própria intensidade e o ×. O Modo jogo reduz o atraso que o FluidEQ acrescenta, para jogos e chamadas; os presets de jogo o ativam.',
  'help.eq.keywords':
    'equalizador, equalização, paramétrico, predefinição, predefinições, bass boost, peaking, low cut, high cut, HPF, LPF, zerar, resetar, timbre, som abafado, estridente',
  'help.eq.bandsCaption': 'A página Bandas, sem nada selecionado',
  'help.eq.bandCaption': 'Uma banda selecionada',
  'help.eq.gameMode':
    'Reduz o atraso que o FluidEQ acrescenta, para jogos e chamadas. Os presets de jogo o ativam.',
  'help.eq.layers':
    'As outras camadas que moldam esta saída (uma correção de fones, o EQ inteligente, uma convolução), cada uma com sua intensidade, seu interruptor e o ×.',
  'help.eq.bandName': 'Uma banda',
  'help.eq.band':
    'Arraste o ponto dela para reforçar ou cortar. Clique na frequência dela para selecioná-la.',
  'help.eq.bass': 'Aumenta ou reduz a região grave de toda a curva.',
  'help.eq.mid': 'Aumenta ou reduz a região média, onde ficam as vozes.',
  'help.eq.treble':
    'Aumenta ou reduz a região aguda, onde ficam o ar e os detalhes.',
  'help.eq.selected':
    'A banda em edição. Use Ctrl+clique ou Shift+clique para selecionar várias.',
  'help.eq.filter':
    'A forma dela: Sino, Shelf grave, Shelf agudo, Notch, Passa-baixa, Passa-alta ou Passa-banda.',
  'help.eq.voicing':
    'Uma cadeia pronta para o som, como Música ou um gênero. Nenhum deixa só as suas bandas.',
  'help.eq.smart':
    'Ouve o que está tocando e corrige: Detalhe, Equilíbrio ou Alvo.',
  'help.eq.clear':
    'Define todos os ganhos em 0 dB e mantém suas bandas. Pergunta antes.',
  'help.eq.mode':
    'A força com que seu EQ e as curvas se aplicam, o Q das bandas e a fase.',
  'help.eq.add': 'Adiciona uma banda ao lado da selecionada.',
  'help.eq.layouts':
    'Quantidades de bandas e os designs de bandas que você salvou.',
  'help.eq.frequency': 'Onde a banda selecionada atua, de 1 Hz a 20 kHz.',
  'help.eq.gain': 'Quanto ela reforça ou corta. Ctrl+clique volta a 0 dB.',
  'help.eq.q': 'A largura dela: quanto maior, mais estreita.',
  'help.eq.delete':
    'Pressione duas vezes para excluir a banda; Manter cancela.',
  'help.eq.menuCaption': 'O menu de clique direito de uma banda',
  'help.eq.reset': 'Ganho de volta a 0 dB e Q de volta a 2.',
  'help.eq.disable': 'Tira a banda do som e mantém os ajustes dela.',
  'help.eq.addLeft': 'Adiciona uma banda a meio caminho da vizinha mais grave.',
  'help.eq.addRight':
    'Adiciona uma banda a meio caminho da vizinha mais aguda.',

  'help.eqmode.title': 'Modo EQ e designs de bandas',
  'help.eqmode.intro':
    'O Modo EQ muda como o seu som é moldado, sem editar nada. Seu EQ reúne suas bandas, o Tom, os presets, o Tipo de driver e o EQ inteligente; Correções reúne as correções de fones e as curvas importadas ou personalizadas. Os designs de bandas armazenam as frequências e o Q de um layout de que você gosta, prontos para qualquer saída.',
  'help.eqmode.steps':
    'Abra Modo EQ na barra de ferramentas de Bandas. Experimente uma opção de Intensidade, Q das bandas ou Suavização das curvas com a música tocando; o painel continua aberto.\nCom o Motor FluidEQ, escolha a fase Mínima ou Linear, e Preciso ou Clássico nos agudos. Pressione Redefinir para voltar tudo ao Normal.\nAbra o botão de layouts ao lado de Adicionar banda. Escolha 6, 10, 15, 20 ou 31 bandas, ou pressione Salvar design… para dar nome ao layout atual.',
  'help.eqmode.tip':
    'Um design armazena só frequências e Q: ao carregar um, todas as bandas começam em 0 dB. A fase linear acrescenta atraso e pode ressoar antes de ataques rápidos.',
  'help.eqmode.keywords':
    'número de bandas, quantas bandas, equalizador gráfico, força, pre-ringing, terço de oitava, agudos, preciso, clássico',
  'help.eqmode.modeCaption': 'Modo EQ',
  'help.eqmode.strength':
    'Normal, Estúdio ×1.5 ou ×2, para Seu EQ e suas Correções separadamente.',
  'help.eqmode.q':
    'Constante mantém cada Q; Proporcional e Assimétrico estreitam as bandas conforme elas crescem.',
  'help.eqmode.smoothing': 'Suaviza curvas de correção amostradas.',
  'help.eqmode.phase': 'Mínima ou Linear. Só com o Motor FluidEQ.',
  'help.eqmode.treble':
    'Preciso soa como desenhado; Clássico, como no Equalizer APO. Só com o Motor FluidEQ.',
  'help.eqmode.reset': 'Tudo de volta ao Normal.',
  'help.eqmode.designsCaption': 'Designs de bandas',
  'help.eqmode.builtIn': 'Layouts padrão de 6, 10, 15, 20 ou 31 bandas.',
  'help.eqmode.save':
    'Dá nome às frequências e ao Q atuais como um design, listado em Meus designs.',

  'help.games.title': 'Presets de jogo',
  'help.games.intro':
    'Dê a cada jogo o seu próprio som. Quando o jogo vem para a frente, o FluidEQ muda para esse som e o mantém até você fechar o jogo, mesmo que você vá para outra janela com Alt+Tab nesse meio-tempo. Depois, ele restaura o que você tinha.',
  'help.games.steps':
    'Abra EQ → Presets de jogo e pressione Adicionar um jogo. Escolha um jogo dos seus lançadores, um programa aberto agora, ou escolha você mesmo o programa dele.\nNo seletor da linha dele, escolha o som que ele deve receber: um preset de jogo ou qualquer outro.\nInicie o jogo. Um cartão na tela diz para qual som o FluidEQ mudou, e outro diz qual som voltou quando você o fecha.',
  'help.games.tip':
    'Enquanto um jogo estiver no comando do som, a barra na parte de baixo da janela mostra o nome dele. Se você escolher outro som enquanto joga, ele é mantido: o FluidEQ só desfaz o que ele mesmo aplicou. Os presets de jogo também ativam o Modo jogo.',
  'help.games.keywords':
    'games, gaming, perfil de jogo, por aplicativo, troca automática, launcher, FPS, jogo de tiro, passos dos inimigos, competitivo, latência',
  'help.games.tab': 'Seus jogos e o som que cada um recebe.',
  'help.games.add':
    'Adiciona um jogo de Steam, Epic, EA, GOG, Ubisoft, Battle.net ou Xbox, ou qualquer programa aberto agora.',
  'help.games.gameName': 'Um jogo',
  'help.games.game': 'O jogo e a pasta pela qual o FluidEQ o reconhece.',
  'help.games.soundName': 'O som dele',
  'help.games.sound':
    'O som para o qual o FluidEQ muda quando este jogo vem para a frente, ou Deixar como está.',
  'help.games.removeName': 'Remover',
  'help.games.remove': 'Esquece o jogo. O preset que ele usava permanece.',

  'help.headphones.title': 'Correção de fones e importações',
  'help.headphones.intro':
    'A correção compensa um modelo medido e pode ser combinada com suas bandas e seus presets. Confira modelo exato e autor da medição.',
  'help.headphones.steps':
    'Abra EQ → Presets EQ, procure o modelo dos seus fones, revise as medições disponíveis e escolha a correspondente.\nPara texto de EQ de outra ferramenta, use Importar configurações de EQ no menu de ações. Confira as bandas e a curva interpretadas antes de aplicar.\nPara o Squiglink, cole a exportação dele no painel de importação. Aplicar como EQ substitui suas bandas; Aplicar como curva a adiciona como uma correção de fones com intensidade própria.',
  'help.headphones.tip':
    'Uma prévia marcada como Não aplicada não muda o som. Evite duas correções completas para o mesmo fone por acidente; compare desligando a camada de fones.',
  'help.headphones.keywords':
    'AutoEq, Harman, curva alvo, fones de ouvido, headphone, headset, IEM, in-ear, earbuds, TWS, Crinacle, oratory1990, resposta de frequência, calibração',

  'help.convolution.title': 'Use uma resposta ao impulso',
  'help.convolution.intro':
    'Convolução aplica um impulso WAV como camada separada. Pesquise o catálogo AutoEq ou importe seu WAV; as bandas paramétricas continuam independentes.',
  'help.convolution.steps':
    'Abra EQ → Convolução e procure por modelo ou autor da medição.\nConfira a origem e use Baixar e aplicar; o download acompanha a taxa da sua saída. Use Importar um WAV para um arquivo que você já tem.\nOuça com a camada de convolução ligada e desligada em Também aplicado.',
  'help.convolution.tip':
    'O Motor FluidEQ converte sozinho qualquer taxa do impulso. O Equalizer APO precisa de um WAV importado na taxa da própria saída. Os downloads do catálogo precisam de conexão; o guia não.',
  'help.convolution.keywords':
    'IR, resposta impulsiva, convolver, FIR, correção de sala, REW, arquivo de correção, taxa de amostragem',

  'help.profiles.title': 'Dispositivos, perfis e segunda saída',
  'help.profiles.intro':
    'Seu EQ acompanha o dispositivo de saída. O Vínculo automático salva as edições na saída atual, e os Perfis salvos permitem manter sons alternativos. Segunda saída espelha a reprodução em outros dispositivos, com um nível separado para cada um.',
  'help.profiles.steps':
    'Confira o Dispositivo de saída antes de editar. Use Novo perfil para um som que quer manter; Atualizar salva as mudanças nesse perfil e Restaurar traz de volta os ajustes salvos dele.\nAbra Segunda saída, ative um dispositivo acessível e ajuste o nível. Escolha o perfil de EQ salvo desse dispositivo logo abaixo dele.\nUse Jogo/Vídeo para um buffer inicial menor ou Música para mais reserva. Compare a sincronização nos seus dispositivos.',
  'help.profiles.tip':
    'Cada saída espelhada usa seu próprio perfil, com qualquer um dos motores. O espelhamento funciona enquanto o FluidEQ está aberto; trocar a saída principal encerra os espelhamentos antigos. A latência do dispositivo ainda afeta a sincronização.',
  'help.profiles.keywords':
    'caixas de som, alternar saída, salvar configurações, saída secundária, múltiplas saídas, dois fones, Bluetooth, delay, atraso, DAC',
  'help.profiles.list':
    'Os sons que você salvou. ATV indica o perfil que esta saída usa; pressione outro para trocar.',
  'help.profiles.update': 'Salva suas mudanças no perfil em que você está.',
  'help.profiles.new': 'Cria um perfil novo a partir do EQ que você tem agora.',
  'help.profiles.restore':
    'Traz o perfil de volta como você o salvou pela última vez.',
  'help.profiles.output':
    'A saída pela qual você está ouvindo. DESLIG. significa que seu EQ não chega a ela; ATIVO, que o Windows está tocando por ela.',
  'help.profiles.mapping':
    'O perfil que esta saída segue. Qualquer mudança que você fizer é salva nele automaticamente.',
  'help.profiles.onePlayer':
    'Começar algo no FluidEQ pausa o que toca em outro lugar do PC, e vice-versa.',
  'help.profiles.outputs':
    'Suas outras saídas. Ative uma para tocar nela também, com um perfil próprio.',
  'help.profiles.driver':
    'Um ponto de partida suave para o que você usa para ouvir: fones de ouvido, fones intra-auriculares, um tamanho ou um material de driver. Deixe em Sem compensação se o som já estiver certo.',

  'help.config.title': 'Inspecione e salve uma cadeia',
  'help.config.intro':
    'EQ → Config mostra o que o motor de áudio realmente tem em disco. Os cartões de saída e a árvore de inclusões ajudam a ver quais dispositivos e camadas estão envolvidos. Exporte uma cadeia antes de um grande experimento ou ao transferir uma configuração.',
  'help.config.steps':
    'Abra EQ → Config, selecione a saída e confira estado e camadas.\nUse Exportar cadeia para salvar um arquivo .fluideq.\nPara recuperá-lo, selecione primeiro a saída desejada, use Importar cadeia e confira o resultado.',
  'help.config.tip':
    'Os arquivos de camadas gerados são reescritos quando os ajustes deles mudam; coloque linhas manuais permanentes no arquivo personalizado de cada saída. O Motor FluidEQ lê as linhas Filter, Preamp, GraphicEQ e Convolution desse arquivo; outros comandos do APO e plugins precisam do Equalizer APO.',
  'help.config.keywords':
    'backup, cópia de segurança, restaurar backup, exportar configurações, config.txt, arquivo de texto, include, avançado, migrar',

  'help.dsp.title': 'Explore o rack DSP',
  'help.dsp.intro':
    'O rack DSP é uma cadeia de estágios de estúdio. Com o Motor FluidEQ, ele processa tudo o que o PC toca; com o Equalizer APO, processa as faixas de áudio da Biblioteca. Ele fica desligado enquanto o FluidEQ está desligado.',
  'help.dsp.steps':
    'Abra a aba DSP. Escolha uma cadeia em Presets, ou selecione um estágio na barra lateral e ligue-o.\nMude um controle por vez e compare desativando o estágio, em um volume parecido. Isolar permite ouvir só o que um estágio acrescenta.\nSalve um rack de que você gosta e use Exportar e Importar para compartilhá-lo.',
  'help.dsp.tip':
    'Mais alto costuma soar melhor só por ser mais alto, então compare em níveis equivalentes. Ctrl+clique em um controle giratório para voltar ao valor padrão.',
  'help.dsp.keywords':
    'efeitos, FX, plugins, limiter, limitador, loudness, LUFS, normalização de volume, nivelamento, exciter, abertura estéreo, subgrave, subharmônico, transientes, masterização, crossfade, gapless',
  'help.dsp.normalizer':
    'Uniformiza a sonoridade. No áudio ao vivo, nivela música por música.',
  'help.dsp.denoise':
    'Corrige chiado, zumbido e estalos. O limpador de voz neural funciona nas faixas da Biblioteca.',
  'help.dsp.exciter': 'Adiciona harmônicos para dar corpo e ar.',
  'help.dsp.bassForge':
    'Adiciona uma oitava real abaixo do baixo, ou os harmônicos dela, para alto-falantes pequenos.',
  'help.dsp.equaliser':
    'Quinze bandas paramétricas, com fase mínima ou linear.',
  'help.dsp.bassPunch':
    'Molda o ataque, a sustentação e a floração dos graves.',
  'help.dsp.dimension': 'Amplia a imagem estéreo sem mudar a soma mono.',
  'help.dsp.maximizer': 'Eleva o nível sem deixar os picos passarem do teto.',
  'help.dsp.master': 'Nível final, alvo de sonoridade e proteção de picos.',
  'help.dsp.crossfade': 'Funde uma faixa da Biblioteca na seguinte.',
  'help.dsp.presets':
    'Cadeias do rack inteiro para gêneros, dispositivos e reparos.',
  'help.dsp.scopeName': 'Em todo o sistema',
  'help.dsp.scope':
    'Onde o rack está funcionando e qualquer atraso que a fase linear acrescente.',

  'help.room.title': 'A Sala: surround nos fones de ouvido',
  'help.room.intro':
    'A Sala transforma os fones de ouvido em uma sala de escuta. Cada canal do som passa a ser um alto-falante ao redor da sua cabeça, renderizado através de uma cabeça medida e das reflexões de uma sala que você mesmo molda, e um filme fica à sua frente e um jogo envolve você. Precisa do Motor FluidEQ e de fones de ouvido; em alto-falantes não serve para nada.',
  'help.room.steps':
    'Abra DSP, escolha Sala na barra e ligue-a. O estéreo vira dois alto-falantes à sua frente; um filme 5.1, cinco e o sub; um jogo 7.1, o anel inteiro. O chip ao lado do interruptor diz qual.\nEscolha uma sala no topo — estúdio, sala de estar, cinema, sala de concertos e mais — ou gire Tamanho, Paredes e Distância você mesmo e arraste um alto-falante pelo anel. Os alto-falantes que o fluxo em reprodução não alcança são desenhados adormecidos.\nPressione Começar o teste de escuta e responda a cinco pares curtos de escuta: a sala fica com a cabeça que põe os sons à sua frente. Pequena, Média e Grande também podem ser escolhidas à mão.\nSalve uma sala de que você goste com um nome; uma sala salva volta com um toque e nunca muda a sua cabeça.',
  'help.room.tip':
    'Jogos e filmes só enviam os canais surround para uma saída que o Windows acredita ter esse número de alto-falantes: quando o driver aceita, o painel de saída oferece um toque para 7.1.',
  'help.room.keywords':
    'surround virtual, áudio espacial, 3D, binaural, HRTF, virtualizador, reverb, reverberação, eco, palco sonoro, soundstage, crossfeed, home theater, imersivo',
  'help.room.picker':
    'As salas de partida, agrupadas como os perfis de todos os outros estágios; Personalizado assim que você molda uma.',
  'help.room.picture':
    'A sala vista de cima: paredes que se apagam ao absorver, os alto-falantes no anel deles, a cabeça no centro. Está tudo desenhado em uma só escala, por isso um alto-falante mais afastado do que a sala é larga fica desenhado fora das paredes dela. Arraste um e o par dele o acompanha; mantenha Shift para movê-lo sozinho.',
  'help.room.speaker':
    'Toque em um alto-falante da sala e este painel passa a ser dele: o ângulo em graus, a própria distância, o nível, e Silenciar ou Solo para ouvi-lo sozinho.',
  'help.room.speakerName': 'O alto-falante escolhido',
  'help.room.dialsName': 'Espaço, Ambiente, Distância',
  'help.room.dials':
    'Quanto você ouve das paredes, a cauda suave que vem depois e a que distância estão os alto-falantes. Tamanho, Paredes e a duração e o tom da cauda estão em Caráter da sala, abaixo.',
  'help.room.fit':
    'Cinco pares de escuta que escolhem a cabeça para os seus ouvidos.',
  'help.room.head':
    'A cabeça medida através da qual a sala é renderizada: pequena, média ou grande.',
  'help.room.saved': 'Dá um nome à sala tal como está; volta com um toque.',
  'help.room.liveName': 'O que a sala está fazendo',
  'help.room.live':
    'Lido do motor: quais alto-falantes o fluxo em reprodução alcança, ou por que a sala está parada.',

  'help.denoise.title': 'Redução de ruído e análise',
  'help.denoise.intro':
    'A Redução de ruído diminui chiado, zumbido da rede elétrica e estalos. Com o Motor FluidEQ, ela funciona ao vivo em tudo o que o PC toca; o limpador de voz neural e o piso de ruído analisado são para faixas da Biblioteca. Redução mais forte não é automaticamente melhor.',
  'help.denoise.steps':
    'Toque algo com o ruído que você quer reduzir e selecione Redução de ruído em DSP.\nLigue Chiado, Zumbido ou Estalos com um ajuste leve e ouça os trechos quietos e os detalhes musicais.\nAumente a redução aos poucos e depois desative o estágio para conferir se a melhora compensa alguma perda de detalhe.',
  'help.denoise.tip':
    'Preste atenção a detalhes suavizados e a texturas aguadas ou com bombeamento. Isto não é uma limpeza de microfone. Se não ouvir nenhuma mudança, confirme que o rack e o estágio estão ligados.',
  'help.denoise.keywords':
    'barulho, remover ruído, tirar ruído, ruído de fundo, estática, vinil, restauração, limpar áudio, denoise, noise',

  'help.graph.title': 'O gráfico e seus controles',
  'help.graph.intro':
    'O gráfico de resposta desenha as curvas do seu EQ sobre o som ao vivo. A barra acima dele escolhe o que é desenhado e como, e muda conforme o visual: um estilo padrão ou um visualizador Plus.',
  'help.graph.steps':
    'Clique no nome do visual para escolher um estilo ou visualizador. As setas ao lado dele, Espaço e Ctrl+Espaço percorrem as opções.\nAbra Visualização para o tamanho do gráfico, o que ele mostra e a altura e a posição da onda. Quadros também está lá: todos os quadros que a sua tela oferecer, ou 60 ou 30, e 60 na bateria.\nUm visualizador Plus acrescenta os seus próprios controles a Visualização — o que o autor deixou você ajustar — e Usar a onda original devolve a onda à altura e à posição que esse autor escolheu.\nClique duas vezes no gráfico para tela cheia, ou Ctrl+clique duplo para expandi-lo na janela; outro clique duplo o traz de volta. Um clique simples oculta ou mostra a barra.\nTeclas: Ctrl+F tela cheia, Ctrl+S visualização expandida, Esc volta à visualização normal, Ctrl+G a grade, Ctrl+W o que o gráfico mostra, Ctrl+I o sentido da onda, Ctrl+A todas as bandas. No ponto de uma banda, arraste para movê-la e o clique direito abre o menu dela; Ctrl+roda muda o Q de um ponto selecionado.',
  'help.graph.tip':
    'Tudo aqui muda só o desenho, nunca o seu som. O Modo arco-íris (ativado em Ajuda → Novidades) desenha os estilos padrão, os medidores e a onda na taxa de atualização total da sua tela em vez de 30 quadros por segundo.',
  'help.graph.keywords':
    'analisador de espectro, forma de onda, waveform, FPS, frame rate, fullscreen, esconder, atalhos, atalhos de teclado, clique duplo, expandida',
  'help.graph.stripCaption': 'Com um estilo padrão',
  'help.graph.live': 'Mostra ou oculta a onda ao vivo.',
  'help.graph.previous': 'Volta ao visual anterior.',
  'help.graph.picker': 'Abre todos os estilos e visualizadores.',
  'help.graph.next': 'Avança para o próximo visual.',
  'help.graph.autoName': 'Auto',
  'help.graph.auto': 'Troca o visual a intervalos de 10 segundos a 2 minutos.',
  'help.graph.colouring':
    'Colore o estilo: Auto, Uniforme, Frequência, Nível ou Calor.',
  'help.graph.newLook': 'Cria um visual seu a partir deste estilo.',
  'help.graph.bandsName': 'Faixas de audição',
  'help.graph.bands': 'Sombreia as faixas de frequência que você mais ouve.',
  'help.graph.bandsMenu':
    'O mesmo sombreamento; fica acinzentado com um visualizador Plus, que nunca o desenha.',
  'help.graph.gridName': 'Grade',
  'help.graph.grid': 'Mostra ou oculta a grade e as escalas.',
  'help.graph.viewName': 'Visualização',
  'help.graph.view': 'Tamanho, o que é desenhado e a onda.',
  'help.graph.plusCaption': 'Com um visualizador Plus',
  'help.graph.tintName': 'Cores da janela',
  'help.graph.tint':
    'O tema do app, as cores do visualizador ou as cores dele com luz (Ambiente).',
  'help.graph.lighting': 'Ilumina seus dispositivos RGB com esta cena.',
  'help.graph.desktop':
    'Coloca este visualizador atrás dos ícones da área de trabalho.',
  'help.graph.viewCaption': 'O menu Visualização',
  'help.graph.expand': 'O gráfico cresce por cima do editor.',
  'help.graph.fullscreen': 'O gráfico ocupa a tela toda.',
  'help.graph.showingName': 'Mostrando',
  'help.graph.showing': 'Percorre o que o gráfico mostra.',
  'help.graph.waveName': 'A onda',
  'help.graph.wave': 'O desenho do espectro ao vivo.',
  'help.graph.topWaveName': 'Onda superior',
  'help.graph.topWave': 'A pequena onda na barra de título.',
  'help.graph.meterName': 'Medidor de nível',
  'help.graph.meter': 'O medidor de saída no painel da esquerda.',
  'help.graph.waveHeight': 'A altura com que a onda é desenhada.',
  'help.graph.wavePosition': 'Da borda inferior até o meio.',
  'help.graph.attack':
    'Com que rapidez um visualizador Plus sobe com a música.',
  'help.graph.release':
    'Com que lentidão ele volta a cair depois de cada batida.',
  'help.graph.ownTiming': 'Volta ao ritmo original do visualizador.',
  'help.looks.title': 'Estilos e visualizadores Plus',
  'help.looks.intro':
    'Os estilos padrão são desenhos gratuitos do som ao vivo que você mesmo pode colorir e personalizar: Linha e Área para um traço limpo, Blocos LED e Picos para impacto, Treliça, Horizonte e Chamas dançantes para cenas inteiras. Os visualizadores Plus são cenas desenhadas na placa de vídeo, como Alpino, Aurora, Floração e Cidade de neon, em que os graves, a batida e os agudos movem, cada um, algo diferente.',
  'help.looks.steps':
    'Clique no nome do visual no gráfico. Pesquise ou filtre os estilos por Linhas, Preenchimentos, Barras, Pontos ou Cenas.\nEscolha um visualizador Plus à direita. Sem o Plus ele fica bloqueado, e escolhê-lo explica como obtê-lo.\nEm um estilo padrão, pressione Novo visual para mudar as cores, o movimento e os picos, e depois salve; ele aparece em Seus.',
  'help.looks.tip':
    'Um visualizador Plus traz as próprias cores: ajuste o ataque e a liberação dele em Visualização. Se uma cena não puder rodar neste computador, o gráfico desenha um estilo gratuito em vez de ficar em branco.',
  'help.looks.keywords':
    'skin, aparência, temas, animação, animações, customizar, visualizer',
  'help.looks.searchName': 'Pesquisar',
  'help.looks.search':
    'Encontra estilos e visualizadores por nome, criador ou categoria.',
  'help.looks.styles':
    'Estilos gratuitos desenhados pelo FluidEQ e os visuais que você salvou.',
  'help.looks.familiesName': 'Filtros de estilos',
  'help.looks.families':
    'Linhas, Preenchimentos, Barras, Pontos, Cenas e Seus.',
  'help.looks.plus': 'Cenas do FluidEQ e dos membros, cada uma com uma imagem.',
  'help.looks.categoriesName': 'Categorias',
  'help.looks.categories': 'Natureza, Cidades, Abstrato e mais.',

  'help.plus.title': 'O FluidEQ Plus e sua conta',
  'help.plus.intro':
    'Uma conta é opcional: tudo o que era grátis funciona neste computador sem ela. O FluidEQ Plus, mensal ou anual, acrescenta Visualizadores, a Classificação, o Estúdio, a Iluminação dinâmica e o visualizador da área de trabalho. Uma conta nova pode experimentar o Plus grátis por quinze dias, e uma cena que você publicar e que for aprovada lhe dá um mês.',
  'help.plus.steps':
    'Abra Conta no menu de ações. Entre, ou crie uma conta e digite o código de seis dígitos enviado para seu email.\nPressione Passar ao Plus, leia os termos, marque que concorda e pague no Buy Me a Coffee, no seu navegador, com o mesmo email.\nAbra a aba Plus. A barra lateral dela leva à Classificação, aos Visualizadores, ao Estúdio e à Iluminação dinâmica.',
  'help.plus.tip':
    'O app nunca vê seu cartão; Gerenciar assinatura permite alterá-la ou cancelá-la. O teste gratuito não pede cartão e não cobra nada ao terminar. Uma conta fica conectada em até cinco computadores, e o Plus continua funcionando offline por um tempo.',
  'help.plus.keywords':
    'login, cadastro, cadastrar, registrar, premium, assinar, planos, preço, custo, comprar, pagamento, cartão de crédito, mensalidade, trial, cancelar, upgrade, código de verificação',
  'help.plus.leaderboard':
    'Quem ouve mais, entre os membros Plus que participam.',
  'help.plus.visualizers':
    'Cenas do FluidEQ e dos membros, prontas para sua música.',
  'help.plus.studio': 'Crie suas próprias cenas com sua IA.',
  'help.plus.lighting': 'Seus dispositivos RGB seguem a cena.',
  'help.plus.fold':
    'Recolhe a barra lateral até ficarem só as imagens; ela volta a abrir ao passar o mouse.',

  'help.gallery.title': 'A galeria de Visualizadores',
  'help.gallery.intro':
    'Visualizadores reúne as cenas do próprio FluidEQ e as que os membros publicam. Qualquer conta pode explorar e experimentar por dez segundos as amostras grátis do FluidEQ; o Plus toca todas as cenas com sua música e as adiciona aos seus visuais.',
  'help.gallery.steps':
    'Abra Plus → Visualizadores. Pesquise, ordene por Mais curtidas, Nesta semana ou Mais novas, ou escolha uma categoria.\nAbra uma cena, pressione Adicionar aos meus visuais e depois Reproduzir no gráfico. As setas, ou ← e →, passam de uma cena para outra.\nCurta as cenas dos membros com o coração e denuncie uma que não deveria estar lá.',
  'help.gallery.tip':
    'As cenas nos seus visuais se atualizam sozinhas, e a página de uma cena diz o que mudou em cada versão. Uma cena que você publica aparece assim que um moderador a aprova. Abrir no Estúdio mostra como as cenas do próprio FluidEQ são feitas.',
  'help.gallery.keywords':
    'baixar visualizadores, cenas da comunidade, likes, populares, denunciar, moderação',
  'help.gallery.search': 'Encontra cenas e criadores.',
  'help.gallery.sortName': 'Ordenar',
  'help.gallery.sort': 'Mais curtidas, curtidas nesta semana ou mais novas.',
  'help.gallery.categoriesName': 'Categorias',
  'help.gallery.categories': 'Mostra um tipo de cena.',
  'help.gallery.mine': 'As cenas que você publicou, com as curtidas delas.',
  'help.gallery.cardName': 'Uma cena',
  'help.gallery.card':
    'A imagem abre a cena; Adicionar a coloca nos seus visuais.',
  'help.gallery.manage':
    'O que cada monitor mostra como fundo da área de trabalho.',
  'help.gallery.stop': 'Para todos os fundos da área de trabalho.',
  'help.gallery.sceneCaption': 'A página de uma cena',
  'help.gallery.back': 'Volta à galeria, onde você parou.',
  'help.gallery.play':
    'Adiciona a cena aos seus visuais ou a reproduz no gráfico.',
  'help.gallery.desktop': 'Coloca a cena atrás dos ícones da área de trabalho.',
  'help.gallery.inspect':
    'Abre a cena do FluidEQ no Estúdio para ver como ela é feita.',

  'help.leaderboard.title': 'A Classificação',
  'help.leaderboard.intro':
    'A Classificação ordena os membros Plus que participam dela pelo quanto ouvem e pelas curtidas que suas cenas recebem. Ela fica desligada a menos que você entre.',
  'help.leaderboard.steps':
    'Abra Conta e pressione Entrar na classificação.\nAbra Plus → Classificação. Escolha o nome de usuário e o nome visível que a classificação mostra, e depois alterne entre Desde sempre e Este mês.\nPara parar, pressione Sair da classificação. Remover todos os meus dados apaga tudo o que você enviou.',
  'help.leaderboard.tip':
    'Um número por dia sai do seu computador (os minutos de música que tocaram), e nunca o que você toca. Cada número é verificado no servidor. Seu nome de usuário e seu nome visível podem ser mudados depois em Conta → Mudar nome; a Classificação e suas cenas publicadas acompanham.',
  'help.leaderboard.keywords':
    'ranking, leaderboard, pontuação, estatísticas, tempo de escuta, top ouvintes, competição, apelido, privacidade',
  'help.leaderboard.periodName': 'Desde sempre ou Este mês',
  'help.leaderboard.period': 'Todo o histórico, ou só este mês.',
  'help.leaderboard.standing':
    'Sua posição e seus pontos, e quanto falta para o próximo lugar.',
  'help.leaderboard.earn':
    '10 pontos por hora, 20 por dia com 30 minutos ou mais, 5 por curtida.',

  'help.studio.title': 'Crie cenas no Estúdio',
  'help.studio.intro':
    'O Estúdio transforma uma descrição em um visualizador. Seu próprio assistente de IA escreve a cena em uma pasta de projeto, e o FluidEQ toca cada versão com sua música no momento em que ela é salva. O Estúdio faz parte do Plus; uma conta nova pode abri-lo com o teste gratuito.',
  'help.studio.steps':
    'Abra Plus → Estúdio e pressione Novo projeto…. Dê um nome; o FluidEQ cria a pasta dele com uma cena que já se mexe.\nDescreva sua ideia, abra a pasta no seu assistente de IA e cole o prompt de Copiar prompt para IA.\nAcompanhe o palco enquanto os arquivos são salvos e experimente os sinais de teste. Depois, Adicionar aos meus visuais, Publicar… ou Exportar….',
  'help.studio.tip':
    'Clique duas vezes no palco para tela cheia. Ver por dentro uma cena do FluidEQ… abre uma das cenas do próprio FluidEQ para você aprender com ela; essa cena não pode ser publicada. Cenas que piscam forte demais ou ficam pesadas demais são retidas. Uma cena que você publica é lida antes por um moderador, e uma que for aprovada lhe dá um mês de Plus.',
  'help.studio.keywords':
    'criar visualizador, editor de cenas, shader, GLSL, WebGL, programação, ChatGPT, Claude, Gemini',
  'help.studio.project':
    'Seus projetos e as cenas do FluidEQ para ver por dentro.',
  'help.studio.stageName': 'Palco',
  'help.studio.stage':
    'A cena, tocando com sua música. Clique duas vezes para tela cheia.',
  'help.studio.code':
    'O código da cena, ao vivo, atualizado conforme sua IA o salva.',
  'help.studio.hears':
    'O que a cena recebe: nível, batida, graves, médios, agudos.',
  'help.studio.signals': 'Sinais de teste que movem só esta prévia.',
  'help.studio.size':
    'Testa a cena em um painel de gráfico, estreito, largo ou em tela cheia.',
  'help.studio.wave':
    'Testa a altura e a posição da onda que os ouvintes podem ajustar.',

  'help.desktop.title': 'O visualizador da área de trabalho',
  'help.desktop.intro':
    'O visualizador da área de trabalho coloca um visualizador Plus atrás dos seus ícones, em um monitor ou em cada um deles, enquanto o FluidEQ estiver aberto.',
  'help.desktop.steps':
    'Coloque um visualizador Plus no gráfico e pressione o botão de monitor ao lado do nome dele, ou escolha Visualização → Definir como fundo da área de trabalho.\nPressione os monitores no mapa, escolha Com a música ou Calmo e pressione Definir fundo.\nPara mudar ou parar, abra Plus → Visualizadores e use Gerenciar ou Parar no topo.',
  'help.desktop.tip':
    'Ele fica em pausa enquanto as janelas cobrem o monitor, com o PC bloqueado e, se você quiser, na bateria, e volta quando o FluidEQ inicia. Sair do FluidEQ o interrompe. Só no Windows.',
  'help.desktop.keywords':
    'papel de parede, papel de parede animado, wallpaper, plano de fundo, fundo de tela, dois monitores, vários monitores, segundo monitor, desktop',
  'help.desktop.monitors':
    'Seus monitores como o Windows os organiza. Pressione os que quer usar.',
  'help.desktop.music': 'Move-se com o que estiver tocando.',
  'help.desktop.calm': 'Uma animação lenta e tranquila que ignora a música.',
  'help.desktop.battery':
    'Economiza energia enquanto o computador está fora da tomada.',
  'help.desktop.start': 'Inicia nos monitores que você escolheu.',

  'help.lighting.title': 'Iluminação dinâmica (beta)',
  'help.lighting.intro':
    'A Iluminação dinâmica acende seu teclado, mouse, mousepad, headset e suporte com o visualizador Plus do gráfico, pelo Windows Dynamic Lighting e pelo Razer Chroma. Ela está em beta, então conte para nós como seus dispositivos se comportam.',
  'help.lighting.steps':
    'Abra Plus → Iluminação dinâmica e ative-a, ou pressione o botão de iluminação ao lado de um visualizador Plus no gráfico.\nEscolha o estilo de iluminação deste visualizador (Cena, Onda de cor, Espectro ou Onda rítmica) e ajuste o brilho e a que ele responde.\nClique em um dispositivo em Seus dispositivos para ajustá-lo separadamente; Todos os dispositivos volta a ajustar todos.',
  'help.lighting.tip':
    'Se o Windows reservar um dispositivo para outro app, a página diz qual configuração mudar e a abre para você. Dispositivos Razer precisam do Razer Synapse aberto, com o Chroma Apps permitido.',
  'help.lighting.keywords':
    'RGB, LED, luzes, periféricos, sincronizar luzes, iluminação reativa',
  'help.lighting.switch':
    'Ilumina seus dispositivos enquanto um visualizador Plus toca.',
  'help.lighting.browse': 'Abre a galeria para escolher um visualizador.',
  'help.lighting.previewName': 'Prévia da mesa ao vivo',
  'help.lighting.preview':
    'Sua própria mesa, iluminada com as cores enviadas a ela.',
  'help.lighting.devices':
    'Todos os dispositivos encontrados. Clique em um para ajustá-lo separadamente.',
  'help.lighting.all': 'Volta a ajustar todos os dispositivos de uma vez.',
  'help.lighting.style':
    'Cena, Onda de cor, Espectro ou Onda rítmica, salvo para cada visualizador.',

  'help.online.title': 'Ouça com Mídia online',
  'help.online.intro':
    'Mídia online mantém sites compatíveis ao lado do seu EQ. A reprodução e o login dos sites ainda dependem do provedor e da sua conexão. A barra na parte de baixo do FluidEQ acompanha o player ativo, e o volume dela é o do seu computador.',
  'help.online.steps':
    'Abra Mídia online, escolha um site e inicie a reprodução na página.\nVá à EQ para ajustar ouvindo; volte à página para os controles próprios.\nAtive Um reprodutor de cada vez para evitar sobreposição com outros players.',
  'help.online.tip':
    'Com o Motor FluidEQ, a Mídia online passa pelo seu EQ e pelo rack DSP como qualquer outro app. Com o Equalizer APO, o rack fica com as faixas da Biblioteca.',
  'help.online.keywords':
    'YouTube, YouTube Music, Bandcamp, Twitch, Suno, streaming, web, internet, navegador',

  'help.library.title': 'Monte sua biblioteca local',
  'help.library.intro':
    'A Biblioteca reúne músicas e vídeos das suas unidades. Navegue por álbuns, artistas, gêneros, músicas, pastas, uma árvore de pastas ou suas playlists. Capas e detalhes vêm dos seus arquivos, então a mesma coleção pode parecer diferente dependendo das tags.',
  'help.library.steps':
    'Abra Biblioteca e adicione a pasta com suas mídias. Deixe a leitura terminar antes de avaliar o que está faltando.\nEscolha um artista ou álbum, ou busque uma música. Inicie uma faixa nos resultados.\nUse a barra na parte de baixo da janela para pausar, mudar a posição e pular. O volume dela é o do seu computador, o mesmo do Windows.',
  'help.library.tip':
    'Passe o mouse sobre o botão do FluidEQ na barra de tarefas do Windows para ter Anterior, Reproduzir e Próximo, mesmo com ele minimizado. A Biblioteca precisa dos arquivos originais: reconecte uma unidade ou adicione de novo uma pasta que foi movida.',
  'help.library.keywords':
    'reprodutor de música, tocador, adicionar músicas, escanear, metadados, MP3, FLAC, AAC, WAV',

  'help.queue.title': 'Álbuns e fila de reprodução',
  'help.queue.intro':
    'A fila define a ordem de escuta. Abrir outro álbum permite explorar sem trocar a música atual. A faixa ativa e A seguir ajudam a acompanhar.',
  'help.queue.steps':
    'Abra um álbum para ver as faixas dele e inicie a que você quer ouvir.\nClique com o botão direito em uma música para Adicionar à fila, Adicionar aos Favoritos ou Adicionar a uma playlist.\nAbra A seguir para ver o que toca depois e ative Continuar tocando para seguir com mais do mesmo gênero.',
  'help.queue.tip':
    'Iniciar a reprodução da Biblioteca assume o lugar dos outros players do FluidEQ. Use a faixa atual mostrada na barra para confirmar qual fonte está com a reprodução.',
  'help.queue.keywords':
    'próxima música, tocar em seguida, aleatório, shuffle, repetir, autoplay, reprodução automática, lista de reprodução',

  'help.karaoke.title': 'Cante com Karaokê',
  'help.karaoke.intro':
    'Karaokê combina áudio e letras locais. Letras sincronizadas seguem a reprodução; alvos de afinação exigem dados de notas. Um microfone configurado acrescenta sua afinação ao vivo.',
  'help.karaoke.steps':
    'Abra Karaokê e use Adicionar arquivos ou Adicionar pasta para áudio e letras correspondentes.\nSelecione uma música, reproduza e confira o pareamento.\nConfigure o microfone, ajuste o tamanho das letras e use a tela cheia do palco.',
  'help.karaoke.tip':
    'Um arquivo só de letras não tem notas-alvo. O Karaokê toca no volume do seu computador; os níveis da melodia, da base e da voz guia ficam em Configurações de mistura.',
  'help.karaoke.keywords': 'cantar, videokê, pontuação, pitch, LRC, UltraStar',

  'help.maker.title': 'Crie no Criador de karaokê',
  'help.maker.intro':
    'O Criador de karaokê transforma áudio em um projeto editável com letras e notas na linha do tempo. Confira palavras e tempos gerados automaticamente.',
  'help.maker.steps':
    'Abra Criar em Karaokê e carregue o áudio. Escolha as ferramentas de separação ou transcrição necessárias.\nAcompanhe o progresso; o primeiro uso de IA pode baixar modelos. Revise letras e notas.\nOuça pequenos trechos, corrija texto e tempos, salve o projeto e exporte os arquivos.',

  'help.maker.lyricsCaption': 'A letra, e quando cada palavra é cantada',
  'help.maker.referenceName': 'Letra de referência',
  'help.maker.reference':
    'A música inteira como texto, um verso por linha. Cole-a ou carregue um arquivo; o FluidEQ encontra os tempos a partir dela.',
  'help.maker.timingName': 'Tempo da palavra',
  'help.maker.timing':
    'Todas as palavras em ordem, com quantas já têm tempo. Clique em uma para trabalhar nela.',
  'help.maker.wordName': 'Palavra selecionada',
  'help.maker.word':
    'Onde começa a palavra escolhida e quanto dura. Mover a borda dela dá ou tira tempo da palavra ao lado; a linha mantém a duração.',
  'help.maker.toolsCaption':
    'As ferramentas de IA e os modelos de que precisam',
  'help.maker.separate':
    'Separa a gravação em voz e música, para o karaokê tocar sem o cantor.',
  'help.maker.loadVocals':
    'Use um arquivo só de voz que você já tenha, em vez de separá-lo aqui.',
  'help.maker.redetectTiming':
    'Volta a ouvir a voz e recalcula os tempos das palavras que você já tem.',
  'help.maker.redetectNotes':
    'Volta a ouvir a melodia e reescreve as notas sob as palavras.',
  'help.maker.modelsName': 'Memória dos modelos de IA',
  'help.maker.models':
    'O que cada modelo precisa e se ele está neste computador. Eles são baixados na primeira vez que você usa um.',
  'help.maker.idleName': 'Quando estiver ocioso',
  'help.maker.idle':
    'Se um modelo fica na memória entre usos, e por quanto tempo. Liberá-lo deixa memória livre; mantê-lo faz a próxima vez começar de imediato.',

  'help.makerBar.caption': 'As ferramentas no topo do Criador',
  'help.makerBar.import':
    'Abre um arquivo de karaokê ou um projeto salvo, e mantém o áudio já carregado.',
  'help.makerBar.lyrics': 'As palavras e os seus tempos, numa só janela.',
  'help.makerBar.timing':
    'Move palavras e notas em conjunto, para uma música adiantada ou atrasada desde o primeiro segundo.',
  'help.makerBar.pan':
    'Arraste pela linha do tempo para percorrer a música sem mudar nada.',
  'help.makerBar.language':
    'Em que língua estão as palavras, e uma segunda ao lado para que a música possa ser cantada em qualquer uma.',
  'help.makerBar.record':
    'Toque a música e pressione uma tecla no início e no fim de cada linha. O tempo vem das suas teclas.',
  'help.makerBar.select':
    'Desenhe uma caixa ao redor das notas para movê-las ou apagá-las juntas.',
  'help.makerBar.paint': 'Desenhe a melodia diretamente sobre a grade de tons.',
  'help.makerBar.split':
    'Corta uma palavra em sílabas, para que uma palavra longa leve uma nota em cada uma.',
  'help.makerBar.repair':
    'As ferramentas que ouvem por você, e os modelos de que precisam.',
  'help.makerBar.export':
    'Salva o karaokê pronto como projeto FluidEQ, UltraStar TXT, LRC ou LRC aprimorado.',
  'help.maker.tip':
    'Modelos exigem conexão e espaço. O tempo depende do computador e da música. Use áudio autorizado e revise antes de compartilhar.',
  'help.maker.keywords':
    'remover voz, isolar voz, instrumental, playback, acapella, a capela, stems, sincronizar letra, transcrever, timing, editor de karaokê',

  'help.share.title': 'Compartilhe áudio entre computadores',
  'help.share.intro':
    'Compartilhar áudio envia som do sistema entre computadores da mesma rede privada. O receptor tem os fones ou alto-falantes; os outros enviam. É diferente de espelhar para outro dispositivo no mesmo computador.',
  'help.share.steps':
    'No computador de escuta, abra Compartilhar áudio, escolha Reproduzir áudio neste computador e pressione Criar código de conexão. Comece com volume baixo.\nEm cada computador de origem, escolha Enviar o áudio deste computador, cole o código da sua rede e pressione Conectar e enviar.\nAcompanhe o monitor de conexão. Pressione Parar de enviar ou Parar de ouvir ao terminar; Criar novo código desconecta todos os pareamentos salvos.',
  'help.share.tip':
    'Mantenha o código de conexão privado: ele autoriza o pareamento. Vários emissores se misturam e elevam o nível, que o volume do computador receptor ajusta. Com o Motor FluidEQ, o áudio recebido também passa pelo rack DSP.',
  'help.share.keywords':
    'rede local, LAN, wifi, outro PC, transmitir, receber áudio, remoto',

  'help.trouble.title': 'Quando o som está errado',
  'help.trouble.intro':
    'Comece pela fonte e pela saída, depois isole a camada. Um gráfico, um preset salvo ou um interruptor ativado não provam, sozinhos, que o som chegou ao dispositivo certo. O menu Ajuda também leva à solução de problemas de áudio, ao relato de problemas e ao Fórum.',
  'help.trouble.steps':
    'Sem som: confirme que a reprodução está rodando, que a saída esperada está selecionada, que o volume está alto e que o dispositivo está conectado. Veja se Um reprodutor de cada vez pausou outra fonte.\nSem efeito do EQ: confirme que o EQ do sistema está ligado e que a saída não mostra o selo DESLIG. Se mostrar, pressione Ativar. Se um aviso disser que o motor não está funcionando, pressione Reiniciar o áudio do Windows.\nEstá tudo certo e o EQ continua sem fazer nada: o Windows pode estar tocando a música por fora do motor. O aviso diz isso e oferece, com um toque, mover o motor para onde o Windows o use; custa uma permissão e um segundo de silêncio.\nDistorção ou graves demais: deixe Normalizar automaticamente ligado, reduza os reforços e desative as camadas uma por vez. Se continuar, use Relatar um problema e revise o relatório antes de enviar.',
  'help.trouble.tip':
    'F1 abre este guia. Esc fecha uma captura ampliada e depois o guia. Se a interface estiver grande demais, Ctrl + 0 restaura o zoom. Processos, no menu de ações, mostra o que cada parte do FluidEQ está fazendo.',
  'help.trouble.keywords':
    'mudo, erro, bug, picotando, falhando, engasgando, pipocando, cortando, distorcido, estourado, clipping, som baixo, consertar, resolver, suporte, atalhos de teclado, teclas de atalho, resetar zoom, travou, crash, reportar',

  'help.forum.title': 'Pergunte no Fórum',
  'help.forum.intro':
    'O Fórum traz o GitHub Discussions do FluidEQ para dentro do app: anúncios, ideias, perguntas e ajustes de que as pessoas se orgulham. Qualquer um pode ler; para publicar, você usa sua conta do GitHub, não uma do FluidEQ.',
  'help.forum.steps':
    'Abra Ajuda → Fórum e escolha uma categoria: Anúncios, Geral, Ideias, Votações, Q&A ou Mostre o seu som.\nPesquise no fórum ou abra um tópico para ler as respostas.\nPressione Entrar com GitHub, termine no navegador e depois publique um Novo tópico ou uma resposta.',
  'help.forum.tip':
    'Tudo o que é publicado fica público no GitHub, com seu nome do GitHub. Em Q&A, marque a resposta que funcionou para que a próxima pessoa a encontre.',
  'help.forum.keywords':
    'comunidade, dúvidas, suporte, sugestão, sugestões, feedback, pedido de recurso, contato, desenvolvedor, discussões, enquete',
};

export default help;
