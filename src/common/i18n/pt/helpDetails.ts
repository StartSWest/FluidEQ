/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'Dinâmica: trechos baixos e altos',
  'help.dynamics.intro':
    'Dinâmica é um compressor de três faixas: aumenta trechos baixos e segura os altos sem acrescentar atraso. Pode tratar música, filmes, fala ou o som de um jogo.',
  'help.dynamics.steps':
    'Abra DSP → Dinâmica, ative a etapa e escolha um preset. Os presets de jogos ficam no Gaming Lab.\nAs faixas cobrem graves abaixo de 150 Hz, médios de 150 Hz a 4 kHz e agudos acima de 4 kHz. Ajuste a faixa do som desejado.\nEm Subir, Abaixo de define quando elevar os sons baixos, Proporção a intensidade e Até o ganho máximo. A relação 1:1 não altera o sinal.\nEm Segurar, Acima de define quando reduzir sons altos e Proporção com que força. Baixar o limiar faz a redução agir mais vezes.\nAjuste Ataque e Liberação, Mistura para misturar o original e Compensação para o nível final. Compare em volumes parecidos.\nO gráfico mostra antes, depois e o ganho aplicado: para cima eleva, para baixo segura. Um aviso de atualização do mecanismo pode se referir apenas ao gráfico ao vivo, mesmo com o áudio já sendo processado.',
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
    'Ajusta o nível da fonte antes das etapas criativas. Arquivos da Biblioteca podem ser analisados por completo; outras fontes são aprendidas durante a reprodução.',
  'help.normalizer.steps':
    'Escolha Desligado, Pico verdadeiro ou Sonoridade em DSP → Normalizador. Pico verdadeiro reduz os picos sem amplificar. Sonoridade usa os trechos de três segundos mais fortes; clipes curtos usam a sonoridade integrada.\nEspere a análise da Biblioteca terminar e confira a sonoridade dos trechos fortes, o ganho aplicado e o limite indicado. A sonoridade integrada continua sendo uma medida separada da faixa inteira.\nAo vivo aprende durante a reprodução e pode ajustar o ganho quando chega um trecho mais forte. Os trechos suaves mantêm o nível relativo, portanto a média da faixa pode variar. A margem de pico e o ganho máximo podem impedir que a meta seja atingida.',
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
  'help.songs.title': 'Lembrar o som de cada música',
  'help.songs.intro':
    'Uma música pode lembrar preset, Tone e EQ por saída. O ajuste dos fones não muda a memória dos alto-falantes.',
  'help.songs.steps':
    'Abaixo dos perfis da saída, ative Lembrar o som de cada música. Essa opção começa desligada.\nToque uma música identificável e mude preset, Tone ou EQ. Um aviso informa que será salvo; use a opção de não salvar se era só um teste.\nNa próxima reprodução nessa saída, o ajuste volta temporariamente. Desfazer ignora nesta reprodução; Esquecer esta música também apaga a memória.\nAo terminar, o som anterior da saída retorna. Escolher outro perfil devolve o controle explicitamente.\nO Smart EQ tem seu próprio controle para salvar a música enquanto mede. Ele guarda a correção medida, separadamente da regulagem manual lembrada.',
  'help.songs.tip':
    'A identificação vem do arquivo ou dos dados do player. Títulos ausentes ou errados podem impedir o reconhecimento. O pré-amplificador não é salvo; um jogo com som carregado tem prioridade.',
  'help.songs.keywords':
    'per song, song sound, song memory, remember song, save song eq, smart eq, undo, forget this song, preset per song, tone per song',
  'help.mycurves.title': 'Minhas curvas: importar, editar e compartilhar',
  'help.mycurves.intro':
    'Sua coleção de curvas fica ao lado da biblioteca de medições. Confira a resposta e escolha entre camada de correção e bandas de EQ editáveis.',
  'help.mycurves.steps':
    'Abra EQ Presets → Minhas curvas. Pesquise ou ordene as curvas salvas.\nAdicionar curva aceita o EQ atual, um arquivo de texto, uma medição ou texto colado. A importação do Squiglink usa a exportação de EQ dele. Confira a prévia.\nAplicar como curva adiciona uma camada sem substituir suas bandas. Aplicar como EQ substitui, após confirmação, as bandas dos dois ouvidos, do esquerdo ou do direito conforme o destino.\nO menu permite renomear, editar bandas, duplicar, copiar como texto ou excluir. Não precisa importar de novo para editar.\nExportar lista e Importar lista levam a coleção a outro computador. Preserve o modelo e o autor da medição ao compartilhá-la.',
  'help.mycurves.tip':
    'Uma curva descreve uma resposta de frequência; um perfil de saída também guarda o restante do som desse dispositivo. Confira o modelo e a fonte antes de corrigir.',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
