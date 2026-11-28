/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Ajuda',
  'help.title': 'Guia do usuário',
  'help.subtitle': 'Encontre seu som. Sinta-se em casa.',
  'help.intro':
    'Um guia prático do FluidEQ, com ilustrações feitas pelos próprios controles do app. Comece pela primeira sessão de escuta e explore no seu ritmo.',
  'help.offline': 'Disponível offline',
  'help.search': 'Buscar no guia',
  'help.searchHint': 'Experimente motor, graves, cena…',
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
    'As ilustrações ao vivo seguem seu idioma e as cores da janela. Os ajustes de exemplo explicam os controles; não são presets recomendados.',
  'help.steps': 'Experimente',
  'help.tip': 'Vale saber',
  'help.back': 'Voltar ao início',

  'help.group.start': 'Primeiros passos',
  'help.group.sound': 'Modele seu som',
  'help.group.visuals': 'Veja sua música',
  'help.group.plus': 'Cenas e sua conta',
  'help.group.listen': 'Ouça, cante e compartilhe',
  'help.group.help': 'Quando precisar de ajuda',

  'help.start.title': 'Seus primeiros cinco minutos',
  'help.start.intro':
    'Comece com uma música conhecida num volume confortável. O painel da esquerda traz o botão de ligar do FluidEQ e a pré-amplificação; o centro é seu espaço de trabalho, com o gráfico sobre suas bandas; o painel de som à direita acompanha sua saída e os perfis dela. A barra no pé da janela controla o que estiver tocando. O tour abaixo só é transmitido quando você pressiona Reproduzir. Para a página de jogos, veja Laboratório gamer.',
  'help.start.steps':
    'Instale o FluidEQ e deixe o Motor FluidEQ selecionado quando o instalador perguntar como processar o seu som. O Windows pede permissão uma vez, sem reiniciar.\nEscolha seu dispositivo de escuta no cartão Saída do painel de som. Pressione o botão de ligar no alto do painel da esquerda e deixe Normalizar automaticamente ligado.\nToque uma música, abra EQ → Bandas, mova um pouco o deslizante de uma banda e compare com o botão de ligar desligado e ligado.',
  'help.start.tip':
    'O EQ em todo o sistema precisa do Windows e de um motor de áudio: o Motor FluidEQ ou o Equalizer APO. No macOS e no Linux, o app mostra saídas de demonstração, então um gráfico em movimento ali não prova que algo esteja sendo processado.',
  'help.start.keywords':
    'instalar, instalador, setup, configurar, primeiros passos, começar, como usar, tutorial, passo a passo, iniciante, introdução, básico, início rápido, guia rápido, manual, botão de ligar, gráfico, abas, bandas',
  'help.start.pagesName': 'As páginas do EQ',
  'help.start.pages':
    'Bandas, Correções de fones, Convolução e Config: o que molda o som, uma página cada.',
  'help.start.engineName': 'O motor',
  'help.start.engine':
    'Qual motor toca o seu EQ: o Motor FluidEQ ou o Equalizer APO. Um ponto vermelho quer dizer que ele não chega à saída que você está ouvindo.',
  'help.start.delay':
    'Com quanto atraso o motor toca o som nesta saída. Pressione para ver o que cada estágio acrescenta.',
  'help.start.graphName': 'O gráfico',
  'help.start.graph':
    'A curva do seu EQ e um ponto em cada banda, com o que você ouve se movendo atrás. Arraste um ponto para moldar o som; o resto está no capítulo do gráfico.',
  'help.start.tabsName': 'Seu EQ, Preset, Tom',
  'help.start.tabs':
    'Três abas sob o gráfico: suas próprias bandas, um preset pronto por baixo delas, e os cortes e botões do Tom. As ferramentas de cada aba ficam no fim da linha.',
  'help.start.bandsName': 'Suas bandas',
  'help.start.bands':
    'Um deslizante por banda, a frequência em cima e o ganho embaixo. O capítulo do EQ mostra cada parte.',
  'help.video.play': 'Reproduzir o vídeo: {title}',
  'help.video.loading': 'Carregando de fluideq.com…',
  'help.video.failed':
    'Não foi possível carregar o vídeo. Ele é reproduzido a partir de fluideq.com, então precisa de conexão com a internet.',
  'help.video.retry': 'Tentar de novo',

  'help.window.title': 'Conheça a janela',
  'help.window.intro':
    'O cabeçalho leva você de uma página do FluidEQ a outra e mostra o som enquanto ele toca. O painel da esquerda traz o botão de ligar do FluidEQ, a pré-amplificação e o medidor de nível; o painel de som à direita acompanha sua saída e os perfis dela.',
  'help.window.steps':
    'Abra uma página pelo cabeçalho: Cenas, Compartilhar áudio, Microfone, Laboratório gamer, EQ, DSP, Biblioteca, Karaokê, Mídia online.\nPressione o botão de ligar no alto do painel da esquerda para ligar o FluidEQ, e deixe Normalizar automaticamente ligado, para que nenhum reforço sature.\nPressione o medidor de nível para passar ao próximo estilo; com Ctrl você volta ao anterior.\nNo menu ≡, leve o Brilho aonde quiser, do totalmente escuro ao totalmente branco, e dê ao Tom uma segunda cor para desenhar as bandas, o título e os controles acesos num degradê entre as duas.\nPara ligar ou desligar a partir de outro app, abra ≡ → Tecla liga/desliga e escolha uma combinação. Nenhuma vem atribuída; o aviso sobre as janelas confirma o estado do FluidEQ.\nClique com o botão direito em qualquer campo de texto para Recortar, Copiar, Colar e Selecionar tudo. A busca ignora maiúsculas, acentos, espaços e pontuação: kpop encontra K-pop.',
  'help.window.tip':
    'O menu Ajuda abre este guia, Novidades, a solução de problemas de áudio e Relatar um problema. O menu ≡ ao lado dele tem duas colunas. À esquerda: o cartão do motor, Corrigir problemas de áudio, Reiniciar o áudio do Windows, a Tecla liga/desliga, a importação de configurações de EQ ou de uma resposta ao impulso, Processos, que mostra o que cada parte do FluidEQ está usando, Redefinir todas as configurações, as animações, Iniciar com o Windows (o FluidEQ então inicia na bandeja e molda o seu som sem abrir nenhuma janela) e o idioma. À direita, a aparência da janela: Brilho, Tom (as duas amostras dele são a cor da janela e uma segunda cor para um degradê), Colorir o ícone (desligado no início; deixa os ícones da barra de tarefas, da bandeja e do menu dela nas cores da janela), os deslizantes do EQ e Definir como fundo da área de trabalho. Os avisos se empilham no canto inferior direito da janela. O botão depois dos menus transforma a janela no Player compacto.',
  'help.window.keywords':
    'interface, abas, navegação, tela principal, visão geral, barra superior, barra inferior, painel lateral, VU meter, preamp, tom, cor, segunda cor, degradê, gradiente, tint, colour, color, second colour, gradient, tema, modo escuro, modo claro, tema escuro, tema claro, dark mode, idioma, língua, iniciar com o windows, iniciar automaticamente, inicialização automática, inicialização, busca, buscar, pesquisa, maiúsculas, minúsculas, acentos, espaços, pontuação, search, accents, spaces, punctuation, case insensitive, ligar, botão de ligar, brilho, janela branca, clique direito, menu de contexto, recortar, copiar, colar, avisos, microfone',
  'help.window.headerLeftCaption': 'O cabeçalho, até o sinal',
  'help.window.headerRightCaption': 'O cabeçalho, depois do sinal',
  'help.window.railCaption': 'O painel da esquerda',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch e Suno, tocados dentro do FluidEQ com seu EQ aplicado.',
  'help.window.share':
    'Envia o som deste computador para outro, ou toca aqui o som de outro.',
  'help.window.mic':
    'Seus microfones, cada um com um som de voz próprio que todos os apps ouvem.',
  'help.window.gaming':
    'Seus jogos, cada um com um som próprio, ajustado para aquele jogo.',
  'help.window.eq':
    'Suas bandas, presets, correção de fones e a configuração do motor.',
  'help.window.waveName': 'Sinal de áudio',
  'help.window.wave':
    'O que está tocando, enquanto toca, com o nível de pico; o menu Visualização do gráfico pode ocultá-lo.',
  'help.window.dsp':
    'O rack de efeitos: presets, a Sala e cada estágio da cadeia.',
  'help.window.library':
    'Seus arquivos de música, álbuns e a fila de reprodução.',
  'help.window.karaoke':
    'Cante junto e transforme suas próprias músicas em karaokê.',
  'help.window.plus': 'Cenas: a galeria, o Estúdio e a Iluminação dinâmica.',
  'help.window.support': 'Formas de apoiar o desenvolvimento do FluidEQ.',
  'help.window.help':
    'Este guia, Novidades, Notas de versão completas, Fórum, a solução de problemas de áudio, Relatar um problema e Sobre o FluidEQ. As notas completas abrem diretamente. Sobre tem links para suas seções e, quando o link de apoio está disponível, um cartão do Buy Me a Coffee com código QR.',
  'help.window.actions':
    'Duas colunas. Comandos e comportamento: o motor, Corrigir problemas de áudio, Reiniciar o áudio do Windows, a Tecla liga/desliga (um atalho que desliga e liga todo o processamento do FluidEQ enquanto outro app está na frente; nenhum no início, e um cartão sobre as outras janelas confirma cada troca), a importação de configurações de EQ ou de uma resposta ao impulso, Processos, Redefinir todas as configurações, as animações, Iniciar com o Windows e o idioma. Aparência: Brilho, Tom e a segunda cor dele, Colorir o ícone, os deslizantes do EQ e Definir como fundo da área de trabalho.',
  'help.window.systemEq':
    'O botão de ligar do FluidEQ: liga ou desliga o processamento para tudo o que o PC toca. A linha embaixo dele dá o nome do motor; ela fica vermelha quando o motor não chega à saída que você está ouvindo, e então um toque pergunta sobre o motor.',
  'help.window.preamp':
    'Abaixa o nível antes do EQ para que os reforços tenham margem. Enquanto Normalizar automaticamente o controla, ele indica AUTO; com ele desligado, gire o botão ou pressione o número para digitar um nível. Ctrl+clique volta a 0 dB.',
  'help.window.autoNormalize':
    'Mantém a pré-amplificação baixa só o necessário para que nada do que você reforçar sature.',
  'help.window.responseGraph': 'Mostra ou oculta o gráfico de resposta.',
  'help.window.meterName': 'Medidor de nível',
  'help.window.meter':
    'O nível de saída, esquerdo e direito, em decibéis reais, com o pico do canal mais alto acima. Pressione para o próximo estilo; com Ctrl você volta ao anterior.',
  'help.player.title': 'O Player compacto',
  'help.player.intro':
    'Um botão transforma a janela do FluidEQ no Player compacto, uma única coluna estreita: no alto, uma cena ou um estilo com a música por cima e os controles de reprodução embaixo; depois Som, seu equalizador; e depois A seguir e suas playlists. O que estiver tocando continua tocando, e o mesmo botão traz o app completo de volta na página em que você estava.',
  'help.player.steps':
    'Pressione o botão Player compacto na barra de título, ao lado de Ajuda. No player, o mesmo botão traz o app completo de volta.\nRecolha Som, ou A seguir e Playlists, até o cabeçalho, e a imagem ocupa o espaço; clique no cabeçalho para abrir de novo. Arraste a borda de cima ou de baixo do player para deixá-lo mais alto ou mais baixo.\nClique duas vezes na imagem para ela ocupar a tela inteira; Esc o devolve ao lugar. Clique no nome do estilo, ao lado do aleatório e da repetição, para escolher entre todos os estilos e cenas.\nEscolha Recolher em uma linha no menu do logo do FluidEQ para recolher o player em uma linha; o logo o expande de novo.\nNo mesmo menu, ajuste o Brilho do próprio player, a Transparência sobre uma cena ou o Tom da janela sobre um estilo padrão, e a Luz do dia de uma cena. Sempre visível, ali ou no cabeçalho, o mantém acima das outras janelas.\nSolte arquivos de música em qualquer lugar do player: eles entram na Biblioteca e no fim de A seguir ou, sobre a lista, no ponto em que você soltar.\nEm Som, Tone oferece graves, médios e agudos, e Bandas abre o EQ completo. Preset e modo EQ alteram a mesma saída do app completo. Explorar cenas abre a galeria; a troca automática de cenas também funciona no player compacto.',
  'help.player.tip':
    'O volume do player é o do seu computador, o mesmo do Windows, então ele ajusta o nível de tudo o que o computador toca. Se o player acabar fora da tela, clique com o botão direito no ícone do FluidEQ na bandeja do sistema e escolha Recuperar a janela. Enquanto o som de um jogo está ativo, o botão mostra só o nome do jogo para caber no player compacto.',
  'help.player.keywords':
    'mini player, miniplayer, player pequeno, player compacto, compacto, modo compacto, reprodutor compacto, winamp, amp, modo player, sempre visível, sempre no topo, sempre por cima, always on top, fixar, recolher, uma linha, fila, a seguir, soltar arquivos, arrastar arquivos, tema, tema claro, tema escuro, modo escuro, modo claro, janela pequena, player flutuante, janela flutuante, volume',
  'help.player.topCaption': 'O topo: a música, e como ela toca',
  'help.player.eqCaption': 'Som, seu equalizador',
  'help.player.queueCaption': 'A seguir',
  'help.player.menuCaption': 'O menu do player',
  'help.player.foldedCaption': 'Recolhido em uma linha',
  'help.player.menu':
    'Voltar ao app completo ou a uma das páginas dele; o Brilho do próprio player, a Transparência ou o Tom, a Luz do dia de uma cena, Colorir o ícone e os deslizantes do EQ; Sempre visível e Recolher em uma linha.',
  'help.player.pin': 'Mantém o player acima de todas as outras janelas.',
  'help.player.switch': 'Voltar ao app completo, na página em que você estava.',
  'help.player.clock': 'Tempo tocado. Clique nele para ver o tempo restante.',
  'help.player.level': 'O nível do som que sai do FluidEQ, em decibéis.',
  'help.player.volume':
    'O volume do seu computador, o mesmo do Windows: ele ajusta o nível de tudo o que o computador toca.',
  'help.player.seek': 'Onde a música está. Arraste para ir a outro ponto.',
  'help.player.playingName': 'Controles de reprodução',
  'help.player.playing':
    'Anterior, voltar cinco segundos, reproduzir ou pausar, avançar cinco segundos, próximo e parar.',
  'help.player.orderName': 'Aleatório e repetição',
  'help.player.order':
    'Embaralha a fila A seguir e não repete nada, repete tudo ou só esta música.',
  'help.player.lookName': 'Estilo',
  'help.player.look':
    'O estilo ou a cena do player. Clique para escolher entre todos.',
  'help.player.bands':
    'Arraste uma banda para cima ou para baixo para reforçá-la ou cortá-la. A frequência dela fica escrita embaixo.',
  'help.player.tone':
    'Seu EQ mostra todas as bandas; Tom, os controles Graves, Médios e Agudos. Cada aba mostra o que tem agora.',
  'help.player.upNext':
    'A seguir e Playlists, cada uma com quantos itens tem, e o tempo que falta na fila.',
  'help.player.songsName': 'As músicas',
  'help.player.songs':
    'O que toca a seguir. Clique em uma música para tocá-la, arraste para mudá-la de lugar, ou solte arquivos de música aqui para adicioná-los no ponto em que você soltar.',
  'help.player.openIn': 'Abre o app completo em uma das páginas dele.',
  'help.player.theme':
    'O Brilho do próprio player, separado do app completo; a Transparência sobre uma cena, ou o Tom da janela sobre um estilo padrão; a Luz do dia de uma cena; e Colorir o ícone, desligado no início, para o ícone da barra de tarefas, o da bandeja e o do menu dela nas cores da janela.',
  'help.player.fold': 'Recolhe o player em uma linha.',
  'help.player.unfold': 'Expande o player. A seta na outra ponta também.',
  'help.player.foldedPlaying': 'Reproduzir ou pausar.',
  'help.player.fullScreen':
    'Enche a tela com a cena ou o estilo. Clicar duas vezes na imagem faz o mesmo, e Esc devolve a tela.',
  'help.player.sourceName': 'Origem',
  'help.player.source':
    'De onde vem a música: a Biblioteca, Mídia online, Karaokê, outro computador ou outro programa deste PC. Clicar nele abre essa página no app completo.',
  'help.player.heart':
    'Adiciona uma música da Biblioteca aos seus Favoritos, ou a tira de lá.',
  'help.player.soundFold':
    'Recolhe os controles de som até esta linha, que deixa à mão Seu EQ, Tom, o preset e o botão, e os abre de novo.',
  'help.player.mode':
    'Abre o Modo EQ: com que força seu EQ e as curvas atuam, o Q de banda, a fase e os agudos deles.',
  'help.player.save': 'Guarda A seguir como uma playlist própria.',
  'help.player.queueFold':
    'Recolhe A seguir e Playlists até as abas, e a imagem ocupa o espaço.',
  'help.player.remove': 'Tira de A seguir uma música que ainda não tocou.',
  'help.player.output':
    'Para onde o som vai: a saída pela qual o Windows toca.',
  'help.player.engineName': 'Motor',
  'help.player.engine':
    'Qual motor está moldando o som; fica aceso enquanto o FluidEQ está ligado.',
  'help.player.sliders':
    'Alças redondas ou tampas retangulares nos deslizantes do EQ, aqui e na página do EQ.',

  'help.requirements.title': 'O que o seu PC precisa',
  'help.requirements.intro':
    'O FluidEQ roda em qualquer PC com Windows dos últimos dez anos. Duas partes pedem mais que o resto: as cenas desenham na placa de vídeo, e o karaokê com IA baixa seus modelos na primeira vez que você o usa.',
  'help.requirements.steps':
    'Veja qual Windows você tem: Windows 10 versão 1803 ou posterior, ou Windows 11, de 64 bits, 4 GB de memória e cerca de 600 MB de disco. Processar tudo o que o PC toca precisa do Motor FluidEQ ou do Equalizer APO, e o Windows pede permissão uma vez durante a instalação.\nPara tocar cenas: qualquer placa de vídeo ou vídeo integrado de 2013 em diante. Em 1080p o vídeo integrado basta; para 4K, ou um plano de fundo em várias telas ao mesmo tempo, uma placa dedicada é melhor. Com a placa ocupada, o FluidEQ desenha a cena menor e solta as que você não está vendo.\nExperimente o karaokê com IA: separar a voz baixa um modelo de 713 MB na primeira vez, o da afinação acrescenta cerca de 360 MB e o de remover ruído, 11 MB. Com uma placa de vídeo com DirectX 12, uma música de quatro minutos é separada em meio minuto; só com o processador leva cerca de quatro minutos. Deixe 2 GB de memória livres enquanto ele trabalha.\nMire nisto se puder: Windows 11, 8 GB de memória, vídeo de 2018 em diante e 3 GB de disco livres se você usar os recursos com IA.',
  'help.requirements.tip':
    'Tudo, menos os modelos de IA, vem no instalador, e eles só são baixados quando você usa o recurso pela primeira vez. Processos, no menu de ações, mostra o que cada parte do FluidEQ está usando na sua máquina agora.',
  'help.requirements.keywords':
    'requisitos mínimos, configuração mínima, recomendado, especificações, hardware, notebook, laptop, GPU, CPU, RAM, armazenamento, espaço em disco, desempenho, performance, lento, travando, lag, PC fraco, consumo, compatibilidade, compatível, Mac, macOS, Linux',

  'help.engine.title': 'O Motor FluidEQ',
  'help.engine.intro':
    'O FluidEQ processa seu som com um motor próprio ou com o Equalizer APO. O Motor FluidEQ roda dentro do serviço de áudio do Windows, depois dos efeitos da sua placa de som, leva seu EQ e o rack DSP a tudo o que o PC toca e sai do caminho assim que o FluidEQ fecha.',
  'help.engine.steps':
    'Abra o menu de ações (≡) e pressione o cartão do mecanismo no topo.\nEscolha Motor FluidEQ e pressione Aplicar. O Windows pede permissão, e o áudio pausa por alguns segundos enquanto reinicia.\nSe uma saída mostrar DESLIG., pressione Ativar no aviso dela. Se um aviso disser que o motor não está funcionando, pressione Reiniciar o áudio do Windows.',
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
  'help.engine.nowName': 'O motor atual',
  'help.engine.now':
    'Qual motor toca o seu som agora; Aplicar fica desativado até você escolher o outro.',

  'help.eq.title': 'Modele seu som com EQ',
  'help.eq.intro':
    'Seu EQ são as bandas que você mesmo molda. A frequência escolhe onde uma banda atua, o ganho define o reforço ou o corte, e Q a largura: quanto mais alto, mais estreita. Sob o gráfico, três abas dividem a página: Seu EQ, Preset e Tom, cada uma uma camada própria. Comece com mudanças pequenas e amplas e compare com frequência.',
  'help.eq.steps':
    'Abra EQ → Bandas. Seu EQ guarda suas bandas; Preset coloca um som pronto por baixo delas, e Novo preset cria um seu; Tom tem Corte graves, Corte agudos, Graves, Médios e Agudos, desenhados como uma linha própria.\nArraste o deslizante de uma banda, ou o ponto dela no gráfico, para reforçar ou cortar; a curva acompanha enquanto você move. Clique na frequência de uma banda, ou no ponto dela, para selecioná-la. Ctrl+roda sobre uma banda muda o Q dela.\nSegure Shift com uma banda selecionada e o popover dela aparece ao lado: o filtro, os botões de Frequência, Ganho e Q, Ativa e a lixeira. Shift+Tab e Shift+← → passam para a banda anterior ou seguinte; Esc ou × o fecham.\nTudo funciona também pelo teclado: com Tab você chega a um deslizante, um botão ou um ponto do gráfico, e as setas o movem; Page Up e Page Down dão passos maiores.\nClique com o botão direito numa banda para redefini-la, desligá-la, excluí-la (pede um segundo toque), adicionar uma banda ao lado ou escolher Esquerdo + direito: uma banda para cada ouvido na mesma frequência, com a curva do ouvido esquerdo contínua e a do direito tracejada. Ambos os ouvidos junta as duas de novo.\nSelecione várias bandas com Ctrl ou Shift, ou arraste uma caixa em volta delas, para movê-las juntas; Ctrl+A no gráfico seleciona todas.\nSalvar EQ guarda o que está tocando como um EQ salvo que você pode colocar de novo, atualizar ou gerenciar. Limpar põe cada ganho em 0 dB e mantém suas bandas; pergunta antes.\nUm preset seu (Preset → Novo preset) começa a curva a partir de um preset ou plana; você a molda no gráfico, e o rack dele na página DSP. O menu do cartão dele o exporta para um arquivo, e Importar na aba Preset lê um de volta.',
  'help.eq.tip':
    'Curvas lista o que molda esta saída além das suas bandas, cada um com a própria intensidade e um ×. Modo jogo, ao lado do nome do motor acima do gráfico, reduz o atraso que o FluidEQ acrescenta, para jogos e chamadas; presets de gaming o ligam. Enquanto o EQ está desligado pelo chip dele, as bandas ficam esmaecidas e não podem ser mudadas por acidente; a aba Tom continua funcionando.',
  'help.eq.keywords':
    'equalizador, equalização, paramétrico, predefinição, predefinições, bass boost, peaking, low cut, high cut, HPF, LPF, zerar, resetar, timbre, som abafado, estridente, graves, médios, agudos, tom, reforçar, cortar, latência, etiquetas, rótulos, etiquetas do EQ, rótulos das bandas, labels, teclado, setas, teclas de seta, acessibilidade, leitor de tela, ouvido esquerdo, ouvido direito, cada ouvido, por ouvido, esquerdo e direito, eq estéreo, excluir banda, remover banda, popover, shift, salvar eq, eqs salvos, seu eq, aba preset, tom, novo preset, exportar, importar',
  'help.eq.rowCaption': 'As abas sob o gráfico, em Seu EQ',
  'help.eq.tabBands': 'Suas próprias bandas, e quantas são.',
  'help.eq.tabPreset':
    'O preset sob suas bandas, e os presets para escolher: por gênero, por uso e os seus.',
  'help.eq.tabTone':
    'Corte graves, Corte agudos, Graves, Médios e Agudos: um tom rápido que deixa suas bandas como estão. Mostra Desligado enquanto nenhum está em uso.',
  'help.eq.bandsCaption': 'Suas bandas',
  'help.eq.bandCaption': 'O popover de uma banda, enquanto você segura Shift',
  'help.eq.gameMode':
    'Reduz o atraso que o FluidEQ acrescenta, para jogos e chamadas. Os presets de jogo o ativam.',
  'help.eq.layers':
    'O que mais molda esta saída — um preset, uma correção de fones, a correção inteligente, uma convolução —, cada um com intensidade, interruptor e ×.',
  'help.eq.bandName': 'Uma banda',
  'help.eq.band':
    'Arraste o deslizante para reforçar ou cortar, ou mova com as setas. Ctrl+roda sobre ele muda o Q.',
  'help.eq.caption':
    'Clique para selecionar a banda. Ctrl+clique ou duplo clique a devolve à frequência do layout.',
  'help.eq.gainCaption': 'O ganho da banda, em dB.',
  'help.eq.scaleName': 'Escala em dB',
  'help.eq.scale':
    'De +20 a −20 dB ao lado dos deslizantes, com 0 dB marcado, como uma mesa imprime ao lado dos faders.',
  'help.eq.stepName': 'Banda anterior e seguinte',
  'help.eq.step':
    '‹ e › levam o popover à banda de baixo ou de cima, como Shift+Tab e Tab dentro dele.',
  'help.eq.close':
    'Fecha o popover e mantém a banda selecionada. Soltar Shift faz o mesmo.',
  'help.eq.filter':
    'A forma dele: um pico, uma prateleira, um notch ou um filtro de passagem.',
  'help.eq.voicing':
    'Uma cadeia pronta para o som, como Música ou um gênero. Nenhum deixa só as suas bandas.',
  'help.eq.smart':
    'EQ automático: o som salvo de cada música, o som do álbum vindo da Biblioteca e, por cima, a Correção inteligente.',
  'help.eq.clear':
    'Põe cada ganho, e o Tom, em 0 dB e mantém suas bandas. Pergunta antes.',
  'help.eq.loadEq':
    'O EQ salvo que está ativo, pelo nome. Abre seus EQs salvos para carregar um, volta o ativo para como foi salvo ou abre todos para gerenciar.',
  'help.eq.saveEq':
    'Salva suas alterações no EQ salvo que está ativo, com Desfazer até a sua próxima alteração, ou salva o que está tocando como um novo EQ.',
  'help.eq.mode':
    'Com que força seu EQ e as curvas se aplicam, o Q das bandas, a fase, os agudos e a suavização; mostra Normal até você mudar algo. Com o cartão Modo EQ fixado, ele traz o cartão à vista.',
  'help.eq.add':
    'Adiciona uma banda ao lado da selecionada, com o Q das bandas que já existem.',
  'help.eq.layouts':
    'Quantas bandas: quantidades de bandas que começam todas num mesmo Q, os designs de bandas que você salvou e a redefinição do layout.',
  'help.eq.frequency': 'Onde a banda atua, de 1 Hz a 20 kHz.',
  'help.eq.gain': 'Quanto ela reforça ou corta. Ctrl+clique volta a 0 dB.',
  'help.eq.q':
    'A largura: mais alto é mais estreito. Ctrl+clique volta ao Q do layout.',
  'help.eq.delete':
    'Pressione uma vez para armar e outra para excluir a banda; o × ao lado desfaz.',
  'help.eq.menuDelete':
    'Fica vermelho e pede um segundo toque antes de excluir a banda.',
  'help.eq.ears':
    'Uma banda para cada ouvido na mesma frequência, para mover separadamente; Ambos os ouvidos junta as duas de novo.',
  'help.eq.menuCaption': 'O menu de clique direito de uma banda',
  'help.eq.reset': 'Ganho de volta a 0 dB e Q de volta a 2.',
  'help.eq.disable': 'Tira a banda do som e mantém as configurações dela.',
  'help.eq.addLeft': 'Adiciona uma banda a meio caminho da vizinha mais grave.',
  'help.eq.addRight':
    'Adiciona uma banda a meio caminho da vizinha mais aguda.',

  'help.eqmode.title': 'Modo EQ e designs de bandas',
  'help.eqmode.intro':
    'O modo EQ muda como o seu som é moldado, sem editar nada. É um botão nas ferramentas de Seu EQ sob o gráfico, e fixado é o primeiro cartão do painel de som, ao lado das curvas que ele muda. Tem duas abas: Seu EQ cobre suas bandas, o Tom, os presets, o tipo de driver e a correção inteligente; Correções cobre as correções de fones e as curvas importadas ou próprias. Os designs de bandas guardam as frequências e o Q de um layout de que você gosta, prontos para qualquer saída.',
  'help.eqmode.steps':
    'Pressione Modo EQ nas ferramentas de Seu EQ sob o gráfico. Fixado, o cartão aparece no painel de som; senão ele abre como um menu sobre o gráfico.\nEscolha a aba Seu EQ ou Correções e experimente uma Intensidade ou um Q de banda com a música tocando. Com o Motor FluidEQ, escolha agudos precisos ou clássicos para cada aba, e fase mínima ou linear onde a aba oferecer.\nEm Correções, a suavização de curva pode suavizar curvas amostradas a 1/12 ou 1/3 de oitava; fica desligada até você escolher. Redefinir volta tudo a Normal, e a suavização a desligada.\nPrefere um menu? Pressione o alfinete do cartão: o modo EQ passa a abrir como menu sobre o gráfico, e o alfinete desse menu traz o cartão de volta.\nAbra o botão do número de bandas nas ferramentas de Seu EQ. Escolha 6, 10, 15, 20 ou 31 bandas, ou pressione Salvar design… para dar nome ao layout atual.',
  'help.eqmode.tip':
    'Um layout novo começa todas as bandas em um mesmo Q, e uma banda que você adiciona recebe o Q das outras. Um design armazena só frequências e Q: ao carregar um, todas as bandas começam em 0 dB. A fase linear acrescenta atraso e pode ressoar antes de ataques rápidos. Escolher um layout embutido o faz começar do zero: suas próprias frequências e Q, cada banda em 0 dB e nos dois ouvidos.',
  'help.eqmode.keywords':
    'número de bandas, quantas bandas, equalizador gráfico, força, pre-ringing, terço de oitava, agudos, preciso, clássico, layout de bandas, 10 bandas, 31 bandas, design de bandas, intensidade, fase linear, fase mínima, suavização, Q constante, Q proporcional, alfinete, fixar, desafixar, pin, cartão, painel lateral, menu, abas, seu eq, correções, 1/12 de oitava',
  'help.eqmode.modeCaption': 'O cartão Modo EQ',
  'help.eqmode.tabsName': 'Seu EQ e Correções',
  'help.eqmode.tabs': 'Duas abas, cada uma com os próprios ajustes.',
  'help.eqmode.pin':
    'Devolve estes ajustes a um menu sobre o gráfico. O alfinete do menu traz o cartão de volta.',
  'help.eqmode.strength': 'Normal, Estúdio ×1.5 ou ×2. Cada aba guarda a sua.',
  'help.eqmode.q':
    'Constante mantém cada Q; Proporcional e Assimétrico estreitam as bandas conforme elas crescem. Em Seu EQ, ele molda só as suas bandas, nunca um preset ou uma correção.',
  'help.eqmode.treble':
    'Preciso soa como desenhado; Clássico, como no Equalizer APO. Só com o Motor FluidEQ.',
  'help.eqmode.reset':
    'Tudo de volta ao Normal, e Suavização das curvas de volta a Desativada.',
  'help.eqmode.designsCaption': 'Designs de bandas',
  'help.eqmode.builtIn': 'Layouts padrão de 6, 10, 15, 20 ou 31 bandas.',
  'help.eqmode.resetBands':
    'Devolve cada banda à frequência e ao Q do layout dela; os ganhos ficam como estão.',
  'help.eqmode.saved':
    'Um design que você salvou: pressione para carregar as frequências e o Q dele, com cada banda em 0 dB. A lixeira ao lado o exclui, depois de perguntar.',
  'help.eqmode.sampleDesign': 'Monitores de estúdio',
  'help.eqmode.save':
    'Dá nome às frequências e ao Q atuais como um design, listado em Meus designs.',

  'help.games.title': 'Laboratório gamer',
  'help.games.intro':
    'Dê a cada jogo um som próprio. Um jogo parte de um perfil gamer feito para ele e ganha uma cópia própria: você ajusta a cópia no Laboratório gamer, e o perfil nunca muda. Quando o jogo vem para o primeiro plano, o FluidEQ liga o som dele e o mantém até você fechar o jogo, não importa para onde você vá com Alt+Tab nesse meio-tempo. Depois, seu som de música volta.',
  'help.games.steps':
    'Abra o Laboratório gamer na barra de título e clique em Adicionar um jogo. Escolha um dos seus launchers, um programa aberto agora, ou procure o programa dele. Ele parte do perfil gamer sugerido para ele; escolha outro na lista de perfis gamer dele quando quiser. A lista oferece 32 perfis para títulos específicos, incluindo Counter-Strike 2, Valorant e Fortnite, além de 9 tipos de jogo.\nClique em Experimentar agora para ligar o som do jogo. Escolha uma parte à esquerda — o Filtro Jogo, EQ, Curva ou qualquer etapa DSP — e ajuste ali mesmo. Cada mudança fica na cópia deste jogo.\nSalvar como perfil guarda a cópia como um dos seus próprios perfis gamer para outros jogos, atualiza o seu, volta a cópia para o perfil dela, renomeia ou exclui.\nInicie o jogo. Um cartão na área de trabalho diz que o som dele está ligado, e outro diz que seu som de música voltou quando você o fecha. A notificação mostra o nome do perfil carregado e o do perfil de música quando é restaurado.',
  'help.games.tip':
    'Enquanto o som de um jogo está ligado, a página DSP mostra seu rack de música em pausa com um botão para ajustar o jogo, e a lista de perfis fica em repouso, então nada do que você fizer ali pode sobrescrever seu perfil de música com o som do jogo. O Filtro Jogo aumenta passos e recargas baixos no momento em que acontecem e traz as vozes para a frente.',
  'help.games.list':
    'Os seus jogos ficam à esquerda, com rolagem própria. Arraste a borda do painel para mudar a largura. O alfinete o recolhe aos ícones dos jogos, que o abrem sobre a página enquanto o ponteiro está sobre eles; pressione o alfinete de novo para mantê-lo aberto. A largura e o estado recolhido ficam guardados.',
  'help.games.keywords':
    'games, gaming, perfil de jogo, por aplicativo, troca automática, launcher, FPS, jogo de tiro, passos dos inimigos, competitivo, latência, game filter, dialogue, voices, ambience, environment, hooves, laboratório gamer, gaming lab, perfil gamer, cópia',
  'help.games.switch':
    'Deixa um jogo em primeiro plano ligar o próprio som. Desligado, seus jogos mantêm seu som de música.',
  'help.games.add':
    'Adiciona um jogo de Steam, Epic, EA, GOG, Ubisoft, Battle.net ou Xbox, ou qualquer programa aberto agora. FluidEQ, o Explorador do Windows, processos conhecidos do sistema e dos iniciadores e instaladores de componentes partilhados ficam de fora.',
  'help.games.gameName': 'Um jogo',
  'help.games.game':
    'Um jogo. O que está aberto fica marcado, e um ponto no final significa que ele está em primeiro plano agora. A dica dele diz o perfil de onde o som partiu e se você o ajustou.',
  'help.games.profile':
    'O perfil gamer de onde parte a cópia deste jogo. Escolher outro dá ao jogo uma cópia nova dele.',
  'help.games.save':
    'Salva a cópia como perfil novo ou atualiza um dos seus, volta a cópia para o perfil dela, renomeia ou exclui. O perfil em si nunca muda.',
  'help.games.try':
    'Liga agora o som do jogo, para você ouvir o que ajusta. Enquanto ele está ligado, aqui fica Descarregar, que traz seu som de música de volta.',
  'help.games.statusName': 'O que foi ajustado',
  'help.games.status':
    'Quais partes desta cópia são diferentes do perfil dela.',
  'help.games.railName': 'Suas partes',
  'help.games.rail':
    'Cada parte do som do jogo, cada uma ajustada no próprio editor ao lado da lista. Ajustado marca o que se afastou do perfil.',

  'help.headphones.title': 'Correção de fones e importações',
  'help.headphones.intro':
    'A correção compensa um modelo medido e pode ser combinada com suas bandas e seus presets. Confira modelo exato e autor da medição.',
  'help.headphones.steps':
    'Abra EQ → Correções de fones. A página abre em Minhas curvas, sua própria lista; a aba Biblioteca OPRA ao lado traz correções medidas para milhares de modelos de fones. Procure seu modelo exato e escolha a entrada que corresponde.\nPara texto de EQ de outra ferramenta, use Importar configurações de EQ no menu de ações. Confira as bandas e a curva lidas antes de aplicar.\nPara o Squiglink, pressione Importar do Squiglink em Minhas curvas, cole a exportação dele e confira a prévia ao vivo da curva; depois use-a como curva ou como EQ editável.\nAdicionar curva aceita uma exportação do Squiglink, um arquivo .txt, seu EQ como está ou uma escolha da OPRA, e pergunta para quais ouvidos ela é: ambos, o esquerdo ou o direito. Cada curva tem Aplicar como curva e Aplicar como EQ; Aplicar como EQ substitui só as bandas desses ouvidos, depois de perguntar.\nO menu de uma curva (≡) a renomeia, edita as bandas dela, a duplica, a copia como texto ou a exclui. Exportar lista e Importar lista levam a lista inteira para outro computador.',
  'help.headphones.tip':
    'Uma prévia marcada como Não aplicada não muda o som. Evite duas correções completas para o mesmo fone por acidente; compare desligando a camada de fones.',
  'help.headphones.keywords':
    'AutoEq, Harman, curva alvo, fones de ouvido, headphone, headset, IEM, in-ear, earbuds, TWS, Crinacle, oratory1990, resposta de frequência, calibração, ouvido esquerdo, ouvido direito, um ouvido, minhas curvas, curvas salvas, lista de curvas, exportar lista, importar lista',
  'help.headphones.tabsName': 'Minhas curvas e OPRA',
  'help.headphones.tabs':
    'Suas próprias curvas, com quantas você guarda, e a biblioteca da OPRA de correções de fones medidas.',
  'help.headphones.libraryName': 'Atualizações da OPRA',
  'help.headphones.library':
    'Se a biblioteca da OPRA está atualizada e quantos modelos ela tem; quando sai uma mais nova, Atualizar banco de dados a busca.',
  'help.headphones.add':
    'Uma exportação do Squiglink, um arquivo .txt, seu EQ como está ou uma escolha da OPRA, para os dois ouvidos ou um. Importar do Squiglink, ao lado, cola direto do Squiglink; Importar lista e Exportar lista levam a lista inteira.',
  'help.headphones.searchName': 'Busca e ordem',
  'help.headphones.search':
    'Encontra uma curva pelo nome; Recentes e A–Z, ao lado, ordenam a lista.',
  'help.headphones.applyEq':
    'Aplicar como curva toca como camada de correção e mantém suas bandas; Aplicar como EQ a coloca nas suas bandas (só nos ouvidos para os quais foi salva), depois de perguntar.',
  'help.headphones.moreName': 'Menu de uma curva',
  'help.headphones.more':
    'Renomear, editar as bandas, duplicar, copiar como texto ou excluir.',

  'help.convolution.title': 'Use uma resposta ao impulso',
  'help.convolution.intro':
    'Convolução aplica um impulso WAV como camada separada. Pesquise o catálogo AutoEq ou importe seu WAV; as bandas paramétricas continuam independentes.',
  'help.convolution.steps':
    'Abra EQ → Convolução e procure por modelo ou autor da medição.\nConfira a origem e use Baixar e aplicar; o download acompanha a taxa da sua saída. Use Importar um WAV para um arquivo que você já tem.\nOuça com a camada de convolução ligada e desligada em Curvas.',
  'help.convolution.tip':
    'O Motor FluidEQ converte sozinho qualquer taxa do impulso. O Equalizer APO precisa de um WAV importado na taxa da própria saída. Os downloads do catálogo precisam de conexão; o guia não.',
  'help.convolution.keywords':
    'IR, resposta impulsiva, convolver, FIR, correção de sala, REW, arquivo de correção, taxa de amostragem',
  'help.convolution.import':
    'Aplica um WAV que você já tem, em qualquer taxa com o Motor FluidEQ.',
  'help.convolution.applied':
    'O impulso que esta saída toca agora. Remover o tira.',
  'help.convolution.search':
    'Busca no catálogo do AutoEq por modelo ou autor da medição.',
  'help.convolution.resultName': 'Um resultado',
  'help.convolution.result':
    'O modelo, quem o mediu, e a fase e a taxa do impulso. Origem abre onde foi publicado.',
  'help.convolution.apply':
    'Baixa o impulso na taxa da sua saída e o aplica. Aplicado marca o que está tocando.',

  'help.profiles.title': 'Dispositivos, perfis e segunda saída',
  'help.profiles.intro':
    'Cada saída guarda o seu próprio som: o EQ, o preset, o Tom, os cortes, o rack DSP, a Sala e o nivelamento são salvos com ela e voltam no momento em que você muda para ela. Perfis guardam outros sons para a mesma saída. Segunda saída toca em outro dispositivo ao mesmo tempo, com som e nível próprios.',
  'help.profiles.steps':
    'Confira a saída no topo do cartão Saída antes de editar; fones Bluetooth mostram a bateria ao lado dela. Use Novo perfil para um som que quer manter; Atualizar salva as mudanças nesse perfil e Restaurar traz de volta os ajustes salvos dele.\nO som próprio de cada música agora está no EQ automático, na página EQ: uma música mantém o preset, o Tom e o EQ em todas as saídas, e a Biblioteca define um para um álbum.\nAbra Segunda saída, ative um dispositivo e ajuste o nível. Escolha o perfil dele logo abaixo, ou pressione Editar som para mudar o som dele na página EQ sem trocar a saída principal; Concluído ou Editar saída principal leva você de volta.\nCada segunda saída acompanha o ritmo sozinha e mostra o atraso em milissegundos; com Compartilhar áudio, o som de outro computador mostra o próprio atraso, rede incluída.',
  'help.profiles.tip':
    'Com o Motor FluidEQ, uma segunda saída toca direto do motor, e a saída principal nunca espera por ela. O EQ automático começa desligado. Na página EQ, o painel começa com o cartão Modo EQ; recolha-o para chegar mais rápido às suas saídas.',
  'help.profiles.keywords':
    'caixas de som, alternar saída, salvar configurações, saída secundária, múltiplas saídas, dois fones, Bluetooth, delay, atraso, DAC, saída, dispositivo de saída, dispositivo, troca automática, perfil, perfis, segunda saída, espelhar, duas saídas, sincronia, latência, por dispositivo, por saída, cada saída, som próprio, bateria, editar som, editar saída principal',
  'help.profiles.list':
    'Sons que você salvou. A marca indica o que esta saída usa; pressione outro para trocar. O lápis de um perfil o renomeia e a lixeira o exclui, depois de perguntar.',
  'help.profiles.update':
    'Salva suas mudanças no perfil em que você está. Restaurar, ao lado, traz o perfil de volta como você o salvou pela última vez.',
  'help.profiles.new': 'Cria um perfil novo a partir do EQ que você tem agora.',
  'help.profiles.output':
    'A saída pela qual você está ouvindo, com a bateria em fones Bluetooth. DESLIG. significa que seu EQ não chega a ela; ATIVO, que o Windows está tocando por ela.',
  'help.profiles.onePlayer':
    'Começar algo no FluidEQ pausa o que toca em outro lugar do PC, e vice-versa.',
  'help.profiles.outputs':
    'Suas outras saídas. Ative uma para tocar nela também, com som, nível e atraso em milissegundos próprios. Editar som muda o som dela na página EQ sem trocar a saída principal.',
  'help.profiles.driver':
    'Um ponto de partida suave para o que você usa para ouvir: fones de ouvido, fones intra-auriculares, um tamanho ou um material de driver. Deixe em Sem compensação se o som já estiver certo.',
  'help.profiles.sampleHeadset': 'Fones de ouvido (áudio USB)',
  'help.profiles.sampleSpeakers': 'Alto-falantes (Realtek Audio)',
  'help.profiles.sampleMusic': 'Música',
  'help.profiles.sampleMovies': 'Filmes',
  'help.profiles.sampleNight': 'Tarde da noite',

  'help.config.title': 'Inspecione e salve uma cadeia',
  'help.config.intro':
    'EQ → Config mostra o que o motor de áudio realmente tem em disco. Os cartões de saída e a árvore de inclusões ajudam a ver quais dispositivos e camadas estão envolvidos. Exporte uma cadeia antes de um grande experimento ou ao transferir uma configuração.',
  'help.config.steps':
    'Abra EQ → Config, selecione a saída e confira estado e camadas.\nUse Exportar cadeia para salvar um arquivo .fluideq.\nPara recuperá-lo, selecione primeiro a saída desejada, use Importar cadeia e confira o resultado.',
  'help.config.tip':
    'Os arquivos de camadas gerados são reescritos quando os ajustes deles mudam; coloque linhas manuais permanentes no arquivo personalizado de cada saída. O Motor FluidEQ lê as linhas Filter, Preamp, GraphicEQ e Convolution desse arquivo; outros comandos do APO e plugins precisam do Equalizer APO.',
  'help.config.keywords':
    'backup, cópia de segurança, restaurar backup, exportar configurações, config.txt, arquivo de texto, include, avançado, migrar',
  'help.config.statusName': 'Se está aplicado',
  'help.config.status':
    'Se o motor está lendo esta configuração, dito antes de tudo.',
  'help.config.outputsName': 'Saídas',
  'help.config.outputs':
    'Cada saída da configuração, com o perfil dela e quantos filtros aplica; Tocando agora marca a que você ouve. Pressione uma para ver a cadeia dela.',
  'help.config.transferName': 'Exportar e importar',
  'help.config.transfer':
    'Exportar cadeia salva a cadeia desta saída como arquivo .fluideq; Importar cadeia traz uma de volta para a saída que você está ouvindo.',
  'help.config.treeName': 'Os arquivos da cadeia',
  'help.config.tree':
    'O arquivo da saída e, abaixo, o de cada camada, na ordem em que o motor os lê, com o que cada um diz.',
  'help.config.customName': 'Seu próprio arquivo',
  'help.config.custom':
    'O único arquivo que o FluidEQ nunca reescreve: coloque aqui com Editar as suas linhas duradouras.',
  'help.config.reload': 'Lê a configuração do disco de novo.',

  'help.dsp.title': 'Explore o rack DSP',
  'help.dsp.intro':
    'O rack DSP é uma cadeia de estágios de estúdio. Com o Motor FluidEQ, ele processa tudo o que o PC toca; com o Equalizer APO, processa as faixas de áudio da Biblioteca. Ele fica desligado enquanto o FluidEQ está desligado.',
  'help.dsp.steps':
    'Abra o DSP e escolha uma cadeia em Cadeia inteira, no topo: ela ajusta todas as etapas de uma vez. Sobre abre as notas de uma cadeia de gênero, com exemplos para ouvir no YouTube.\nClique em uma etapa no trilho para abri-la e ligue-a com o próprio botão. O seletor de presets dela ajusta só essa etapa, e Salvar ao lado guarda só essa etapa.\nO Normalizer fica à parte das cadeias: escolher uma cadeia nunca o muda.\nCompare com a etapa desligada em um volume parecido. Isolar, onde a etapa tem, toca só o que essa etapa muda. Ctrl+clique em um botão giratório o devolve ao padrão.\nSalvar guarda todo o rack como uma cadeia sua; Exportar e Importar o levam para outro computador, e Redefinir devolve a cadeia ao que era.\nTodos os canais aplica o rack a cada canal de uma saída surround; o botão ao lado liga ou desliga o rack inteiro.\nDynamics, De-esser, Denoise, a Sala e Crossfade têm capítulos próprios. O filtro de jogo fica no Gaming Lab; enquanto o som próprio de um jogo está ligado, esta página descansa para que nada aqui o sobrescreva.',
  'help.dsp.tip':
    'Mais alto costuma soar melhor só por ser mais alto, então compare em níveis equivalentes. Ctrl+clique em um controle giratório para voltar ao valor padrão.',
  'help.dsp.keywords':
    'efeitos, FX, plugins, limiter, limitador, loudness, LUFS, normalização de volume, nivelamento, exciter, abertura estéreo, subgrave, subharmônico, transientes, masterização, crossfade, gapless, de-esser, sibilância, s agudo, chiado, voz, podcast, perfis, salvar perfil, passos, ouvir passos, footsteps, jogos, som de jogo, recargas, equalização de volume, game, game filter, dialogue, voice clarity, voices forward, ambience, environment, rain, wind, hooves, horses, headset',
  'help.dsp.normalizer':
    'Iguala o nível da fonte antes de qualquer efeito: Loudness, True Peak ou desligado. Escolher uma cadeia nunca o muda.',
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
  'help.dsp.room':
    'Surround nos fones de ouvido: cada canal vira um alto-falante numa sala ao seu redor.',
  'help.dsp.maximizer': 'Eleva o nível sem deixar os picos passarem do teto.',
  'help.dsp.master': 'Nível final, alvo de sonoridade e proteção de picos.',
  'help.dsp.crossfade': 'Funde uma faixa da Biblioteca na seguinte.',
  'help.dsp.presets':
    'Cadeias prontas para música, gêneros, dispositivos e reparos. Escolher uma ajusta todas as etapas de uma vez.',
  'help.dsp.chainActionsName': 'Ações da cadeia',
  'help.dsp.chainActions':
    'Redefinir devolve a cadeia; Salvar guarda o rack como uma cadeia sua; Exportar e Importar o levam para outro computador.',
  'help.dsp.switchesName': 'Botões do rack',
  'help.dsp.switches':
    'Todos os canais aplica o rack a cada canal de uma saída surround, ou só ao par frontal; Ligado liga o rack inteiro.',
  'help.dsp.stagePresetName': 'Preset da etapa',
  'help.dsp.stagePreset':
    'Os presets próprios da etapa aberta, com suas setas, Redefinir e Salvar, que valem só para esta etapa.',

  'help.room.title': 'A Sala: surround nos fones de ouvido',
  'help.room.intro':
    'A Sala transforma os fones de ouvido em uma sala de escuta. Cada canal do som passa a ser um alto-falante ao redor da sua cabeça, renderizado através de uma cabeça medida e das reflexões de uma sala que você mesmo molda, e um filme fica à sua frente e um jogo envolve você. Precisa do Motor FluidEQ e de fones de ouvido; em alto-falantes não serve para nada.',
  'help.room.steps':
    'Abra o DSP, escolha Sala no trilho e ligue-a. O estéreo vira duas caixas à sua frente; um filme 5.1, cinco e o subwoofer; um jogo 7.1, o anel inteiro. A linha abaixo dos presets diz qual.\nEscolha uma sala em Preset de sala — primeiro as em destaque, depois as clássicas e as suas — ou gire você mesmo Espaço, Ambiência e Distância e arraste uma caixa pelo anel. As caixas que o som tocando não alcança aparecem adormecidas.\nClique em uma caixa: o painel ao lado do desenho passa a ser dela, com ângulo, distância, nível e Mudo ou Solo.\nEm Sua cabeça, clique em Começar o teste de escuta e responda cinco pares curtos: a sala pega a cabeça que coloca os sons na sua frente. Pequena, Média e Grande também podem ser escolhidas à mão.\nSalve com um nome uma sala de que você gosta; uma sala salva volta com um clique e nunca muda a sua cabeça.',
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
  'help.room.dials':
    'Quanto você ouve das paredes, a cauda suave que vem depois e a que distância estão os alto-falantes. Tamanho, Paredes e a duração e o tom da cauda estão em Caráter da sala, abaixo.',
  'help.room.head':
    'A cabeça medida pela qual a sala soa — pequena, média ou grande — e o teste de escuta que a escolhe para os seus ouvidos.',
  'help.room.bass':
    'Manda os graves das caixas para o subwoofer ou os mantém em faixa completa, no crossover que você escolher, e ajusta os níveis do centro e do sub.',
  'help.room.stereo':
    'Só para uma fonte estéreo: mantê-la como palco frontal, ou preencher a sala ao seu redor na quantidade que você escolher.',
  'help.room.saved': 'Dá um nome à sala tal como está; volta com um toque.',
  'help.room.liveName': 'O que a sala está fazendo',
  'help.room.live':
    'Lido do motor: quais alto-falantes o fluxo em reprodução alcança, ou por que a sala está parada.',

  'help.denoise.title': 'Redução de ruído e análise',
  'help.denoise.intro':
    'A Redução de ruído diminui chiado, zumbido da rede elétrica e estalos. Com o Motor FluidEQ, ela funciona ao vivo em tudo o que o PC toca; o limpador de voz neural e o piso de ruído analisado são para faixas da Biblioteca. Redução mais forte não é automaticamente melhor.',
  'help.denoise.steps':
    'Toque algo com o ruído que você quer reduzir e selecione Redução de ruído em DSP.\nLigue Chiado, Zumbido ou Estalos com um ajuste leve e ouça os trechos quietos e os detalhes musicais.\nAumente a redução aos poucos e depois desative o estágio para conferir se a melhora compensa alguma perda de detalhe.\nEm arquivos da Biblioteca, espere a análise antes de comparar o piso de ruído medido ou a limpeza neural de voz. O áudio do sistema usa redução de chiado, zumbido e cliques; a limpeza neural é exclusiva da Biblioteca.',
  'help.denoise.tip':
    'Preste atenção a detalhes suavizados e a texturas aguadas ou com bombeamento. Isto não é uma limpeza de microfone. Se não ouvir nenhuma mudança, confirme que o rack e o estágio estão ligados.',
  'help.denoise.keywords':
    'barulho, remover ruído, tirar ruído, ruído de fundo, estática, vinil, restauração, limpar áudio, denoise, noise',
  'help.denoise.preset':
    'Pontos de partida para uma limpeza suave ou forte, chiado, zumbido, cliques, vinil, fita ou um podcast. Salvar guarda os seus.',
  'help.denoise.isolate':
    'Toca só o que o Denoise remove, para você conferir que ele não tira nada que você quer manter.',
  'help.denoise.graphName': 'Imagem do ruído',
  'help.denoise.graph':
    'O som contra o seu piso de ruído, com a redução de chiado, o zumbido e os cliques reparados desenhados enquanto acontecem.',
  'help.denoise.analysis':
    'Em uma faixa da Biblioteca: o piso de ruído, o zumbido e os cliques por minuto, medidos do próprio arquivo. Analisar novamente mede outra vez.',
  'help.denoise.hiss':
    'Abaixa o chiado constante sob a música. O limite de redução deixa um pouco, para o resto não borbulhar.',
  'help.denoise.hum':
    'Remove o zumbido da rede e seus harmônicos. Auto usa 50 ou 60 Hz conforme a análise encontrou.',
  'help.denoise.clicks':
    'Encontra e emenda cliques e estalos curtos; o que for mais longo fica, para a bateria sobreviver.',
  'help.denoise.voice':
    'O limpador neural de voz, para a reprodução da Biblioteca. O modelo é baixado na primeira vez que você usa.',
  'help.denoise.liveName': 'O que está fazendo',
  'help.denoise.live':
    'Quanto está reduzindo agora, os cliques reparados e qualquer momento em que o limpador de voz ficou para trás.',

  'help.graph.title': 'O gráfico e seus controles',
  'help.graph.intro':
    'O gráfico de resposta desenha suas curvas de EQ sobre o som ao vivo. As opções dele descansam fora de vista e voltam sob o ponteiro: a legenda num canto, Visualizar e tela cheia no outro, e no pé a galeria de visuais, o do gráfico no meio com seus botões, o anterior e o seguinte nas pontas. O que a galeria oferece muda com o visual: um estilo padrão ou uma cena.',
  'help.graph.steps':
    'Clique no nome do visual para escolher um estilo ou uma cena. As setas ao lado, Espaço e Ctrl+Espaço passam por eles.\nAbra Visualização para o que o gráfico desenha — cada desenho tem seu botão, cada curva também —, a faixa de frequências, a altura e a posição da onda e Como é desenhado: a taxa de quadros (todos os que a sua tela oferece, ou 60 ou 30, fixa em 60 na bateria), a resolução e a suavização. Os estilos padrão guardam suas próprias escolhas, separadas das cenas.\nUma cena acrescenta seus próprios controles a Visualização — o que o autor deixou para você ajustar — e Usar a onda original devolve a onda à altura e à posição que esse autor escolheu.\nClique duas vezes no gráfico para ele encher a tela, e de novo para voltar. Em tela cheia, a borda de cima da janela traz o cabeçalho e a de baixo os controles de reprodução; um clique os guarda.\nTeclas: Ctrl+F tela cheia, Esc voltar, Ctrl+G a grade, Ctrl+W e Ctrl+S passam por Somente onda, Onda com curvas e Somente curvas, Ctrl+I o sentido da onda, Ctrl+A todas as bandas. No ponto de uma banda, arraste para movê-la, use as setas para ajustá-la e o clique direito para o menu; Ctrl+rolagem muda o Q de um ponto selecionado.\nClique no nome de uma curva na legenda do gráfico para ocultar ou mostrar o desenho dela. O som não muda. Remova ou mude a camada em Curvas quando quiser mudar o que você ouve.',
  'help.graph.tip': 'Tudo aqui muda só o desenho, nunca o seu som.',
  'help.graph.keywords':
    'analisador de espectro, forma de onda, waveform, FPS, frame rate, fullscreen, esconder, atalhos, atalhos de teclado, clique duplo, expandida, gráfico, espectro, analisador, resposta de frequência, curva, tela cheia, taxa de quadros, quadros, onda, grade, visualização, expandir, etiquetas, rótulos, etiquetas do EQ, rótulos das bandas, labels, teclado, setas, teclas de seta, gráficos, desempenho gráfico, resolução, suavização, galeria, legenda, faixa de frequência, inclinação do analisador',
  'help.graph.stripCaption': 'Com um estilo padrão',
  'help.graph.legend':
    'O nome de cada curva desenhada, e Saída ao vivo para a onda. Pressione um para esconder ou mostrar o desenho dele; o som continua o mesmo.',
  'help.graph.previous': 'Volta ao visual anterior.',
  'help.graph.picker': 'Abre todos os estilos e cenas.',
  'help.graph.placeName': 'Posição na sequência',
  'help.graph.place': 'Onde este visual fica entre os que as setas percorrem.',
  'help.graph.next': 'Avança para o próximo visual.',
  'help.graph.auto': 'Troca o visual a intervalos de 10 segundos a 2 minutos.',
  'help.graph.colouring':
    'Colore o estilo: Auto, Uniforme, Frequência, Nível ou Calor.',
  'help.graph.newLook': 'Cria um visual seu a partir deste estilo.',
  'help.graph.gridName': 'Grade',
  'help.graph.grid': 'Mostra ou oculta a grade e as escalas.',
  'help.graph.hintName': 'Como editar no gráfico',
  'help.graph.hint':
    'Passe o ponteiro sobre ele para ver os gestos: arraste um ponto, Ctrl ou Shift para selecionar, Ctrl+roda para o Q, Ctrl+arrastar move um grupo como um sino.',
  'help.graph.viewName': 'Visualização',
  'help.graph.view':
    'O que o gráfico desenha e como: cada curva, os rótulos, a legenda, a onda, a grade, a faixa de frequência e o medidor.',
  'help.graph.plusCaption': 'Com uma cena',
  'help.graph.creditName': 'A cena e quem a fez',
  'help.graph.credit':
    'Qual cena está tocando e quem a fez. Pressione para escolher outro estilo ou outra cena.',
  'help.graph.likeName': 'Curtir',
  'help.graph.like':
    'Curte a cena que está tocando e dá pontos a quem a criou. Numa cena sua, mostra quantas curtidas ela tem.',
  'help.graph.lighting': 'Ilumina seus dispositivos RGB com esta cena.',
  'help.graph.desktop':
    'Coloca esta cena atrás dos ícones da área de trabalho.',
  'help.graph.viewCaption': 'O menu Visualização',
  'help.graph.fullscreen': 'O gráfico ocupa a tela toda.',
  'help.graph.curves':
    'Um botão para cada curva que o gráfico desenha, na ordem em que são aplicadas. Ctrl+W passa por Só a onda, Onda com curvas e Só curvas; Ctrl+S volta.',
  'help.graph.labels':
    'A frequência, o Q e o ganho de cada banda sobre o ponto dela.',
  'help.graph.wave':
    'A onda ao vivo do que você ouve, desenhada no visual que você escolheu.',
  'help.graph.range':
    'Quanto do espectro o gráfico abrange: 10 Hz–20 kHz de início, 20 Hz–20 kHz, 10 Hz–30 kHz, ou 20 Hz–16 kHz, onde as gravações têm som. Sem a grade, abrange 20 Hz–16 kHz.',
  'help.graph.slope':
    'Inclina o analisador em até 6 dB por oitava, para que a música, que cai rumo aos agudos, pareça mais plana. Desligado por padrão; só nos estilos que desenham o analisador.',
  'help.graph.meter': 'O medidor de saída no painel da esquerda.',
  'help.graph.drawing':
    'Taxa de quadros, resolução e suavização, guardadas separadamente para os estilos padrão e as cenas.',
  'help.graph.sampleScene': 'Aurora',
  'help.graph.sampleScenePrevious': 'Bloom',
  'help.graph.sampleSceneNext': 'Neon City',
  'help.graph.sampleMaker': 'Lumen Works',
  'help.looks.title': 'Estilos e cenas',
  'help.looks.intro':
    'Os estilos padrão são desenhos gratuitos do som ao vivo que você mesmo pode colorir e personalizar: Onda espectral para um traço limpo, Barras de LED e Barras neon para impacto, Horizonte, Torres de vidro e Eco para cenas inteiras. As cenas são imagens vivas desenhadas na placa de vídeo, como Alpino, Aurora, Floração e Cidade de neon, em que os graves, a batida e os agudos movem, cada um, algo diferente.',
  'help.looks.steps':
    'Clique no nome do visual no gráfico. Escolha uma seção à esquerda, ou pesquise em tudo de uma vez.\nCom “De”, veja só os do FluidEQ, as cenas dos membros ou os seus. Se uma cena ainda não for sua, ela fica bloqueada, e escolhê-la explica como obtê-la.\nEm um estilo padrão, pressione Novo visual para mudar as cores, o movimento e os picos, e depois salve; ele aparece em “De: Seus”.',
  'help.looks.tip':
    'Uma cena traz as próprias cores: ajuste o ataque e a liberação dela em Visualização. Os estilos padrão têm ajustes gráficos próprios em Visualização, separados das cenas: resolução total e escala simples para começar. Se uma cena não puder rodar neste computador, o gráfico desenha um estilo gratuito em vez de ficar em branco.',
  'help.looks.keywords':
    'skin, aparência, temas, animação, animações, customizar, cena, cenas, visualizer, estilos, estilo, visualizador, visualização, cores, visual, personalizar, gráficos, ajustes gráficos, configurações gráficas, resolução, qualidade',
  'help.looks.searchName': 'Pesquisar',
  'help.looks.search':
    'Encontra estilos e cenas por nome, criador ou categoria.',
  'help.looks.placesName': 'Seções',
  'help.looks.places':
    'Tudo, Novas e atualizadas, os tipos de estilo e cada categoria de cenas, cada um com quantos tem.',
  'help.looks.from': 'Quem fez: o FluidEQ, os membros ou você.',
  'help.looks.viewName': 'Visualização e ordem',
  'help.looks.view':
    'Imagens ou uma lista detalhada, ordenadas por mais novas, atualizadas recentemente, nome ou mais usadas.',
  'help.looks.plus':
    'Cada visual como uma imagem. Nova ou Atualizada marca o que mudou, e Tocando marca o visual do gráfico.',

  'help.plus.title': 'Sua conta, os créditos e a aba Cenas',
  'help.plus.intro':
    'A conta é opcional: tudo o que era gratuito funciona neste computador sem ela. Conectado, a aba Cenas reúne a Galeria, o Estúdio, a Iluminação dinâmica e o fundo da área de trabalho. Uma cena da Galeria custa um crédito e é sua para sempre; uma conta confirmada recebe 1 crédito grátis, e os pacotes de créditos são pagos uma única vez.',
  'help.plus.steps':
    'Abra a aba Cenas e pressione Entrar, ou Criar sua conta grátis e digite o código de seis dígitos enviado para seu email. Depois de entrar, sua conta é o cartão no pé da coluna esquerda da aba.\nEscolha Galeria. Abra uma cena, assista e pressione Obter para gastar um crédito nela.\nPara ter mais créditos, abra sua conta por esse cartão e escolha um pacote. Ele é pago uma única vez na Stripe, no seu navegador.',
  'help.plus.tip':
    'O app nunca vê seu cartão, e nada é renovado. Uma conta fica conectada em até cinco computadores.',
  'help.plus.keywords':
    'conta, entrar, login, cadastrar, registrar, créditos, crédito, pacote, comprar, preço, preços, custo, pagamento, pagar, premium, pago, cena, assinatura, cancelar, membro, código por email',
  'help.plus.visualizers':
    'Cenas do FluidEQ e dos membros, prontas para sua música.',
  'help.plus.studio': 'Crie suas próprias cenas com sua IA.',
  'help.plus.lighting': 'Seus dispositivos RGB seguem a cena.',
  'help.plus.fold':
    'Recolhe a barra lateral até ficarem só as imagens; ela volta a abrir ao passar o mouse.',

  'help.gallery.title': 'A galeria de cenas',
  'help.gallery.intro':
    'A galeria reúne as cenas do FluidEQ e as que os membros publicam. Qualquer pessoa com uma conta pode navegar pela galeria. Se uma cena tem uma prévia publicada, o vídeo de dez segundos sem som se repete até você mudar de cena. Cenas sem vídeo mostram a capa. Uma cena que você obtém com um crédito reage à sua música e fica nos seus visuais.',
  'help.gallery.steps':
    'Abra Cenas → Galeria. Pesquise, ordene por Mais curtidas, Nesta semana ou Mais novas, ou escolha uma categoria.\nAbra uma cena e pressione Obter para ficar com ela usando um crédito, depois Reproduzir no gráfico. As setas, ou ← e →, passam de uma cena para outra.\nCurta com o coração as cenas que você tem, e denuncie uma que não deveria estar ali.',
  'help.gallery.tip':
    'As cenas nos seus visuais se atualizam sozinhas, e a página de uma cena diz o que mudou em cada versão. Uma cena que você publica aparece assim que o criador do FluidEQ a aprova. Abrir no Estúdio mostra como as cenas do próprio FluidEQ são feitas. Uma cena 3D diz isso no cartão e na página dela, com as teclas que movem a câmera. Enquanto uma cena toca, Visualização → Cores da janela escolhe o que a janela veste: Original, Cores ou Ambiente.',
  'help.gallery.keywords':
    'baixar cenas, galeria de cenas, baixar visualizadores, cenas da comunidade, likes, populares, denunciar, moderação',
  'help.gallery.search': 'Encontra cenas e criadores.',
  'help.gallery.sortName': 'Ordenar',
  'help.gallery.sort': 'Mais curtidas, curtidas nesta semana ou mais novas.',
  'help.gallery.categoriesName': 'Categorias',
  'help.gallery.categories': 'Mostra um tipo de cena.',
  'help.gallery.mine': 'As cenas que você publicou, com as curtidas delas.',
  'help.gallery.cardName': 'Uma cena',
  'help.gallery.card':
    'A imagem abre a cena. Obter a guarda com um crédito, e o coração curte a cena.',
  'help.gallery.manage':
    'O que cada monitor mostra como fundo da área de trabalho.',
  'help.gallery.stop': 'Para todos os fundos da área de trabalho.',
  'help.gallery.sceneCaption': 'A página de uma cena',
  'help.gallery.back': 'Volta à galeria, onde você parou.',
  'help.gallery.play':
    'Reproduz a cena no gráfico. Uma cena que você ainda não tem oferece Obter, por um crédito.',
  'help.gallery.desktop': 'Coloca a cena atrás dos ícones da área de trabalho.',
  'help.gallery.inspect':
    'Abre a cena do FluidEQ no Estúdio para ver como ela é feita.',

  'help.studio.title': 'Crie cenas no Estúdio',
  'help.studio.intro':
    'O Estúdio transforma uma descrição em uma cena. Seu próprio assistente de IA escreve a cena em uma pasta de projeto, e o FluidEQ toca cada versão com sua música no momento em que ela é salva. O Estúdio é grátis para todas as contas.',
  'help.studio.steps':
    'Abra Cenas → Estúdio e pressione Novo projeto…. Dê um nome; o FluidEQ cria a pasta dele com uma cena que já se mexe.\nDescreva sua ideia, abra a pasta no seu assistente de IA e cole o prompt de Copiar prompt para IA.\nOu escreva o que deve mudar no chat ao lado do palco: o Claude Code neste computador, com o seu próprio plano, edita a cena e toca cada versão. Cada resposta guarda a sua versão, com Trazer de volta.\nAcompanhe o palco enquanto os arquivos são salvos e experimente os sinais de teste. Depois, Adicionar aos meus visuais, Publicar… ou Exportar….\nEm Publicar…, escreva uma linha sobre a cena ou clique em Escrever com IA, e depois em Enviar para revisão: ao enviar, o FluidEQ grava a prévia de dez segundos sem som para a Galeria com a música de demonstração.',
  'help.studio.tip':
    'Clique duas vezes no palco para tela cheia. Ver por dentro uma cena do FluidEQ… abre uma das cenas do próprio FluidEQ para você aprender com ela; essa cena não pode ser publicada. Cenas que piscam forte demais ou ficam pesadas demais são retidas. Uma cena que você publica é lida antes pelo criador do FluidEQ, e, depois de aprovada, toca de graça para você em todo lugar.',
  'help.studio.keywords':
    'criar cena, criar visualizador, editor de cenas, shader, GLSL, WebGL, programação, ChatGPT, Claude, Gemini, chat, chat do estúdio, pedir uma mudança, claude code, trazer de volta, versões',
  'help.studio.project':
    'Seus projetos e as cenas do FluidEQ para ver por dentro.',
  'help.studio.stageName': 'Palco',
  'help.studio.stage':
    'A cena, tocando com sua música. Clique duas vezes para tela cheia.',
  'help.studio.hears':
    'O que a cena recebe: nível, batida, graves, médios, agudos.',
  'help.studio.tabs':
    'Ajustar testa a onda e as configurações próprias da cena, Código mostra o código conforme sua IA o salva, Desempenho como ela roda aqui, e abaixo está aberto O que ela ouve agora.',
  'help.studio.chat':
    'Peça uma mudança ao Claude com suas próprias palavras. Cada resposta que mudou a cena pode trazer aquela versão de volta.',
  'help.studio.signals': 'Sinais de teste que movem só esta prévia.',
  'help.studio.size': 'Testa a cena em tela cheia.',

  'help.desktop.title': 'O fundo da área de trabalho',
  'help.desktop.intro':
    'O fundo da área de trabalho coloca uma cena atrás dos seus ícones, em um monitor ou em cada um deles, enquanto o FluidEQ estiver aberto.',
  'help.desktop.steps':
    'Coloque uma cena no gráfico e pressione o botão de monitor ao lado do nome dela, ou escolha Visualização → Definir como fundo da área de trabalho.\nPressione os monitores no mapa, escolha Com a música ou Calmo e pressione Definir fundo.\nPara mudar ou parar, abra Cenas → Galeria e use Gerenciar ou Parar no topo.',
  'help.desktop.tip':
    'Ele fica em pausa enquanto as janelas cobrem o monitor, com o PC bloqueado e, se você quiser, na bateria, e volta quando o FluidEQ inicia. Sair do FluidEQ o interrompe. Só no Windows.',
  'help.desktop.keywords':
    'papel de parede, papel de parede animado, wallpaper, plano de fundo, fundo de tela, dois monitores, vários monitores, segundo monitor, desktop',
  'help.desktop.monitors':
    'Seus monitores como o Windows os organiza. Pressione os que quer usar.',
  'help.desktop.music': 'Move-se com o que estiver tocando.',
  'help.desktop.calm': 'Uma animação lenta e tranquila que ignora a música.',
  'help.desktop.follow':
    'Muda com a cena do gráfico, seja você que a escolha ou a troca automática.',
  'help.desktop.battery':
    'Economiza energia enquanto o computador está fora da tomada.',
  'help.desktop.start': 'Inicia nos monitores que você escolheu.',

  'help.lighting.title': 'Iluminação dinâmica (beta)',
  'help.lighting.intro':
    'A Iluminação dinâmica acende seu teclado, mouse, mousepad, headset e suporte com a cena do gráfico, pelo Windows Dynamic Lighting e pelo Razer Chroma. Ela está em beta, então conte para nós como seus dispositivos se comportam.',
  'help.lighting.steps':
    'Abra Cenas → Iluminação dinâmica e ative-a, ou pressione o botão de iluminação ao lado de uma cena no gráfico.\nEscolha o estilo de iluminação desta cena (Cena, Onda de cor, Espectro ou Onda rítmica) e ajuste o brilho e a que ele responde.\nClique em um dispositivo em Seus dispositivos para ajustá-lo separadamente; Todos os dispositivos volta a ajustar todos.',
  'help.lighting.tip':
    'Se o Windows reservar um dispositivo para outro app, a página diz qual configuração mudar e a abre para você. Dispositivos Razer precisam do Razer Synapse aberto, com o Chroma Apps permitido.',
  'help.lighting.keywords':
    'RGB, LED, luzes, periféricos, sincronizar luzes, iluminação reativa',
  'help.lighting.switch': 'Ilumina seus dispositivos enquanto uma cena toca.',
  'help.lighting.browse': 'Abre a galeria para escolher uma cena.',
  'help.lighting.previewName': 'Prévia da mesa ao vivo',
  'help.lighting.preview':
    'Sua própria mesa, iluminada com as cores enviadas a ela.',
  'help.lighting.devices':
    'Todos os dispositivos encontrados. Clique em um para ajustá-lo separadamente; o botão Todos os dispositivos, acima da lista, volta a ajustar todos de uma vez.',
  'help.lighting.style':
    'Cena, Onda de cor, Espectro ou Onda rítmica, salvo para cada cena.',

  'help.online.title': 'Ouça com Mídia online',
  'help.online.intro':
    'A Mídia online toca YouTube, YouTube Music, Bandcamp, Twitch e Suno dentro do FluidEQ, com o mesmo layout da Biblioteca: os sites e suas pesquisas recentes na barra lateral, a barra de ferramentas sobre a página. O que toca passa pelo seu EQ como qualquer outro app; a reprodução e o login são de cada site.',
  'help.online.steps':
    'Escolha um site na barra lateral. Pesquise pela barra de ferramentas ou encontre algo na página dele e dê play.\nPressione uma pesquisa recente para repeti-la no site aberto.\nVá para outra aba enquanto toca: a página continua tocando e a barra no rodapé da janela acompanha.\nAtive Um reprodutor de cada vez se o FluidEQ e outros players devem pausar um ao outro em vez de tocar juntos.',
  'help.online.tip':
    'Com o Motor FluidEQ, a Mídia online passa pelo seu EQ e pelo rack DSP como qualquer outro app. Com o Equalizer APO, o rack fica com as faixas da Biblioteca.',
  'help.online.keywords':
    'youtube, youtube music, bandcamp, twitch, suno, streaming, web, site, navegador, online, histórico de pesquisa, pesquisas recentes, sair, logout, cores, página escura',
  'help.online.sites':
    'Os sites. Um ponto ao lado indica que está tocando. O alfinete sobre a barra lateral a recolhe aos ícones.',
  'help.online.recent':
    'O que você pesquisou antes. Pressione uma para pesquisar de novo no site aberto; o × dela a esquece.',
  'help.online.colours':
    'Colore a página do site com as cores do FluidEQ, só na sua tela. Vídeos, imagens e logotipos nunca mudam, e sites de páginas claras mantêm as próprias cores.',
  'help.online.signOut':
    'Apaga todos os logins, cookies e páginas em cache que o player guarda.',
  'help.online.navName': 'Voltar, avançar e recarregar',
  'help.online.nav':
    'Navegue pelas páginas que você abriu no site ou recarregue a página.',
  'help.online.search':
    'Pesquisa no site aberto e guarda a pesquisa em Pesquisas recentes.',

  'help.library.title': 'Navegue e organize sua Biblioteca',
  'help.library.intro':
    'A Biblioteca reúne as músicas e os vídeos das suas unidades numa página: as estantes na barra lateral, uma barra para encontrar e organizar, e abaixo dela onde você está. Capas e detalhes vêm das tags dos arquivos, que o editor de tags corrige.',
  'help.library.steps':
    'Pressione Adicionar pasta no pé da barra lateral e escolha a pasta com suas músicas. A linha de status abaixo da página diz quando a Biblioteca está em dia.\nEscolha uma estante: Álbuns, Artistas, Gêneros, Músicas, Pastas (suas pastas se abrem como árvore embaixo), Vídeos ou uma playlist. Um vídeo toca na própria página, com uma aba Legendas para as legendas dele.\nPesquise pela barra, mostre a estante em Detalhes, Grade ou Cover Flow e ordene com Ordenar. As setas voltam e avançam pelos lugares por onde você passou.\nAbra um álbum, um artista ou uma pasta para ver as músicas. O nome de um artista, onde quer que apareça, abre a página dele: os álbuns e todas as músicas em que ele está.\nPara corrigir tags, clique com o botão direito numa música, em várias ou num álbum e escolha Editar tags (Ctrl+I) ou Corrigir tags automaticamente (Ctrl+Shift+I). Uma música abre ao lado da página; um álbum, uma pasta ou uma seleção abre como a página.\nConfira as alterações e pressione Salvar. Os arquivos são gravados em segundo plano, e o cartão no canto oferece Desfazer, que devolve as tags antigas.',
  'help.library.tip':
    'Passe o mouse sobre o botão do FluidEQ na barra de tarefas do Windows para Anterior, Reproduzir e Próxima, mesmo minimizado. Solte músicas na Biblioteca para tocá-las. A Biblioteca precisa dos arquivos onde os encontrou: reconecte a unidade ou adicione de novo uma pasta movida.',
  'help.library.keywords':
    'reprodutor de música, tocador, adicionar músicas, escanear, metadados, árvore de pastas, cover flow, grade, legendas, tags, editar tags, corrigir tags, ID3, renomear arquivos, capas, musicbrainz, desfazer, MP3, FLAC, AAC, WAV, Playlists, Nova playlist',
  'help.library.shelvesName': 'Estantes',
  'help.library.shelves':
    'O que a Biblioteca tem, com quanto há em cada uma. Pastas abre embaixo uma árvore das suas pastas.',
  'help.library.playlists':
    'Todas as suas playlists, onde se cria uma nova; embaixo, Favoritos e as suas.',
  'help.library.addFolder':
    'Adiciona uma pasta de músicas ou vídeos. Suas pastas, embaixo, lista as pastas e remove uma.',
  'help.library.history': 'Volta e avança pelos lugares que você abriu.',
  'help.library.search':
    'Encontra músicas, artistas e álbuns na Biblioteca inteira.',
  'help.library.views': 'Detalhes, Grade ou Cover Flow, em todas as estantes.',
  'help.library.sort':
    'Ordena a estante por título, artista, ano, adicionadas recentemente, mais tocadas e mais. A seta inverte a ordem.',
  'help.library.upNext':
    'Abre e recolhe o painel direito: a música tocando, A seguir, Detalhes e Letra.',
  'help.library.album':
    'Abre o álbum. Clique com o botão direito para tocar, enfileirar, pôr numa playlist ou editar as tags dele inteiro.',
  'help.library.rescan':
    'Diz se a Biblioteca está em dia. Escanear novamente relê suas pastas atrás de mudanças; Forçar nova leitura, ao lado, lê cada arquivo do zero.',
  'help.library.tagsCaption': 'Um álbum no editor de tags, depois de corrigido',
  'help.library.fixAuto':
    'Preenche o que falta a partir dos nomes dos arquivos, do nome da pasta, de uma folha .cue e do que a maioria das músicas tem em comum, com a imagem da pasta como capa. Nada é buscado na internet.',
  'help.library.searchWeb':
    'Abre o álbum no MusicBrainz no seu navegador. O FluidEQ não baixa nada.',
  'help.library.cover':
    'Uma capa para todas as músicas. Pressione-a para escolher uma imagem, colar ou procurar uma, ou solte uma imagem sobre ela.',
  'help.library.albumFields':
    'Valores digitados uma vez para todas as músicas. O que mudou fica colorido, com o valor substituído riscado embaixo; a seta devolve o antigo.',
  'help.library.findReplace':
    'Encontra palavras em todos os títulos e as substitui de uma vez.',
  'help.library.fileNames':
    'Renomeia os arquivos a partir das tags, por um padrão. Cada nome novo aparece sob a música, com o antigo riscado.',
  'help.library.sheet':
    'Número, título e artista de cada música, editados como numa planilha. Arraste uma linha pela alça e pressione Renumerar pela ordem.',
  'help.library.save':
    'Grava as alterações; antes disso nada muda no disco. Descartar joga todas fora.',
  'help.library.changesCaption': 'Alterações: o que Salvar vai gravar',
  'help.library.changes':
    'Tudo o que Salvar vai gravar, contado. Ocupa o lugar de A seguir enquanto o editor está aberto.',
  'help.library.changesAlbum':
    'O que muda em todas as músicas. Um valor preenchido onde não havia nenhum fica verde; um substituído mostra o antigo riscado.',
  'help.library.changesSongs':
    'As alterações de cada música e, depois, os arquivos que ganham nome novo.',

  'help.queue.title': 'Álbuns, A seguir e letras',
  'help.queue.intro':
    'Um álbum abre sob a capa sem parar o que está tocando. Ao lado, o painel direito mostra a música tocando sobre três abas: A seguir, os Detalhes da música e a Letra.',
  'help.queue.steps':
    'Abra um álbum e pressione Reproduzir, ou pressione uma música para começar por ela. Um segundo toque numa música a recomeça do início.\nClique com o botão direito numa música para Adicionar à fila, Adicionar aos Favoritos ou Adicionar a uma playlist; escolha várias com Ctrl ou Shift.\nEm A seguir, pressione uma música para tocá-la agora, arraste para mudar a ordem, ou aponte para ela e pressione × para tirá-la.\nAtive Continuar tocando para seguir com mais do mesmo gênero quando a lista acabar. Me surpreenda, no pé de A seguir e na barra de reprodução, toca uma música aleatória da sua Biblioteca e continua no estilo dela.\nLetra mostra as palavras da música a partir das tags dela, ou de um arquivo .lrc ou .txt com o mesmo nome ao lado. Linhas sincronizadas acompanham a música palavra por palavra.\nSem letra, ou com a errada? Encontrar outra letra pesquisa a música na internet pelo seu navegador. Importe o arquivo baixado, cole a letra ou solte o arquivo na aba; o FluidEQ a guarda com a música.',
  'help.queue.tip':
    'Abrir no Karaokê transforma a letra de uma música num karaokê no Criador de karaokê, onde o tempo dela pode ser corrigido. No Windows, solte arquivos ou pastas de música no Player compacto para adicioná-los à Biblioteca e à fila.',
  'help.queue.keywords':
    'fila, a seguir, próxima música, aleatório, repetir, favoritos, playlist, continuar tocando, reprodução automática, me surpreenda, aleatória, tocando agora, letra, letras, lrc, letra sincronizada, lrclib, genius, musixmatch, karaokê, ordem',
  'help.queue.recordCaption': 'Um álbum aberto',
  'help.queue.place':
    'Onde você está: a estante, depois o álbum. Pressione a estante para voltar a ela.',
  'help.queue.artist':
    'Abre a página do artista: os álbuns e todas as músicas em que ele está.',
  'help.queue.fix':
    'Abre o álbum no editor de tags com as propostas da correção já preenchidas.',
  'help.queue.actionsName': 'Os botões do álbum',
  'help.queue.actions':
    'Reproduzir, Aleatório, Adicionar à fila, Mostrar no Explorador e o menu do álbum: Favoritos, playlists, Editar tags e mais.',
  'help.queue.albumSound':
    'Um som para este álbum, um EQ salvo ou um preset, que toca com qualquer música dele.',
  'help.queue.filter':
    'Filtra as músicas deste álbum enquanto você digita. A pesquisa da barra procura na Biblioteca inteira.',
  'help.queue.songsName': 'As músicas',
  'help.queue.songs':
    'Pressione uma música para tocá-la. As barras marcam a que está tocando, a estrela seus Favoritos; o clique direito abre o menu dela.',
  'help.queue.paneCaption': 'O painel direito, em A seguir',
  'help.queue.now': 'A música tocando. O nome do artista abre a página dele.',
  'help.queue.tabs':
    'A seguir, os Detalhes da música (arquivo, formato e loudness) e a Letra. Num vídeo, a última aba é Legendas.',
  'help.queue.keep':
    'Quando a lista acaba, segue com mais do mesmo gênero e depois com uma surpresa.',
  'help.queue.rowsName': 'O que toca em seguida',
  'help.queue.rows':
    'O resto do que você estava ouvindo, sob o nome do álbum. Pressione uma música para tocá-la agora, arraste para reordenar, aponte para ver o ×.',
  'help.queue.picks':
    'As músicas que você adicionou, depois do resto do álbum, na ordem em que as adicionou.',
  'help.queue.surprise':
    'Uma música aleatória da sua Biblioteca agora, depois mais do estilo dela.',
  'help.queue.lyricsCaption': 'Letra, e Encontrar outra letra',
  'help.queue.lyricsLine':
    'A linha sendo cantada, acesa palavra por palavra. Pressione qualquer linha para tocar a partir dela.',
  'help.queue.sourceName': 'De onde vieram',
  'help.queue.source':
    'As tags da música, ou o arquivo de letra ao lado dela, pelo nome. A lixeira apaga um arquivo de letra guardado com a música; a letra dentro do próprio arquivo da música nunca é alterada.',
  'help.queue.karaoke':
    'Cria um karaokê com esta letra no Criador de karaokê, onde o tempo dela pode ser corrigido.',
  'help.queue.findOther':
    'Abre a busca, mostrada à direita, para trazer outra letra.',
  'help.queue.sites':
    'Pesquisa a música no LRCLIB (letras grátis e sincronizadas), Genius ou Musixmatch, no seu navegador. O FluidEQ não baixa letras por conta própria.',
  'help.queue.import':
    'Guarda a letra com a música: um arquivo baixado, texto colado ou um arquivo solto na aba (.lrc, .srt, .vtt, .ttml, .json, .yaml ou .txt).',

  'help.karaoke.title': 'Cante com Karaokê',
  'help.karaoke.intro':
    'O Karaokê coloca as suas próprias músicas num palco: a letra enquanto é cantada, os acordes e uma faixa de afinação que desenha a sua voz sobre as notas da música e pontua cada linha. Suas músicas ficam numa lista ao lado, como na Biblioteca, e cada uma toca pelo player da Biblioteca, com as suas configurações de som.',
  'help.karaoke.steps':
    'Abra o Karaokê e pressione + ao lado de Músicas para adicionar arquivos ou uma pasta inteira: cada música com o seu arquivo de letra. Clique duas vezes numa música para cantá-la.\nUse a linha no topo do palco: Afinação e Acordes mostram ou escondem a faixa de afinação e os acordes, cada um por si; Cena, Capa, Vídeo ou Nenhum escolhe o que fica atrás da letra. Com Cena, a escolha da cena aparece ao lado.\nAtive o microfone no canto da faixa de afinação e cante. Cada nota é uma caixa e a sua voz uma linha que a atravessa: verde afinada, amarela perto, vermelha fora. Cada nota recebe o seu veredito ao terminar.\nSob a faixa, cada linha da música é uma fileira de células com a sua pontuação. Pressione uma linha para cantá-la de novo a partir de logo antes. Quando a música termina, o resumo mostra a sua pontuação de 10.000, o que foi mais difícil, uma dica e cada linha diante do seu recorde; Ver resultados abre de novo.\nAbra Configurações de mistura na barra do player para o volume, o tom da melodia, a faixa base e, depois que o Criador separou a música, a Voz guia: a voz do cantor por baixo da música, tão alta quanto você quiser.\nA tela cheia dá a janela ao palco. A linha e a barra do player saem depois de alguns segundos parados: leve o ponteiro à borda de cima para o cabeçalho ou à de baixo para a barra, ou fixe-os com os botões ao lado da tela cheia.',
  'help.karaoke.tip':
    'Um arquivo de letra só com as palavras não tem notas, então não há nada na faixa para cantar nem pontuar; arquivos UltraStar as trazem, e o Criador de karaokê pode adicioná-las. Os acordes vêm dos próprios arquivos da música quando ela os tem, uma folha de acordes ao lado da música ou acordes no arquivo de letra, e senão são tirados da música. O microfone é analisado neste computador para nível e afinação; o FluidEQ nunca o grava nem o toca pelos seus alto-falantes.',
  'help.karaoke.keywords':
    'cantar, letra, microfone, mic, afinação, pontuação, acordes, voz guia, tela cheia, lrc, ultrastar, músicas, lyrics, sing',
  'help.karaoke.stageCaption':
    'O palco: a letra, os acordes, a sua afinação e a sua pontuação',
  'help.karaoke.guides':
    'Afinação mostra a faixa de notas, Acordes os acordes. Cada um liga e desliga sozinho; com os dois desligados o palco mostra só a letra.',
  'help.karaoke.background':
    'O que fica atrás da letra: a cena, a capa da música, o vídeo dela ou nada. Capa e Vídeo aparecem quando a música os traz.',
  'help.karaoke.maker':
    'Abre esta música no Criador de karaokê para corrigir o tempo, a letra ou as notas.',
  'help.karaoke.textSize':
    'Aumenta ou diminui a letra conforme a distância de onde você canta.',
  'help.karaoke.micSettings':
    'Qual microfone usar, quão alto ele ouve você e o volume dele. Ele acende enquanto o microfone está ativo.',
  'help.karaoke.fullScreen':
    'Dá a janela inteira ao palco; clicar duas vezes no palco faz o mesmo. Em tela cheia, mais dois botões aqui mantêm o cabeçalho ou a barra do player na tela.',
  'help.karaoke.chords':
    'O acorde que acabou de tocar, o que soa agora, em destaque, e os dois seguintes.',
  'help.karaoke.pitch':
    'As notas a cantar como caixas, e a sua voz como uma linha que as atravessa: verde afinada, amarela perto, vermelha fora. Arraste-a para percorrer a música, e arraste a alça acima dela para deixá-la mais alta.',
  'help.karaoke.micToggle':
    'Liga ou desliga o microfone. Enquanto ele escuta, a nota que você está cantando aparece ao lado.',
  'help.karaoke.score':
    'Cada linha como uma fileira de células, uma por nota, na cor do veredito, com a pontuação acumulada e a sequência. Pressione uma linha para cantá-la de novo.',
  'help.karaoke.playlistCaption': 'Suas músicas, ao lado do palco',
  'help.karaoke.search':
    'Encontra uma música na lista pelo título ou pelo nome do arquivo.',
  'help.karaoke.add':
    'Adicione arquivos ou uma pasta, agrupe a lista por pasta ou esvazie-a.',
  'help.karaoke.fold':
    'Recolhe a lista para dar espaço ao palco. O botão Playlist no início da linha do palco a traz de volta.',
  'help.karaoke.singingName': 'A música no palco',
  'help.karaoke.singing':
    'Ela mostra barras em movimento enquanto é cantada. Clique numa música para escolhê-la e clique duas vezes para cantar; aponte para uma linha para subi-la, descê-la ou tirá-la da lista.',
  'help.karaoke.folderName': 'Uma pasta',
  'help.karaoke.folder':
    'Com a lista agrupada por pasta, pressione uma pasta para recolher as músicas dela ou abri-las de novo. O número é quantas músicas ela tem.',
  'help.karaoke.mixCaption':
    'Configurações de mistura, na barra do player no pé da janela',
  'help.karaoke.volume':
    'O volume do computador, o mesmo controle que a barra de cada aba tem. O ícone dele silencia o som.',
  'help.karaoke.melody':
    'Um tom que toca as notas da música, para cantar junto. O botão dele liga ou desliga.',
  'help.karaoke.backing':
    'A música: a própria música, ou a faixa base depois que o Criador de karaokê separou a voz dela.',
  'help.karaoke.vocal':
    'A voz do próprio cantor, posta sob a faixa base quando a música foi separada. Em zero, só a música.',
  'help.karaoke.scene':
    'Com a cena atrás da letra, quanto ela transparece e quanto fica desfocada. O Karaokê guarda os seus, à parte dos do gráfico.',
  'help.karaoke.micCaption': 'Configurações do microfone',
  'help.karaoke.micInput': 'O microfone em que você canta.',
  'help.karaoke.micOn':
    'Começa ou para de escutar. Se está ativo aparece no alto à direita do painel.',
  'help.karaoke.micLevel':
    'Quão alto o microfone ouve você agora. Cante e veja se mexer.',
  'help.karaoke.micVolume':
    'Aumenta um microfone baixo demais para a sua afinação ser ouvida, ou abaixa um alto demais.',
  'help.karaoke.scoreCaption': 'O resumo no fim de uma música',
  'help.karaoke.total':
    'A sua pontuação de 10.000, a avaliação dela e como fica diante do seu recorde nesta música.',
  'help.karaoke.statsName': 'Afinação · No tempo · Notas',
  'help.karaoke.stats':
    'Quanto do tempo você cantou dentro das notas, em quantas notas entrou no tempo e quantas acertou, com cada veredito contado embaixo.',
  'help.karaoke.hardest':
    'A linha que mais deu trabalho e por quê, com uma coisa para tentar na próxima vez embaixo.',
  'help.karaoke.practise':
    'Leva você para logo antes dessa linha para cantá-la de novo.',
  'help.karaoke.again': 'A música inteira de novo, desde o início.',
  'help.karaoke.map':
    'Cada linha com a avaliação dela e quantos pontos mudou desde o seu recorde. Pressione uma linha para praticá-la.',
  'help.karaoke.attempts':
    'Suas últimas tentativas nesta música, entre elas esta e a melhor.',

  'help.maker.title': 'Crie no Criador de karaokê',
  'help.maker.intro':
    'O Criador de karaokê transforma uma música num karaokê para cantar: a letra, quando cada palavra é cantada e as notas da melodia. Ele abre a música do palco num só editor: as ferramentas no alto, o som da música com a letra e as notas embaixo, e uma prévia ao vivo de como o palco vai mostrá-las.',
  'help.maker.steps':
    'No palco do Karaokê, pressione Abrir no Criador. Pressione Letra e cole a letra da música ou carregue um arquivo de letra, uma linha por fileira, com cada repetição escrita.\nPressione Detectar tempo e melodia para o FluidEQ ouvir quando cada palavra é cantada e quais notas a levam, ou Aceitar e gravar tempos para marcar você mesmo cada linha enquanto a música toca. Na primeira vez, os modelos de IA necessários são baixados.\nConfira o resultado na grade: as palavras ficam em faixas acima das notas, e as notas são desenhadas como no palco. Arraste uma palavra ou uma nota para movê-la, ou a borda para mudar a duração. Selecionar notas desenha uma caixa em volta de várias; Desenhar notas desenha novas.\nPercorra a música com a visão geral sob a grade, ou arraste com o botão do meio do mouse em qualquer ponto da grade para se mover no tempo e na altura ao mesmo tempo. A Faixa de altura, na borda esquerda da grade, amplia e rola as notas. Seguir a letra mantém o cursor de reprodução à vista e vira a página quando ele chega à borda.\nPressione Usar no player para cantar no palco. Exportar salva como projeto FluidEQ, UltraStar TXT, LRC ou LRC aprimorado; uma música da sua Biblioteca também pode ser salva de volta nela com Salvar na biblioteca.',
  'help.maker.editorCaption': 'O editor: o som da música, a letra e as notas',
  'help.maker.gridName': 'A grade',
  'help.maker.grid':
    'No alto o som da música, embaixo a letra em três faixas e as notas como caixas na grade de altura, como o palco as desenha. Arraste com o botão do meio do mouse para se mover no tempo e na altura.',
  'help.maker.pitchRange':
    'Onde a grade está na altura, diante de toda a faixa. Arraste as pontas para ampliar e o meio para rolar; clique duas vezes para ajustar às notas.',
  'help.maker.overview':
    'A música inteira, com a parte mostrada na grade enquadrada. Arraste o quadro para se mover e as bordas para ampliar.',
  'help.maker.follow':
    'Mantém o cursor de reprodução à vista enquanto a música toca e vira a página quando ele chega à borda.',
  'help.maker.preview':
    'A letra como o palco vai mostrá-la enquanto a música toca. O controle A muda o tamanho; esconda a prévia para ter mais espaço.',
  'help.maker.checked':
    'Quantas palavras você ajustou à mão e quantas ainda estão como foram detectadas ou importadas, com as notas, palavras e verificações da música ao lado.',

  'help.maker.lyricsCaption': 'A letra, e quando cada palavra é cantada',
  'help.maker.reference':
    'A música inteira como texto, um verso por linha. Cole-a ou carregue um arquivo; o FluidEQ encontra os tempos a partir dela.',
  'help.maker.timing':
    'Todas as palavras em ordem, com quantas já têm tempo. Clique em uma para trabalhar nela.',
  'help.maker.word':
    'Onde começa a palavra escolhida e quanto dura. Mover a borda dela dá ou tira tempo da palavra ao lado; a linha mantém a duração.',
  'help.maker.toolsCaption':
    'Ferramentas de reparo e os modelos de IA de que precisam',
  'help.maker.separate':
    'Divide a gravação em voz e música. O karaokê pode então tocar sem o cantor, o controle Voz guia pode trazer a voz de volta por baixo e a detecção ouve a letra com mais clareza.',
  'help.maker.loadVocals':
    'Use um arquivo só de voz que você já tenha, em vez de separá-lo aqui.',
  'help.maker.redetectTiming':
    'Escuta de novo a voz separada e refaz o tempo das palavras que você já tem. Ele espera a voz estar separada.',
  'help.maker.redetectNotes':
    'Escuta de novo a melodia na voz separada e reescreve as notas sob a letra. Ele espera a voz estar separada.',
  'help.maker.models':
    'O que cada modelo precisa e se ele está neste computador. Eles são baixados na primeira vez que você usa um.',
  'help.maker.idle':
    'Se um modelo fica na memória entre usos, e por quanto tempo. Liberá-lo deixa memória livre; mantê-lo faz a próxima vez começar de imediato.',

  'help.makerBar.caption': 'As ferramentas no alto do Criador',
  'help.makerBar.import':
    'Abre um arquivo de karaokê ou um projeto salvo, e mantém o áudio já carregado.',
  'help.makerBar.lyrics': 'As palavras e os seus tempos, numa só janela.',
  'help.makerBar.timing':
    'Move palavras e notas em conjunto, para uma música adiantada ou atrasada desde o primeiro segundo.',
  'help.makerBar.language':
    'Em que língua estão as palavras, e uma segunda ao lado para que a música possa ser cantada em qualquer uma.',
  'help.makerBar.record':
    'Toque a música e pressione uma tecla no início e no fim de cada linha. O tempo vem das suas teclas.',
  'help.makerBar.select':
    'Desenhe uma caixa ao redor das notas para movê-las ou apagá-las juntas.',
  'help.makerBar.paint': 'Desenhe a melodia diretamente sobre a grade de tons.',
  'help.makerBar.repair':
    'Separa a voz da música e escuta de novo a letra ou a melodia, com os modelos de IA necessários.',
  'help.makerBar.export':
    'Salva o karaokê pronto como projeto FluidEQ, UltraStar TXT, LRC ou LRC aprimorado.',
  'help.makerBar.apply': 'Entrega o karaokê pronto ao palco e fecha o Criador.',
  'help.maker.tip':
    'A detecção é um ponto de partida: toque trechos curtos e corrija as palavras e as notas pela gravação. Separar primeiro a voz da música faz a detecção ouvir a letra com mais clareza e dá ao player o controle de Voz guia. Os modelos precisam de conexão e espaço em disco na primeira vez; use áudio e letras com que você tem permissão para trabalhar.',
  'help.maker.keywords':
    'remover voz, vocais, vocal remover, instrumental, acapella, faixas, separar voz, isolar voz, sincronizar letra, tempo, melodia, notas, afinação, ultrastar, lrc, criar karaokê, transcrever, criador',

  'help.share.title': 'Compartilhe áudio entre computadores',
  'help.share.intro':
    'Compartilhar áudio junta computadores da mesma rede privada em um grupo, e cada um toca o som dos outros: seja qual for o que você está usando, você ouve o resto. Cada computador envia o próprio som direto para os outros, intacto, e nunca reenvia o que recebe, então não há eco; o computador em que você ouve aplica o próprio EQ, curvas e DSP. Isso é diferente de espelhar para um segundo dispositivo no mesmo computador.',
  'help.share.steps':
    'Em um computador, abra Compartilhar áudio, pressione Adicionar computador e depois Copiar código. Comece com volume baixo.\nNo outro computador, pressione Adicionar computador, cole o código em Código do outro computador e pressione Vincular. Os dois computadores tocam um ao outro na hora. Vincule mais computadores do mesmo jeito: cada um entra no grupo todo, e os que chegam por meio de outro aparecem com Receber desligado até você ligar.\nEm Todo o grupo, cada computador tem duas chaves, Receber e Enviar; Compartilhar desliga o som deste computador para todos. Sua mixagem ajusta o volume de Este PC e um nível por computador.\nPausar, Retomar e Desvincular ficam no menu de cada computador. Um computador ausente continua na lista como Offline, e o grupo se reencontra sozinho depois de reiniciar, suspender, cair a rede ou trocar de motor.\nAtive Fluid ao lado de Compartilhar para música em conexão que trava. Ele acrescenta um pequeno buffer; desligue se o atraso menor for prioridade.\nSe um computador salvo continuar offline, abra ••• e escolha Reconectar. O código salvo é tentado novamente sem esquecer o vínculo; se o endereço mudou, cole o código atual.',
  'help.share.tip':
    'Mantenha o código de conexão privado: ele autoriza o vínculo. Com o Motor FluidEQ, este computador mantém o DSP enquanto compartilha, e o computador que toca o som dele aplica o próprio. Tocar e enviar ao mesmo tempo exige Windows nesse computador; em outros, um vínculo funciona em um sentido só.',
  'help.share.keywords':
    'rede local, LAN, wifi, outro PC, transmitir, receber áudio, remoto, dois sentidos, bidirecional, vincular, desvincular, rede, enviar áudio, outro computador, segundo computador, receptor, transmissor, código de conexão, parear, conexão, pausar, retomar, volume, grupo, adicionar computador, receber, enviar, compartilhar, mixagem, offline, vários computadores',
  'help.share.mix':
    'O volume deste PC e um nível para cada computador que você ouve.',
  'help.share.outputName': 'Saída',
  'help.share.output': 'Onde este computador toca o grupo.',
  'help.share.add':
    'Copie o código deste computador, ou cole o de outro e clique em Vincular.',
  'help.share.shareSwitch':
    'Compartilhar envia o som deste computador para todo o grupo; Fluid ao lado adiciona uma pequena folga para uma conexão que trava.',
  'help.share.switchesName': 'Receber e Enviar',
  'help.share.switches':
    'Receber toca aquele computador aqui; Enviar toca este lá. O menu ••• dele pausa, retoma, reconecta ou desvincula.',
  'help.share.laneName': 'O que ele toca',
  'help.share.lane':
    'A música daquele computador e o som dela como chega, com o atraso em cada sentido.',

  'help.trouble.title': 'Quando o som está errado',
  'help.trouble.intro':
    'Comece pela fonte e pela saída, depois isole a camada. Um gráfico, um preset salvo ou um interruptor ativado não provam, sozinhos, que o som chegou ao dispositivo certo. O menu Ajuda também leva à solução de problemas de áudio, ao relato de problemas e ao Fórum.',
  'help.trouble.steps':
    'Sem som: confirme que a reprodução está rodando, que a saída esperada está escolhida, que o volume está alto e que o dispositivo está conectado. Veja se Um reprodutor de cada vez pausou outra fonte.\nO EQ não muda nada: confirme que o botão de ligar no alto do painel da esquerda está ligado e que a saída não mostra o selo DESLIG.; se mostrar, pressione Ativar. Se o aviso do motor disser que ele não está rodando, pressione Reiniciar o áudio do Windows.\nTudo parece certo e o EQ continua sem fazer nada: o Windows pode estar tocando a música por fora do motor. O aviso diz isso e oferece, com um toque, mover o motor para onde o Windows vai usá-lo; custa um pedido de permissão e um segundo de silêncio.\nDistorção ou graves demais: deixe Normalizar automaticamente ligado, reduza os reforços e contorne as camadas uma a uma. Se continuar, use Relatar um problema e confira o relatório antes de enviar.',
  'help.trouble.tip':
    'F1 abre este guia. Esc fecha uma captura ampliada e depois o guia. Se a interface estiver grande demais, Ctrl + 0 restaura o zoom. Processos, no menu de ações, mostra o que cada parte do FluidEQ está fazendo.',
  'help.trouble.keywords':
    'mudo, erro, bug, picotando, falhando, engasgando, pipocando, cortando, distorcido, estourado, clipping, som baixo, consertar, resolver, suporte, atalhos de teclado, teclas de atalho, resetar zoom, travou, crash, reportar',
  'help.trouble.noticeName': 'O aviso do motor',
  'help.trouble.notice':
    'Diz qual saída o motor não alcança e por quê, no canto inferior direito da janela, assim que se ouve som nela.',
  'help.trouble.useApo': 'Troca para o Equalizer APO, pela janela do motor.',
  'help.trouble.restart':
    'Reinicia o áudio do Windows, o que costuma trazer o motor de volta. O Windows pede permissão.',

  'help.forum.title': 'Pergunte no Fórum',
  'help.forum.intro':
    'O Fórum traz o GitHub Discussions do FluidEQ para dentro do app: anúncios, ideias, perguntas e ajustes de que as pessoas se orgulham. Qualquer um pode ler; para publicar, você usa sua conta do GitHub, não uma do FluidEQ.',
  'help.forum.steps':
    'Abra Ajuda → Fórum e escolha uma categoria: Anúncios, Geral, Ideias, Votações, Q&A, Mostre o seu som, Dicas e truques ou Apoie o FluidEQ. Novo para você reúne o que chegou desde a última visita, e Problemas mostra o que foi relatado no GitHub.\nPesquise no fórum ou abra um tópico para ler as respostas.\nPressione Entrar com GitHub, termine no navegador e depois publique um Novo tópico ou uma resposta.',
  'help.forum.tip':
    'Tudo o que é publicado fica público no GitHub, com seu nome do GitHub. Em Q&A, marque a resposta que funcionou para que a próxima pessoa a encontre. O número amarelo de cada seção indica tópicos com atividade que você ainda não viu; Problemas conta os que estão abertos. Tópicos e respostas pela metade ficam salvos quando você sai. Pressione a imagem de uma publicação para ampliá-la dentro do FluidEQ.',
  'help.forum.keywords':
    'comunidade, dúvidas, suporte, sugestão, sugestões, feedback, pedido de recurso, contato, desenvolvedor, discussões, enquete',
  'help.forum.boardsName': 'Quadros',
  'help.forum.boards':
    'Cada quadro com sua contagem. Novo para você reúne o que chegou desde sua última visita, e Issues lista os problemas relatados no GitHub.',
  'help.forum.textSize': 'Aumenta ou diminui o texto do Fórum e deste guia.',
  'help.forum.meName': 'Sua conta do GitHub',
  'help.forum.me':
    'Com quem você publica. Sair deixa o Fórum legível e para de publicar.',
  'help.forum.newTopic':
    'Novo tópico inicia uma discussão; Marcar tudo como lido zera as contagens, e a seta busca o que há de novo.',
  'help.forum.search': 'Procura nos tópicos e respostas de todos os quadros.',
  'help.forum.topicsName': 'Tópicos',
  'help.forum.topics':
    'A atividade mais recente primeiro, cada um com seu quadro, seu estado, suas respostas e seus votos. Abra um para ler e responder.',
  'help.games.profiles':
    'Abra Perfis de jogos para buscar por perfil, jogo, curva ou cadeia. Os filtros ficam em uma linha e cada tipo de jogo tem sua cor. Seus perfis salvos também mostram a curva, os níveis do filtro Jogo e a cadeia. Usar em um jogo cria uma nova cópia.',
  'help.mic.title': 'O som do seu microfone',
  'help.mic.intro':
    'A aba Microfone dá a cada microfone um rack de voz próprio. O FluidEQ Engine o executa no próprio microfone, então Discord, OBS, um jogo ou uma chamada ouvem sua voz como você a moldou. É preciso o FluidEQ Engine.',
  'help.mic.steps':
    'Abra Microfone no cabeçalho e escolha o seu microfone no topo. Se o FluidEQ ainda não estiver nele, clique em Configurar neste microfone; o Windows pede permissão uma vez.\nEscolha um Perfil do microfone por uso — Streaming, Podcast, Chat de jogo, Reuniões —, por microfone, para cantar ou um efeito de voz. Ele ajusta cada etapa para uma voz; uma etapa que você muda marca o perfil como ajustado, e Redefinir o traz de volta.\nClique em uma etapa no trilho para abri-la. Cada uma tem seu botão, um medidor que se move com a sua voz e o atraso que adiciona; uma etapa desligada some do som por completo.\nFale e veja o desenho: o fraco é o que o microfone capta, o brilhante é o que os outros ouvem, e o cinza que aparece é o que os filtros tiraram. Ouvir o resultado final toca para você; use fones, senão microfonia.\nEfeitos próprios do microfone mostra o que o fabricante do microfone coloca na sua voz antes do FluidEQ. Desligá-los evita limpar a voz duas vezes; o Windows pede permissão e, ao religar, eles voltam exatamente como eram.',
  'help.mic.tip':
    'Uma etapa desligada deixa a voz intacta e não adiciona atraso; se Atraso estiver alto, desligue o que você não precisa. No Equalizer APO a aba Microfone não tem onde rodar.',
  'help.mic.keywords':
    'microfone, mic, voz, streaming, obs, discord, podcast, chamadas, reuniões, cancelamento de ruído, supressão de ruído, noise gate, gate, de-esser, compressor, limitador, reverb, efeitos de voz, cantar, microfone usb, microfone do headset, efeitos próprios',
  'help.mic.own':
    'O que o fabricante do microfone coloca na sua voz antes do FluidEQ. O botão pede permissão ao Windows nos dois sentidos.',
  'help.mic.master': 'Liga ou desliga todo o rack de voz deste microfone.',
  'help.mic.stagesName': 'As etapas',
  'help.mic.stages':
    'Na ordem em que a sua voz passa por elas, cada uma com seu botão, um medidor que se move com a voz e o atraso que adiciona. Clique em uma para abri-la.',
  'help.mic.pick':
    'O microfone que você está moldando; cada um guarda o próprio som. A linha abaixo diz se o motor está trabalhando nele agora.',
  'help.mic.pictureName': 'Sua voz',
  'help.mic.picture':
    'O fraco é o que o microfone capta, o brilhante é o que os outros ouvem, e o cinza que aparece é o que os filtros tiraram.',
  'help.mic.profile':
    'Sons de voz prontos por uso, por microfone, para cantar e como efeitos de voz. Uma mudança marca o perfil como ajustado; Redefinir o traz de volta.',
  'help.mic.delay':
    'Quanto o rack inteiro atrasa a sua voz, como o motor mede.',
};

export default help;
