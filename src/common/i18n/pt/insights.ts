/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'Favoritas',
  'insights.loading': 'Carregando as cenas que os membros assistem',
  'insights.period': 'Período',
  'insights.period.week': '7 dias',
  'insights.period.month': '30 dias',
  'insights.period.quarter': '90 dias',
  'insights.period.all': 'Desde sempre',
  'insights.favourites.hint':
    'Cada cena reproduzida, adicionada ou curtida no período, ordenada por quantas pessoas a reproduziram e depois pelo tempo na tela. Seus próprios testes ficam de fora.',
  'insights.favourites.summary': '{scenes} cenas reproduzidas por {time}',
  'insights.favourites.empty':
    'Nenhuma cena foi reproduzida, adicionada ou curtida neste período.',
  'insights.favourites.kinds': 'Tempo na tela por tipo',
  'insights.favourites.noPlays': 'Nada foi reproduzido ainda neste período.',
  'insights.favourites.advice':
    '{kind} concentra {share} de todo o tempo assistido, em {count} cenas. Mais cenas de {kind} são a aposta mais segura.',
  'insights.col.rank': 'Posição',
  'insights.col.scene': 'Cena',
  'insights.col.people': 'Pessoas',
  'insights.col.time': 'Tempo',
  'insights.col.perPerson': 'Por pessoa',
  'insights.col.adds': 'Adições',
  'insights.col.likes': 'Curtidas',
  'insights.account.title': 'Cenas',
  'insights.account.empty':
    'Nenhuma cena adicionada, curtida ou reproduzida ainda. O tempo de reprodução é contado assim que o membro usa esta versão do FluidEQ e viu os termos atualizados.',
  'insights.account.played': 'Cenas reproduzidas',
  'insights.account.time': 'Na tela',
  'insights.account.added': 'Adicionadas',
  'insights.account.liked': 'Curtidas',
  'insights.account.kind': 'Tipo favorito',
  'insights.account.notPlayed': 'Não reproduzida',
  'insights.account.days': '{days} dias · última vez em {date}',
  'insights.by': 'de {maker}',
  'insights.byFluidEQ': 'do FluidEQ',
  'insights.member': 'um membro',
  'insights.chip.added': 'Adicionada em {date}',
  'insights.chip.liked': 'Curtida',
  'insights.kind.other': 'Sem categoria',
  'insights.time.underMinute': 'menos de um minuto',
  'insights.time.hoursMinutes': '{hours} {minutes}',
  'insights.error.offline':
    'O FluidEQ não conseguiu acessar o servidor. Verifique sua conexão e tente de novo.',
  'insights.error.signedOut': 'Entre de novo para ver isto.',
  'insights.error.server': 'Não foi possível carregar isto. Tente de novo.',
  'insights.error.forbidden': 'Só o administrador do FluidEQ pode ver isto.',
  'insights.error.notDeployed':
    'O servidor ainda não tem isto. Chega com a atualização do servidor que acompanha esta versão do FluidEQ.',
} as const;

export default insights;
