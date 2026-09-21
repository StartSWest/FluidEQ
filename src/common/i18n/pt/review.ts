/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.tab': 'Para aprovar',
  'review.tabCount': 'Aguardando aprovação: {count}',
  'review.badge': 'Esperando por você: {count}',
  'review.hint':
    'Cada cena que um membro publica, e cada nova versão de uma, espera aqui até você aprovar. Ninguém mais a vê até lá.',
  'review.empty.title': 'Nada esperando',
  'review.empty.hint':
    'Cenas novas e versões novas aparecem aqui quando os membros as publicam.',
  'review.kind.new': 'Cena nova',
  'review.kind.update': 'Atualização · v{from} → v{to}',
  'review.sent': 'Enviada em {date}',
  'review.open': 'Revisar',
  'review.back': 'Tudo o que espera',
  'review.flag.takenDown': 'Retirada da galeria',
  'review.flag.takenDownHint':
    'Retirada da galeria: restaure-a em Denunciadas para aprovar uma versão nova',
  'review.flag.reports': 'Denúncias abertas sobre a versão publicada: {count}',
  'review.note.title': 'O que o autor diz que é novo',
  'review.note.none': 'O autor não escreveu nada sobre esta versão.',
  'review.sceneFailed': 'Não foi possível abrir esta cena para assistir.',
  'review.changed':
    'A cena mudou enquanto você assistia: o autor enviou uma versão mais nova ou a retirou. A lista mostra o que aguarda agora.',
  'review.approve': 'Aprovar e publicar',
  'review.approving': 'Aprovando…',
  'review.reject': 'Não aprovar',
  'review.reject.title': 'Por que não é aprovada?',
  'review.reject.lead':
    'O autor recebe o motivo, e a sua linha se você escrever uma.',
  'review.reject.noteLabel': 'Uma linha para o autor (opcional)',
  'review.reject.notePlaceholder':
    'Por exemplo: o clarão branco no drop é forte demais',
  'review.reject.cancel': 'Voltar',
  'review.reject.send': 'Enviar a resposta',
  'review.reject.sending': 'Enviando…',
  'review.reason.flashing': 'Clarões ou piscadas',
  'review.reason.rights': 'Obra de outra pessoa',
  'review.reason.offensive': 'Ofensiva',
  'review.reason.broken': 'Quebrada ou pesada demais',
  'review.reason.other': 'Outra coisa',
  'review.done.approved': '{name} já está na galeria.',
  'review.done.rejected': '{name} não foi aprovada. O autor saberá por quê.',
  'review.failed': 'A resposta não foi enviada. Tente de novo.',
  'review.versionRaised': 'A galeria já tem esta versão ou uma mais nova.',
  'review.takenDown':
    'Foi retirada da galeria nesse meio-tempo, então não aceita versões novas. Restaure-a primeiro em Denunciadas.',
  'review.deleted': 'Foi excluída para sempre, então não aceita versões novas.',
  'review.filesFailed':
    'Aprovada, mas os arquivos não chegaram à galeria. Clique em Aprovar e publicar de novo para concluir.',
  'review.forbidden': 'Só o administrador do FluidEQ pode aprovar cenas.',
  'review.fine.new':
    'Aprovar a coloca na galeria na versão {version}: todos que estão conectados a veem, e os membros Plus podem adicioná-la.',
  'review.fine.update':
    'Aprovar substitui a versão {version} para todos que têm a cena. Não aprovar deixa a versão {version} como está.',
  'review.state.pending': 'Em revisão',
  'review.state.pendingUpdate': 'Versão {version} em revisão',
  'review.state.rejected': 'Não aprovada',
  'review.state.rejectedUpdate': 'Versão {version} não aprovada',
  'review.withdraw': 'Retirar',
  'review.withdrawConfirm': 'Retirar da revisão?',
  'review.remove': 'Remover',
  'review.removeConfirm': 'Remover desta lista?',
  'review.withdrawn': '{name} foi retirada.',
  'review.notice.waitingOne': 'Uma cena aguarda a sua aprovação',
  'review.notice.waitingMany': '{count} cenas aguardam a sua aprovação',
  'review.notice.waitingWho': '{name}, de {maker}',
  'review.notice.waitingNewest': 'A mais recente: {name}, de {maker}',
  'review.notice.later': 'Depois',
  'review.notice.review': 'Revisar agora',
  'review.notice.approved': '{name} está na galeria',
  'review.notice.approvedBody':
    'Foi aprovada. Os membros Plus já podem adicioná-la.',
  'review.notice.approvedUpdate':
    'A versão {version} de {name} está na galeria',
  'review.notice.approvedUpdateBody':
    'Foi aprovada. Todos que têm a cena recebem a nova versão.',
  'review.notice.rejected': '{name} não foi aprovada',
  'review.notice.rejectedUpdate':
    'A versão {version} de {name} não foi aprovada',
  'review.notice.keepsLive': 'Quem a tem continua com a versão {version}.',
  'review.notice.gotIt': 'Entendido',
  'review.notice.openStudio': 'Abrir o Estúdio',
  'review.notice.openMine': 'Suas cenas',
} as const;

export default review;
