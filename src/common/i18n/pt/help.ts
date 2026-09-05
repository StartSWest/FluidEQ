/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.share.title': 'Compartilhe áudio entre computadores',
  'help.share.intro':
    'Compartilhar áudio envia som do sistema entre computadores da mesma rede privada. O receptor tem os fones ou alto-falantes; os outros enviam. É diferente de espelhar para outro dispositivo no mesmo computador.',
  'help.share.steps':
    'No computador de escuta, abra Compartilhar áudio, escolha reproduzir neste computador e crie um código. Comece com volume baixo.\nEm cada origem, escolha enviar deste computador, cole o código do receptor e conecte. Mantenha FluidEQ aberto nos dois.\nConfira o monitor e pare de enviar ou receber ao terminar. Se falhar, verifique rede privada compartilhada e permissão do firewall.',
  'help.share.tip':
    'O código autoriza o pareamento: mantenha-o privado. Vários emissores se misturam e podem elevar o nível. O áudio recebido não passa pelo DSP da Biblioteca.',
  'help.menu': 'Ajuda',
  'help.title': 'Guia do usuário',
  'help.subtitle': 'Encontre seu som. Sinta-se em casa.',
  'help.intro':
    'Um guia prático do FluidEQ com capturas reais. Comece pela primeira sessão e explore cada área no seu ritmo.',
  'help.offline': 'Disponível offline',
  'help.search': 'Buscar no guia',
  'help.searchHint': 'Experimente perfis, graves, letras…',
  'help.contents': 'Neste guia',
  'help.results': '{count} capítulos',
  'help.empty':
    'Nenhum capítulo encontrado. Tente uma frase menor ou limpe a busca.',
  'help.clear': 'Limpar busca',
  'help.close': 'Fechar guia',
  'help.enlarge': 'Ampliar captura: {title}',
  'help.closeImage': 'Fechar captura',
  'help.captureNote':
    'Capturas reais do FluidEQ 1.6.x. Cores, nomes e posições podem variar na sua versão. Os ajustes são exemplos, não presets recomendados.',
  'help.steps': 'Experimente',
  'help.tip': 'Vale saber',
  'help.back': 'Voltar ao início',
  'help.start.title': 'Seus primeiros cinco minutos',
  'help.start.intro':
    'Comece com uma música conhecida e volume confortável. À esquerda ficam EQ do sistema e margem; no centro, a área de trabalho; à direita, saída e perfis. O transporte fica embaixo.',
  'help.start.steps':
    'No Windows, instale o Equalizer APO quando oferecido, marque seu dispositivo no seletor e reinicie quando solicitado.\nSelecione esse dispositivo em Dispositivo de saída. Ative EQ do sistema e mantenha a normalização automática.\nReproduza uma música, abra EQ → Bandas, faça uma pequena mudança e compare ligando e desligando a EQ.',
  'help.start.tip':
    'EQ do sistema exige Windows e Equalizer APO. macOS e Linux usam saídas de demonstração; um gráfico em movimento não comprova processamento do sistema.',
  'help.eq.title': 'Modele seu som com EQ',
  'help.eq.intro':
    'Frequência define onde a banda atua; Ganho, o reforço ou corte; Q, a largura: Q maior é mais estreito. Graves dão corpo, médios carregam boa parte da voz e agudos acrescentam brilho.',
  'help.eq.steps':
    'Selecione uma banda em EQ → Bandas. Ajuste frequência, ganho e Q ou arraste seu ponto no gráfico.\nComece com uma banda larga e suave. Compare antes de adicionar outra; o seletor de filtro muda a forma.\nCompare as camadas de fones, EQ, voicing e Smart EQ pelos interruptores e intensidades. Mantenha a normalização ao aumentar ganhos.',
  'help.eq.tip':
    'A curva descreve filtros; o espectro móvel descreve a medição. Smart EQ precisa de áudio. Detail, Balance e Target corrigem aspectos diferentes; compare um modo por vez.',
  'help.headphones.title': 'Correção de fones e importações',
  'help.headphones.intro':
    'A correção compensa um modelo medido e pode ser combinada com suas bandas. Confira modelo exato e autor da medição.',
  'help.headphones.steps':
    'Abra EQ → Presets de EQ, procure seus fones e escolha a medição correspondente.\nUse Importar ajustes de EQ em Ações de áudio para texto de outra ferramenta. Confira bandas e curva antes de aplicar.\nNo Squiglink, exporte o texto, cole no painel e pressione Aplicar EQ importada após revisar.',
  'help.headphones.tip':
    'Uma prévia não aplicada não muda o som. Evite duas correções completas para o mesmo fone por acidente; compare desligando a camada de fones.',
  'help.convolution.title': 'Use uma resposta ao impulso',
  'help.convolution.intro':
    'Convolução aplica um impulso WAV como camada separada. Pesquise o catálogo AutoEq ou importe seu WAV; as bandas paramétricas continuam independentes.',
  'help.convolution.steps':
    'Abra EQ → Convolução e procure modelo ou autor.\nConfira origem e taxa de amostragem; use Baixar e aplicar ou Importar WAV.\nCompare com a camada ligada e desligada e ajuste sua intensidade.',
  'help.convolution.tip':
    'A taxa do impulso precisa corresponder à saída no Equalizer APO. Downloads do catálogo exigem internet; o guia não.',
  'help.profiles.title': 'Dispositivos, perfis e segunda saída',
  'help.profiles.intro':
    'A EQ acompanha a saída. O mapeamento automático guarda alterações no dispositivo atual; perfis nomeados conservam alternativas. Segunda saída espelha o som com nível por dispositivo.',
  'help.profiles.steps':
    'Confira a saída antes de editar. Novo perfil guarda um som; Atualizar salva as mudanças e Restaurar recupera os ajustes salvos.\nAbra Segunda saída, ative um dispositivo acessível e ajuste o nível. Nas versões atuais, selecione o perfil de EQ logo abaixo.\nUse Jogo/Vídeo para reserva inicial menor ou Música para mais margem. Confira a sincronização real.',
  'help.profiles.tip':
    'Cada saída espelhada do Windows usa seu perfil APO. O espelhamento exige FluidEQ aberto e para ao mudar a saída principal. A latência do dispositivo também conta.',
  'help.config.title': 'Inspecione e salve uma cadeia',
  'help.config.intro':
    'EQ → Config mostra o que Equalizer APO realmente tem em disco. As saídas e a árvore de inclusões mostram dispositivos e camadas. Exporte antes de grandes experiências.',
  'help.config.steps':
    'Abra EQ → Config, selecione a saída e confira estado e camadas.\nUse Exportar cadeia para salvar um arquivo .fluideq.\nPara recuperá-lo, selecione primeiro a saída desejada, use Importar cadeia e confira o resultado.',
  'help.config.tip':
    'Camadas geradas são reescritas ao mudar ajustes. Coloque comandos APO permanentes no arquivo personalizado da saída que FluidEQ preserva.',
  'help.online.title': 'Ouça com Mídia online',
  'help.online.intro':
    'Mídia online mantém sites compatíveis ao lado da EQ. Reprodução e login dependem do provedor e da conexão. O transporte inferior acompanha o player ativo.',
  'help.online.steps':
    'Abra Mídia online, escolha um site e inicie a reprodução na página.\nVá à EQ para ajustar ouvindo; volte à página para os controles próprios.\nAtive Um player por vez para evitar sobreposição com outros players.',
  'help.online.tip':
    'O rack DSP processa áudio da Biblioteca, não Mídia online. No Windows, a EQ do sistema ainda pode atuar na saída habilitada para APO.',
  'help.library.title': 'Monte sua biblioteca local',
  'help.library.intro':
    'Biblioteca reúne músicas e vídeos das suas unidades, por álbuns, artistas, faixas, pastas ou vídeos. Capas e metadados vêm dos arquivos.',
  'help.library.steps':
    'Abra Biblioteca e adicione a pasta de mídia. Aguarde a indexação.\nEscolha artista ou álbum, ou busque uma faixa e reproduza.\nUse o transporte inferior para pausar, buscar, pular e controlar o volume em qualquer aba.',
  'help.library.tip':
    'Os arquivos originais precisam estar acessíveis. Reconecte uma unidade removida ou adicione a nova localização de uma pasta movida.',
  'help.queue.title': 'Álbuns e fila de reprodução',
  'help.queue.intro':
    'A fila define a ordem de escuta. Abrir outro álbum permite explorar sem trocar a música atual. A faixa ativa e A seguir ajudam a acompanhar.',
  'help.queue.steps':
    'Abra um álbum e reproduza uma faixa.\nNo menu da faixa, escolha tocar a seguir ou adicionar à fila.\nConfira A seguir e use aleatório ou repetição quando desejar.',
  'help.queue.tip':
    'Iniciar Biblioteca assume a reprodução dos outros players do FluidEQ. O transporte mostra faixa e fonte atuais.',
  'help.dsp.title': 'Explore o rack DSP',
  'help.dsp.intro':
    'DSP processa apenas faixas de áudio da Biblioteca. Karaoke, vídeos, áudio compartilhado recebido e outros apps ficam fora. Inclui Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension, Maximizer e Master.',
  'help.dsp.steps':
    'Reproduza áudio da Biblioteca, abra DSP e ative o rack. Comece por um preset ou estágio.\nAltere um controle e compare desativando o estágio com volume parecido.\nAcompanhe os níveis e salve o rack. Exportar e Importar trocam racks completos.',
  'help.dsp.tip':
    'O Equaliser do DSP e a EQ do sistema são etapas distintas e podem atuar juntos no Windows. Compare em volumes parecidos para julgar o timbre.',
  'help.denoise.title': 'Redução de ruído e análise',
  'help.denoise.intro':
    'Denoise reduz ruído no áudio da Biblioteca. O gráfico ajuda a entender a resposta. Excesso pode apagar detalhes ou causar bombeamento.',
  'help.denoise.steps':
    'Reproduza uma faixa com ruído e selecione Denoise em DSP.\nAtive uma redução leve e ouça trechos quietos e detalhes.\nAumente gradualmente e compare com o estágio desativado.',
  'help.denoise.tip':
    'Não limpa o microfone nem Mídia online. Sem mudança? Confira se a fonte é áudio da Biblioteca e se rack e estágio estão ligados.',
  'help.visuals.title': 'Personalize o player',
  'help.visuals.intro':
    'Curva, espectro e medidor mostram aspectos diferentes. Formas, paletas e picos do visualizador mudam a aparência sem alterar a EQ.',
  'help.visuals.steps':
    'Ative Gráfico de resposta à esquerda e escolha o tamanho em Visualização.\nEscolha a forma e abra Novo visual para ajustar cores, preenchimento, brilho, espaçamento e picos. Salve com um nome.\nEm Ações de áudio, escolha tema ou idioma. Ctrl + mais, menos ou 0 amplia, reduz ou restaura o zoom.',
  'help.visuals.tip':
    'Um espectro se movendo não prova que a EQ chegou ao dispositivo. Compare o som e confira o estado da saída.',
  'help.karaoke.title': 'Cante com Karaoke',
  'help.karaoke.intro':
    'Karaoke combina áudio e letras locais. Letras sincronizadas seguem a reprodução; alvos de afinação exigem dados de notas. Um microfone configurado acrescenta sua afinação ao vivo.',
  'help.karaoke.steps':
    'Abra Karaoke e use Adicionar arquivos ou pasta para áudio e letras correspondentes.\nSelecione uma música, reproduza e confira o pareamento.\nConfigure o microfone, ajuste o tamanho das letras e use a tela cheia do palco.',
  'help.karaoke.tip':
    'Um arquivo só de letras não tem notas-alvo. A ausência de alvos não prova defeito no microfone.',
  'help.maker.title': 'Crie no Karaoke Maker',
  'help.maker.intro':
    'Maker transforma áudio em um projeto editável com letras e notas na linha do tempo. Confira palavras e tempos gerados automaticamente.',
  'help.maker.steps':
    'Abra Criar em Karaoke e carregue o áudio. Escolha as ferramentas de separação ou transcrição necessárias.\nAcompanhe o progresso; o primeiro uso de IA pode baixar modelos. Revise letras e notas.\nOuça pequenos trechos, corrija texto e tempos, salve o projeto e exporte os arquivos.',
  'help.maker.tip':
    'Modelos exigem conexão e espaço. O tempo depende do computador e da música. Use áudio autorizado e revise antes de compartilhar.',
  'help.trouble.title': 'Quando o som está errado',
  'help.trouble.intro':
    'Comece pela fonte e saída, depois isole as camadas. Um gráfico ou interruptor não comprova o caminho do som. Ajuda leva à solução de áudio e ao relato de problemas.',
  'help.trouble.steps':
    'Sem som: confira reprodução, saída, volume e conexão. Um player por vez pode ter pausado outra fonte.\nSem EQ: confira EQ do sistema e o dispositivo no Equalizer APO. Use Corrigir problemas de áudio; reinícios interrompem o som.\nDistorção ou graves demais: mantenha normalização automática, reduza ganhos e desligue camadas uma a uma. Se persistir, revise o relatório antes de enviar.',
  'help.trouble.tip':
    'F1 abre o guia. Escape fecha a captura ampliada e depois o guia. Ctrl + 0 restaura o zoom. Para testar DSP, use uma faixa de áudio da Biblioteca.',
};

export default help;
