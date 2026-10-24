/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dictionary } from '../en';

/** Portuguese of `./en.ts`, the Linux wording; see there. */
const pt: Partial<Dictionary> = {
  'app.menu.restartAudio': 'Reiniciar o áudio',
  'restart.title': 'Reiniciar o áudio',
  'restart.failed': 'Não foi possível reiniciar o áudio.',
  'notice.restartConfirm':
    'O áudio vai parar por alguns segundos enquanto o Motor FluidEQ inicia de novo. Continuar?',
  'notice.restartDone':
    'O áudio foi reiniciado. Reabra qualquer aplicativo que continuar mudo.',
  'troubleshoot.restart.title': 'Reiniciar o áudio',
  'troubleshoot.restart.cost':
    'Alguns segundos de silêncio enquanto o Motor FluidEQ inicia de novo. Sem senha.',
  'engine.title': 'Como o FluidEQ processa seu som',
  'engine.subtitle':
    'O Motor FluidEQ roda ao lado do seu servidor de som, PipeWire ou PulseAudio, enquanto o FluidEQ estiver aberto.',
  'engine.fluid.l1':
    'Funciona com PipeWire e PulseAudio, em qualquer distribuição',
  'engine.fluid.l2':
    'O EQ e o rack DSP se aplicam a tudo o que você ouve, sem reiniciar',
  'engine.fluid.l3':
    'Linhas Plugin: e plugins VST na configuração não funcionam',
  'output.hint':
    'As edições são salvas no perfil ativo e acompanham esta saída sempre que ela é a que está tocando.',
  'extraOutput.ambiguous':
    'Duas saídas têm este mesmo nome, então o FluidEQ não consegue saber qual você quer. Renomeie uma nas suas configurações de som.',
  'extraOutput.unmatched':
    'As suas configurações de som listam esta saída, mas o FluidEQ não consegue alcançá-la, então não dá para espelhar nela.',
  'convolution.eyebrow': 'RESPOSTAS AO IMPULSO',
  'convolution.notice.fluid':
    'O catálogo para download é fornecido pelo AutoEq. Cada download corresponde à taxa em que sua saída funciona, e o Motor FluidEQ converte sozinho qualquer outra taxa.',
  'graph.scene.gpu.auto': 'O sistema decide',
  'settingsReset.body':
    'O gráfico e os visualizadores, Cores da janela, o player, a Biblioteca, o idioma, Animações e Iniciar com a sessão voltam a ser como em uma nova instalação do FluidEQ.',
  'app.processes.hint':
    'O seu sistema dá a todos eles o nome do app, porque são o mesmo programa. Isto é o que cada um faz na realidade pelo FluidEQ.',
  'app.processes.what.engine':
    'O motor próprio do FluidEQ. Decodifica o que você reproduz e aplica o equalizador pelo caminho. É um programa à parte dos outros, por isso uma janela ocupada não consegue travar a música.',
  'app.processes.what.devices':
    'Iniciado pelo Chromium quando o app pergunta quais dispositivos de áudio existem; o mesmo pedido também lista os de vídeo. Não abre nenhuma câmera nem grava nada.',
  'app.processes.name.systemEngine': 'Motor FluidEQ (áudio do sistema)',
  'app.processes.what.systemEngine':
    'O equalizador entre seus apps e seu servidor de som, que o aplica a tudo o que você ouve. O FluidEQ o inicia e o encerra junto consigo; a memória e a CPU dele são mostradas mas não somadas ao total.',
  'dsp.normalizer.liveGuidance':
    'O nivelamento ao vivo acompanha a música que está tocando. Um trecho forte reduz o ganho para o resto da música; a próxima mantém esse nível, a menos que seja muito mais suave. Músicas já ouvidas são niveladas desde o primeiro segundo. O ganho sobe no máximo 6 dB dentro da margem de pico; o alvo não é garantido. Desative e reative para analisar novamente. Não corrige distorção existente.',
  'dsp.latency.hint':
    'Atraso adicionado pelo processamento do motor. Servidor de som, dispositivo e rede não estão incluídos.',
  'dsp.latency.note':
    'Buffers informados pelo motor na taxa atual. Servidor de som, dispositivo e rede não estão incluídos.',
  'dsp.surround.onHint':
    'Passa o rack por todos os canais de uma saída 5.1 ou 7.1, conforme sua saída está definida, com uma única decisão de nível para todos.',
  'update.mandatory.failedInstall':
    'A atualização foi baixada, mas o instalador não iniciou. O arquivo baixado pode estar danificado.',
  'startup.label': 'Iniciar com a sessão',
  'startup.blocked':
    'Sua área de trabalho desativou isto nos aplicativos de inicialização',
  'startup.failed': 'O seu sistema não permitiu alterar isto',
  'disclaimer.liability':
    'O FluidEQ altera a forma como o áudio é processado no seu computador: o motor dele fica entre seus apps e seu servidor de som e processa tudo o que você ouve. Na máxima medida permitida por lei, {author} não responde por quaisquer danos resultantes da sua utilização — à sua audição, a alto-falantes, fones de ouvido ou outro equipamento, a dados ou a outro software, nem a qualquer outra coisa, incluindo perdas que você não pudesse ter previsto.',
  'provenance.body':
    'Os pacotes oficiais do FluidEQ são distribuídos apenas através de fluideq.com. Compilações a partir do código-fonte devem vir do repositório oficial. A GPL permite que terceiros copiem, modifiquem, recompilem e vendam o FluidEQ, mas as versões deles não são revisadas, suportadas nem aprovadas pelo FluidEQ. Se um download afirmar ser oficial e não tiver vindo de fluideq.com nem do repositório oficial, feche-o e denuncie-o.',
  'engineHealth.offBody':
    'Esta saída está tocando sem o seu EQ. Reiniciar o áudio costuma trazer o motor de volta, e todo o resto no FluidEQ continua funcionando enquanto isso.',
  'engineHealth.rackNeedsEngine':
    'Os efeitos DSP rodam dentro do próprio motor. Reiniciar o áudio o inicia de novo; se isso não ajudar, reinstalar o FluidEQ coloca o motor dele de volta no lugar.',
  'tour.engine.lead':
    'O FluidEQ agora tem um motor de áudio próprio. Ele roda ao lado do seu servidor de som, PipeWire ou PulseAudio, e leva seu EQ e todo o rack DSP a tudo o que o computador toca: jogos, navegadores e apps de streaming, não só a Biblioteca.',
  'tour.engine.flow.inside': 'Ao lado do seu servidor de som',
  'tour.dsp.lead':
    'Um rack de estágios de estúdio: Normalizador, Redução de ruído, Excitador, Forja de graves, Equalizador, Punch dos graves, Dimensão, Sala, Maximizador e Master, mais uma transição cruzada entre faixas da Biblioteca. Ele funciona em tudo o que o computador toca. Cada estágio tem sua própria página com uma visualização ao vivo, a maioria tem presets, e cinco têm um interruptor Isolar para ouvir só o que estão fazendo.',
  'tour.dsp.how':
    'Abra a aba DSP, escolha uma cadeia em Presets, depois clique em um estágio nas abas laterais e ligue-o.',
  'help.start.steps':
    'Instale o FluidEQ pelo .deb ou pelo AppImage e abra-o: o Motor FluidEQ inicia junto, sem senha e sem reiniciar.\nEscolha seu dispositivo de escuta em Dispositivo de saída. Ative EQ do sistema e deixe Normalizar automaticamente ligado.\nReproduza uma música, abra EQ → Bandas, faça uma pequena mudança e compare com o EQ do sistema desligado e ligado.',
  'help.start.tip':
    'O EQ em todo o sistema no Linux precisa do PipeWire ou do PulseAudio, que todos os ambientes de trabalho atuais usam. Com o FluidEQ aberto, tudo o que você toca passa por ele; ao sair, seu som volta intacto.',
  'help.window.tip':
    'O menu Ajuda abre este guia, Novidades, a solução de problemas de áudio e Relatar um problema. O botão de pulso ao lado dele reúne o cartão do motor, sua conta, a importação de configurações de EQ ou de uma resposta ao impulso, o reinício do áudio e Processos, que mostra o que cada parte do FluidEQ está usando; na parte de baixo dele ficam Brilho e Transparência, as animações, Iniciar com a sessão e o idioma. O botão depois deles transforma a janela no Player compacto.',
  'help.window.actions':
    'O motor, sua conta, a importação de configurações de EQ, o reinício do áudio e Processos; Brilho e Transparência, as animações, Iniciar com a sessão e o idioma.',
  'help.player.tip':
    'O volume do player é o do seu computador, então ele ajusta o nível de tudo o que o computador toca. Se o player acabar fora da tela, clique com o botão direito no ícone do FluidEQ na barra superior e escolha Recuperar a janela.',
  'help.player.volume':
    'O volume do seu computador: ele ajusta o nível de tudo o que o computador toca.',
  'help.requirements.intro':
    'O FluidEQ roda em qualquer ambiente de trabalho Linux de 64 bits dos últimos anos — Ubuntu, Debian, Fedora, Mint, Arch e os demais. Duas partes pedem mais que o resto: os visualizadores Plus desenham na placa de vídeo, e o karaokê com IA baixa seus modelos na primeira vez que você o usa.',
  'help.requirements.steps':
    'Veja seu sistema: Linux de 64 bits com PipeWire ou PulseAudio (todo ambiente de trabalho atual tem um), 4 GB de memória e cerca de 600 MB de disco. O .deb é para Ubuntu, Debian e seus derivados; o AppImage roda nos demais.\nAbra um visualizador: qualquer placa de vídeo ou vídeo integrado de 2013 em diante. Em 1080p o vídeo integrado basta; para 4K, uma placa dedicada é melhor. Com a placa ocupada, o FluidEQ desenha a cena menor e solta as que você não está vendo.\nExperimente o karaokê com IA: separar a voz baixa um modelo de 713 MB na primeira vez, o da afinação acrescenta cerca de 180 MB e o de remover ruído, 11 MB. Ele roda no processador, onde uma música de quatro minutos é separada em cerca de quatro minutos. Deixe 2 GB de memória livres enquanto ele trabalha.\nMire nisto se puder: 8 GB de memória, vídeo de 2018 em diante e 3 GB de disco livres se você usar os recursos com IA.',
  'help.requirements.keywords':
    'requisitos mínimos, configuração mínima, recomendado, especificações, hardware, notebook, laptop, GPU, CPU, RAM, armazenamento, espaço em disco, desempenho, performance, lento, travando, lag, PC fraco, consumo, compatibilidade, compatível, Linux, Ubuntu, Debian, Fedora, Mint, Arch, PipeWire, PulseAudio, deb, AppImage',
  'help.engine.intro':
    'O FluidEQ processa seu som com um motor próprio. O Motor FluidEQ roda ao lado do seu servidor de som (PipeWire ou PulseAudio): ele se torna a saída do sistema, leva seu EQ e o rack DSP a tudo o que o computador toca, envia o resultado para a sua saída real e sai do caminho assim que o FluidEQ fecha.',
  'help.engine.steps':
    'Abra o menu de ações (o botão de pulso no canto superior direito). O cartão do motor, no topo, diz se o motor está funcionando.\nEscolha a saída em que você ouve no painel Saída. O FluidEQ toca nela e acompanha você quando escolhe outra nas configurações de som.\nSe um aviso disser que o motor não está funcionando, pressione Reiniciar o áudio.',
  'help.engine.tip':
    'Deixe o FluidEQ como saída do sistema: escolher alto-falantes ou um headset nas configurações de som não tem problema, o FluidEQ acompanha. Sair do FluidEQ devolve todos os apps à saída que você escolheu.',
  'help.engine.keywords':
    'motor de áudio, engine, driver, global, todos os programas, todos os aplicativos, Spotify, Discord, navegador, PipeWire, PulseAudio, servidor de som, saída, saída padrão, reiniciar o áudio',
  'help.engine.apo':
    'Não no Linux: o Equalizer APO é um programa do Windows, e aqui quem faz esse trabalho é o Motor FluidEQ.',
  'help.engine.apply':
    'Não é necessário no Linux: o Motor FluidEQ é o único motor e já é o que está em uso.',
  'help.convolution.tip':
    'O Motor FluidEQ converte sozinho qualquer taxa do impulso. Os downloads do catálogo precisam de conexão; o guia não.',
  'help.profiles.output':
    'A saída pela qual você está ouvindo, com a bateria em fones Bluetooth. DESLIG. significa que seu EQ não chega a ela; ATIVO, que é a saída tocando agora.',
  'help.config.tip':
    'Os arquivos de camadas gerados são reescritos quando os ajustes deles mudam; coloque linhas manuais permanentes no arquivo personalizado de cada saída. O Motor FluidEQ lê as linhas Filter, Preamp, GraphicEQ e Convolution desse arquivo; linhas Plugin: e plugins VST não funcionam no Linux.',
  'help.dsp.intro':
    'O rack DSP é uma cadeia de estágios de estúdio. Com o Motor FluidEQ, ele processa tudo o que o computador toca. Ele fica desligado enquanto o FluidEQ está desligado.',
  'help.room.tip':
    'Jogos e filmes só enviam os canais surround para uma saída configurada com esse número de alto-falantes: quando seu dispositivo os tem, escolha 5.1 ou 7.1 para ele nas configurações de som.',
  'help.online.tip':
    'Com o Motor FluidEQ, a Mídia online passa pelo seu EQ e pelo rack DSP como qualquer outro app.',
  'help.library.tip':
    'A Biblioteca precisa dos arquivos originais: reconecte uma unidade ou adicione de novo uma pasta que foi movida.',
  'help.share.tip':
    'Mantenha o código de conexão privado: ele autoriza o vínculo. Este computador mantém o DSP enquanto compartilha, e o computador que toca o som dele aplica o próprio. Tocar e enviar ao mesmo tempo exige Windows, ou o Motor FluidEQ no Linux, nesse computador; em outros, um vínculo funciona em um sentido só.',
  'help.trouble.steps':
    'Sem som: confirme que a reprodução está rodando, que a saída esperada está selecionada, que o volume está alto e que o dispositivo está conectado. Veja se Um reprodutor de cada vez pausou outra fonte.\nSem efeito do EQ: confirme que o EQ do sistema está ligado e que a saída não mostra o selo DESLIG. Se um aviso disser que o motor não está funcionando, pressione Reiniciar o áudio.\nEstá tudo certo e o EQ continua sem fazer nada: verifique se o FluidEQ ainda é a saída nas configurações de som; reiniciar o áudio o coloca de volta.\nDistorção ou graves demais: deixe Normalizar automaticamente ligado, reduza os reforços e desative as camadas uma por vez. Se continuar, use Relatar um problema e revise o relatório antes de enviar.',
  'troubleshoot.description':
    'No Linux um único passo resolve quase todos os problemas: reiniciar o Motor FluidEQ, que leva alguns segundos.',
  'troubleshoot.footer':
    'Ainda com problema depois disso? Use **{report}** no mesmo menu: ele reúne os registros, remove tudo o que possa identificar você e mostra tudo antes de enviar.',
  'help.window.plus': 'Visualizadores, a galeria e o Estúdio.',
  'help.plus.intro':
    'A conta é opcional: tudo o que era gratuito funciona neste computador sem ela. Conectado, a aba Plus reúne Visualizadores e o Estúdio. Uma cena de Visualizadores custa um crédito e é sua para sempre; uma conta confirmada recebe alguns créditos grátis, e os pacotes de créditos são pagos uma única vez.',
  'help.gallery.desktop':
    'Só no Windows: coloca a cena atrás dos ícones da área de trabalho.',
  'help.gallery.manage':
    'Só no Windows: o que cada monitor mostra como fundo da área de trabalho.',
  'help.gallery.stop':
    'Só no Windows: para todos os fundos da área de trabalho.',
  'help.library.steps':
    'Abra Biblioteca e adicione a pasta com suas mídias. Deixe a leitura terminar antes de avaliar o que está faltando.\nEscolha um artista ou álbum, ou busque uma música. Inicie uma faixa nos resultados.\nUse a barra na parte de baixo da janela para pausar, mudar a posição e pular. O volume dela é o do seu computador.',
};

export default pt;
