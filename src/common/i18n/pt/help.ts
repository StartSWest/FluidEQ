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

  'help.requirements.title': 'O que o seu PC precisa',
  'help.requirements.intro':
    'O FluidEQ roda em qualquer PC com Windows dos últimos dez anos. Duas partes pedem mais que o resto: os visualizadores do Plus desenham na placa de vídeo, e o karaokê com IA baixa seus modelos na primeira vez que você o usa.',
  'help.requirements.steps':
    'Veja qual Windows você tem: Windows 10 versão 1803 ou posterior, ou Windows 11, de 64 bits, 4 GB de memória e cerca de 600 MB de disco. Processar tudo o que o PC toca precisa do Motor FluidEQ ou do Equalizer APO, e o Windows pede permissão uma vez durante a instalação.\nAbra um visualizador: qualquer placa de vídeo ou vídeo integrado de 2013 em diante. Em 1080p o vídeo integrado basta; para 4K, ou um plano de fundo em várias telas ao mesmo tempo, uma placa dedicada é melhor. Com a placa ocupada, o FluidEQ desenha a cena menor e solta as que você não está vendo.\nExperimente o karaokê com IA: separar a voz baixa um modelo de 713 MB na primeira vez, o da afinação acrescenta cerca de 180 MB e o de remover ruído, 11 MB. Com uma placa de vídeo com DirectX 12, uma música de quatro minutos é separada em meio minuto; só com o processador leva cerca de quatro minutos. Deixe 2 GB de memória livres enquanto ele trabalha.\nMire nisto se puder: Windows 11, 8 GB de memória, vídeo de 2018 em diante e 3 GB de disco livres se você usar os recursos com IA.',
  'help.requirements.tip':
    'Tudo, menos os modelos de IA, vem no instalador, e eles só são baixados quando você usa o recurso pela primeira vez. Processos, no menu de ações, mostra o que cada parte do FluidEQ está usando na sua máquina agora.',

  'help.engine.title': 'O Motor FluidEQ',
  'help.engine.intro':
    'O FluidEQ processa seu som com um motor próprio ou com o Equalizer APO. O Motor FluidEQ roda dentro do serviço de áudio do Windows, depois dos efeitos da sua placa de som, leva seu EQ e o rack DSP a tudo o que o PC toca e sai do caminho assim que o FluidEQ fecha.',
  'help.engine.steps':
    'Abra o menu de ações (o botão de pulso no canto superior direito) e clique no cartão do motor, no topo.\nEscolha Motor FluidEQ e pressione Aplicar. O Windows pede permissão, e o áudio pausa por alguns segundos enquanto reinicia.\nSe uma saída mostrar DESLIG., pressione Ativar no aviso dela. Se um aviso disser que o motor não está funcionando, pressione Reiniciar o áudio do Windows.',
  'help.engine.tip':
    'O Equalizer APO continua disponível para comandos personalizados do APO, Peace e plugins VST. Quando uma atualização traz um motor mais novo, um aviso oferece Atualizar o motor. Sair do FluidEQ pela bandeja do sistema desliga o EQ em todas as saídas.',
  'help.engine.fluid':
    'Recomendado. Os efeitos da sua placa de som continuam funcionando, e o EQ e o rack DSP chegam a todos os apps.',
  'help.engine.apo':
    'Roda comandos personalizados do APO, Peace e plugins VST. O rack DSP fica só na reprodução da Biblioteca.',
  'help.engine.apply':
    'Troca o motor. O Windows pede permissão uma vez, e o áudio reinicia por alguns segundos.',

  'help.eq.title': 'Modele seu som com EQ',
  'help.eq.intro':
    'Frequência define onde a banda atua; Ganho, o reforço ou corte; Q, a largura: Q maior é mais estreito. Comece com mudanças pequenas e amplas e compare sempre.',
  'help.eq.steps':
    'Selecione uma banda em EQ → Bandas. Gire os controles Frequência, Ganho e Fator Q, ou arraste o ponto dela no gráfico.\nClique com o botão direito em uma banda para redefini-la, desativá-la ou adicionar uma banda ao lado. Ctrl+clique em um controle deslizante ou giratório para devolvê-lo ao valor padrão.\nPressione Limpar EQ para definir todos os ganhos em 0 dB mantendo suas bandas. Ele pergunta antes.',
  'help.eq.tip':
    'A curva de resposta descreve seus filtros; o espectro em movimento descreve o som. Desligar uma banda com Ativa guarda os ajustes dela para depois.',
  'help.eq.bandsCaption': 'A página Bandas',
  'help.eq.voicing': 'Um caráter rápido para o som, como Music ou Movies.',
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
    'O Modo EQ muda como suas bandas e suas curvas de correção são aplicadas, sem editá-las. Os designs de bandas guardam as frequências e o Q de um layout de que você gosta, prontos para qualquer saída.',
  'help.eqmode.steps':
    'Abra Modo EQ na barra de ferramentas de Bandas. Experimente uma opção de Intensidade, Q das bandas ou Suavização das curvas com a música tocando; o painel continua aberto.\nCom o Motor FluidEQ, escolha a fase Mínima ou Linear. Pressione Redefinir para voltar tudo ao Normal.\nAbra o botão de layouts ao lado de Adicionar banda. Escolha 6, 10, 15 ou 31 bandas, ou pressione Salvar design… para dar nome ao layout atual.',
  'help.eqmode.tip':
    'Um design guarda só frequências e Q: ao carregar um, todas as bandas começam em 0 dB. A fase linear acrescenta atraso e pode ressoar antes de ataques rápidos.',
  'help.eqmode.modeCaption': 'Modo EQ',
  'help.eqmode.strength':
    'Normal, Estúdio ×1.5 ou ×2, para seu EQ e suas curvas separadamente.',
  'help.eqmode.q':
    'Constante mantém cada Q; Proporcional e Assimétrico estreitam as bandas conforme elas crescem.',
  'help.eqmode.smoothing': 'Suaviza curvas de correção amostradas.',
  'help.eqmode.phase': 'Mínima ou Linear. Só com o Motor FluidEQ.',
  'help.eqmode.reset': 'Tudo de volta ao Normal.',
  'help.eqmode.designsCaption': 'Designs de bandas',
  'help.eqmode.builtIn': 'Layouts padrão de 6, 10, 15 ou 31 bandas.',
  'help.eqmode.save':
    'Dá nome às frequências e ao Q atuais como um design, listado em Meus designs.',

  'help.headphones.title': 'Correção de fones e importações',
  'help.headphones.intro':
    'A correção compensa um modelo medido e pode ser combinada com suas bandas. Confira modelo exato e autor da medição.',
  'help.headphones.steps':
    'Abra EQ → Presets EQ, procure o modelo dos seus fones, revise as medições disponíveis e escolha a correspondente.\nPara texto de EQ de outra ferramenta, use Importar configurações de EQ no menu de ações. Confira as bandas e a curva interpretadas antes de aplicar.\nPara o Squiglink, cole a exportação dele no painel de importação. Aplicar como EQ substitui suas bandas; Aplicar como curva a adiciona como uma correção de fones com intensidade própria.',
  'help.headphones.tip':
    'Uma prévia não aplicada não muda o som. Evite duas correções completas para o mesmo fone por acidente; compare desligando a camada de fones.',

  'help.convolution.title': 'Use uma resposta ao impulso',
  'help.convolution.intro':
    'Convolução aplica um impulso WAV como camada separada. Pesquise o catálogo AutoEq ou importe seu WAV; as bandas paramétricas continuam independentes.',
  'help.convolution.steps':
    'Abra EQ → Convolução e procure por modelo ou autor da medição.\nConfira a origem e use Baixar e aplicar; o download acompanha a taxa da sua saída. Use Importar um WAV para um arquivo que você já tem.\nOuça com a camada de convolução ligada e desligada em Também aplicado.',
  'help.convolution.tip':
    'O Motor FluidEQ converte sozinho qualquer taxa do impulso. O Equalizer APO precisa de um WAV importado na taxa da própria saída. Os downloads do catálogo precisam de conexão; o guia não.',

  'help.profiles.title': 'Dispositivos, perfis e segunda saída',
  'help.profiles.intro':
    'Seu EQ acompanha o dispositivo de saída. O Vínculo automático salva as edições na saída atual, e os Perfis salvos permitem guardar sons alternativos. Segunda saída espelha a reprodução em outros dispositivos, com um nível separado para cada um.',
  'help.profiles.steps':
    'Confira o Dispositivo de saída antes de editar. Use Novo perfil para um som que quer manter; Atualizar salva as mudanças nesse perfil e Restaurar traz de volta os ajustes salvos dele.\nAbra Segunda saída, ative um dispositivo acessível e ajuste o nível. Escolha o perfil de EQ salvo desse dispositivo logo abaixo dele.\nUse Jogo/Vídeo para um buffer inicial menor ou Música para mais reserva. Compare a sincronização nos seus dispositivos.',
  'help.profiles.tip':
    'Cada saída espelhada usa seu próprio perfil, com qualquer um dos motores. O espelhamento funciona enquanto o FluidEQ está aberto; trocar a saída principal encerra os espelhamentos antigos. A latência do dispositivo ainda afeta a sincronização.',

  'help.config.title': 'Inspecione e salve uma cadeia',
  'help.config.intro':
    'EQ → Config mostra o que o motor de áudio realmente tem em disco. Os cartões de saída e a árvore de inclusões ajudam a ver quais dispositivos e camadas estão envolvidos. Exporte uma cadeia antes de um grande experimento ou ao transferir uma configuração.',
  'help.config.steps':
    'Abra EQ → Config, selecione a saída e confira estado e camadas.\nUse Exportar cadeia para salvar um arquivo .fluideq.\nPara recuperá-lo, selecione primeiro a saída desejada, use Importar cadeia e confira o resultado.',
  'help.config.tip':
    'Os arquivos de camadas gerados são reescritos quando os ajustes deles mudam; coloque linhas manuais permanentes no arquivo personalizado de cada saída. O Motor FluidEQ lê as linhas Filter, Preamp, GraphicEQ e Convolution desse arquivo; outros comandos do APO e plugins precisam do Equalizer APO.',

  'help.dsp.title': 'Explore o rack DSP',
  'help.dsp.intro':
    'O rack DSP é uma cadeia de estágios de estúdio. Com o Motor FluidEQ, ele processa tudo o que o PC toca; com o Equalizer APO, processa as faixas de áudio da Biblioteca. Ele fica desligado enquanto o FluidEQ está desligado.',
  'help.dsp.steps':
    'Abra a aba DSP. Escolha uma cadeia em Predefinições, ou selecione um estágio na barra lateral e ligue-o.\nMude um controle por vez e compare desativando o estágio, em um volume parecido. Isolar permite ouvir só o que um estágio acrescenta.\nSalve um rack de que você gosta e use Exportar e Importar para compartilhá-lo.',
  'help.dsp.tip':
    'Mais alto costuma soar melhor só por ser mais alto, então compare em níveis equivalentes. Ctrl+clique em um controle giratório para voltar ao valor padrão.',
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

  'help.denoise.title': 'Redução de ruído e análise',
  'help.denoise.intro':
    'A Redução de ruído diminui chiado, zumbido da rede elétrica e estalos. Com o Motor FluidEQ, ela funciona ao vivo em tudo o que o PC toca; o limpador de voz neural e o piso de ruído analisado são para faixas da Biblioteca. Redução mais forte não é automaticamente melhor.',
  'help.denoise.steps':
    'Toque algo com o ruído que você quer reduzir e selecione Redução de ruído em DSP.\nLigue Chiado, Zumbido ou Estalos com um ajuste leve e ouça os trechos quietos e os detalhes musicais.\nAumente a redução aos poucos e depois desative o estágio para conferir se a melhora compensa alguma perda de detalhe.',
  'help.denoise.tip':
    'Preste atenção a detalhes suavizados e a texturas aguadas ou com bombeamento. Isto não é uma limpeza de microfone. Se não ouvir nenhuma mudança, confirme que o rack e o estágio estão ligados.',

  'help.graph.title': 'O gráfico e seus controles',
  'help.graph.intro':
    'O gráfico de resposta desenha as curvas do seu EQ sobre o som ao vivo. A barra acima dele escolhe o que é desenhado e como, e muda conforme o visual: um estilo padrão ou um visualizador Plus.',
  'help.graph.steps':
    'Clique no nome do visual para escolher um estilo ou visualizador. As setas ao lado dele, Space e Ctrl+Space percorrem as opções.\nAbra Visualização para o tamanho do gráfico, o que ele mostra e a altura e a posição da onda.\nClique duas vezes no gráfico para tela inteira. Um clique simples oculta ou mostra a barra.',
  'help.graph.tip':
    'Tudo aqui muda só o desenho, nunca o seu som. Esc sai das visualizações expandida e em tela inteira.',
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
    'Coloca este visualizador atrás dos ícones do ambiente de trabalho.',
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
    'Os estilos padrão são desenhos gratuitos do som ao vivo que você mesmo pode colorir e personalizar: Linha e Área para um traço limpo, Blocos LED e Picos para impacto, Treliça, Horizonte e Chamas dançantes para cenas inteiras. Os visualizadores Plus são cenas desenhadas na placa gráfica, como Alpino, Aurora, Floração e Cidade de neon, em que os graves, a batida e os agudos movem, cada um, algo diferente.',
  'help.looks.steps':
    'Clique no nome do visual no gráfico. Pesquise ou filtre os estilos por Linhas, Preenchimentos, Barras, Pontos, Cenas ou Onda.\nEscolha um visualizador Plus à direita. Sem o Plus ele fica bloqueado, e escolhê-lo explica como obtê-lo.\nEm um estilo padrão, pressione Novo visual para mudar as cores, o movimento e os picos, e depois salve; ele aparece em Seus.',
  'help.looks.tip':
    'Um visualizador Plus traz as próprias cores: ajuste o ataque e a liberação dele em Visualização. Se uma cena não puder rodar neste computador, o gráfico desenha um estilo gratuito em vez de ficar em branco.',
  'help.looks.searchName': 'Pesquisar',
  'help.looks.search':
    'Encontra estilos e visualizadores por nome, criador ou categoria.',
  'help.looks.styles':
    'Estilos gratuitos desenhados pelo FluidEQ e os visuais que você salvou.',
  'help.looks.familiesName': 'Filtros de estilos',
  'help.looks.families':
    'Linhas, Preenchimentos, Barras, Pontos, Cenas, Onda e Seus.',
  'help.looks.plus': 'Cenas do FluidEQ e dos membros, cada uma com uma imagem.',
  'help.looks.categoriesName': 'Categorias',
  'help.looks.categories': 'Natureza, Cidades, Abstrato e mais.',

  'help.plus.title': 'O FluidEQ Plus e sua conta',
  'help.plus.intro':
    'Uma conta é opcional: tudo o que era grátis funciona neste computador sem ela. O FluidEQ Plus, mensal ou anual, acrescenta Visualizadores, o Estúdio, a Classificação, a Iluminação dinâmica e o visualizador do ambiente de trabalho.',
  'help.plus.steps':
    'Abra Conta no menu de ações. Inicie sessão, ou crie uma conta e digite o código de seis dígitos enviado para seu e-mail.\nPressione Passar ao Plus, leia os termos, marque que concorda e pague no Buy Me a Coffee, no seu navegador, com o mesmo e-mail.\nAbra a aba Plus. A barra lateral dela leva à Classificação, aos Visualizadores, ao Estúdio e à Iluminação dinâmica.',
  'help.plus.tip':
    'O app nunca vê seu cartão; Gerir subscrição permite alterá-la ou cancelá-la. Uma conta fica com a sessão iniciada em até cinco computadores, e o Plus continua funcionando offline por um tempo.',
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
    'As cenas nos seus visuais se atualizam sozinhas, e a página de uma cena diz o que mudou em cada versão. Abrir no Estúdio mostra como as cenas do próprio FluidEQ são feitas.',
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
    'O que cada monitor mostra como fundo do ambiente de trabalho.',
  'help.gallery.stop': 'Para todos os fundos do ambiente de trabalho.',
  'help.gallery.sceneCaption': 'A página de uma cena',
  'help.gallery.back': 'Volta à galeria, onde você parou.',
  'help.gallery.stepName': 'Anterior e próxima',
  'help.gallery.step': 'Percorre a lista de onde você abriu a cena.',
  'help.gallery.play':
    'Adiciona a cena aos seus visuais ou a reproduz no gráfico.',
  'help.gallery.desktop':
    'Coloca a cena atrás dos ícones do ambiente de trabalho.',
  'help.gallery.inspect':
    'Abre a cena do FluidEQ no Estúdio para ver como ela é feita.',

  'help.leaderboard.title': 'A Classificação',
  'help.leaderboard.intro':
    'A Classificação ordena os membros Plus que participam dela pelo quanto ouvem e pelas curtidas que suas cenas recebem. Ela fica desligada a menos que você entre.',
  'help.leaderboard.steps':
    'Abra Conta e pressione Entrar na classificação.\nAbra Plus → Classificação. Escolha o nome de utilizador e o nome visível que a classificação mostra, e depois alterne entre Desde sempre e Este mês.\nPara parar, pressione Sair da classificação. Remover todos os meus dados apaga tudo o que você enviou.',
  'help.leaderboard.tip':
    'Um número por dia sai do seu computador (os minutos de música que tocaram), e nunca o que você toca. Cada número é verificado no servidor.',
  'help.leaderboard.periodName': 'Desde sempre ou Este mês',
  'help.leaderboard.period': 'Todo o histórico, ou só este mês.',
  'help.leaderboard.standing':
    'Sua posição e seus pontos, e quanto falta para o próximo lugar.',
  'help.leaderboard.earn':
    '10 pontos por hora, 20 por dia com 30 minutos ou mais, 5 por curtida.',

  'help.studio.title': 'Crie cenas no Estúdio',
  'help.studio.intro':
    'O Estúdio transforma uma descrição em um visualizador. Seu próprio assistente de IA escreve a cena em uma pasta de projeto, e o FluidEQ toca cada versão com sua música no momento em que ela é salva.',
  'help.studio.steps':
    'Abra Plus → Estúdio e pressione Novo projeto…. Dê um nome; o FluidEQ cria a pasta dele com uma cena que já se mexe.\nDescreva sua ideia, abra a pasta no seu assistente de IA e cole o prompt de Copiar prompt para IA.\nAcompanhe o palco enquanto os arquivos são salvos e experimente os sinais de teste. Depois, Adicionar aos meus visuais, Publicar… ou Exportar….',
  'help.studio.tip':
    'Clique duas vezes no palco para tela cheia. Ver por dentro uma cena da FluidEQ… abre uma das cenas do próprio FluidEQ para você aprender com ela; essa cena não pode ser publicada. Cenas que piscam forte demais ou ficam pesadas demais são retidas.',
  'help.studio.project':
    'Seus projetos e as cenas do FluidEQ para ver por dentro.',
  'help.studio.switchName': 'Projeto anterior e próximo',
  'help.studio.switch': 'Volta ou avança pelos seus projetos.',
  'help.studio.stageName': 'Palco',
  'help.studio.stage':
    'A cena, tocando com sua música. Clique duas vezes para tela cheia.',
  'help.studio.code':
    'O código da cena, ao vivo, atualizado conforme sua IA o salva.',
  'help.studio.prompt':
    'Copia o prompt que explica à sua IA como as cenas são feitas.',
  'help.studio.hears':
    'O que a cena recebe: nível, batida, graves, médios, agudos.',
  'help.studio.signals': 'Sinais de teste que movem só esta prévia.',
  'help.studio.size':
    'Testa a cena em um painel de gráfico, estreito, largo ou em tela cheia.',
  'help.studio.wave':
    'Testa a altura e a posição da onda que os ouvintes podem ajustar.',

  'help.desktop.title': 'O visualizador do ambiente de trabalho',
  'help.desktop.intro':
    'O visualizador do ambiente de trabalho coloca um visualizador Plus atrás dos seus ícones, em um monitor ou em cada um deles, enquanto o FluidEQ estiver aberto.',
  'help.desktop.steps':
    'Coloque um visualizador Plus no gráfico e pressione o botão de monitor ao lado do nome dele, ou escolha Visualização → Definir como fundo do ambiente de trabalho.\nPressione os monitores no mapa, escolha Com a música ou Calmo e pressione Definir fundo.\nPara mudar ou parar, abra Plus → Visualizadores e use Gerir ou Parar no topo.',
  'help.desktop.tip':
    'Ele fica em pausa com apps em tela inteira, com o PC bloqueado e, se você quiser, na bateria, e volta quando o FluidEQ inicia. Sair do FluidEQ o interrompe. Só no Windows.',
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
    'Cena, Onda de cor, Espectro ou Onda rítmica, guardado para cada visualizador.',

  'help.online.title': 'Ouça com Mídia online',
  'help.online.intro':
    'Mídia online mantém sites compatíveis ao lado do seu EQ. A reprodução e o login dos sites ainda dependem do provedor e da sua conexão. A barra na parte de baixo do FluidEQ acompanha o player ativo, e o volume dela é o do próprio site.',
  'help.online.steps':
    'Abra Mídia online, escolha um site e inicie a reprodução na página.\nVá à EQ para ajustar ouvindo; volte à página para os controles próprios.\nAtive Um player por vez para evitar sobreposição com outros players.',
  'help.online.tip':
    'Com o Motor FluidEQ, a Mídia online passa pelo seu EQ e pelo rack DSP como qualquer outro app. Com o Equalizer APO, o rack fica com as faixas da Biblioteca.',

  'help.library.title': 'Monte sua biblioteca local',
  'help.library.intro':
    'A Biblioteca reúne músicas e vídeos das suas unidades. Navegue por álbuns, artistas, gêneros, músicas, pastas, uma árvore de pastas ou suas playlists. Capas e detalhes vêm dos seus arquivos, então a mesma coleção pode parecer diferente dependendo das tags.',
  'help.library.steps':
    'Abra Biblioteca e adicione a pasta com suas mídias. Deixe a leitura terminar antes de avaliar o que está faltando.\nEscolha um artista ou álbum, ou busque uma música. Inicie uma faixa nos resultados.\nUse a barra na parte de baixo da janela para pausar, mudar a posição e pular. O volume dela é um nível único para todos os players.',
  'help.library.tip':
    'Passe o mouse sobre o botão do FluidEQ na barra de tarefas do Windows para ter Anterior, Reproduzir e Seguinte, mesmo com ele minimizado. A Biblioteca precisa dos arquivos originais: reconecte uma unidade ou adicione de novo uma pasta que foi movida.',

  'help.queue.title': 'Álbuns e fila de reprodução',
  'help.queue.intro':
    'A fila define a ordem de escuta. Abrir outro álbum permite explorar sem trocar a música atual. A faixa ativa e A seguir ajudam a acompanhar.',
  'help.queue.steps':
    'Abra um álbum para ver as faixas dele e inicie a que você quer ouvir.\nClique com o botão direito em uma música para Adicionar à fila, Adicionar aos Favoritos ou Adicionar a uma playlist.\nAbra A seguir para ver o que toca depois e ative Continuar a tocar para seguir com mais do mesmo gênero.',
  'help.queue.tip':
    'Iniciar a reprodução da Biblioteca assume o lugar dos outros players do FluidEQ. Use a faixa atual mostrada na barra para confirmar qual fonte está com a reprodução.',

  'help.karaoke.title': 'Cante com Karaoke',
  'help.karaoke.intro':
    'Karaoke combina áudio e letras locais. Letras sincronizadas seguem a reprodução; alvos de afinação exigem dados de notas. Um microfone configurado acrescenta sua afinação ao vivo.',
  'help.karaoke.steps':
    'Abra Karaoke e use Adicionar arquivos ou pasta para áudio e letras correspondentes.\nSelecione uma música, reproduza e confira o pareamento.\nConfigure o microfone, ajuste o tamanho das letras e use a tela cheia do palco.',
  'help.karaoke.tip':
    'Um arquivo só de letras não tem notas-alvo. O Karaokê segue o Volume do app; os níveis da melodia, da base e da voz guia ficam em Definições de mistura.',

  'help.maker.title': 'Crie no Karaoke Maker',
  'help.maker.intro':
    'Maker transforma áudio em um projeto editável com letras e notas na linha do tempo. Confira palavras e tempos gerados automaticamente.',
  'help.maker.steps':
    'Abra Criar em Karaoke e carregue o áudio. Escolha as ferramentas de separação ou transcrição necessárias.\nAcompanhe o progresso; o primeiro uso de IA pode baixar modelos. Revise letras e notas.\nOuça pequenos trechos, corrija texto e tempos, salve o projeto e exporte os arquivos.',
  'help.maker.tip':
    'Modelos exigem conexão e espaço. O tempo depende do computador e da música. Use áudio autorizado e revise antes de compartilhar.',

  'help.share.title': 'Compartilhe áudio entre computadores',
  'help.share.intro':
    'Compartilhar áudio envia som do sistema entre computadores da mesma rede privada. O receptor tem os fones ou alto-falantes; os outros enviam. É diferente de espelhar para outro dispositivo no mesmo computador.',
  'help.share.steps':
    'No computador de escuta, abra Compartilhar áudio, escolha Reproduzir áudio neste computador e pressione Criar código de conexão. Comece com volume baixo.\nEm cada computador de origem, escolha Enviar o áudio deste computador, selecione Música ou Jogo/Vídeo, cole o código da sua rede e pressione Conectar e enviar.\nAcompanhe o monitor de conexão. Pressione Parar de enviar ou Parar de ouvir ao terminar; Criar novo código desconecta todos os pareamentos salvos.',
  'help.share.tip':
    'Mantenha o código de conexão privado: ele autoriza o pareamento. Vários emissores se misturam e elevam o nível, e o Volume do receptor o ajusta. Com o Motor FluidEQ, o áudio recebido também passa pelo rack DSP.',

  'help.trouble.title': 'Quando o som está errado',
  'help.trouble.intro':
    'Comece pela fonte e pela saída, depois isole a camada. Um gráfico, um preset salvo ou um interruptor ativado não provam, sozinhos, que o som chegou ao dispositivo certo. O menu Ajuda também leva à solução de problemas de áudio, ao relato de problemas e ao Fórum.',
  'help.trouble.steps':
    'Sem som: confirme que a reprodução está rodando, que a saída esperada está selecionada, que o volume está alto e que o dispositivo está conectado. Veja se Um reprodutor de cada vez pausou outra fonte.\nSem efeito do EQ: confirme que o EQ do sistema está ligado e que a saída não mostra o selo DESLIG. Se mostrar, pressione Ativar. Se um aviso disser que o motor não está funcionando, pressione Reiniciar o áudio do Windows.\nDistorção ou graves demais: deixe Normalizar automaticamente ligado, reduza os reforços e desative as camadas uma por vez. Se continuar, use Relatar um problema e revise o relatório antes de enviar.',
  'help.trouble.tip':
    'F1 abre este guia. Esc fecha uma captura ampliada e depois o guia. Se a interface estiver grande demais, Ctrl + 0 restaura o zoom. Processos, no menu de ações, mostra o que cada parte do FluidEQ está fazendo.',

  'help.forum.title': 'Pergunte no Fórum',
  'help.forum.intro':
    'O Fórum traz o GitHub Discussions do FluidEQ para dentro do app: anúncios, ideias, perguntas e ajustes de que as pessoas se orgulham. Qualquer um pode ler; para publicar, você usa sua conta do GitHub, não uma do FluidEQ.',
  'help.forum.steps':
    'Abra Ajuda → Fórum e escolha uma categoria: Anúncios, Geral, Ideias, Votações, Q&A ou Mostra o teu som.\nPesquise no fórum ou abra um tópico para ler as respostas.\nPressione Iniciar sessão com GitHub, termine no navegador e depois publique um Novo tópico ou uma resposta.',
  'help.forum.tip':
    'Tudo o que é publicado fica público no GitHub, com seu nome do GitHub. Em Q&A, marque a resposta que funcionou para que a próxima pessoa a encontre.',
};

export default help;
