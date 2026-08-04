/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/** Portuguese. Brazilian spelling, which is the larger readership by far. */
const pt: Partial<Dictionary> = {
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
  'whatsNew.eyebrow': 'NOTAS DA VERSÃO',
  'whatsNew.title': 'Novidades do FluidEQ',
  'whatsNew.loading': 'Carregando as notas da versão…',
  'whatsNew.missing':
    'As notas da versão não foram encontradas nesta compilação. Elas também estão no GitHub.',
  'app.menu.whatsNew': 'Novidades',
  'app.menu.language': 'Idioma',
  'app.window.minimize': 'Minimizar',
  'app.window.maximize': 'Maximizar',
  'app.window.restore': 'Restaurar',
  'app.window.close': 'Fechar',
  'app.window.minimizeApp': 'Minimizar o FluidEQ',
  'app.window.maximizeApp': 'Maximizar o FluidEQ',
  'app.window.restoreApp': 'Restaurar o FluidEQ',
  'app.window.closeApp': 'Fechar o FluidEQ',
  'app.dismiss': 'Dispensar',

  'tabs.aria': 'Área de trabalho de som',
  'tabs.eq': 'EQ e tipo de fone',
  'tabs.voicing': 'Caráter',
  'tabs.convolution': 'Convolução',

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

  'output.eyebrow': 'ACOMPANHA SUA SAÍDA',
  'output.title': 'Perfil automático',
  'output.device': 'Dispositivo de saída',
  'output.active': 'ATIVO',
  'output.none': 'Nenhuma saída ativa encontrada',
  'output.mapping': 'Vínculo automático',
  'output.mapping.neutral': 'Saída neutra',
  'output.mapping.live': 'Ajuste ao vivo vinculado',
  'output.mapping.hint':
    'Mexa em qualquer controle do EQ para salvá-lo e vinculá-lo automaticamente a esta saída.',
  'output.hint':
    'O FluidEQ usa o identificador estável do dispositivo, então este som o acompanha sempre que o Windows o seleciona.',

  'driver.eyebrow': 'NO QUE VOCÊ OUVE',
  'driver.title': 'Tipo de driver',
  'driver.none': 'Sem compensação',
  'driver.none.hint': 'Apenas suas bandas e o caráter',
  'driver.strength': 'Intensidade',
  'driver.range': '±1,5 dB',

  'profiles.eyebrow': 'SEU SOM',
  'profiles.title': 'Perfis salvos',
  'profiles.name': 'Nome do perfil',
  'profiles.nameAria': 'Nome do perfil',
  'profiles.new': 'Novo perfil',
  'profiles.newAria': 'Criar um perfil novo com o EQ atual',
  'profiles.untitled': 'Perfil sem título',
  'profiles.save': 'Salvar como novo',
  'profiles.update': 'Atualizar',
  'profiles.saveAria': 'Salvar as configurações no perfil',
  'profiles.restore': 'Restaurar',
  'profiles.restoring': 'Restaurando…',
  'profiles.restoreAria':
    'Restaurar a última versão salva manualmente deste perfil',
  'profiles.attached': 'ATV',
  'profiles.attachedTitle': 'Tocando nesta saída',
  'profiles.detecting': 'Detectando sua saída…',
  'profiles.empty': 'Ainda não há perfis. Crie o seu primeiro som.',
  'profiles.error.empty': 'O nome do perfil não pode ficar vazio.',
  'profiles.error.restricted': 'Nome inválido, escolha outro.',
  'profiles.error.duplicate': 'Esse nome já existe, escolha outro.',
  'profiles.edit': 'Editar o nome do perfil',

  'autoeq.eyebrow': 'COMECE POR UMA REFERÊNCIA',
  'autoeq.title': 'Biblioteca AutoEQ',
  'autoeq.selectSource': 'Escolha uma origem',
  'autoeq.applied': 'Aplicado: {name}',
  'autoeq.notApplied': 'Nenhuma referência aplicada',
  'autoeq.source': 'Origem da medição',
  'autoeq.model': 'Modelo de fone',
  'autoeq.target': 'Medição / alvo',
  'autoeq.apply': 'Aplicar EQ do modelo',
  'autoeq.applyAria': 'Aplicar o EQ do modelo selecionado',
  'autoeq.checking': 'Verificando o banco de dados oficial…',
  'autoeq.updateAvailable': 'Atualização disponível ({count} modelos)',
  'autoeq.upToDate': 'Banco de dados em dia — {count} modelos',
  'autoeq.updateUnknown': 'Não foi possível verificar a atualização',
  'autoeq.update': 'Atualizar banco de dados',
  'autoeq.updating': 'Atualizando…',
  'autoeq.updateAria': 'Atualizar o banco de dados do AutoEq',
  'autoeq.allDatabases': 'Todos os bancos de dados',
  'autoeq.allDatabases.hint':
    'Busca no AutoEq oficial e no GadgetryTech juntos.',
  'autoeq.pickDevice': 'Escolha um modelo primeiro 🎧',
  'autoeq.noResponses': 'Nenhuma medição compatível 😞',
  'autoeq.pickResponse': 'Escolha uma medição! 🔊',
  'autoeq.selectSourcePlaceholder': 'Escolha uma origem…',
  'autoeq.searchSources': 'Buscar origens…',
  'autoeq.noModel': 'Nenhum modelo medido corresponde à sua busca.',
  'autoeq.searchModels': 'Buscar por marca ou modelo…',
  'voicing.quickAria': 'Caráter: {name}',
  'voicing.quickNone': 'Caráter: nenhum',
  'voicing.quickTitle': 'Nenhum caráter aplicado',
  'voicing.quickLabel': 'Caráter',
  'voicing.quickNoneHint': 'Apenas suas bandas de EQ',

  'eq.eyebrow': 'AJUSTE FINO',
  'eq.title': 'EQ paramétrico',
  'eq.smart': 'EQ inteligente',
  'eq.smart.cancel': 'Cancelar',
  'eq.smart.aria': 'EQ inteligente a partir da saída ao vivo',
  'eq.smart.cancelAria': 'Cancelar a medição do EQ inteligente',
  'eq.smart.fromFlat': 'Do plano',
  'eq.layers': 'Também aplicado',
  'eq.layers.aria': 'Outros ajustes que afetam esta saída',
  'eq.layers.convolution': 'Convolução',
  'eq.layers.voicing': 'Caráter',
  'eq.layers.driver': 'Driver',
  'eq.layers.headset': 'Fone',
  'eq.layers.remove': 'Remover a camada de {layer}',
  'eq.layers.forget':
    'Esquecer o modelo de referência — as bandas continuam como estão',
  'eq.fromFlat': 'Do plano',
  'eq.fromFlat.hint':
    'Zera todas as bandas antes de ouvir. Use quando um corte existente estiver escondendo justamente a região que ele afeta — a medição não enxerga através da própria correção.',
  'eq.clear': 'Limpar EQ',
  'eq.addBand': 'Adicionar banda',
  'eq.addBandAria': 'Adicionar uma banda de EQ',
  'eq.quickLayouts': 'Layouts rápidos',
  'eq.bandCount': '{count} bandas',
  'eq.selected': 'Banda selecionada',
  'eq.filter': 'Filtro',
  'eq.frequency': 'Frequência',
  'eq.gain': 'Ganho',
  'eq.gainDisabled': 'Ganho · n/d',
  'eq.quality': 'Fator Q',
  'eq.delete': 'Excluir banda',
  'eq.deleteAria': 'Excluir a banda de EQ selecionada',

  'convolution.eyebrow': 'RESPOSTAS AO IMPULSO DO APO',
  'convolution.title': 'Biblioteca de convolução',
  'convolution.intro':
    'Baixe um impulso de fase mínima verificado para o seu fone e aplique-o antes do EQ paramétrico. O gráfico abaixo mostra as duas curvas.',
  'convolution.import': 'Importar um WAV…',
  'convolution.importing': 'Importando…',
  'convolution.applied': 'Aplicado a esta saída',
  'convolution.clear': 'Remover',
  'convolution.search': 'Buscar modelos de fone',
  'convolution.searchPlaceholder':
    'Tente “Kraken”, “HD 650” ou o nome de um laboratório',
  'convolution.notice':
    'O catálogo para download é fornecido pelo AutoEq. Os arquivos são importados como WAV de 48 kHz porque o Equalizer APO exige que a resposta ao impulso corresponda à taxa de amostragem da saída ativa.',
  'convolution.loading': 'Carregando o catálogo oficial…',
  'convolution.empty':
    'Nenhuma resposta ao impulso corresponde. Tente um nome mais curto.',
  'convolution.source': 'Origem',
  'convolution.apply': 'Baixar e aplicar',
  'convolution.downloading': 'Baixando…',
  'convolution.isApplied': 'Aplicado',
  'convolution.none':
    'Nenhuma convolução carregada. A aba de EQ continua totalmente independente.',

  'voicing.eyebrow': 'CURVAS-ALVO',
  'voicing.title': 'Caráter',
  'voicing.intro':
    'Um alvo ajustado para o que você realmente está fazendo. Cada um é escrito como uma camada própria depois das suas bandas, então o seu ajuste nunca é tocado e voltar para Nenhum o restaura exatamente.',
  'voicing.none': 'Nenhum',
  'voicing.none.hint': 'Apenas suas bandas de EQ, sem nada por cima',
  'voicing.strength': 'Intensidade',
  'voicing.off': 'Nada',
  'voicing.full': 'Total',
  'voicing.inert': 'Com 0% de intensidade este caráter não faz nada.',
  'voicing.headroom':
    'Adiciona até +{peak} dB. Normalizar automaticamente reserva a margem; deixe ligado a menos que você ajuste a pré-amplificação na mão.',

  'support.eyebrow': 'TOTALMENTE OPCIONAL',
  'support.title': 'Apoie o projeto',
  'support.close': 'Fechar',
  'support.pitch':
    'O FluidEQ é livre e de código aberto, e vai continuar assim: nada aqui está atrás de um paywall e nada é rastreado. Se ele conquistou um lugar no seu setup, uma contribuição financia o tempo que o mantém e as próximas ideias que saírem da mesma oficina.',
  'support.craft':
    'Isto é o trabalho de uma pessoa só, feito com muito carinho e um cuidado com os detalhes que beira o exagero. Cada painel foi desenhado à mão e discutido: como a curva se lê num relance, como um menu se abre, o que um botão giratório faz quando você gira devagar, que palavras entram num botão. Aqui não há componente de prateleira com um tema por cima.',
  'support.card': 'Cartão ou carteira',
  'support.card.hint':
    'Pagamento seguro hospedado pela Stripe. Abre no seu navegador — o aplicativo nunca vê os dados do cartão.',
  'support.coffee': 'Me pague um café',
  'support.coffee.hint':
    'Uma contribuição única, sem precisar de conta. Clique para abrir no navegador ou escaneie o código com o celular.',
  'support.verify': 'Confira o endereço antes de enviar.',
  'support.copy': 'Copiar endereço',
  'support.copied': 'Copiado',
  'support.openWallet': 'Abrir na carteira',
  'support.contributed': 'Eu contribuí — libere a estrela e a dança',
  'support.thanks': 'Obrigado — seu bichinho ganhou a estrela e agora dança.',
  'support.footerBefore':
    'Prefere contribuir com tempo? Issues e pull requests são igualmente bem-vindos no',

  'language.title': 'Idioma',
  'language.aria': 'Idioma da interface',
};

export default pt;
