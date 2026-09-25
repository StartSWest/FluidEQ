/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The shell around everything: menus, tabs, updates, config, notices. */
import { Dictionary } from '../en';

const app: Partial<Dictionary> = {
  'recovery.title': 'O FluidEQ está se recuperando',
  'recovery.working':
    'Parando a reprodução e recarregando a janela com suas configurações salvas. O trabalho não salvo pode ser perdido.',
  'recovery.stopped':
    'O FluidEQ não conseguiu se recuperar com segurança. As tentativas automáticas foram interrompidas. Você pode recarregar ou sair. O trabalho não salvo pode ser perdido.',
  'recovery.reload': 'Recarregar FluidEQ',
  'recovery.quit': 'Sair',
  'recovery.copy': 'Copiar detalhes',
  'recovery.history': 'Falhas anteriores',
  'app.tagline': 'Seu som. Em todo dispositivo. Automaticamente.',
  'app.actions': 'Ações do FluidEQ',
  'app.actions.title': 'Ações de áudio',
  'app.status.ready': 'Motor de áudio conectado',
  'app.status.checking': 'Verificando o motor de áudio…',
  'app.status.error': 'O motor de áudio não está respondendo',
  'app.menu.importEq': 'Importar configurações de EQ…',
  'app.menu.importConvolution': 'Importar resposta ao impulso…',
  'app.menu.restartAudio': 'Reiniciar o áudio do Windows',
  'engine.apo.reconfigure': 'Reconfigurar o Equalizer APO',
  'engine.apo.settings': 'Configurações do Equalizer APO',
  'app.menu.support': 'Apoie o projeto',
  'app.menu.fix': 'Corrigir',
  'app.menu.reportProblem': 'Relatar um problema',
  'app.menu.about': 'Sobre {product}…',
  'app.processes.menu': 'Processos…',
  'app.processes.eyebrow': 'Processos',
  'app.processes.hint':
    'O Windows dá a todos eles o nome do app, porque são o mesmo programa. Isto é o que cada um faz na realidade pelo FluidEQ.',
  'app.processes.hintSplit':
    'A divisão é proposital: a interface, o desenho e o som funcionam cada um por si, para que uma janela ocupada não atrase a música e uma falha em uma parte não leve as outras junto.',
  'app.processes.process': 'Processo',
  'app.processes.pid': 'PID',
  'app.processes.memory': 'Memória',
  'app.processes.cpu': 'CPU',
  'app.processes.thisWindow': 'esta janela',
  'app.processes.total': '{megabytes} MB e {cpu}% de CPU no total.',
  'app.processes.unmeasured': 'Um traço é um valor que ainda ninguém mediu.',
  'app.processes.scene':
    '{place}: {name}, {ms} ms por quadro a {fps} fps, desenhado em {drawn} para {shown}',
  'app.processes.sceneRate':
    '{place}: {name} a {fps} fps, desenhado em {drawn} para {shown}',
  'app.processes.place.graph': 'Visualizador do gráfico',
  'app.processes.place.studio': 'Palco do Estúdio',
  'app.processes.name.window': 'Interface',
  'app.processes.what.window':
    'A janela que você está vendo: a curva, a biblioteca, o player, todos os controles. Um processo por janela, para que um redesenho pesado não atrase o som. Os visualizadores Plus rodam aqui dentro em uma linha de execução própria, para que uma cena pesada não trave os controles.',
  'app.processes.name.core': 'Núcleo do app',
  'app.processes.what.core':
    'A parte sem janela. Armazena suas configurações, fala com os dispositivos de áudio e com o equalizador do sistema, procura atualizações e inicia todo o resto desta lista.',
  'app.processes.name.engine': 'Motor de áudio (C++)',
  'app.processes.what.engine':
    'O motor próprio do FluidEQ. Decodifica o que você reproduz e aplica o equalizador pelo caminho. É um programa à parte, por isso o Windows o coloca separado dos outros.',
  'app.processes.name.graphics': 'Gráficos',
  'app.processes.what.graphics':
    'Desenha tudo o que está na tela na placa de vídeo: o espectro, a curva, cada animação e as cenas dos visualizadores Plus. Trabalha sempre que algo se move; nenhum modelo roda aqui.',
  'app.processes.name.desktop': 'Visualizador da área de trabalho',
  'app.processes.what.desktop':
    'Um visualizador Plus desenhado como fundo da área de trabalho de um monitor, à parte desta janela: um para cada monitor que o mostra. Pausa enquanto as janelas cobrem esse monitor ou o PC está bloqueado.',
  'app.processes.name.desktopHost':
    'Ajudante do visualizador da área de trabalho',
  'app.processes.what.desktopHost':
    'Coloca o visualizador da área de trabalho desse monitor atrás dos ícones e o avisa quando as janelas cobrem a tela. Um para cada monitor que o mostra.',
  'app.processes.name.shareCapture': 'Captura de áudio',
  'app.processes.what.shareCapture':
    'Captura o que este PC toca, antes do equalizador, para a aba Compartilhar áudio, uma segunda saída e o EQ inteligente. Só roda enquanto um deles está em uso.',
  'app.processes.name.sharePlayback': 'Reprodução do áudio compartilhado',
  'app.processes.what.sharePlayback':
    'Toca o som que outro FluidEQ compartilha com este PC. Só roda enquanto você está ouvindo.',
  'app.processes.name.volume': 'Volume do sistema',
  'app.processes.what.volume':
    'Acompanha o volume e o mudo do Windows para os controles de volume do FluidEQ, e muda o volume quando você move um deles. Só roda enquanto um deles está na tela.',
  'app.processes.name.games': 'Detecção de jogos',
  'app.processes.what.games':
    'Diz ao FluidEQ qual programa está em primeiro plano, para que um jogo tenha seu próprio som assim que você muda para ele. Só roda enquanto um jogo tem som próprio ou a página Presets de jogo está aberta.',
  'app.processes.name.outputs': 'Vigia das saídas',
  'app.processes.what.outputs':
    'Ouve o Windows avisar que uma saída foi conectada, desconectada ou alterada, para que o FluidEQ passe ao perfil dessa saída mesmo com a janela escondida. Roda enquanto o FluidEQ estiver aberto.',
  'app.processes.name.mediaWatch': 'Mídia de outros apps',
  'app.processes.what.mediaWatch':
    'Lê o que o Spotify, um navegador ou outro player está reproduzindo, para que a barra do player possa mostrá-lo e controlá-lo. Fecha quando o FluidEQ não precisa mais dele.',
  'app.processes.name.models': 'Modelos de karaokê',
  'app.processes.what.models':
    'Separa a voz da música e segue a afinação de quem canta quando uma música é preparada para karaokê. Inicia na primeira vez que é preciso e roda à parte, para que um modelo que falhe não derrube o app junto.',
  'app.processes.name.libraryScan': 'Análise da biblioteca',
  'app.processes.what.libraryScan':
    'Lê suas pastas de música enquanto a biblioteca as analisa: tags, durações e capas. Inicia para uma análise e fecha quando termina.',
  'app.processes.name.sound': 'Som do navegador',
  'app.processes.what.sound':
    'O áudio próprio do Chromium, para a aba Mídia online e para os sons de uma página. Sua música não passa por aqui.',
  'app.processes.name.network': 'Rede',
  'app.processes.what.network':
    'Verificação de atualizações, capas e tudo o que a aba Mídia online carrega. Nada mais nesta lista acessa a rede.',
  'app.processes.name.devices': 'Lista de dispositivos',
  'app.processes.what.devices':
    'Iniciado pelo Chromium quando o app pergunta ao Windows quais dispositivos de áudio existem; o mesmo pedido também lista os de vídeo. Não abre nenhuma câmera nem grava nada.',
  'app.processes.name.page': 'Página web',
  'app.processes.what.page':
    'Uma página aberta na aba Mídia online. Roda no seu próprio processo, à parte da interface.',
  'app.processes.name.systemEngine': 'Motor FluidEQ (áudio do Windows)',
  'app.processes.what.systemEngine':
    'O equalizador rodando dentro do próprio serviço de áudio do Windows, que o aplica a tudo o que você ouve. O Windows compartilha esse serviço com os efeitos da sua placa de som, por isso a memória e a CPU são mostradas mas não somadas ao total.',
  'app.processes.name.meter': 'Medidor de processos',
  'app.processes.what.meter':
    'Mede os valores desta lista como o Gerenciador de Tarefas, para que a soma confira. Só roda enquanto esta lista está aberta.',
  'app.processes.name.lighting': 'Iluminação dinâmica',
  'app.processes.what.lighting':
    'Passa as cores da cena para os dispositivos compatíveis com o Windows Dynamic Lighting. Só roda enquanto a iluminação está ligada ou a página dela está aberta.',
  'app.processes.name.helper': 'Serviço auxiliar',
  'app.processes.what.helper':
    'Um serviço do Chromium iniciado a pedido. O FluidEQ nunca o pede pelo nome.',
  'app.menu.reinstallApp': 'Reinstalar {product}…',
  'app.menu.fixAudio': 'Corrigir problemas de áudio…',
  'engine.apo.reinstall': 'Reinstalar Equalizer APO…',
  'engine.title': 'Como o FluidEQ deve processar seu som?',
  'engine.subtitle':
    'Um único motor funciona em todo o PC. Trocar pede permissão ao Windows uma vez.',
  'engine.now': 'Agora: {engine}',
  'engine.recommended': 'RECOMENDADO',
  'engine.fluid.name': 'Motor FluidEQ',
  'engine.fluid.l1':
    'Os efeitos e o painel da sua placa de som continuam funcionando',
  'engine.fluid.l2': 'O EQ e o rack DSP se aplicam a tudo, sem reiniciar',
  'engine.fluid.l3':
    'Comandos personalizados do APO, Peace e plugins VST não funcionam',
  'engine.fluid.l4':
    'O Equalizer APO fica desligado enquanto este motor funciona e volta exatamente como estava se você mudar para ele',
  'engine.apo.name': 'Equalizer APO',
  'engine.apo.l1': 'Comandos personalizados, Peace, plugins VST',
  'engine.apo.l2':
    'Ocupa o slot de efeitos da sua placa de som; os painéis do fabricante podem perder controles',
  'engine.apo.l3':
    'O rack DSP só funciona na reprodução da Biblioteca. Instalação à parte e o Windows reinicia.',
  'engine.apply': 'Aplicar',
  'engine.cancel': 'Cancelar',
  'engine.close': 'Fechar',
  'engine.switched': 'Alterado para {engine}',
  'engine.installing': 'Trocando de motor…',
  'engine.declined':
    'A permissão do Windows foi recusada, por isso nada mudou.',
  'engine.failed': 'Não foi possível trocar de motor. Nada mudou.',
  'engine.detachFailed':
    'Não foi possível remover o Motor FluidEQ desta saída. Nada mudou.',
  'engine.unsupported': 'Requer o Windows 10 versão 1803 ou posterior.',
  'prereq.title.apo': 'O Equalizer APO precisa de atenção',
  'prereq.title.fluid': 'O Motor FluidEQ precisa de atenção',
  'prereq.install.apo': 'Instalar o APO',
  'prereq.install.fluid': 'Instalar o Motor FluidEQ',
  'prereq.retry': 'Tentar de novo',
  'prereq.dismiss': 'Dispensar',
  'prereq.credit.apo':
    'O Equalizer APO vem incluído no {product} — nada será baixado. A instalação dele pergunta quais dispositivos de áudio equalizar e pede um reinício no fim. Projeto GPLv2 independente de {author}, incluído sem alterações.',
  'prereq.starting': 'Iniciando…',
  'prereq.bundleMissing':
    'Esta versão não traz a própria cópia do Equalizer APO. O projeto oficial será aberto em vez disso.',
  'prereq.notStarted':
    'O Equalizer APO não iniciou — é necessária permissão de administrador. Tente de novo e aceite o pedido do Windows.',
  'whatsNew.eyebrow': 'HISTÓRICO DE VERSÕES',
  'whatsNew.title': 'Notas da versão do FluidEQ',
  'whatsNew.loading': 'Carregando as notas da versão…',
  'whatsNew.missing':
    'As notas da versão não foram encontradas nesta compilação. Elas também estão no GitHub.',
  'whatsNew.ok': 'OK',
  'app.menu.whatsNew': 'Novidades',
  'app.menu.language': 'Idioma',
  'app.window.minimize': 'Minimizar',
  'app.window.maximize': 'Maximizar',
  'app.window.restore': 'Restaurar',
  'app.window.close': 'Fechar',
  'app.tray.open': 'Abrir o {product}',
  'app.tray.recoverWindow': 'Recuperar a janela',
  'app.tray.quit': 'Sair do {product}',
  'app.tray.tooltip': '{product} — ainda em execução',
  'app.tray.installUpdate': 'Instalar atualização e reiniciar',
  'app.tray.checkForUpdates': 'Procurar atualizações',
  'app.tray.tooltip.updateReady':
    '{product} — atualização pronta para instalar',
  'app.notification.updateReady.title': 'Atualização do FluidEQ pronta',
  'app.notification.updateReady.body':
    'A versão {version} está pronta. Clique para reiniciar o FluidEQ.',
  'app.notification.updateReady.bodyNoVersion':
    'Uma atualização está pronta. Clique para reiniciar o FluidEQ.',
  'app.notification.upToDate.title': 'O FluidEQ está atualizado',
  'app.notification.upToDate.body': 'Você já tem a versão mais recente.',
  'app.notification.updateFound.title': 'Atualização do FluidEQ encontrada',
  'app.notification.updateFound.body':
    'A versão {version} está sendo baixada. Avisamos quando estiver pronta para instalar.',
  'app.notification.checkFailed.title':
    'Não foi possível procurar atualizações',
  'app.notification.checkFailed.body':
    'Não foi possível contatar o servidor de atualizações. O FluidEQ tentará novamente mais tarde.',
  'app.notification.installFailed.title':
    'Não foi possível instalar a atualização',
  'app.notification.installFailed.body':
    'O FluidEQ não conseguiu iniciar o instalador. Clique para abrir o FluidEQ e tentar novamente.',
  'app.window.minimizeApp': 'Minimizar o FluidEQ',
  'app.window.maximizeApp': 'Maximizar o FluidEQ',
  'app.window.restoreApp': 'Restaurar o FluidEQ',
  'app.window.closeApp': 'Fechar o FluidEQ',
  'app.media.previous': 'Faixa anterior',
  'app.media.playPause': 'Reproduzir ou pausar',
  'app.media.next': 'Próxima faixa',
  'app.media.previousAria':
    'Faixa anterior, em qualquer parte deste computador',
  'app.media.playPauseAria':
    'Reproduzir ou pausar, em qualquer parte deste computador',
  'app.media.nextAria': 'Próxima faixa, em qualquer parte deste computador',
  'app.dismiss': 'Dispensar',
  'common.search': 'Pesquisar…',
  'common.recentSearches': 'Pesquisas recentes',
  'common.clearRecentSearches': 'Limpar pesquisas recentes',
  'common.clearSearch': 'Limpar a pesquisa',
  'common.noMatches': 'Sem resultados',
  'common.filterOptions': 'Filtrar opções',
  'common.increase': 'Aumentar {item}',
  'common.decrease': 'Diminuir {item}',
  'common.icon.edit': 'Editar',
  'common.icon.delete': 'Excluir',
  'common.icon.trash': 'Remover',
  'common.icon.accept': 'Aceitar',
  'common.icon.cancel': 'Cancelar',
  'tabs.aria': 'Área de trabalho de som',
  'tabs.eq': 'EQ',
  'tabs.eqMain': 'Bandas',
  'tabs.presets': 'Presets EQ',
  'tabs.convolution': 'Convolução',
  'tabs.games': 'Presets de jogo',
  'tabs.config': 'Config',
  'tabs.media': 'Mídia online',
  'tabs.mediaShort': 'Mídia',
  'tabs.karaoke': 'Karaokê',
  'tabs.plus': 'Plus',
  'tabs.scrollBack': 'Rolar abas para trás',
  'tabs.scrollForward': 'Rolar abas para a frente',
  'notice.apoReconfigured':
    'O Equalizer APO foi instalado ou reconfigurado. Se ficar sem som, reinicie o serviço de áudio do Windows em vez de reiniciar o computador.',
  'notice.restartNow': 'Reiniciar o áudio agora',
  'notice.importComplete': 'Importação concluída',
  'notice.restartConfirm':
    'O áudio vai parar por alguns segundos e o Windows vai pedir permissão de administrador. Continuar?',
  'restart.title': 'Reiniciar o áudio do Windows',
  'restart.action': 'Reiniciar o áudio',
  'restart.running': 'Reiniciando o áudio…',
  'restart.failed': 'Não foi possível reiniciar o áudio do Windows.',
  'restart.tryAgain': 'Tentar de novo',
  'restart.close': 'Fechar',
  'restart.declined':
    'A permissão do Windows foi negada, então o áudio não foi reiniciado.',
  'update.title': 'Atualização do FluidEQ',
  'update.available': 'A versão {version} está disponível. Baixando agora.',
  'update.downloading': 'Baixando a atualização… {percent}%',
  'update.ready':
    'A versão {version} está pronta. Reinicie o FluidEQ para concluir.',
  'update.restart': 'Reiniciar agora',
  'update.restarting': 'Reiniciando…',
  'update.mandatory.title': 'Esta versão precisa ser atualizada',
  'update.mandatory.body':
    'Esta versão corrige um problema grave o suficiente para que o FluidEQ não deva continuar funcionando como está. A atualização está sendo baixada agora.',
  'update.mandatory.notOptional':
    'Não é uma atualização opcional. Você pode fechar este aviso e terminar o que estava fazendo — ele voltará a aparecer até o FluidEQ ser atualizado.',
  'update.mandatory.later': 'Agora não',
  'update.mandatory.waiting': 'Obtendo a atualização…',
  'update.mandatory.readyPrompt':
    'A atualização já foi baixada. O FluidEQ vai fechar durante a instalação e abrir novamente em seguida.',
  'update.mandatory.install': 'Instalar e reiniciar',
  'update.mandatory.installing': 'Instalando…',
  'update.mandatory.failedDownload':
    'Não foi possível baixar a atualização. Ou não foi possível contatar o servidor de downloads, ou a conexão caiu no meio.',
  'update.mandatory.failedInstall':
    'A atualização foi baixada, mas o instalador não iniciou. O Windows pode tê-lo recusado, ou o arquivo baixado pode estar danificado.',
  'update.mandatory.manual':
    'Você também pode instalá-la manualmente: baixe a versão mais recente na página de downloads e execute-a. Suas configurações e perfis são mantidos.',
  'update.mandatory.releasePage': 'Abrir a página de downloads',
  'notice.restartDone':
    'O áudio do Windows foi reiniciado. Reabra qualquer aplicativo que continuar mudo.',
  'sidebar.systemEq': 'EQ do sistema',
  'sidebar.state.on': '{engine} · ligado',
  'sidebar.state.off': 'Desligado',
  'sidebar.state.notOnOutput': 'Não está nesta saída',
  'sidebar.preamp': 'Pré-amplificação',
  'sidebar.autoLabel': 'AUTO',
  'sidebar.preampAria': 'Ganho de pré-amplificação (dB)',
  'sidebar.preampAuto':
    'É ajustado sozinho. Desligue Normalizar automaticamente para mudar.',
  'sidebar.autoPreamp': 'Normalizar automaticamente',
  'sidebar.visualizer': 'VISUALIZADOR',
  'sidebar.graphView': 'Gráfico de resposta',
  'sidebar.output': 'Saída',
  'config.eyebrow': 'O QUE O MOTOR LÊ',
  'config.title': 'Configuração do Equalizer APO',
  'config.title.fluid': 'Configuração do Motor FluidEQ',
  'config.lede': 'O que está no disco agora, não o que o FluidEQ pretende.',
  'config.reload': 'Recarregar',
  'config.reloadTitle': 'Ler a configuração do disco outra vez',
  'config.reading': 'Lendo…',
  'config.absent':
    'O FluidEQ ainda não escreveu nada nesta instalação do Equalizer APO.',
  'config.absent.fluid':
    'O FluidEQ ainda não escreveu a configuração do Motor FluidEQ.',
  'config.status.notIncluded':
    'O Equalizer APO não está incluindo esta configuração. Nada do que está abaixo é aplicado.',
  'config.status.notIncluded.fluid':
    'O Motor FluidEQ não está lendo esta configuração. Nada do que está abaixo é aplicado.',
  'config.status.engineOff':
    'O EQ do sistema está desligado: esta configuração não nomeia nenhuma saída, então o Equalizer APO não aplica nada dela.',
  'config.status.engineOff.fluid':
    'O EQ do sistema está desligado: esta configuração não nomeia nenhuma saída, então o Motor FluidEQ não aplica nada dela.',
  'config.status.active':
    'Ativa: o Equalizer APO está aplicando esta configuração.',
  'config.status.active.fluid':
    'Ativa: o Motor FluidEQ está aplicando esta configuração.',
  'config.outputsAria': 'Saídas na configuração do Equalizer APO',
  'config.outputsAria.fluid': 'Saídas na configuração do Motor FluidEQ',
  'config.filters.one': '{count} filtro',
  'config.filters.many': '{count} filtros',
  'config.impulse': 'impulso',
  'config.playingNow': 'Tocando agora',
  'config.liveTitle': 'O EQ contínuo mantém esta medição em dia',
  'config.layer.on': 'ativo',
  'config.layer.off': 'inativo',
  'config.layers.noFile': 'Sem arquivo próprio',
  'config.layers.inFile': 'Escrito neste arquivo, não em um próprio.',
  'config.empty': 'Nada incluído: esta saída fica intocada.',
  'config.file.missing': 'ausente',
  'config.export': 'Exportar cadeia',
  'config.import': 'Importar cadeia',
  'config.import.hint': 'A importação se aplica à saída que você está ouvindo.',
  'config.import.customSkipped':
    'O arquivo próprio do remetente foi ignorado: uma linha Include: ou Plugin: carregaria código no áudio do Windows.',
  'config.file.yours': 'seu',
  'config.hint.custom': 'É seu. Nunca é sobrescrito.',
  'config.hint.generated': 'Gerado: reescrito na próxima alteração.',
  'config.hint.saving':
    'Salvar grava o arquivo; o Equalizer APO o assume em seguida.',
  'config.hint.saving.fluid':
    'Salvar grava o arquivo; o Motor FluidEQ o assume em seguida.',
  'config.edit': 'Editar',
  'config.cancel': 'Cancelar',
  'config.save': 'Salvar',
  'disclaimer.heading': 'Sem garantia e sem responsabilidade',
  'disclaimer.asIs':
    'O FluidEQ é fornecido tal como está, sem garantia de qualquer tipo. Ninguém promete que funciona, que serve para aquilo que você quer fazer com ele, nem que continuará funcionando. É o que dizem as seções 15 e 16 da GNU General Public License, e isso se aplica quer esta cópia lhe tenha sido dada, quer você tenha pago por ela.',
  'disclaimer.liability':
    'O FluidEQ altera a forma como o áudio é processado no seu computador e instala e comanda o Equalizer APO, um programa separado que roda com direitos de administrador e fica no caminho de áudio do Windows. Na máxima medida permitida por lei, {author} não responde por quaisquer danos resultantes da sua utilização — à sua audição, a alto-falantes, fones de ouvido ou outro equipamento, a dados ou a outro software, nem a qualquer outra coisa, incluindo perdas que você não pudesse ter previsto.',
  'disclaimer.volume':
    'O som pode ser alto, e a equalização pode torná-lo mais alto do que o material original. Baixe o volume antes de mudar uma configuração e suba-o depois.',
  'disclaimer.localLaw':
    'Alguns países não permitem que um vendedor exclua certas garantias ou responsabilidades. Onde for esse o caso, aplicam-se essas regras e este aviso não lhe retira os direitos que a lei lhe dá.',
  'disclaimer.accepting': 'Ao usar o FluidEQ, você aceita o que está acima.',
  'disclaimer.language':
    'Este aviso foi escrito em inglês. Se uma tradução divergir do texto em inglês, prevalece o texto em inglês.',
  'disclaimer.accept': 'Compreendo e aceito',
  'disclaimer.decline': 'Sair',
  'provenance.heading': 'Verifique de onde veio esta cópia',
  'provenance.body':
    'O instalador oficial assinado do FluidEQ é distribuído apenas através de fluideq.com. Compilações a partir do código-fonte devem vir do repositório oficial. A GPL permite que terceiros copiem, modifiquem, recompilem e vendam o FluidEQ, mas as versões deles não são automaticamente assinadas, revisadas, suportadas nem aprovadas pelo FluidEQ. Se um download afirmar ser oficial e não tiver uma assinatura digital válida do Windows, feche-o e denuncie-o.',
  'provenance.site': 'Site oficial: fluideq.com',
  'provenance.repository': 'Código oficial: github.com/StartSWest/FluidEQ',
  'language.aria': 'Idioma da interface',
  'theme.aria': 'Tema',
  'motion.aria': 'Animações',
  'motion.restart': 'Reinicie o FluidEQ para aplicar',
  'startup.label': 'Iniciar com o Windows',
  'startup.blocked': 'O Windows desativou isto em Aplicativos de inicialização',
  'startup.failed': 'O Windows não permitiu alterar isto',
  'theme.ocean': 'Claro',
  'theme.black': 'Escuro',
  // The settings a visualizer has, grouped the same way and in the same
  // order wherever they are offered — see `common/settingsGroups.ts`.
  'settings.group.picture': 'A imagem',
  'settings.group.visualizer': 'O visualizador',
  'settings.group.drawing': 'Como é desenhado',
  'settings.group.thisView': 'Esta visualização',
  'settings.group.studioOnly': 'Só aqui no Estúdio',

  // Game profiles: the page, its list and what it says.
  'games.add': 'Adicionar um jogo',
  'games.addHint':
    'Escolha um jogo dos seus lançadores, ou um programa aberto agora.',
  'games.choose': 'Escolher um programa…',
  'games.group.installed': 'Instalados',
  'games.group.running': 'Abertos agora',
  'games.source.steam': 'Steam',
  'games.source.epic': 'Epic Games',
  'games.source.ea': 'EA',
  'games.source.gog': 'GOG',
  'games.source.ubisoft': 'Ubisoft',
  'games.source.battlenet': 'Battle.net',
  'games.source.xbox': 'Xbox',
  'games.source.running': 'Aberto agora',
  'games.source.file': 'Escolhido por você',
  'games.front.playing': '{name} está à frente, e o som dele está ligado.',
  'games.front.sounding': '{name} está aberto, e o som dele está ligado.',
  'games.toast.loaded': '{preset} carregado',
  'games.toast.forGame': 'para {game}',
  'games.toast.restored': 'De volta a {preset}',
  'games.toast.restoredNone': 'Efeitos desligados de novo',
  'games.toast.afterGame': 'depois de {game}',
  'games.empty.title': 'Ainda não há jogos',
  'games.empty.more':
    'Adicione um jogo, dê um som a ele, e o FluidEQ muda para ele assim que o jogo estiver à frente — e volta quando você fechar o jogo.',
  'games.preset.none': 'Deixar como está',
  'games.preset.noneHint': 'Nada muda quando este jogo está à frente.',
  'games.row.inFront': 'à frente',
  'games.row.sounding': 'som ligado',
  'games.row.sound': 'Som para {name}',
  'games.row.remove': 'Remover {name}',
};

export default app;
