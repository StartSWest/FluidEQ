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
  'app.tagline': 'Seu som. Em todo dispositivo. Automaticamente.',
  'app.actions': 'Ações do FluidEQ',
  'app.actions.title': 'Ações de áudio',
  'app.status.ready': 'Conectado ao Equalizer APO',
  'app.status.checking': 'Verificando o Equalizer APO…',
  'app.status.error': 'O Equalizer APO não está respondendo',
  'app.menu.importEq': 'Importar configurações de EQ…',
  'app.menu.importConvolution': 'Importar resposta ao impulso…',
  'app.menu.restartAudio': 'Reiniciar o áudio do Windows',
  'app.menu.reconfigure': 'Reconfigurar o Equalizer APO',
  'app.menu.apoSettings': 'Configurações do Equalizer APO',
  'app.menu.support': 'Apoie o projeto',
  'app.menu.fix': 'Corrigir',
  'app.menu.reportProblem': 'Relatar um problema',
  'app.menu.about': 'Sobre {product}…',
  'app.processes.menu': 'Processos…',
  'app.processes.eyebrow': 'Processos',
  'app.processes.hint':
    'O Windows dá a todos eles o nome da aplicação, porque são o mesmo programa. Isto é o que cada um faz na realidade pelo FluidEQ.',
  'app.processes.hintSplit':
    'A divisão é propositada: a interface, o desenho e o som funcionam cada um por si, para que uma janela ocupada não atrase a música e uma falha numa parte não leve as restantes atrás.',
  'app.processes.process': 'Processo',
  'app.processes.pid': 'PID',
  'app.processes.memory': 'Memória',
  'app.processes.cpu': 'CPU',
  'app.processes.thisWindow': 'esta janela',
  'app.processes.total': '{megabytes} MB no total.',
  'app.processes.unmeasured': 'Um traço é um valor que ainda ninguém mediu.',
  'app.processes.name.window': 'Interface',
  'app.processes.what.window':
    'A janela que está a ver: a curva, a biblioteca, o leitor, todos os controlos. Um processo por janela, para que um redesenho pesado não atrase o som.',
  'app.processes.name.core': 'Núcleo da app',
  'app.processes.what.core':
    'A parte sem janela. Guarda as suas definições, fala com os dispositivos de áudio e com o equalizador do sistema, procura atualizações e arranca tudo o resto desta lista.',
  'app.processes.name.engine': 'Motor de áudio (C++)',
  'app.processes.what.engine':
    'O motor próprio do FluidEQ. Descodifica o que reproduz e aplica o equalizador pelo caminho. É um programa à parte, por isso o Windows arruma-o longe dos restantes.',
  'app.processes.name.graphics': 'Gráficos',
  'app.processes.what.graphics':
    'Desenha a janela na placa gráfica: o espetro, a curva, cada animação. Trabalha sempre que algo se move no ecrã; aqui não corre nenhum modelo de karaoke ou de ruído.',
  'app.processes.name.sound': 'Som do navegador',
  'app.processes.what.sound':
    'O áudio próprio do Chromium, para o separador Vídeo e para os sons de uma página. A sua música não passa por aqui.',
  'app.processes.name.network': 'Rede',
  'app.processes.what.network':
    'Verificação de atualizações, capas e tudo o que o separador Vídeo carrega. Mais nada nesta lista vai à rede.',
  'app.processes.name.camera': 'Serviço de câmara',
  'app.processes.what.camera':
    'Iniciado pelo Chromium quando a app pede ao Windows a lista de dispositivos de áudio, porque a mesma chamada enumera também as câmaras. Não mantém nenhuma câmara aberta.',
  'app.processes.name.page': 'Página web',
  'app.processes.what.page':
    'Uma página aberta no separador Vídeo. Corre no seu próprio processo, à parte da interface.',
  'app.processes.name.helper': 'Serviço auxiliar',
  'app.processes.what.helper':
    'Um serviço do Chromium iniciado a pedido. O FluidEQ nunca o pede pelo nome.',
  'app.menu.reinstallApp': 'Reinstalar {product}…',
  'app.menu.fixAudio': 'Corrigir problemas de áudio…',
  'app.menu.reinstallApo': 'Reinstalar Equalizer APO…',
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
  'app.notification.upToDate.body': 'Já tem a versão mais recente.',
  'app.notification.updateFound.title': 'Atualização do FluidEQ encontrada',
  'app.notification.updateFound.body':
    'A versão {version} está a ser transferida. Avisamos quando estiver pronta para instalar.',
  'app.notification.checkFailed.title':
    'Não foi possível procurar atualizações',
  'app.notification.checkFailed.body':
    'Não foi possível contactar o servidor de atualizações. O FluidEQ tentará novamente mais tarde.',
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
  'tabs.voicing': 'Caráter',
  'tabs.convolution': 'Convolução',
  'tabs.config': 'Config',
  'tabs.media': 'Mídia online',
  'tabs.mediaShort': 'Mídia',
  'tabs.karaoke': 'Karaokê',
  'tabs.scrollBack': 'Rolar separadores para trás',
  'tabs.scrollForward': 'Rolar separadores para a frente',
  'notice.apoReconfigured':
    'O Equalizer APO foi instalado ou reconfigurado. Se ficar sem som, reinicie o serviço de áudio do Windows em vez de reiniciar o computador.',
  'notice.restartNow': 'Reiniciar o áudio agora',
  'notice.importComplete': 'Importação concluída',
  'notice.restartConfirm':
    'O áudio vai parar por alguns segundos e o Windows vai pedir permissão de administrador. Continuar?',
  'update.title': 'Atualização do FluidEQ',
  'update.available': 'A versão {version} está disponível. Baixando agora.',
  'update.downloading': 'Baixando a atualização… {percent}%',
  'update.ready':
    'A versão {version} está pronta. Reinicie o FluidEQ para concluir.',
  'update.restart': 'Reiniciar agora',
  'update.restarting': 'Reiniciando…',
  'update.mandatory.title': 'Esta versão precisa de ser atualizada',
  'update.mandatory.body':
    'Esta versão corrige um problema grave o suficiente para que o FluidEQ não deva continuar a funcionar como está. A atualização está a ser transferida agora.',
  'update.mandatory.notOptional':
    'Não é uma atualização opcional. Pode fechar este aviso e terminar o que estava a fazer — voltará a aparecer até o FluidEQ estar atualizado.',
  'update.mandatory.later': 'Agora não',
  'update.mandatory.waiting': 'A obter a atualização…',
  'update.mandatory.readyPrompt':
    'A atualização já foi transferida. O FluidEQ vai fechar durante a instalação e abrir novamente a seguir.',
  'update.mandatory.install': 'Instalar e reiniciar',
  'update.mandatory.installing': 'A instalar…',
  'update.mandatory.failedDownload':
    'Não foi possível transferir a atualização. Ou não se conseguiu contactar o servidor de transferências, ou a ligação caiu a meio.',
  'update.mandatory.failedInstall':
    'A atualização foi transferida, mas o instalador não arrancou. O Windows pode tê-lo recusado, ou o ficheiro transferido pode estar danificado.',
  'update.mandatory.manual':
    'Também pode instalá-la manualmente: transfira a versão mais recente na página de lançamentos e execute-a. As suas definições e perfis são mantidos.',
  'update.mandatory.releasePage': 'Abrir a página de transferências',
  'notice.restartDone':
    'O áudio do Windows foi reiniciado. Reabra qualquer aplicativo que continuar mudo.',
  'sidebar.engine': 'MOTOR',
  'sidebar.systemEq': 'EQ do sistema',
  'sidebar.preamp': 'Pré-amplificação',
  'sidebar.preampAria': 'Ganho de pré-amplificação (dB)',
  'sidebar.preampAuto':
    'É ajustado sozinho. Desligue Normalizar automaticamente para mudar.',
  'sidebar.headroom': 'MARGEM DO APO',
  'sidebar.autoPreamp': 'Normalizar automaticamente',
  'sidebar.visualizer': 'VISUALIZADOR',
  'sidebar.graphView': 'Gráfico de resposta',
  'config.eyebrow': 'O QUE O MOTOR LÊ',
  'config.title': 'Configuração do Equalizer APO',
  'config.lede': 'O que está no disco agora, não o que o FluidEQ pretende.',
  'config.reload': 'Recarregar',
  'config.reloadTitle': 'Ler a configuração do disco outra vez',
  'config.reading': 'Lendo…',
  'config.absent':
    'O FluidEQ ainda não escreveu nada nesta instalação do Equalizer APO.',
  'config.status.notIncluded':
    'O Equalizer APO não está incluindo esta configuração. Nada do que está abaixo é aplicado.',
  'config.status.engineOff':
    'O motor do FluidEQ está desligado: esta configuração não nomeia nenhuma saída, então o Equalizer APO não aplica nada dela.',
  'config.status.active':
    'Ativa: o Equalizer APO está aplicando esta configuração.',
  'config.outputsAria': 'Saídas na configuração do Equalizer APO',
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
  'config.import.hint': 'A importação aplica-se à saída que estás a ouvir.',
  'config.import.customSkipped':
    'O arquivo próprio do remetente foi ignorado: uma linha Include: ou Plugin: carregaria código no áudio do Windows.',
  'config.file.yours': 'seu',
  'config.hint.custom': 'É seu. Nunca é sobrescrito.',
  'config.hint.generated': 'Gerado: reescrito na próxima alteração.',
  'config.hint.saving':
    'Salvar grava o arquivo; o Equalizer APO o assume em seguida.',
  'config.edit': 'Editar',
  'config.cancel': 'Cancelar',
  'config.save': 'Salvar',
  'disclaimer.heading': 'Sem garantia e sem responsabilidade',
  'disclaimer.asIs':
    'O FluidEQ é fornecido tal como está, sem garantia de qualquer tipo. Ninguém promete que funciona, que serve para aquilo que quer fazer com ele, nem que continuará a funcionar. É o que dizem as secções 15 e 16 da GNU General Public License, e aplica-se quer lhe tenham dado esta cópia quer tenha pago por ela.',
  'disclaimer.liability':
    'O FluidEQ altera a forma como o áudio é processado no seu computador e instala e comanda o Equalizer APO, um programa separado que corre com direitos de administrador e fica no caminho de áudio do Windows. Na máxima medida permitida por lei, {author} não responde por quaisquer danos resultantes da sua utilização — à sua audição, a colunas, auscultadores ou outro equipamento, a dados ou a outro software, nem a seja o que for, incluindo perdas que não pudesse ter previsto.',
  'disclaimer.volume':
    'O som pode ser alto, e a equalização pode torná-lo mais alto do que o material original. Baixe o volume antes de mudar uma definição e suba-o depois.',
  'disclaimer.localLaw':
    'Alguns países não permitem que um vendedor exclua certas garantias ou responsabilidades. Onde for esse o caso, aplicam-se essas regras e este aviso não lhe retira os direitos que a lei lhe dá.',
  'disclaimer.accepting': 'Ao usar o FluidEQ, aceita o que está acima.',
  'disclaimer.language':
    'Este aviso foi escrito em inglês. Se uma tradução divergir do texto em inglês, prevalece o texto em inglês.',
  'disclaimer.accept': 'Compreendo e aceito',
  'disclaimer.decline': 'Sair',
  'provenance.heading': 'Verifique de onde veio esta cópia',
  'provenance.body':
    'O instalador oficial assinado do FluidEQ é distribuído apenas através de fluideq.com. Compilações a partir do código-fonte devem vir do repositório oficial. A GPL permite que terceiros copiem, modifiquem, recompilem e vendam o FluidEQ, mas as versões deles não são automaticamente assinadas, revisadas, suportadas nem aprovadas pelo FluidEQ. Se um download afirmar ser oficial e não tiver uma assinatura digital válida do Windows, feche-o e denuncie-o.',
  'provenance.site': 'Site oficial: fluideq.com',
  'provenance.repository': 'Código oficial: github.com/StartSWest/FluidEQ',
  'language.title': 'Idioma',
  'language.aria': 'Idioma da interface',
  'theme.aria': 'Tema',
  'theme.ocean': 'Oceano',
  'theme.black': 'Preto',
};

export default app;
