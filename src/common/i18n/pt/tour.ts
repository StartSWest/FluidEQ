/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Por favor, contribua',
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
    'Um botão na barra de título transforma todo o FluidEQ em um player. É o amplificador clássico, com seu relógio de LED, suas luzes e o equalizador completo; com {backdrop}, sobre uma cena, ele vira vidro. O mesmo botão leva você de volta à página que deixou.',
  'tour.player.point1':
    'O equalizador inteiro vai junto: presets, layouts de bandas, Modo EQ, EQ inteligente, Graves, Médios e Agudos.',
  'tour.player.point2':
    'Recolha-o em uma linha, mantenha-o acima das outras janelas ou clique duas vezes no visualizador para tela cheia.',
  'tour.player.point3':
    'Um tema próprio, e as músicas soltas em “A seguir” entram na Biblioteca e na fila.',
  'tour.player.how':
    'Pressione o botão Player compacto na barra de título, ao lado de Ajuda. No player, o mesmo botão traz o app completo de volta.',
  'tour.player.open': 'Experimentar o Player compacto',
  'tour.player.imageAlt':
    'O canto da barra de título com o botão {player} destacado, e os dois players que ele abre: o amplificador clássico com relógio de LED, luzes, equalizador e fila, e o player de vidro, mais largo, sobre uma aurora com {backdrop}.',
  'tour.player.classic': 'Amplificador clássico',
  'tour.player.glass': 'Vidro, com {backdrop}',
  'tour.look.kicker': 'UM VISUAL NOVO',
  'tour.look.title': 'Uma janela nova, com cores novas',
  'tour.look.subtitle':
    'Um só controle de tema e um visualizador por trás de tudo',
  'tour.look.lead':
    'Os painéis ficam sobre um único piso aberto, nas cores do novo ícone, e um só controle, {brightness}, leva a janela inteira do quase preto a um azul-oceano claro. Com uma cena no gráfico, a janela pode assumir as cores dela ou deixá-la rodando por trás de tudo.',
  'tour.look.point1':
    '{brightness} fica no menu do ícone de pulso, e ao lado de {transparency} em {windowColours}.',
  'tour.look.point2':
    '{windowColours} oferece {original}, {colours}, {ambient} e {backdrop}, cada um com uma linha sobre o que faz com a janela.',
  'tour.look.point3':
    'Diálogos e menus compartilham o mesmo material, e o {rainbow} percorre as cores do ícone, ou as de um visualizador.',
  'tour.look.how':
    'Mova {brightness} no menu de ações no ícone de pulso do canto superior direito. Com uma cena no gráfico, abra {windowColours} pela barra do gráfico e escolha {backdrop}.',
  'tour.look.open': 'Abrir EQ',
  'tour.look.imageAlt':
    'O FluidEQ nas próprias cores na página do EQ, o Analisador desenhando uma música sob as curvas, e o menu do ícone de pulso aberto sobre o canto, com o Brilho na metade e o Modo arco-íris ligado.',
  'tour.gpu.kicker': 'UM NOVO MOTOR DE VISUALIZADORES',
  'tour.gpu.title': 'Todos os visualizadores na sua placa de vídeo',
  'tour.gpu.subtitle': 'Quarenta estilos no ritmo da sua tela, e mundos 3D',
  'tour.gpu.lead':
    'Os quarenta estilos do gráfico agora são desenhados pelo motor das cenas: na sua placa de vídeo, na taxa de atualização da sua tela, então barras, partículas e picos deslizam onde antes saltavam. E uma cena agora pode ser um mundo 3D de verdade.',
  'tour.gpu.point1':
    'Dezoito estilos novos em {scenes}, entre eles {synthwave}, {horizon}, {towers} e {ledwall}; um estilo sem cores próprias usa as da janela.',
  'tour.gpu.point2':
    'Os mundos 3D pisam no bumbo, balançam com a caixa, saltam no drop e passam da noite ao dia com {brightness}; arraste um para vê-lo de outro lado.',
  'tour.gpu.point3':
    'Ao trocar de estilo, um se funde no próximo, e um mundo 3D devolve a memória de vídeo enquanto a janela está coberta.',
  'tour.gpu.how':
    'Clique no nome do estilo no gráfico e escolha um em {scenes}.',
  'tour.gpu.open': 'Abrir EQ',
  'tour.gpu.imageAlt':
    'Uma cena que é uma cidade 3D à noite, e quatro estilos novos fotografados no gráfico — {synthwave}, {horizon}, {towers} e {ledwall} —, com o seletor de estilos destacado no primeiro.',
  'tour.gpu.world': 'Mundo 3D',
  'tour.sparks.kicker': 'FAÍSCAS DO PONTEIRO',
  'tour.sparks.title': 'Visualizadores que respondem ao seu mouse',
  'tour.sparks.subtitle': 'Faíscas, pétalas ou neve a partir do ponteiro',
  'tour.sparks.lead':
    'Passe o mouse sobre uma cena e ela lança aquilo de que é feita — faíscas, pétalas, neve, brasas — num rastro atrás do ponteiro, e explode onde você clica. Com {ambient} e com {backdrop}, seus pássaros, pétalas e luzes também flutuam pela janela inteira.',
  'tour.sparks.point1':
    'Cada visualizador lança o seu: neve de uma cena de inverno, brasas de uma fogueira, pétalas de um jardim.',
  'tour.sparks.point2':
    'O palco do Studio sempre mostra as faíscas, para quem cria uma cena dar forma ao que ela lança.',
  'tour.sparks.point3':
    'Um só botão para todos os visualizadores: {sparks}, em {windowColours} abaixo de {rainbow}.',
  'tour.sparks.how':
    'Com uma cena no gráfico, passe o mouse sobre ela e clique. {sparks} fica em {windowColours}, abaixo de {rainbow}.',
  'tour.sparks.open': 'Abrir EQ',
  'tour.sparks.imageAlt':
    'Um visualizador de aurora com um rastro de faíscas brilhantes atrás do ponteiro e uma explosão onde ele clicou, e {windowColours} com o botão {sparks} destacado.',
  'tour.sound.kicker': 'O MOTOR FLUIDEQ',
  'tour.sound.title': 'O som exatamente como você desenhou',
  'tour.sound.subtitle':
    'Agudos como desenhados, trocas sem cliques, nível em um passo',
  'tour.sound.lead':
    'No Motor FluidEQ, sua curva agora toca exatamente como desenhada até 20 kHz, cada mudança faz uma transição suave em vez de estalar, e {autoNormalize} chega ao nível de uma curva nova em um passo. Como os agudos são construídos, você escolhe: {precise} ou {classic}.',
  'tour.sound.point1':
    '{precise} constrói cada banda como desenhada; numa saída de 48 kHz, os agudos chegavam 3,8 dB abaixo em 20 kHz. {classic} as constrói como o Equalizer APO, e como o AutoEQ ajusta uma correção.',
  'tour.sound.point2':
    'Os presets fazem transição ao trocar: 534 de 636 trocas estalavam, e agora nenhuma passa de −80 dBFS.',
  'tour.sound.point3':
    'Cada ajuste é ouvido no momento em que você o faz, e {autoNormalize} depois vai ao nível dele em um passo, calculado com os últimos dez segundos de música.',
  'tour.sound.how':
    'Abra o EQ e clique em {eqMode}. Em {treble}, escolha {precise} ou {classic}, para o seu EQ e para as correções separadamente.',
  'tour.sound.open': 'Abrir EQ',
  'tour.sound.imageAlt':
    'O menu {eqMode} aberto abaixo do botão, com {treble} em {precise}; uma curva de agudos que {precise} toca como desenhada e {classic} 3,8 dB abaixo em 20 kHz numa saída de 48 kHz; e o som acima de 5 kHz durante uma troca de preset: um clique de −26 dBFS antes da 2.0, nada acima de −80 dBFS agora.',
  'tour.sound.trebleChart': 'Agudos, de 1 a 20 kHz',
  'tour.sound.switchChart': 'Acima de 5 kHz, numa troca de preset',
  'tour.sound.before': 'Antes da 2.0',
  'tour.sound.now': '2.0',
  'tour.graph.kicker': 'VISTAS DE ESTÚDIO',
  'tour.graph.title': 'Um gráfico que lê o som como um estúdio',
  'tour.graph.subtitle': 'Doze vistas e um analisador de 80 dB',
  'tour.graph.lead':
    'O gráfico mede o que está tocando como os analisadores de estúdio: doze vistas, do espectrograma e da cascata ao estéreo, à sonoridade e à fase, em escalas que ficam paradas enquanto a música se move.',
  'tour.graph.point1':
    '{analyzer}, {spectrogram}, {rta}, {waterfall}, {scope} e mais sete, em {analysis} no seletor de visuais.',
  'tour.graph.point2':
    'O som ao vivo é desenhado com 80 dB de profundidade e até 10 Hz, 1/12 de oitava por ponto, então um tom aparece no nível real.',
  'tour.graph.point3':
    'O seu EQ mantém os ±20 dB, com margem nas bordas para uma curva que vai além, e as frequências aparecem como 10, 20, 50, 100, do jeito que os analisadores imprimem.',
  'tour.graph.how':
    'Clique no nome do visual no gráfico e escolha uma vista em {analysis}. Clique duas vezes no gráfico para preencher a tela; Ctrl+G mostra ou esconde a grade.',
  'tour.graph.open': 'Abrir EQ',
  'tour.graph.imageAlt':
    'O Analisador do gráfico com uma música tocando: o espectro ao vivo com 80 dB de profundidade e os picos por cima, as curvas do EQ no topo e, no canto, a lista de vistas em Análise.',

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
    'Três momentos na área de trabalho: um jogo em primeiro plano com o cartão do FluidEQ dizendo que o som dele foi carregado, o mesmo jogo minimizado com o som ainda ativo, e o jogo fechado com o cartão dizendo que o som de antes voltou.',
  'tour.games.stepFront': 'Em primeiro plano: o som dele é carregado',
  'tour.games.stepAway': 'Minimizado ou com Alt+Tab: o som continua',
  'tour.games.stepClosed': 'Fechado: o seu som volta',
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
  'tour.studio.subtitle': 'Grátis para todas as contas',
  'tour.studio.lead':
    'O Estúdio transforma uma ideia numa cena que se move com a sua música. Ele é grátis para todas as contas: crie, exporte e publique quantas cenas quiser.',
  'tour.studio.point1':
    'Cada cena é revisada antes de chegar à galeria e, depois de aprovada, toca em todo lugar para você, de graça.',
  'tour.studio.point2':
    'As cenas podem ser mundos 3D de verdade que pisam no bumbo e saltam no drop.',
  'tour.studio.point3':
    'Copie o prompt para a IA e o seu assistente de IA pode ver a sua cena e ouvir como a música se move.',
  'tour.studio.how': 'Abra Visualizadores e escolha Estúdio na barra lateral.',
  'tour.studio.open': 'Abrir Visualizadores',
  'tour.studio.imageAlt':
    'O Estúdio com Alpine no palco, um lago sob picos nevados e uma aurora, com os três passos para criar uma cena com a sua IA abaixo, e duas notas: grátis para todas as contas, e uma cena publicada toca de graça para quem a criou.',
  'tour.studio.earned': 'Publicada: toca de graça para você',
  'tour.help.kicker': 'AJUDA',
  'tour.help.title': 'Pergunte ao guia com suas palavras',
  'tour.help.subtitle': 'Erros de digitação, plurais e dez idiomas',
  'tour.help.lead':
    'Busque no guia do jeito que você perguntaria a um amigo — “sem som”, “limitador”, “papel de parede” — em qualquer um dos dez idiomas. O melhor capítulo vem primeiro, e o guia leva você ao controle, circulado na captura.',
  'tour.help.point1':
    'Ele perdoa erros de digitação e plurais, e conhece as palavras que as pessoas usam para as coisas.',
  'tour.help.point2':
    'Cada controle em uma captura é numerado, como em um manual impresso.',
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
  'tour.plus.title': 'Cenas que são suas para sempre',
  'tour.plus.subtitle': 'Visualizadores, Estúdio, iluminação e mais',
  'tour.plus.lead':
    'Uma aba inteira de extras que faz o FluidEQ crescer: cenas desenhadas na sua placa de vídeo, um Estúdio para criar as suas, fundos de área de trabalho e a Iluminação dinâmica. Uma cena custa um crédito e fica com você, e o equalizador, o rack e os players continuam gratuitos, como sempre.',
  'tour.plus.point1':
    'Entre por Conta no menu de ações: uma conta confirmada recebe créditos grátis para começar.',
  'tour.plus.point2':
    'Os pacotes de créditos são pagos uma única vez, com termos em palavras simples antes de pagar. Nada é renovado, e o app nunca vê seu cartão.',
  'tour.plus.point3':
    'Cada cena pode ser assistida antes, e as que você obtém tocam em todo computador em que você entra.',
  'tour.plus.how':
    'Abra a aba Visualizadores: a Galeria, o Estúdio e a Iluminação dinâmica ficam do lado esquerdo.',
  'tour.plus.open': 'Abrir Visualizadores',
  'tour.plus.imageAlt':
    'A aba Visualizadores: Galeria, Estúdio e Iluminação dinâmica na lateral, e a Galeria com Cromo, Floração, Aurora, Alpino e Cidade de neon.',
  'tour.scene.alpine': 'Alpino',
  'tour.scene.aurora': 'Aurora',
  'tour.scene.bloom': 'Floração',
  'tour.scene.chrome': 'Cromo',
  'tour.scene.neonCity': 'Cidade de neon',

  'tour.visualizers.kicker': 'VISUALIZADORES',
  'tour.visualizers.title': 'Cenas que se movem com sua música',
  'tour.visualizers.subtitle': 'Desenhadas na sua placa de vídeo',
  'tour.visualizers.lead':
    'As cenas são imagens vivas (montanhas sob as estrelas, cortinas de aurora, uma cidade neon) desenhadas na sua placa de vídeo, por baixo das curvas do seu EQ. Os graves, a batida e os agudos movem, cada um, algo diferente, e a janela em volta pode assumir as cores delas.',
  'tour.visualizers.point1':
    'Um só seletor para tudo: {styles} estilos gratuitos para moldar e colorir, e cenas por categoria.',
  'tour.visualizers.point2':
    'Explore a galeria, experimente as amostras do FluidEQ por dez segundos e adicione as cenas de que gostar.',
  'tour.visualizers.point3':
    'Troque de visual automaticamente, use a tela cheia e ajuste o ataque e a liberação de uma cena em Visualização.',
  'tour.visualizers.how':
    'Clique no nome do visual no gráfico e escolha uma em Visualizadores, ou veja todas em Visualizadores → Galeria.',
  'tour.visualizers.open': 'Abrir EQ',
  'tour.visualizers.imageAlt':
    'Alpino, uma cena de montanhas sobre um lago à noite, tocando no gráfico por baixo das curvas do EQ, com mais quatro cenas abaixo.',

  'tour.desktop.kicker': 'VISUALIZADOR DA ÁREA DE TRABALHO',
  'tour.desktop.title': 'Sua música no fundo da área de trabalho',
  'tour.desktop.subtitle': 'Uma cena em cada monitor',
  'tour.desktop.lead':
    'Coloque uma cena atrás dos ícones da área de trabalho. Ela se move com o que você estiver ouvindo, ou calmamente por conta própria, e cada monitor pode mostrar uma cena própria.',
  'tour.desktop.point1':
    'Escolha os monitores em um mapa da sua mesa, cada um com seu próprio visualizador.',
  'tour.desktop.point2':
    'Fica em pausa enquanto as janelas cobrem o monitor, com o PC bloqueado e na bateria.',
  'tour.desktop.point3': 'Volta sozinho na próxima vez que o FluidEQ iniciar.',
  'tour.desktop.how':
    'Com uma cena no gráfico, pressione o botão de monitor ao lado do nome dela ou escolha Visualização → Definir como fundo da área de trabalho.',
  'tour.desktop.open': 'Abrir EQ',
  'tour.desktop.imageAlt':
    'Três monitores, cada um mostrando uma cena (Aurora, Alpino e Cidade de neon) atrás dos ícones da área de trabalho e da barra de tarefas.',

  'tour.lighting.kicker': 'ILUMINAÇÃO DINÂMICA',
  'tour.lighting.title': 'Sua mesa acende com a cena',
  'tour.lighting.subtitle':
    'Beta · seus dispositivos RGB seguem o visualizador',
  'tour.lighting.lead':
    'Seu teclado, mouse, mousepad, headset e suporte ganham as cores e o ritmo da cena no gráfico, pelo Windows Dynamic Lighting e pelo Razer Chroma.',
  'tour.lighting.point1':
    'Quatro estilos para cada visualizador: Cena, Onda de cor, Espectro e Onda rítmica.',
  'tour.lighting.point2':
    'Ajuste cada dispositivo separadamente e escolha o que acontece quando a música para.',
  'tour.lighting.point3':
    'Uma prévia ao vivo desenha sua própria mesa enquanto ela acende. Está em beta: conte para nós como seus dispositivos se comportam.',
  'tour.lighting.how':
    'Abra Visualizadores → Iluminação dinâmica e ative-a; depois coloque uma cena no gráfico.',
  'tour.lighting.open': 'Abrir Visualizadores',
  'tour.lighting.imageAlt':
    'Um teclado, um mouse e um mousepad iluminados no rosa, violeta e ciano da cena Cidade de neon.',

  'tour.share.kicker': 'CADA PC, NOS DOIS SENTIDOS',
  'tour.share.title': 'Compartilhe áudio entre seus computadores',
  'tour.share.subtitle':
    'Ouça os dois computadores, seja qual for o que você está usando',
  'tour.share.lead':
    'Seu PC gamer e seu notebook tocam um no outro: seja qual for o que você está usando, você ouve os dois — pela sua própria rede, sem perdas, criptografado e com o EQ que você ajustou naquele computador.',
  'tour.share.pairLabel': 'NOS DOIS SENTIDOS',
  'tour.share.pairName': 'Cada computador toca o som do outro',
  'tour.share.wireLabel': 'Sem perdas · Criptografado · LAN privada',
  'tour.share.stepsTitle': 'Configure em três passos',
  'tour.share.step1Title': 'Em um computador, copie o código',
  'tour.share.step1':
    'Abra a aba Compartilhar áudio e pressione “Copiar código”. O código é sempre o mesmo.',
  'tour.share.step2Title': 'No outro, cole e vincule',
  'tour.share.step2':
    'Abra Compartilhar áudio no outro computador, cole o código em “Código do outro computador” e pressione “Vincular”. Os dois começam a tocar um ao outro na hora, intactos: cada um aplica o próprio EQ ao que ouve.',
  'tour.share.step3Title': 'Escolha o que vai para onde',
  'tour.share.step3':
    'Cada computador vinculado tem duas chaves, “Tocar aqui” e “Enviar meu som”: desligue uma para um sentido só. A barra mostra a música do outro computador e a controla pela conexão. Um controle ao lado de “Tocar aqui” ajusta o volume, e “Pausar” para os dois sentidos até você tocar em “Retomar”.',
  'tour.share.fact1Title': 'Sem perdas',
  'tour.share.fact1':
    'PCM Float32 de ponta a ponta. Sem codec, sem perda de geração.',
  'tour.share.fact2Title': 'Criptografado',
  'tour.share.fact2':
    'AES-256-GCM em cada pacote. O código é a chave; sem ele ninguém consegue ouvir.',
  'tour.share.fact3Title': 'Continua vinculado',
  'tour.share.fact3':
    'O vínculo sobrevive a fechar o app e a reinicializações, de qualquer um dos lados. Só “Desvincular” acaba com ele.',
  'tour.share.tip':
    'Comece baixo: dois computadores tocando ao mesmo tempo se somam. Abaixe o volume antes do primeiro vínculo.',
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
    'Escolha um dos perfis salvos dele abaixo do dispositivo, ou clique em {editSound} ao lado para mudar o som dele sem trocar a saída principal. A saída principal mantém sua regulagem.',
  'tour.output.point3':
    'Um reprodutor de cada vez: iniciar algo no FluidEQ pausa o resto da máquina, e vice-versa.',
  'tour.output.point4':
    'Cada saída acompanha o ritmo sozinha: começa uns 30 ms atrás, acrescenta um pouco só depois de uma falha e mostra seu atraso em milissegundos, incluindo o som de outro computador quando Compartilhar áudio o toca aqui.',
  'tour.output.how':
    'Abra a aba EQ e expanda Segunda saída à direita. Ative um dispositivo, escolha seu perfil de EQ abaixo do nome e ajuste o volume; o atraso aparece embaixo.',
  'tour.output.open': 'Abrir EQ',
  'tour.output.imageAlt':
    'O painel Segunda saída com o BlackShark V2 Pro ativado, seu seletor de perfil de EQ, volume e atraso.',

  'tour.outputs.kicker': 'CADA SAÍDA LEMBRA',
  'tour.outputs.title': 'Cada saída mantém o próprio som',
  'tour.outputs.subtitle': 'Fone e caixas, cada um ajustado do seu jeito',
  'tour.outputs.lead':
    'Troque do fone para as caixas e cada saída traz o próprio som junto: o EQ, o preset, o Tom, os cortes, o rack DSP, a Sala e o nivelamento ficam guardados com cada saída.',
  'tour.outputs.point1':
    'Escolha uma saída e tudo o que você ajustou para ela volta na hora. Fone e caixas não dividem mais o mesmo preset nem a mesma curva.',
  'tour.outputs.point2':
    'Uma segunda saída toca direto do Motor FluidEQ com um som próprio, e a saída principal nunca espera por ela. {editSound}, ao lado, muda esse som sem trocar a saída principal.',
  'tour.outputs.point3':
    'Fones Bluetooth mostram a bateria ao lado da saída, e uma segunda saída mostra em milissegundos o quanto toca atrasada.',
  'tour.outputs.how':
    'Abra o EQ e escolha uma saída em {output}, à direita: tudo o que você ajustar a partir daí fica com ela. Para uma segunda, ative-a em {secondOutput} e clique em {editSound}.',
  'tour.outputs.open': 'Abrir EQ',
  'tour.outputs.imageAlt':
    'O cartão Saída com um headset e caixas de som, cada um com seu preset, sua curva e seus estágios DSP, tocando em turnos, e ao lado uma segunda saída tocando ao mesmo tempo com o próprio som, a bateria e Editar som.',

  'tour.bands.kicker': 'O EQ EM NÚMEROS',
  'tour.bands.title': 'Os valores de cada banda, direto no gráfico',
  'tour.bands.subtitle': 'Rótulos na curva, Modo EQ ao lado',
  'tour.bands.lead':
    'Cada banda pode mostrar frequência, Q e ganho sobre o próprio ponto, e os rótulos não atrapalham uns aos outros. O Modo EQ agora fica ao lado do gráfico em vez de por cima, então as curvas continuam à vista enquanto você muda como elas tocam.',
  'tour.bands.point1':
    'Um rótulo fica logo acima ou abaixo do seu ponto, nunca sobre outro, não sai do lugar enquanto você arrasta a banda e volta para a sua posição assim que há espaço.',
  'tour.bands.point2':
    '{eqMode} é o primeiro cartão do painel lateral, com uma aba para {yourEq} e outra para {corrections}. O botão dele acima do gráfico traz o cartão para a vista.',
  'tour.bands.point3':
    'Cada ponto, controle deslizante e botão giratório funciona pelo teclado, e mover um controle deslizante redesenha a curva no mesmo quadro.',
  'tour.bands.how':
    'Abra o EQ, escolha {view} → {everything} acima do gráfico (ou pressione {shortcut}) e mova uma banda: os valores dela a acompanham. {eqMode} fica no topo do painel à direita.',
  'tour.bands.open': 'Abrir EQ',
  'tour.bands.imageAlt':
    'O gráfico do EQ com a frequência, o Q e o ganho de cada banda sobre o seu ponto, uma banda se movendo com as setas do teclado e, embaixo, o cartão Modo EQ com Seu EQ e Correções.',
  'tour.bands.shortcut': 'Ctrl+W',

  'tour.ears.kicker': 'UMA BANDA, DOIS OUVIDOS',
  'tour.ears.title': 'Ajuste cada ouvido separadamente',
  'tour.ears.subtitle': 'Esquerdo + direito no menu da banda',
  'tour.ears.lead':
    'Clique com o botão direito em uma banda e escolha {split}: ela vira uma banda para cada ouvido, na mesma frequência, e você move cada uma sozinha. A curva do ouvido esquerdo é contínua e a do direito, tracejada.',
  'tour.ears.point1':
    '{both} junta as duas de novo no meio, a meio caminho em frequência e ganho. {reset} e {clear} também as juntam.',
  'tour.ears.point2':
    '{delete} fica no mesmo menu, no EQ principal e no rack DSP, e pede um segundo clique antes de apagar.',
  'tour.ears.point3':
    'Uma curva do Squiglink pode ser importada em um só ouvido: {importInto} preenche só o esquerdo ou o direito e deixa o outro como estava.',
  'tour.ears.how':
    'Abra o EQ, clique com o botão direito em uma banda no gráfico e escolha {split}. O EQ do rack DSP tem o mesmo menu enquanto se aplica ao estéreo.',
  'tour.ears.open': 'Abrir EQ',
  'tour.ears.imageAlt':
    'O gráfico do EQ com uma banda dividida em uma para o ouvido esquerdo e outra para o direito, que se afastam e voltam a se juntar no meio, a curva esquerda contínua e a direita tracejada, ao lado do menu da banda com Ambos os ouvidos e Esquerdo + direito.',
  // Film voice: generated from .claude/video-kit/films/narration/lines.cjs — edit there.
  'tour.film.eachEar.intro':
    'Agora cada banda do FluidEQ pode soar diferente em cada ouvido.',
  'tour.film.eachEar.menu':
    'Clique com o botão direito em uma banda para abrir o menu dela.',
  'tour.film.eachEar.split':
    'Escolha Esquerdo + direito. A banda se divide em duas, uma metade para cada ouvido.',
  'tour.film.eachEar.lines':
    'Arraste cada metade separadamente. A linha contínua é o seu ouvido esquerdo, e a tracejada, o direito.',
  'tour.film.eachEar.sliders':
    'Cada ouvido também tem seu próprio controle deslizante, marcado com L ou R.',
  'tour.film.eachEar.join':
    'Para juntá-las de novo, escolha Ambos os ouvidos. As duas metades se encontram no meio.',
  'tour.film.sound.intro':
    'Cada mudança que você faz no FluidEQ é ouvida na hora, e com suavidade.',
  'tour.film.sound.glide':
    'Mova uma banda enquanto a música toca. Cada mudança entra deslizando, sem nenhum clique.',
  'tour.film.sound.precise':
    'No menu Modo EQ, Agudos está em Preciso. Cada banda soa exatamente como foi desenhada, até vinte quilohertz.',
  'tour.film.sound.classic':
    'Escolha Clássico para construir as bandas do jeito que o Equalizer APO constrói.',
  'tour.film.games.intro':
    'O FluidEQ pode dar a cada um dos seus jogos um som próprio.',
  'tour.film.games.add':
    'Pressione Adicionar um jogo e escolha entre os jogos instalados pelos seus launchers.',
  'tour.film.games.sound': 'Depois escolha o som que ele deve ter.',
  'tour.film.games.front':
    'Quando o jogo vem para a frente, o som dele carrega sozinho.',
  'tour.film.games.closed': 'Feche o jogo, e o seu próprio som volta.',
  'tour.film.compact.intro':
    'Quando você só precisa dos controles, o FluidEQ vira um player pequeno.',
  'tour.film.compact.go':
    'Pressione o botão do player no topo, e a janela vira o Player compacto.',
  'tour.film.compact.eq':
    'O seu EQ vem junto. Gire um botão e você ouve na hora.',
  'tour.film.compact.back': 'Um clique leva você de volta à janela completa.',
  'tour.film.deleteImport.intro':
    'Duas pequenas mudanças que protegem o seu EQ.',
  'tour.film.deleteImport.asks':
    'Excluir banda agora pergunta antes. Pressione de novo para excluir a banda de verdade.',
  'tour.film.deleteImport.oneEar':
    'Uma importação também pode preencher só um ouvido. Escolha Importar em e depois Ouvido esquerdo.',
  'tour.film.deleteImport.otherEar':
    'Só o ouvido esquerdo é substituído. O direito fica exatamente como estava.',
  'tour.film.outputs.intro':
    'Cada saída do seu computador guarda o próprio som.',
  'tour.film.outputs.each':
    'Troque das caixas de som para os fones, e o EQ passa a ser o dos fones.',
  'tour.film.outputs.back':
    'Volte, e as caixas soam exatamente como você deixou.',
  'tour.film.outputs.second':
    'Você também pode tocar por uma Segunda saída ao mesmo tempo, com som próprio.',
  'tour.film.outputs.edit':
    'Pressione Editar som para ajustar ali mesmo, enquanto a saída principal continua tocando.',
  'tour.film.dsp.intro':
    'O rack DSP molda tudo o que você ouve, depois do seu EQ.',
  'tour.film.dsp.preset':
    'Escolha um preset, e ele configura o rack inteiro de uma vez.',
  'tour.film.dsp.stages':
    'Cada estágio tem a própria página, com todos os controles à vista.',
  'tour.film.dsp.meters':
    'Os medidores se movem com a música, para você ver o que ele faz.',
  'tour.film.deesser.intro':
    'O rack DSP agora tem um De-esser, para vozes com S ásperos.',
  'tour.film.deesser.cuts':
    'Escolha um preset como Podcast e fala. Cada S áspero é atenuado e aparece em âmbar, enquanto os pratos ficam intactos.',
  'tour.film.deesser.isolate': 'Pressione Isolar para ouvir só o que ele tira.',
  'tour.film.headphones.intro':
    'O FluidEQ pode corrigir seus fones com medições feitas por outras pessoas.',
  'tour.film.headphones.search':
    'Abra Presets EQ e procure seus fones na biblioteca do OPRA.',
  'tour.film.headphones.measure':
    'Escolha uma medição. Cada uma diz quem a fez.',
  'tour.film.headphones.applied':
    'Pressione Aplicar EQ do modelo. A correção vai para uma camada própria, e as suas bandas ficam como estão.',
  'tour.film.headphones.paste':
    'Você também pode colar uma exportação do Squiglink.',
  'tour.film.headphones.ears':
    'Aplique como o seu EQ, nos dois ouvidos ou só em um.',
  'tour.film.headphones.curve': 'Ou aplique como uma curva própria.',
  'tour.film.karaoke.intro':
    'O Karaokê transforma o FluidEQ em um palco para as suas músicas.',
  'tour.film.karaoke.open':
    'Pressione Abrir música e escolha a música junto com o arquivo da letra.',
  'tour.film.karaoke.words':
    'Pressione Reproduzir. Cada palavra acende enquanto é cantada.',
  'tour.film.karaoke.pitch':
    'Abaixo, o guia de afinação mostra cada nota a cantar. Ligue o microfone para ver a sua própria voz nele.',
  'tour.film.maker.intro':
    'O Criador de karaokê transforma uma música em um arquivo de karaokê.',
  'tour.film.maker.timeline':
    'Carregue uma música e pressione Criar. Cada palavra e cada nota ficam em uma linha do tempo.',
  'tour.film.maker.play':
    'Toque, e o cursor passa por cada palavra e nota. Arraste qualquer uma para corrigir o tempo ou a afinação.',
  'tour.film.maker.use':
    'O Criador também pode preparar uma música sozinho, a partir da voz de quem canta. Quando estiver certo, pressione Usar no player.',
  'tour.film.looks.intro':
    'O espectro embaixo do seu EQ pode ser desenhado do jeito que você quiser.',
  'tour.film.looks.open':
    'Pressione Novo visual na barra de ferramentas do gráfico.',
  'tour.film.looks.forms':
    'Passe pelas formas com a seta: barras de LED, barras de neon, horizontes de cidade, torres de vidro e mais.',
  'tour.film.looks.shape':
    'Depois dê forma a ele. Partes define quantas barras existem, e as cores, os espaços e o movimento também são escolha sua.',
  'tour.film.looks.save':
    'Pressione Salvar para guardar como um visual seu, ou compartilhe como arquivo.',
  'tour.film.engine.intro':
    'O FluidEQ tem um motor de áudio próprio. Ele leva o seu EQ e o rack DSP a tudo o que o computador toca.',
  'tour.film.engine.choose':
    'Abra o menu de ações no canto superior direito e pressione o cartão do motor. O Motor FluidEQ é o que você deve escolher.',
  'tour.film.engine.rack':
    'Depois abra o DSP e escolha um preset. Jogos, navegadores e apps de música tocam todos por ele.',
  'tour.film.library.intro':
    'A Biblioteca toca as músicas que você tem, pelo seu EQ.',
  'tour.film.library.albums':
    'Seus álbuns aparecem como capas. Folheie com as setas.',
  'tour.film.library.album':
    'Clique em um álbum para abri-lo, com todas as músicas.',
  'tour.film.library.play':
    'Pressione Reproduzir, e ela toca pelo mesmo EQ e rack DSP de todo o resto.',
  // End of film voice.
  'tour.film.soundOn': 'Ligar o som',
  'tour.film.soundOff': 'Desligar o som',
  'tour.film.watch': 'Assistir ao vídeo',
  'tour.film.close': 'Fechar o vídeo',

  'tour.myCurves.kicker': 'CURVAS SUAS',
  'tour.myCurves.title': 'Sua própria lista de curvas, ao lado da do OPRA',
  'tour.myCurves.subtitle': 'Guarde, nomeie e reutilize suas curvas',
  'tour.myCurves.lead':
    '{eqPresets} agora tem {myCurves} ao lado da biblioteca OPRA: toda curva a que você quer voltar, com o nome que você der e um desenho do formato dela. Adicione uma a partir de uma exportação do Squiglink, de um arquivo .txt, do seu EQ como está ou de uma escolha do OPRA.',
  'tour.myCurves.point1':
    '{applyCurve} toca uma curva como correção do fone, com intensidade e chave próprias; {applyEq} coloca as bandas dela no seu EQ.',
  'tour.myCurves.point2':
    'O atalho do {squiglink} em {myCurves} abre a prévia de importação; {save} guarda sua curva para depois.',
  'tour.myCurves.point3':
    '{exportList} grava a lista inteira em um arquivo, como cópia ou para levar a outro computador; {importList} lê de volta e diz o que ficou de fora.',
  'tour.myCurves.how':
    'Abra {eqPresets} no EQ, escolha {myCurves} e pressione {add}.',
  'tour.myCurves.open': 'Abrir Presets EQ',
  'tour.myCurves.imageAlt':
    'A página Presets EQ em Minhas curvas: uma lista de quatro curvas de fone, cada uma com nome, origem, dia em que foi adicionada e um desenho do formato. Uma curva recém-salva do Squiglink chega no topo e toca como correção do fone.',

  'tour.songs.kicker': 'UM SOM PARA CADA MÚSICA',
  'tour.songs.title': 'Músicas que lembram como você gosta delas',
  'tour.songs.subtitle': 'Ajuste uma vez e ouça assim sempre',
  'tour.songs.lead':
    'Ative {songSound} e o preset, o Tom e o EQ com que uma música termina voltam na próxima vez que ela tocar, na saída em que você a ajustou.',
  'tour.songs.point1':
    'Mude o preset, o Tom ou uma banda enquanto uma música toca e é isso que ela guarda. Uma música em que você nunca mexe não guarda nada.',
  'tour.songs.point2':
    'O som volta com um aviso que diz o nome da música e o que ela trouxe, com {undo} e {forget} ali mesmo.',
  'tour.songs.point3':
    'Quando a música termina, o som que você tinha antes volta, e cada saída lembra o seu: a mesma música pode soar de um jeito no fone e de outro nas caixas.',
  'tour.songs.how':
    'Abra o EQ e ative {songSound} em {output}, à direita. Toque uma música, escolha um preset ou gire o Tom e deixe-a terminar ou pule-a.',
  'tour.songs.open': 'Abrir EQ',
  'tour.songs.imageAlt':
    'Uma fila de quatro músicas tocando em turnos, três com o preset e a curva com que ficaram e uma nunca ajustada, e acima o aviso que uma música lembrada mostra, com Desfazer e Esquecer esta música.',

  'tour.deesser.kicker': 'UM S MAIS SUAVE',
  'tour.deesser.title': 'Um De-esser no rack DSP',
  'tour.deesser.subtitle': 'S agudos mais baixos, pratos intactos',
  'tour.deesser.lead':
    '{deEsser} abaixa os S, T e CH agudos de uma voz só enquanto soam, e deixa os pratos, os chimbais e o resto dos agudos como estavam.',
  'tour.deesser.point1':
    'Ele encontra cada S pelo nível da própria música, então trata igual uma faixa baixa e uma alta, e você vê cada S que ele pegou e quanto tirou.',
  'tour.deesser.point2':
    'Ele abaixa só as frequências de que o S é feito, tudo acima dele ou a voz inteira, e {isolate} toca só o que ele tira.',
  'tour.deesser.point3':
    '{speech}, {podcast} e {audiobook} o ativam. Cada filtro do rack agora pode salvar perfis seus.',
  'tour.deesser.how':
    'Abra o DSP e escolha {deEsser} na lista à esquerda, ou o preset {podcast}. Comece por um perfil e suba {sensitivity} até ele pegar cada S.',
  'tour.deesser.open': 'Abrir DSP',
  'tour.deesser.imageAlt':
    'A faixa do De-esser passando: cada S de uma voz acima da linha onde o estágio começa, com o corte pendurado embaixo em âmbar, e os chimbais em cinza, intactos; em cima o estágio com Espectral escolhido e embaixo Voz, Podcast e Audiolivro.',

  'tour.chat.kicker': 'UMA CENA SÓ DE PEDIR',
  'tour.chat.title': 'Peça uma mudança e veja no palco',
  'tour.chat.subtitle': 'Um chat ao lado do palco do Estúdio',
  'tour.chat.lead':
    'O {studio} agora tem um chat ao lado do palco. Diga o que deve mudar — como uma cena aparece, como ela se move com a música, as cores ou a luz — e a sua própria IA edita a cena e toca cada versão no palco enquanto trabalha.',
  'tour.chat.point1':
    'Cada resposta guarda a versão que fez, e {bringBack} coloca uma anterior de volta. Cada cena guarda os chats anteriores.',
  'tour.chat.point2':
    '{attach} envia uma imagem da cena com a sua mensagem, e você pode desenhar nela para mostrar o que quer dizer. Mensagens enviadas enquanto ele trabalha esperam numa fila e vão juntas.',
  'tour.chat.point3':
    'Ele roda no Claude Code instalado neste computador, com o seu próprio plano, e mostra quanto resta dos seus limites.',
  'tour.chat.how':
    'Abra o {plus}, escolha {studio} na barra lateral, escolha uma cena ou comece uma e escreva na caixa ao lado do palco.',
  'tour.chat.open': 'Abrir Visualizadores',
  'tour.chat.imageAlt':
    'O palco do Estúdio ao lado do chat: um pedido para as luzes do palco piscarem na caixa, os passos da resposta marcados um a um, a versão 2 guardada com Trazer de volta, e as luzes do palco começando a piscar quando a versão 2 toca.',
  'tour.chat.ask': 'Faça as luzes do palco piscarem na caixa.',
  'tour.chat.reply':
    'Pronto: os dois holofotes piscam em branco a cada caixa e voltam ao rosa.',

  'tour.looks.kicker': 'SEU PRÓPRIO VISUALIZADOR',
  'tour.looks.title': 'Visuais próprios para o gráfico',
  'tour.looks.subtitle': 'Suas formas, suas cores, seu movimento',
  'tour.looks.lead':
    'O espectro abaixo do EQ pode ser desenhado do jeito que você quiser. Escolha uma de {forms} formas, de barras de LED e neon a terraços, horizontes e torres de vidro; pinte com a coloração Auto da própria forma, por frequência, por nível ou por calor; defina a rapidez do ataque e quanto tempo um pico fica no ar; e marque os picos com faíscas, cometas ou ondulações. Salve como um visual seu e compartilhe como arquivo.',
  'tour.looks.point1':
    '{forms} formas, cada uma com seus controles: peças, espaço, preenchimento, espessura, e se é preenchida ou traçada.',
  'tour.looks.point2':
    'Pinte cada forma com a coloração Auto dela, por frequência, nível ou calor com uma rampa das suas próprias cores, ou com uma única cor chapada.',
  'tour.looks.point3':
    'Ataque e liberação definem o movimento; picos iluminados, picos preenchidos e doze marcas de pico definem como um golpe aparece.',
  'tour.looks.point4':
    'O Brilho funciona em todos os modos, e os visuais exportam para um arquivo e importam de um.',
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
  'tour.studio.free': 'Grátis para todas as contas',
};

export default tour;
