/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Por favor, contribua',
  'tour.rainbow.title': 'Boas-vindas ao modo arco-íris',
  'tour.rainbow.subtitle': 'Ative com um clique',
  'tour.rainbow.lead':
    'Cores do arco-íris, detalhes luminosos e uma borda que percorre o espectro. Só a aparência muda, nunca o som.',
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
  'tour.rail.new': 'NOVO NESTA VERSÃO',
  'tour.rail.always': 'TAMBÉM NO FLUIDEQ',
  'tour.newBadge': 'NOVO',
  'tour.howTitle': 'Como começar',
  'tour.beta': 'Beta',

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
    'Escolha o Motor FluidEQ ao instalar, ou abra o menu de ações e escolha-o lá. Depois abra a aba DSP e ligue um estágio com qualquer app tocando.',
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

  'tour.plus.kicker': 'FLUIDEQ PLUS',
  'tour.plus.title': 'Boas-vindas ao FluidEQ Plus',
  'tour.plus.subtitle': 'Visualizadores, Estúdio, iluminação e mais',
  'tour.plus.lead':
    'Uma assinatura opcional que mantém o FluidEQ crescendo, com uma aba nova só para ela: cenas desenhadas na sua placa gráfica, um Estúdio para criar as suas, a classificação, fundos do ambiente de trabalho e a Iluminação dinâmica. Tudo o que era grátis continua grátis.',
  'tour.plus.point1':
    'Inicie sessão em Conta, no menu de ações; o pagamento é feito no seu navegador e o Plus é ativado sozinho.',
  'tour.plus.point2':
    'Mensal ou anual, com termos em linguagem simples antes de você pagar. O app nunca vê seu cartão.',
  'tour.plus.point3':
    'Sessão iniciada em até cinco computadores, com novos visualizadores adicionados ao longo do tempo.',
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
  'tour.visualizers.subtitle': 'Desenhadas na sua placa gráfica',
  'tour.visualizers.lead':
    'Os visualizadores Plus são cenas vivas (montanhas sob as estrelas, cortinas de aurora, uma cidade neon) desenhadas na sua placa gráfica, por baixo das curvas do seu EQ. Os graves, a batida e os agudos movem, cada um, algo diferente, e a janela em volta pode assumir as cores delas.',
  'tour.visualizers.point1':
    'Um só seletor para tudo: 38 estilos gratuitos para moldar e colorir, e visualizadores Plus por categoria.',
  'tour.visualizers.point2':
    'Explore a galeria, experimente as amostras do FluidEQ por dez segundos e adicione as cenas de que gostar.',
  'tour.visualizers.point3':
    'Troque de visual automaticamente, use a tela inteira e ajuste o ataque e a liberação de uma cena em Visualização.',
  'tour.visualizers.how':
    'Clique no nome do visual no gráfico e escolha uma cena em Visualizadores Plus, ou veja todas em Plus → Visualizadores.',
  'tour.visualizers.open': 'Abrir EQ',
  'tour.visualizers.imageAlt':
    'Alpino, um visualizador Plus de montanhas sobre um lago à noite, tocando no gráfico por baixo das curvas do EQ, com mais quatro cenas abaixo.',

  'tour.desktop.kicker': 'VISUALIZADOR DO AMBIENTE DE TRABALHO',
  'tour.desktop.title': 'Sua música no fundo do ambiente de trabalho',
  'tour.desktop.subtitle': 'Uma cena em cada monitor',
  'tour.desktop.lead':
    'Coloque um visualizador Plus atrás dos ícones do ambiente de trabalho. Ele se move com o que você estiver ouvindo, ou calmamente por conta própria, e cada monitor pode mostrar uma cena própria.',
  'tour.desktop.point1':
    'Escolha os monitores em um mapa da sua mesa, cada um com seu próprio visualizador.',
  'tour.desktop.point2':
    'Fica em pausa com apps em tela inteira, com o PC bloqueado e na bateria.',
  'tour.desktop.point3': 'Volta sozinho na próxima vez que o FluidEQ iniciar.',
  'tour.desktop.how':
    'Com um visualizador Plus no gráfico, pressione o botão de monitor ao lado do nome dele ou escolha Visualização → Definir como fundo do ambiente de trabalho.',
  'tour.desktop.open': 'Abrir EQ',
  'tour.desktop.imageAlt':
    'Três monitores, cada um mostrando um visualizador Plus (Aurora, Alpino e Cidade de neon) atrás dos ícones do ambiente de trabalho e da barra de tarefas.',

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
  'tour.theme.title': 'Conheça o tema Preto',
  'tour.theme.subtitle': 'Preto puro, para as madrugadas e telas OLED',
  'tour.theme.lead':
    'O FluidEQ agora tem uma segunda cara. O Preto remove todo traço do azul-ardósia com que o app nasceu: painéis, menus e barras ficam monocromáticos, o destaque permanece e o espectro é a única cor na sala.',
  'tour.theme.point1':
    'Fundos preto puro: em uma tela OLED os pixels ao redor do gráfico se apagam.',
  'tour.theme.point2':
    'Todas as janelas acompanham: menus, diálogos, o palco do karaokê e a Biblioteca mudam juntos.',
  'tour.theme.point3':
    'Sua cor de destaque e o modo arco-íris continuam. Nada no seu som muda: é só a pintura.',
  'tour.theme.howTitle': 'Como trocar',
  'tour.theme.how':
    'Abra o menu do ícone de pulso no canto superior direito e, no fundo dele, escolha Preto em Tema. O Oceano fica a um clique se quiser voltar.',
  'tour.theme.tryBlack': 'Mudar para Preto agora',
  'tour.theme.tryOcean': 'Voltar ao Oceano',
  'tour.theme.imageAlt':
    'FluidEQ no tema Preto: a aba EQ com quinze bandas e o espectro ao vivo tocando uma música.',

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
    'Abra o FluidEQ lá, vá em Compartilhar áudio, escolha “Enviar o áudio deste computador”, selecione Música ou Jogo/Vídeo, cole o código e pressione “Conectar e enviar”. O áudio do sistema começa a fluir.',
  'tour.share.step3Title': 'Ouça e ajuste o nível',
  'tour.share.step3':
    'Música mantém um buffer maior para ouvir sem cortes; Jogo/Vídeo roda com o menor atraso para sincronia labial. Cada emissor é mixado na saída do receptor, moldado pelo EQ e ajustado pelo Volume dele. A barra de reprodução do receptor mostra a música do emissor mais recente, e os botões dela funcionam pela rede.',
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
    'Memória de EQ por música: ligue “Salvar para esta música” enquanto ela toca e a correção que você fizer fica guardada para aquela faixa.',
  'tour.library.how':
    'Abra a aba Biblioteca, pressione “Adicionar pasta” ou solte uma pasta na página e espere a leitura terminar. Escolha Álbuns, Artistas, Géneros, Músicas, Pastas ou Árvore e pressione Reproduzir.',
  'tour.library.open': 'Abrir Biblioteca',

  'tour.dsp.kicker': 'UM RACK DE MASTERIZAÇÃO',
  'tour.dsp.title': 'O rack DSP',
  'tour.dsp.subtitle': 'Nove estágios, cada um com seu gráfico',
  'tour.dsp.lead':
    'Um rack de estágios de estúdio, nesta ordem: Normalizador, Redução de ruído, Excitador, Forja de graves, Equalizador, Punch dos graves, Dimensão, Maximizador e Master, mais uma transição cruzada entre faixas da Biblioteca. Com o Motor FluidEQ, ele funciona em tudo o que o computador toca; com o Equalizer APO, na Biblioteca. Cada estágio é um cartão com gráfico ao vivo, predefinições e um botão Isolar para ouvir só o que ele faz.',
  'tour.dsp.point1':
    'A Redução de ruído corrige chiado, zumbido e estalos durante a reprodução, e um limpador de voz neural funciona nas faixas da Biblioteca.',
  'tour.dsp.point2':
    'A Forja de graves adiciona uma oitava real abaixo do baixo; o Punch dos graves molda o ataque, a sustentação e a floração, com Mistura de até 200%.',
  'tour.dsp.point3':
    'Um Equalizador paramétrico de quinze bandas com fase mínima ou linear, mid/side, oversampling e dezenas de presets nomeados.',
  'tour.dsp.point4':
    'Master com alvo de loudness LUFS e proteção true-peak, presets de entrega de Streaming a Vinil, e um ajuste de ganho para comparar som, não volume.',
  'tour.dsp.how':
    'Abra a aba DSP, escolha uma cadeia em Predefinições, depois clique em um estágio nas abas laterais e ligue-o. Com o Equalizer APO, toque antes uma faixa da Biblioteca.',
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
    'Um player por vez: iniciar algo no FluidEQ pausa o resto da máquina, e vice-versa.',
  'tour.output.point4':
    'Jogo/Vídeo começa com cerca de 30 ms de reserva e se sincroniza após uma interrupção; Música começa com cerca de 100 ms para uma reprodução mais suave. O buffer do dispositivo acrescenta atraso.',
  'tour.output.how':
    'Abra a aba EQ e expanda Segunda saída à direita. Ative um dispositivo, escolha seu perfil de EQ abaixo do nome, ajuste o volume e selecione Jogo/Vídeo ou Música.',
  'tour.output.open': 'Abrir EQ',
  'tour.output.imageAlt':
    'O painel Segunda saída com o BlackShark V2 Pro ativado, seu seletor de perfil de EQ, volume e os modos Jogo/Vídeo e Música.',

  'tour.looks.kicker': 'SEU PRÓPRIO VISUALIZADOR',
  'tour.looks.title': 'Visuais próprios para o gráfico',
  'tour.looks.subtitle': 'Trinta e oito formas, suas cores, seu movimento',
  'tour.looks.lead':
    'O espectro abaixo do EQ pode ser desenhado do jeito que você quiser. Escolha uma de trinta e oito formas, de barras e linhas simples a terraços, horizontes e uma ponte à noite com trânsito; pinte com a coloração Auto da própria forma, por frequência, por nível ou por calor; defina a rapidez do ataque e quanto tempo um pico fica no ar; e marque os picos com faíscas, cometas ou ondulações. Salve como um visual seu e compartilhe como arquivo.',
  'tour.looks.point1':
    'Trinta e oito formas, cada uma com seus controles: peças, espaço, preenchimento, espessura, e se é preenchida ou traçada.',
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
    'Um controle de Voz guia que vai do original até só a base, removendo a voz principal sem precisar de outro arquivo.',
  'tour.karaoke.point2':
    'Uma pista de afinação em Notas ou Curva: as notas da música como blocos, sua voz como uma linha ao vivo, com aviso de Alto, Afinado e Baixo.',
  'tour.karaoke.point3':
    'Uma revisão da performance no fim, listando as partes para praticar, com contagem para outra tentativa.',
  'tour.karaoke.point4':
    'Lê LRC, LRC aprimorado com tempo por palavra e UltraStar com sílabas e afinação, sobre MP3, FLAC, WAV, OGG, M4A e mais. Letras traduzidas e acordes de violão estimados vêm junto.',
  'tour.karaoke.how':
    'Abra a aba Karaokê, pressione “Abrir música” ou “Adicionar pasta”, escolha uma faixa na playlist, ligue o microfone, mostre o guia de afinação e pressione Play.',
  'tour.karaoke.open': 'Abrir Karaokê',

  'tour.maker.kicker': 'FAÇA O SEU',
  'tour.maker.title': 'O Criador de Karaokê',
  'tour.maker.subtitle': 'Qualquer música vira um arquivo de karaokê',
  'tour.maker.lead':
    'Um estúdio de criação completo dentro da aba Karaokê. Ele pode fazer todo o trabalho sozinho: separar a voz da música, ler as palavras e seus tempos com um modelo de fala local e detectar as notas da melodia. Ou você marca, grava e desenha cada tempo à mão em uma linha do tempo com zoom. Tudo roda neste computador.',
  'tour.maker.point1':
    '“Configurar esta música automaticamente”: separa a voz e depois lê as palavras e os tempos, com opção de continuar em segundo plano.',
  'tour.maker.point2':
    'Guarde as faixas separadas: a voz e a base, cada uma salvável, inclusive como MP3.',
  'tour.maker.point3':
    'Ferramentas manuais para os detalhes: marcar palavras, gravar entradas de linha, um inspetor de palavra com início e duração, e dividir uma palavra em sílabas.',
  'tour.maker.point4':
    'Pinte a melodia numa grade de afinação, marque notas douradas e exporte como projeto FluidEQ, UltraStar TXT, LRC, LRC aprimorado ou base sem voz.',
  'tour.maker.how':
    'No Karaokê, carregue uma música e pressione “Criar”. Aceite “Configurar automaticamente” no assistente, corrija as palavras na linha do tempo, depois “Usar no player” e “Exportar”.',
  'tour.maker.open': 'Abrir Karaokê',

  'tour.media.kicker': 'A WEB, PELO SEU EQ',
  'tour.media.title': 'Mídia online',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch e Suno',
  'tour.media.lead':
    'Um player embutido para os sites de streaming, para que o que você assiste e ouve online passe pelo seu EQ em vez de por outro navegador. Cinco sites vêm prontos, cada um com sua busca, e links que levam para fora são retidos com a opção “Abrir no navegador”.',
  'tour.media.point1':
    'Um único campo de busca que pesquisa no site que estiver aberto, com buscas recentes que você pode apagar.',
  'tour.media.point2':
    '“Bloquear anúncios” pula os anúncios em vídeo e esconde os espaços de anúncio no YouTube.',
  'tour.media.point3':
    'Retomar: o player lembra a última página e onde você estava nela, e leva você de volta.',
  'tour.media.point4':
    'Downloads com indicador de progresso e “Mostrar na pasta” ao terminar, e um botão “Sair de todos os sites” que limpa todos os cookies e logins de uma vez.',
  'tour.media.how':
    'Abra a aba Mídia online, escolha um site na fileira de cima, digite no campo de busca e pressione Buscar. Voltar, Avançar e Recarregar funcionam como em um navegador.',
  'tour.media.open': 'Abrir Mídia online',
};

export default tour;
