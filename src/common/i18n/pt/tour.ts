/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Por favor, contribua',
  'tour.rainbow.title': 'Boas-vindas ao modo arco-íris',
  'tour.rainbow.subtitle': 'Ative com um clique',
  'tour.rainbow.lead':
    'Cores do arco-íris, detalhes luminosos e uma borda que percorre o espectro — e movimento mais suave: o gráfico, os medidores e a onda são desenhados na taxa de atualização total da sua tela em vez de trinta quadros por segundo. O seu som nunca muda.',
  'tour.rainbow.how':
    'Ative aqui imediatamente, sem alcançar ×10. Sua escolha fica salva e você pode desativar quando quiser. Contribuir é opcional.',
  'tour.rainbow.enable': 'Ativar o modo arco-íris',
  'tour.rainbow.disable': 'Desativar o modo arco-íris',
  'tour.rainbow.waveform': 'Prévia da onda superior',
  'tour.rainbow.toggleHint':
    'Clique no botão “RAINBOW MODE” acima para ativar ou desativar o modo.',
  'tour.eyebrow': 'NOVIDADES DESTA VERSÃO',
  'tour.title': 'Novidades do FluidEQ',
  'tour.close': 'Fechar',
  'tour.rail': 'Novos recursos',
  'tour.stepOf': '{current} de {total}',
  'tour.back': 'Voltar',
  'tour.next': 'Avançar',
  'tour.done': 'Entendi',
  'tour.dontShowAgain': 'Não mostrar de novo nesta versão',
  'tour.releaseNotes': 'Notas da versão completas',
  'tour.rail.newIn': 'NOVIDADES DA {version}',
  'tour.rail.always': 'TAMBÉM NO FLUIDEQ',
  'tour.newBadge': 'NOVO',
  'tour.howTitle': 'Como começar',
  'tour.beta': 'Beta',
  'tour.player.kicker': 'O PLAYER COMPACTO',
  'tour.player.title': 'O FluidEQ, recolhido em um player',
  'tour.player.subtitle': 'Um botão transforma a janela em um player',
  'tour.player.lead':
    'Um botão na barra de título transforma a janela no Player compacto: a música, seu equalizador, um visualizador e “A seguir” em uma coluna estreita. O mesmo botão leva você de volta à página em que estava.',
  'tour.player.point1':
    'O equalizador inteiro vai junto: presets, layouts de bandas, Modo EQ, EQ inteligente, Graves, Médios e Agudos.',
  'tour.player.point2':
    'Recolha-o em uma linha, mantenha-o acima das outras janelas ou clique duas vezes no visualizador para tela cheia.',
  'tour.player.point3':
    'Um tema Claro ou Escuro próprio, e as músicas soltas em “A seguir” entram na Biblioteca e na fila.',
  'tour.player.how':
    'Pressione o botão Player compacto na barra de título, ao lado de Ajuda. No player, o mesmo botão traz o app completo de volta.',
  'tour.player.open': 'Experimentar o Player compacto',
  'tour.player.imageAlt':
    'O Player compacto duas vezes, nos temas Escuro e Claro: a música e seu relógio no topo, o equalizador com quinze bandas, “A seguir” embaixo; e o mesmo player recolhido em uma linha.',
  'tour.games.kicker': 'PRESETS DE JOGO',
  'tour.games.title': 'Cada jogo com seu próprio som',
  'tour.games.subtitle': 'Aplicado quando o jogo vem para a frente',
  'tour.games.lead':
    'Escolha uma vez um som para cada jogo. Quando o jogo vem para a frente, o FluidEQ muda para esse som e o mantém até você fechar o jogo, por mais que você use Alt+Tab, e depois restaura o que você tinha.',
  'tour.games.point1':
    'Jogos de Steam, Epic Games, EA, GOG, Ubisoft, Battle.net e Xbox, ou qualquer programa que esteja aberto.',
  'tour.games.point2':
    'Os presets de jogo ativam o Modo jogo, que reduz o atraso que o FluidEQ acrescenta, e a página mostra esse atraso medido.',
  'tour.games.point3':
    'Um cartão na sua área de trabalho diz o que foi trocado, e outro diz o que voltou quando o jogo fechou.',
  'tour.games.how':
    'Abra EQ, escolha Presets de jogo e pressione Adicionar um jogo. Depois, escolha o som do jogo no seletor da linha dele.',
  'tour.games.open': 'Abrir Presets de jogo',
  'tour.games.imageAlt':
    'A página Presets de jogo com quatro jogos, cada um com seu próprio som, e os cartões que o FluidEQ mostra na área de trabalho quando um jogo vem para a frente e quando ele fecha.',
  'tour.presets.kicker': 'NOVOS PRESETS',
  'tour.presets.title': 'Presets que soam como a música',
  'tour.presets.subtitle': 'Cadeias inteiras, todas no mesmo volume',
  'tour.presets.lead':
    'Cada preset foi medido de novo e nivelado: trocar muda o caráter, não o volume, e agora cada um soa tão claro com o Motor FluidEQ quanto com o Equalizer APO.',
  'tour.presets.point1':
    '{chains} cadeias, {styles} delas de estilos musicais, mais cópias para a Sala de Música, Cinema e Jogos.',
  'tour.presets.point2':
    'A curva de um preset aparece no gráfico como uma camada própria, com uma intensidade que você pode diminuir.',
  'tour.presets.point3':
    'Cada estilo se explica: aponte para um e as notas dele se abrem ao lado da lista.',
  'tour.presets.how':
    'Abra EQ e pressione Presets, ou escolha uma cadeia no topo do DSP.',
  'tour.presets.open': 'Abrir EQ',
  'tour.presets.imageAlt':
    'O seletor de presets com Rock escolhido e as notas dele ao lado da lista: a curva com pontos numerados, para que serve cada ponto e em que volume ele toca.',
  'tour.tone.kicker': 'CONTROLES DE TOM',
  'tour.tone.title': 'Graves, Médios e Agudos, como em um amplificador',
  'tour.tone.subtitle': 'Três botões com curva própria',
  'tour.tone.lead':
    'Sem nenhuma banda selecionada, Graves, Médios e Agudos moldam o som como uma curva própria, com um corte de graves e um de agudos nas laterais: o jeito mais rápido de deixar uma música mais quente ou mais brilhante, e cada banda fica do jeito que você deixou.',
  'tour.tone.point1':
    'O equalizador abre no rack inteiro, sem nada selecionado.',
  'tour.tone.point2':
    'Um novo layout de vinte bandas, e todos os layouts nas frequências padrão.',
  'tour.tone.point3':
    'As bandas se abrem tão largas quanto o espaçamento: sem buracos entre elas e sem duas na mesma nota.',
  'tour.tone.how':
    'Abra EQ sem nenhuma banda selecionada e gire Graves, Médios ou Agudos. Ctrl+clique em um botão para deixar o terço dele plano de novo.',
  'tour.tone.open': 'Abrir EQ',
  'tour.tone.imageAlt':
    'A curva do equalizador nos seus terços de graves, médios e agudos, os três botões que os movem e os layouts rápidos de seis a trinta e uma bandas.',
  'tour.studio.kicker': 'FLUIDEQ PLUS',
  'tour.studio.title': 'Crie seu próprio visualizador',
  'tour.studio.subtitle': 'Grátis por 15 dias, ou ganhe um mês',
  'tour.studio.lead':
    'O Estúdio transforma uma ideia em uma cena que se move com sua música. Agora ele faz parte do Plus, e uma conta nova pode experimentá-lo grátis por quinze dias, sem cartão e sem nenhuma cobrança quando o teste terminar.',
  'tour.studio.point1':
    'Publique uma cena e, quando ela for aprovada, seu próximo mês de Plus é grátis.',
  'tour.studio.point2':
    'A cena de cada membro é revisada antes de chegar à galeria.',
  'tour.studio.point3':
    'Tudo o que você fez antes continua guardado, na pasta que o Estúdio indica.',
  'tour.studio.how':
    'Abra Plus e escolha Estúdio na barra lateral. Sem o Plus, a página ali oferece o teste gratuito.',
  'tour.studio.open': 'Abrir Plus',
  'tour.studio.imageAlt':
    'Uma aurora sobre montanhas feita no Estúdio, a ideia que a originou, o teste de quinze dias e o mês que uma cena aprovada rende.',
  'tour.studio.idea':
    'Aurora boreal sobre um lago de montanha. Os graves fazem a aurora crescer e as estrelas piscam na batida.',
  'tour.studio.earned': 'Aprovada: próximo mês grátis',
  'tour.help.kicker': 'AJUDA',
  'tour.help.title': 'Pergunte ao guia com suas palavras',
  'tour.help.subtitle': 'Erros de digitação, plurais e dez idiomas',
  'tour.help.lead':
    'Busque no guia do jeito que você perguntaria a um amigo — “sem som”, “limitador”, “papel de parede” — em qualquer um dos dez idiomas. O melhor capítulo vem primeiro, e o guia leva você ao controle, circulado na captura.',
  'tour.help.point1':
    'Ele perdoa erros de digitação e plurais, e conhece as palavras que as pessoas usam para as coisas.',
  'tour.help.point2':
    'Cada controle em uma captura é numerado como em um manual impresso, e as capturas acompanham o seu tema.',
  'tour.help.point3':
    'F1 abre o guia de qualquer lugar, e Enter vai para o próximo resultado.',
  'tour.help.how':
    'Pressione F1, ou abra o livro na barra de título e escolha Guia do usuário; depois, digite o que você procura.',
  'tour.help.open': 'Abrir a Ajuda',
  'tour.help.imageAlt':
    'O guia do usuário com a busca “sem som”: os capítulos ordenados com as palavras marcadas, e uma captura com os controles numerados.',
  'tour.help.query': 'sem som',

  'tour.engine.kicker': 'NOSSO PRÓPRIO MOTOR DE ÁUDIO',
  'tour.engine.title': 'Conheça o Motor FluidEQ',
  'tour.engine.subtitle': 'EQ e DSP para tudo o que você ouve',
  'tour.engine.lead':
    'O FluidEQ agora tem um motor de áudio próprio. Ele roda dentro do serviço de áudio do Windows, depois dos efeitos da sua placa de som, e leva seu EQ e todo o rack DSP a tudo o que o computador toca: jogos, navegadores e apps de streaming, não só a Biblioteca.',
  'tour.engine.point1':
    'O rack DSP em todo o áudio do sistema, sem nada tocando no FluidEQ.',
  'tour.engine.point2':
    'Nivelamento ao vivo que sabe qual é a música, e Redução de ruído que limpa o som enquanto ele toca.',
  'tour.engine.point3':
    'Saia do FluidEQ e seu som volta ao normal na hora, mesmo depois de um travamento.',
  'tour.engine.how':
    'Escolha o Motor FluidEQ ao instalar, ou abra o menu de ações no ícone de pulso do canto superior direito, pressione o cartão do motor no topo, escolha Motor FluidEQ e pressione Aplicar. Depois abra a aba DSP e ligue um estágio com qualquer app tocando.',
  'tour.engine.open': 'Abrir DSP',
  'tour.engine.flow.label':
    'Tudo o que o computador toca passa pelo Motor FluidEQ (primeiro seu EQ, depois o rack DSP) a caminho dos seus fones de ouvido e alto-falantes.',
  'tour.engine.flow.games': 'Jogos',
  'tour.engine.flow.browser': 'Navegadores',
  'tour.engine.flow.music': 'Apps de música',
  'tour.engine.flow.video': 'Vídeos',
  'tour.engine.flow.inside': 'Dentro do áudio do Windows',
  'tour.engine.flow.eq': 'Seu EQ',
  'tour.engine.flow.rack': 'Rack DSP',
  'tour.engine.flow.headphones': 'Fones de ouvido',
  'tour.engine.flow.speakers': 'Alto-falantes',

  'tour.room.kicker': 'SURROUND NOS FONES DE OUVIDO',
  'tour.room.title': 'Sente-se na Sala',
  'tour.room.subtitle': 'Vinte e quatro salas, todas gratuitas',
  'tour.room.lead':
    'A Sala transforma seus fones de ouvido em uma sala de escuta, cada canal um alto-falante ao seu redor. Treze salas novas se juntam às onze clássicas, cada uma diferenciada por medição, e tudo isso é gratuito.',
  'tour.room.point1':
    'O estéreo vira dois alto-falantes à sua frente, ou enche a sala se você pedir; um filme 5.1, cinco e o sub; um jogo 7.1, o anel inteiro.',
  'tour.room.point2':
    'Escolha uma sala em “Em destaque”, “Salas clássicas” ou “Seus”; tudo o que compõe uma sala está na página dela.',
  'tour.room.point3':
    'Um teste de escuta escolhe de ouvido a cabeça que põe os sons à sua frente, em cinco pares.',
  'tour.room.how':
    'Abra DSP, escolha Sala na barra e ligue-a. Escolha uma sala, depois arraste um alto-falante ou gire um botão; em “Sua cabeça”, pressione “Começar o teste de escuta”.',
  'tour.room.open': 'Abrir a Sala',
  'tour.room.imageAlt':
    'Uma sala vista de cima: sete alto-falantes e um sub ao redor de uma cabeça no centro, cada um com o seu caminho até os ouvidos.',

  'tour.plus.kicker': 'FLUIDEQ PLUS',
  'tour.plus.title': 'Boas-vindas ao FluidEQ Plus',
  'tour.plus.subtitle': 'Visualizadores, Estúdio, iluminação e mais',
  'tour.plus.lead':
    'Uma assinatura opcional que mantém o FluidEQ crescendo, com uma aba nova só para ela: cenas desenhadas na sua placa de vídeo, um Estúdio para criar as suas, a Classificação, fundos da área de trabalho e a Iluminação dinâmica. O equalizador, o rack e os players continuam gratuitos, como sempre foram.',
  'tour.plus.point1':
    'Entre pelo painel Conta, no menu de ações; o pagamento é feito no seu navegador e o Plus é ativado sozinho.',
  'tour.plus.point2':
    'Mensal ou anual, com termos em linguagem simples antes de você pagar. O app nunca vê seu cartão.',
  'tour.plus.point3':
    'Conta conectada em até cinco computadores, com novos visualizadores adicionados ao longo do tempo.',
  'tour.plus.how':
    'Abra a aba Plus: Classificação, Visualizadores, Estúdio e Iluminação dinâmica ficam do lado esquerdo.',
  'tour.plus.open': 'Abrir Plus',
  'tour.plus.imageAlt':
    'A aba Plus: Classificação, Visualizadores, Estúdio e Iluminação dinâmica na lateral, e a galeria de Visualizadores com Cromo, Floração, Aurora, Alpino e Cidade de neon.',
  'tour.scene.alpine': 'Alpino',
  'tour.scene.aurora': 'Aurora',
  'tour.scene.bloom': 'Floração',
  'tour.scene.chrome': 'Cromo',
  'tour.scene.neonCity': 'Cidade de neon',

  'tour.visualizers.kicker': 'VISUALIZADORES',
  'tour.visualizers.title': 'Cenas que se movem com sua música',
  'tour.visualizers.subtitle': 'Desenhadas na sua placa de vídeo',
  'tour.visualizers.lead':
    'Os visualizadores Plus são cenas vivas (montanhas sob as estrelas, cortinas de aurora, uma cidade neon) desenhadas na sua placa de vídeo, por baixo das curvas do seu EQ. Os graves, a batida e os agudos movem, cada um, algo diferente, e a janela em volta pode assumir as cores delas.',
  'tour.visualizers.point1':
    'Um só seletor para tudo: 28 estilos gratuitos para moldar e colorir, e visualizadores Plus por categoria.',
  'tour.visualizers.point2':
    'Explore a galeria, experimente as amostras do FluidEQ por dez segundos e adicione as cenas de que gostar.',
  'tour.visualizers.point3':
    'Troque de visual automaticamente, use a tela cheia e ajuste o ataque e a liberação de uma cena em Visualização.',
  'tour.visualizers.how':
    'Clique no nome do visual no gráfico e escolha uma cena em Visualizadores Plus, ou veja todas em Plus → Visualizadores.',
  'tour.visualizers.open': 'Abrir EQ',
  'tour.visualizers.imageAlt':
    'Alpino, um visualizador Plus de montanhas sobre um lago à noite, tocando no gráfico por baixo das curvas do EQ, com mais quatro cenas abaixo.',

  'tour.desktop.kicker': 'VISUALIZADOR DA ÁREA DE TRABALHO',
  'tour.desktop.title': 'Sua música no fundo da área de trabalho',
  'tour.desktop.subtitle': 'Uma cena em cada monitor',
  'tour.desktop.lead':
    'Coloque um visualizador Plus atrás dos ícones da área de trabalho. Ele se move com o que você estiver ouvindo, ou calmamente por conta própria, e cada monitor pode mostrar uma cena própria.',
  'tour.desktop.point1':
    'Escolha os monitores em um mapa da sua mesa, cada um com seu próprio visualizador.',
  'tour.desktop.point2':
    'Fica em pausa enquanto as janelas cobrem o monitor, com o PC bloqueado e na bateria.',
  'tour.desktop.point3': 'Volta sozinho na próxima vez que o FluidEQ iniciar.',
  'tour.desktop.how':
    'Com um visualizador Plus no gráfico, pressione o botão de monitor ao lado do nome dele ou escolha Visualização → Definir como fundo da área de trabalho.',
  'tour.desktop.open': 'Abrir EQ',
  'tour.desktop.imageAlt':
    'Três monitores, cada um mostrando um visualizador Plus (Aurora, Alpino e Cidade de neon) atrás dos ícones da área de trabalho e da barra de tarefas.',

  'tour.lighting.kicker': 'ILUMINAÇÃO DINÂMICA',
  'tour.lighting.title': 'Sua mesa acende com a cena',
  'tour.lighting.subtitle':
    'Beta · seus dispositivos RGB seguem o visualizador',
  'tour.lighting.lead':
    'Seu teclado, mouse, mousepad, headset e suporte ganham as cores e o ritmo do visualizador Plus no gráfico, pelo Windows Dynamic Lighting e pelo Razer Chroma.',
  'tour.lighting.point1':
    'Quatro estilos para cada visualizador: Cena, Onda de cor, Espectro e Onda rítmica.',
  'tour.lighting.point2':
    'Ajuste cada dispositivo separadamente e escolha o que acontece quando a música para.',
  'tour.lighting.point3':
    'Uma prévia ao vivo desenha sua própria mesa enquanto ela acende. Está em beta: conte para nós como seus dispositivos se comportam.',
  'tour.lighting.how':
    'Abra Plus → Iluminação dinâmica e ative-a; depois coloque um visualizador Plus no gráfico.',
  'tour.lighting.open': 'Abrir Plus',
  'tour.lighting.imageAlt':
    'Um teclado, um mouse e um mousepad iluminados no rosa, violeta e ciano da cena Cidade de neon.',

  'tour.theme.kicker': 'UM NOVO VISUAL',
  'tour.theme.title': 'Conheça o tema Escuro',
  'tour.theme.subtitle': 'Quase preto, para as madrugadas e telas OLED',
  'tour.theme.lead':
    'O FluidEQ agora tem uma segunda cara. O tema Escuro remove todo traço do azul-ardósia com que o app nasceu: painéis, menus e barras ficam monocromáticos, o destaque permanece e o espectro é a única cor na sala.',
  'tour.theme.point1':
    'Fundos quase pretos: em uma tela OLED, o espaço ao redor do gráfico fica quase escuro.',
  'tour.theme.point2':
    'Todas as páginas acompanham: menus, diálogos, o palco do karaokê e a Biblioteca mudam juntos. O Player compacto mantém um tema próprio.',
  'tour.theme.point3':
    'Sua cor de destaque e o modo arco-íris continuam. Nada no seu som muda: é só a pintura.',
  'tour.theme.howTitle': 'Como trocar',
  'tour.theme.how':
    'Abra o menu do ícone de pulso no canto superior direito e escolha Escuro ao lado de Tema, nas configurações da parte de baixo do menu. O tema Claro fica a um clique se você quiser voltar.',
  'tour.theme.tryBlack': 'Mudar para Escuro agora',
  'tour.theme.tryOcean': 'Voltar ao Claro',
  'tour.theme.imageAlt':
    'FluidEQ no tema Escuro: a aba EQ com quinze bandas e o espectro ao vivo tocando uma música.',

  'tour.share.kicker': 'OUÇA TODOS OS SEUS PCS',
  'tour.share.title': 'Compartilhe áudio entre seus computadores',
  'tour.share.subtitle': 'Um fone, todas as máquinas da sua mesa',
  'tour.share.lead':
    'Seu PC de jogos, o notebook do trabalho e a central de mídia tocam no fone que você está usando: pela sua própria rede, sem perdas, criptografado e pelo EQ que você já ajustou.',
  'tour.share.receiverLabel': 'RECEPTOR',
  'tour.share.receiverName': 'O PC com seu fone',
  'tour.share.senderLabel': 'EMISSORES',
  'tour.share.senderName': 'Todos os outros computadores',
  'tour.share.wireLabel': 'Sem perdas · Criptografado · LAN privada',
  'tour.share.stepsTitle': 'Configure em três passos',
  'tour.share.step1Title': 'No PC do fone, crie um código',
  'tour.share.step1':
    'Abra a aba Compartilhar áudio, escolha “Reproduzir áudio neste computador” e pressione “Criar código de conexão”. Copie o código da sua rede.',
  'tour.share.step2Title': 'Em cada outro PC, cole o código',
  'tour.share.step2':
    'Abra o FluidEQ lá, vá em Compartilhar áudio, escolha “Enviar o áudio deste computador”, cole o código e pressione “Conectar e enviar”. O áudio do sistema começa a fluir, intacto: os efeitos são aplicados no computador em que você ouve.',
  'tour.share.step3Title': 'Ouça e ajuste o nível',
  'tour.share.step3':
    'Cada emissor toca com um buffer curto que se recupera sozinho depois de um engasgo. Todos os emissores são mixados na saída do receptor e moldados pelo EQ dele. A barra de reprodução do receptor mostra a música do emissor mais recente, e os botões dela funcionam pela rede.',
  'tour.share.fact1Title': 'Sem perdas',
  'tour.share.fact1':
    'PCM Float32 de ponta a ponta. Sem codec, sem perda de geração.',
  'tour.share.fact2Title': 'Criptografado',
  'tour.share.fact2':
    'AES-256-GCM em cada pacote. O código é a chave; sem ele ninguém consegue ouvir.',
  'tour.share.fact3Title': 'Fica pareado',
  'tour.share.fact3':
    'O pareamento sobrevive a fechamentos e reinicializações. Só criar um código novo desconecta.',
  'tour.share.tip':
    'Comece baixo: vários computadores somam rápido. Abaixe o volume do fone antes da primeira conexão.',
  'tour.share.open': 'Abrir Compartilhar áudio',

  'tour.library.kicker': 'SUA MÚSICA, SEU PLAYER',
  'tour.library.title': 'Uma Biblioteca para a música que você tem',
  'tour.library.subtitle': 'Entram pastas, saem álbuns',
  'tour.library.lead':
    'Aponte o FluidEQ para uma pasta e ele lê cada música e vídeo dentro dela, com tags e capas, e transforma tudo em uma coleção que você navega por álbum, artista, gênero, música ou pasta. A reprodução passa pelo player do próprio FluidEQ, então o EQ e o rack DSP estão sempre no caminho.',
  'tour.library.point1':
    'Três jeitos de ver a mesma estante: lista, grade e cover flow, com salto por letra para coleções grandes.',
  'tour.library.point2':
    'Uma fila “A seguir” com “Continuar tocando”, que segue com mais do mesmo gênero quando a lista acaba.',
  'tour.library.point3':
    'Playlists e uma lista de Favoritos permanente. Clique com o botão direito em qualquer música para adicioná-la a uma delas, ou à fila.',
  'tour.library.point4':
    'Memória por música do EQ inteligente: enquanto o EQ inteligente continua medindo, ligue “Salvar para esta música”, e depois de dois minutos a correção dele fica salva para aquela faixa e volta quando ela tocar de novo.',
  'tour.library.how':
    'Abra a aba Biblioteca, pressione “Adicionar pasta” ou solte uma pasta na página e espere a leitura terminar. Escolha Álbuns, Artistas, Gêneros, Músicas, Pastas ou Árvore e pressione Reproduzir.',
  'tour.library.open': 'Abrir Biblioteca',

  'tour.dsp.kicker': 'UM RACK DE MASTERIZAÇÃO',
  'tour.dsp.title': 'O rack DSP',
  'tour.dsp.subtitle': 'Dez estágios, cada um em sua própria página',
  'tour.dsp.lead':
    'Um rack de estágios de estúdio: Normalizador, Redução de ruído, Excitador, Forja de graves, Equalizador, Punch dos graves, Dimensão, Sala, Maximizador e Master, mais uma transição cruzada entre faixas da Biblioteca. Com o Motor FluidEQ, ele funciona em tudo o que o computador toca; com o Equalizer APO, na Biblioteca. Cada estágio tem sua própria página com uma visualização ao vivo, a maioria tem presets, e cinco têm um interruptor Isolar para ouvir só o que estão fazendo.',
  'tour.dsp.point1':
    'A Redução de ruído corrige chiado, zumbido e estalos durante a reprodução, e um limpador de voz neural funciona nas faixas da Biblioteca.',
  'tour.dsp.point2':
    'A Forja de graves adiciona uma oitava real abaixo do baixo; o Punch dos graves molda o ataque, a sustentação e a floração, com Mistura de até 200%.',
  'tour.dsp.point3':
    'Um Equalizador paramétrico de 6 a 31 bandas, quinze para começar, com fase mínima ou linear, mid/side, oversampling e mais de cem presets nomeados.',
  'tour.dsp.point4':
    'Master com alvo de loudness LUFS e proteção true-peak, presets de entrega de Streaming a Vinil, e o controle Igualar ganho, para comparar som, não volume.',
  'tour.dsp.how':
    'Abra a aba DSP, escolha uma cadeia em Presets, depois clique em um estágio nas abas laterais e ligue-o. Com o Equalizer APO, toque antes uma faixa da Biblioteca.',
  'tour.dsp.open': 'Abrir DSP',

  'tour.output.kicker': 'TOCA EM DOIS LUGARES',
  'tour.output.title': 'Perfis da segunda saída',
  'tour.output.subtitle':
    'Fone e caixas ao mesmo tempo, cada um com seu perfil',
  'tour.output.lead':
    'Ouça no headset e nos alto-falantes com EQs separados. A segunda saída recebe o som antes do EQ da saída principal e aplica seu próprio perfil salvo. Não é necessário um driver de roteamento.',
  'tour.output.point1':
    'Ative outro dispositivo em Segunda saída e ajuste seu volume.',
  'tour.output.point2':
    'Use o seletor de perfil de EQ abaixo do dispositivo para escolher um dos perfis salvos para ele. A saída principal mantém sua regulagem.',
  'tour.output.point3':
    'Um reprodutor de cada vez: iniciar algo no FluidEQ pausa o resto da máquina, e vice-versa.',
  'tour.output.point4':
    'Jogo/Vídeo começa com cerca de 30 ms de reserva e se sincroniza após uma interrupção; Música começa com cerca de 100 ms para uma reprodução mais suave. O buffer do dispositivo acrescenta atraso.',
  'tour.output.how':
    'Abra a aba EQ e expanda Segunda saída à direita. Ative um dispositivo, escolha seu perfil de EQ abaixo do nome, ajuste o volume e selecione Jogo/Vídeo ou Música.',
  'tour.output.open': 'Abrir EQ',
  'tour.output.imageAlt':
    'O painel Segunda saída com o BlackShark V2 Pro ativado, seu seletor de perfil de EQ, volume e os modos Jogo/Vídeo e Música.',

  'tour.looks.kicker': 'SEU PRÓPRIO VISUALIZADOR',
  'tour.looks.title': 'Visuais próprios para o gráfico',
  'tour.looks.subtitle': 'Vinte e oito formas, suas cores, seu movimento',
  'tour.looks.lead':
    'O espectro abaixo do EQ pode ser desenhado do jeito que você quiser. Escolha uma de vinte e oito formas, de barras e linhas simples a terraços, horizontes e uma ponte à noite com trânsito; pinte com a coloração Auto da própria forma, por frequência, por nível ou por calor; defina a rapidez do ataque e quanto tempo um pico fica no ar; e marque os picos com faíscas, cometas ou ondulações. Salve como um visual seu e compartilhe como arquivo.',
  'tour.looks.point1':
    'Vinte e oito formas, cada uma com seus controles: peças, espaço, preenchimento, espessura, e se é preenchida ou traçada.',
  'tour.looks.point2':
    'Pinte cada forma com a coloração Auto dela, por frequência, nível ou calor com uma rampa das suas próprias cores, ou com uma única cor chapada.',
  'tour.looks.point3':
    'Ataque e liberação definem o movimento; picos iluminados, picos preenchidos e doze marcas de pico definem como um golpe aparece.',
  'tour.looks.point4':
    'O Brilho funciona em todos os modos, e o modo arco-íris adiciona uma borda que percorre toda a roda de cores. Visuais exportam para um arquivo e importam de um.',
  'tour.looks.how':
    'Na aba EQ, pressione “Novo visual” na barra do gráfico. Escolha uma forma no seletor ou pressione Espaço para percorrê-las, ajuste cores e movimento com a música tocando e depois Salvar.',
  'tour.looks.open': 'Abrir EQ',

  'tour.karaoke.kicker': 'UM PALCO EM CASA',
  'tour.karaoke.title': 'Karaokê com guia de afinação',
  'tour.karaoke.subtitle': 'Suas músicas, suas letras, seu microfone',
  'tour.karaoke.lead':
    'Solte uma música com ou sem arquivo de letra e o FluidEQ os pareia em uma playlist, mostra a letra sincronizada sobre a capa ou o vídeo, ouve seu microfone e desenha sua afinação contra a melodia. Tudo fica neste computador; o microfone nunca é gravado nem reproduzido.',
  'tour.karaoke.point1':
    'Um controle de Voz guia, depois que o FluidEQ separar a voz da música no Criador: vai da base sozinha até o original completo, sem precisar de um arquivo instrumental.',
  'tour.karaoke.point2':
    'Uma pista de afinação: as notas da música como blocos e sua voz como uma linha ao vivo sobre elas, com aviso de Alto, Afinado e Baixo.',
  'tour.karaoke.point3':
    'Uma revisão da performance no fim, listando as partes para praticar, com contagem para outra tentativa.',
  'tour.karaoke.point4':
    'Lê LRC, LRC aprimorado com tempo por palavra e UltraStar com sílabas e afinação, sobre MP3, FLAC, WAV, OGG, M4A e mais. Letras traduzidas e acordes de violão estimados vêm junto.',
  'tour.karaoke.how':
    'Abra a aba Karaokê, pressione “Abrir música” ou “Adicionar pasta”, escolha uma faixa na playlist, ligue o microfone, mostre o guia de afinação e pressione Reproduzir.',
  'tour.karaoke.open': 'Abrir Karaokê',

  'tour.maker.kicker': 'FAÇA O SEU',
  'tour.maker.title': 'O Criador de karaokê',
  'tour.maker.subtitle': 'Qualquer música vira um arquivo de karaokê',
  'tour.maker.lead':
    'Um estúdio de criação completo dentro da aba Karaokê. Ele pode fazer todo o trabalho sozinho: separar a voz da música, ler as palavras e seus tempos com um modelo de fala local e detectar as notas da melodia. Ou você marca, grava e desenha cada tempo à mão em uma linha do tempo com zoom. Tudo roda neste computador.',
  'tour.maker.point1':
    '“Preparar esta música automaticamente”: separa a voz e depois lê as palavras e os tempos, com opção de continuar em segundo plano.',
  'tour.maker.point2':
    'Fique com as faixas separadas: a voz e a base, cada uma salvável, inclusive como MP3.',
  'tour.maker.point3':
    'Ferramentas manuais para os detalhes: marcar palavras, gravar entradas de linha, um inspetor de palavra com início e duração, e dividir uma palavra em sílabas.',
  'tour.maker.point4':
    'Pinte a melodia numa grade de afinação, marque notas douradas e exporte como projeto FluidEQ, UltraStar TXT, LRC, LRC aprimorado ou base sem voz.',
  'tour.maker.how':
    'No Karaokê, carregue uma música e pressione “Criar”. Aceite “Preparar automaticamente” no assistente, corrija as palavras na linha do tempo, depois “Usar no player” e “Exportar”.',
  'tour.maker.open': 'Abrir Karaokê',

  'tour.media.kicker': 'A WEB, PELO SEU EQ',
  'tour.media.title': 'Mídia online',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch e Suno',
  'tour.media.lead':
    'Um player embutido para os sites de streaming, para que o que você assiste e ouve online passe pelo seu EQ em vez de por outro navegador. Cinco sites vêm prontos, cada um com sua busca, e links que levam para fora são retidos com a opção “Abrir no navegador”.',
  'tour.media.point1':
    'Um único campo de busca que pesquisa no site que estiver aberto, com buscas recentes que você pode apagar.',
  'tour.media.point2':
    'Faça login uma vez: o player mantém seus logins entre as visitas até você sair.',
  'tour.media.point3':
    'Retomar: o player lembra a última página e onde você estava nela, e leva você de volta.',
  'tour.media.point4':
    'Downloads com indicador de progresso e “Mostrar na pasta” ao terminar, e um botão de sair, a porta no fim da barra de ferramentas, que limpa todos os cookies e logins de uma vez.',
  'tour.media.how':
    'Abra a aba Mídia online, escolha um site na fileira de cima, digite no campo de busca e pressione Buscar. Voltar, Avançar e Recarregar funcionam como em um navegador.',
  'tour.media.open': 'Abrir Mídia online',
};

export default tour;
