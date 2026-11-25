/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'Dinâmica: trechos baixos e altos',
  'help.dynamics.intro':
    'Dinâmica é um compressor de três faixas: aumenta trechos baixos e segura os altos sem acrescentar atraso. Pode tratar música, filmes, fala ou o som de um jogo.',
  'help.dynamics.steps':
    'Abra DSP → Dinâmica, ative a etapa e escolha um preset. Os presets de jogos ficam no Gaming Lab.\nAs faixas cobrem graves abaixo de 150 Hz, médios de 150 Hz a 4 kHz e agudos acima de 4 kHz. Ajuste a faixa do som desejado.\nEm Subir, Abaixo de define quando elevar os sons baixos, Proporção a intensidade e Até o ganho máximo. A relação 1:1 não altera o sinal.\nEm Segurar, Acima de define quando reduzir sons altos e Proporção com que força. Baixar o limiar faz a redução agir mais vezes.\nAjuste Ataque e Liberação, Mistura para misturar o original e Compensação para o nível final. Compare em volumes parecidos.\nCada banda tem sua própria curva: o nível de entrada na horizontal e o de saída na vertical. Arraste um ponto vazado para definir onde uma subida ou uma contenção começa e um ponto cheio para definir a força, ou digite um valor exato na tabela abaixo. Enquanto o som toca, um ponto percorre cada curva e mostra o que a banda está fazendo agora. Um aviso de atualização do mecanismo pode se referir apenas ao gráfico ao vivo, mesmo com o áudio já sendo processado.',
  'help.dynamics.tip':
    'Uma elevação forte também destaca o ruído de fundo. Diminua a mistura para preservar mais do movimento original.',
  'help.dynamics.keywords':
    'dynamics, compressor, compression, upward compression, downward compression, lift, hold, attack, release, mix, makeup, quiet passages, loud passages',
  'help.deesser.title': 'De-esser: suavizar vozes estridentes',
  'help.deesser.intro':
    'Reduz S, T e SH agressivos quando aparecem. Quatro grupos definem o que ele escuta, o que reduz, a velocidade e onde atua no estéreo.',
  'help.deesser.steps':
    'Abra DSP → De-esser, ative a etapa e teste um preset com uma voz sibilante.\nEm Encontrar, coloque as frequências inferior e superior ao redor do som incômodo. Aumente Sensibilidade sem reagir a toda nota brilhante.\nEm Reduzir, Espectral segue apenas as frequências afetadas; Agudos reduz a faixa alta. Voz inteira reduz todo o som e é indicado para voz isolada. Ajuste a redução máxima e a largura disponível.\nEm Tempos, ajuste a captura do início e o retorno dos agudos. Em Onde, Centro foca a voz central e Poupar pratos preserva os ataques brilhantes.\nAtive Isolar para ouvir somente o que foi retirado e desative para avaliar a gravação completa. O gráfico acompanha o controle em ajuste.\nSalve a configuração na barra da etapa e também a cadeia inteira para preservar a combinação: outra cadeia pode substituir várias etapas.',
  'help.deesser.tip':
    'Se a voz ficar com som de língua presa ou a música perder o brilho natural, reduza sensibilidade ou redução máxima. É processamento da reprodução, não do microfone.',
  'help.deesser.keywords':
    'de-esser, deesser, de essing, sibilance, sharp voice, harsh voice, spectral, centre only, center only, cymbals, isolate',
  'help.normalizer.title': 'Normalizador e controle de nível ao vivo',
  'help.normalizer.intro':
    'O Normalizer muda o nível da fonte antes das etapas criativas. Arquivos da Biblioteca podem ser medidos por inteiro; o restante do áudio do sistema é aprendido enquanto toca. Ele fica à parte das cadeias: escolher uma nunca o muda.',
  'help.normalizer.steps':
    'Abra DSP → Normalizador e escolha Desativado, True Peak ou Loudness. Para áudio externo, o mesmo cartão aparece como Controle de nível ao vivo, com Proteção de picos e Nivelamento ao vivo.\nEm True Peak, ajuste o teto de picos. Esse modo reduz o nível se os picos da fonte ultrapassarem o limite; não amplifica fontes mais baixas.\nEm Loudness, ajuste o alvo e o teto de picos. O alvo se aplica aos trechos de três segundos mais fortes; clipes mais curtos usam loudness integrado.\nNa Biblioteca, aguarde o fim da análise da fonte. Consulte o loudness dos trechos fortes, o loudness integrado e o ganho aplicado. O integrado mede a faixa inteira.\nAo vivo, deixe a fonte tocar durante o aprendizado e observe quando o ganho é mantido. Um trecho mais forte pode reduzir o ganho; os trechos suaves mantêm seu nível relativo.\nAntes de aumentar o alvo, confira o ganho aplicado e qualquer motivo de limitação. A margem de picos e o limite de amplificação podem impedir que ele seja atingido. Compare em volume de escuta semelhante; o mesmo alvo para trechos fortes não torna idêntico o loudness total de todas as músicas.',
  'help.normalizer.tip':
    'É diferente da normalização automática à esquerda, que reserva margem para o EQ, e do Master, que ajusta a saída pronta. Nenhum repara distorção já gravada.',
  'help.normalizer.keywords':
    'normalizer, normalisation, normalization, lufs, loudness target, true peak, peak ceiling, applied gain, leveling, live level control, learning source, holding gain',
  'help.crossfade.title': 'Transição cruzada e curvas de transição próprias',
  'help.crossfade.intro':
    'Sobrepõe músicas consecutivas da Biblioteca. É uma opção de reprodução separada dos filtros e não faz transições entre outros apps nem no Karaoke.',
  'help.crossfade.steps':
    'Coloque pelo menos duas músicas na fila da Biblioteca. No DSP, escolha Transição cruzada nas opções de reprodução e ative.\nAjuste a duração e escolha potência constante, suave ou linear. Deixe a primeira música chegar ao fim para ouvir a sobreposição.\nEscolha Personalizada e arraste os pontos das curvas de saída e entrada. Você também pode focar um ponto e usar as setas do teclado.\nObserve as duas curvas e a soma: manter ambas altas pode aumentar o volume da transição.\nSalvar curva guarda a forma com um nome na lista. Redefinir forma retorna a forma editável ao início.',
  'help.crossfade.tip':
    'Se os controles estiverem indisponíveis, inicie uma faixa de áudio da Biblioteca. A curva muda a transição, não o EQ das músicas.',
  'help.crossfade.keywords':
    'crossfade, fade, transition, overlap, dj, equal power, custom curve, save curve, outgoing, incoming',
  'help.gamefilter.title': 'Filtro Jogo: passos, ambiente e vozes',
  'help.gamefilter.intro':
    'Cada jogo tem controles próprios para pistas baixas, ambiente e diálogo. Comece pelo perfil dele e ajuste sua cópia enquanto escuta.',
  'help.gamefilter.steps':
    'Abra Gaming Lab, escolha um jogo e experimente seu som se ainda não estiver carregado. Escolha Jogo entre as partes dele.\nEleve passos, recargas e portas discretos. Calm segura eventos altos que distraem; compare antes de exagerar nos dois controles.\nA opção de cascos e passos pesados aumenta o peso grave de botas, cavalos e veículos. Desligue se deixar as pistas pesadas demais.\nAmbiente abaixa ou aumenta o fundo. Quando um passo ou som distinto se destaca, ele solta a redução para não abaixar a pista junto.\nDiálogo aproxima a voz central. Abrir espaço abaixa um pouco o restante enquanto alguém fala.\nUse o isolamento para ouvir as mudanças e depois volte ao jogo completo. Salvar como perfil conserva a regulagem para outros jogos; redefinir recupera o perfil inicial.',
  'help.gamefilter.tip':
    'Um jogo com áudio 3D próprio pode usar um perfil que mantenha Room desligado para evitar posicionamento duplo. Room é para fones. Ao descarregar o som do jogo, o som da música volta.',
  'help.gamefilter.keywords':
    'game filter, footsteps, lift, calm, environment, ambience, dialogue, voices, make room, hooves, heavy steps, isolate, hrtf, spatial audio',
  'help.songs.title': 'EQ automático: o som de cada música',
  'help.songs.intro':
    'O EQ automático, na página EQ, decide o som de cada música: o som salvo para a música, o som do álbum dela vindo da Biblioteca ou o seu. A Correção inteligente adiciona por cima uma correção medida. O som de uma música a acompanha em todas as saídas; a correção de fones continua sendo da saída.',
  'help.songs.steps':
    'Abra o EQ automático no fim das ferramentas de Seu EQ (o botão fica preenchido enquanto alguma das partes dele está ligada) e ative Sons das músicas, Sons dos álbuns e Correção inteligente como preferir; cada um desliga separadamente. Medir uma vez, no pé do painel ao lado de Gerenciar, mede uma vez o que está tocando e aplica na hora.\nEnquanto uma música toca, pressione Salvar para esta música para guardar o som que você está ouvindo. Quando ela tocar de novo, o som volta; e quando vier uma música sem nada salvo, o seu próprio som volta.\nMude a predefinição, o tom ou uma banda enquanto toca uma música salva e você ouve na hora. Salvar alterações guarda para a música, assim como o botão Salvar ao lado do EQ automático, sem abri-lo; Restaurar, seguido do nome do som salvo, coloca o som salvo de novo. Uma alteração que você não salva não fica: na próxima vez a música toca com o som salvo. Uma alteração numa música sem nada salvo vira o seu som.\nNa Biblioteca, clique com o botão direito numa música, numa seleção ou num álbum, ou use o Som do álbum de um álbum, para escolher um preset ou manter o que está tocando agora. O som próprio de uma música vale mais que o do álbum; os álbuns só mudam na Biblioteca.\nGerenciar lista todas as músicas e álbuns salvos, com Esquecer. Redefinir todas as configurações desliga o EQ automático e os mantém.\nSeus EQs salvos ficam no menu Salvar EQ, nas ferramentas de Seu EQ: guarde o que está tocando como um EQ com nome, atualize o que está ativo, coloque outro ou abra o gerenciamento dos EQs salvos. Uma música salva enquanto um EQ salvo está ativo o segue: atualize esse EQ e a música toca a nova versão.',
  'help.songs.tip':
    'Músicas do Spotify, do YouTube ou do navegador são reconhecidas pelo título e pelo artista que o player informa, e guardam os sons separados dos da Biblioteca. Filmes e vídeos nunca recebem o som de uma música. O EQ automático fica de lado enquanto o DSP está desligado, uma cadeia de Jogos está ativa ou um jogo toca o próprio som.',
  'help.songs.keywords':
    'auto eq, eq automático, por música, som da música, som do álbum, lembrar música, salvar para esta música, correção inteligente, smart correction, smart eq, preset por música, preset por álbum, esquecer, gerenciar, eq salvo, salvar eq',
  'help.mycurves.title': 'Minhas curvas: importar, editar e compartilhar',
  'help.mycurves.intro':
    'Sua coleção de curvas fica ao lado da biblioteca de medições. Confira a resposta e escolha entre camada de correção e bandas de EQ editáveis.',
  'help.mycurves.steps':
    'Abra a página Correções de fones; ela abre em Minhas curvas. Busque ou ordene a lista para encontrar uma curva salva.\nUse Adicionar curva para o seu EQ atual, um arquivo de texto, uma escolha da biblioteca de medições ou dados colados, e diga para quais ouvidos ela é. Importar do Squiglink aceita o texto de EQ exportado dele. Confira a prévia antes de salvar.\nAplicar como curva acrescenta uma camada de correção e deixa suas bandas editáveis no lugar. Aplicar como EQ substitui, depois de confirmar, as bandas dos ouvidos para os quais a curva foi salva.\nO menu de uma curva pode renomeá-la, editar as bandas dela, duplicá-la, copiá-la como texto ou excluí-la. Editar uma curva salva não exige refazer a importação.\nExportar lista e Importar lista levam a coleção inteira entre computadores. Deixe claros o autor da medição e o modelo quando compartilhar uma correção.',
  'help.mycurves.tip':
    'Uma curva descreve uma resposta de frequência; um perfil de saída também guarda o restante do som desse dispositivo. Confira o modelo e a fonte antes de corrigir.',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
