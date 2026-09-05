/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
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
    'Abra o menu do ícone de pulso no canto superior direito e escolha Tema → Preto. O Oceano fica a um clique se quiser voltar.',
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
    'Abra o FluidEQ lá, vá em Compartilhar áudio, escolha “Enviar o áudio deste computador”, cole o código e pressione “Conectar e enviar”. O áudio do sistema começa a fluir.',
  'tour.share.step3Title': 'Escolha uma prioridade e ouça',
  'tour.share.step3':
    'Música mantém um buffer maior para ouvir sem cortes; Jogo/Vídeo roda com o menor atraso para sincronia labial. Cada emissor é mixado na saída do receptor e moldado pelo EQ dele.',
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
    'Abra a aba Biblioteca, pressione “Adicionar pasta” ou solte uma pasta na página e espere por “Músicas adicionadas”. Escolha Álbuns, Artistas, Gêneros, Músicas, Pastas ou Árvore e pressione Play.',
  'tour.library.open': 'Abrir Biblioteca',

  'tour.dsp.kicker': 'UM RACK DE MASTERIZAÇÃO',
  'tour.dsp.title': 'O rack DSP',
  'tour.dsp.subtitle': 'Nove estágios, cada um com seu gráfico',
  'tour.dsp.lead':
    'Tudo o que a Biblioteca toca pode passar por um rack de estágios de estúdio, nesta ordem: Normalizador, Denoise, Exciter, Bass Forge, Equalizador, Bass Punch, Dimension, Maximizador e Master, mais um crossfade entre faixas. Cada estágio é um cartão com gráfico ao vivo, presets e um botão Isolar para ouvir só o que ele faz.',
  'tour.dsp.point1':
    'O Denoise conserta a própria gravação: chiado, zumbido, cliques e um limpador de voz neural, medidos a partir de uma varredura da faixa.',
  'tour.dsp.point2':
    'O Bass Forge adiciona uma oitava real abaixo do baixo; o Bass Punch molda ataque, sustain, bloom e duck.',
  'tour.dsp.point3':
    'Um Equalizador paramétrico de quinze bandas com fase mínima ou linear, mid/side, oversampling e dezenas de presets nomeados.',
  'tour.dsp.point4':
    'Master com alvo de loudness LUFS e proteção true-peak, presets de entrega de Streaming a Vinil, e um ajuste de ganho para comparar som, não volume.',
  'tour.dsp.how':
    'Toque uma faixa da Biblioteca, abra a aba DSP, escolha uma cadeia em Presets, depois clique em um estágio nas abas laterais e ligue-o.',
  'tour.dsp.open': 'Abrir DSP',

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
