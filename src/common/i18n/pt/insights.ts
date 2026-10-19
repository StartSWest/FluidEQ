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
  'insights.chip.unpublished': 'Não publicada',
  'insights.kind.other': 'Sem categoria',
  'insights.time.hoursMinutes': '{hours} {minutes}',
  'insights.error.offline':
    'O FluidEQ não conseguiu acessar o servidor. Verifique sua conexão e tente de novo.',
  'insights.error.signedOut': 'Entre de novo para ver isto.',
  'insights.error.server': 'Não foi possível carregar isto. Tente de novo.',
  'insights.error.forbidden': 'Só o administrador do FluidEQ pode ver isto.',
  'insights.error.notDeployed':
    'O servidor ainda não tem isto. Chega com a atualização do servidor que acompanha esta versão do FluidEQ.',
  'insights.server.tab': 'Servidor',
  'insights.server.loading': 'Medindo o servidor',
  'insights.server.plan': 'Plano gratuito do Supabase',
  'insights.server.measured': 'Medido às {time}',
  'insights.server.database': 'Banco de dados',
  'insights.server.files': 'Arquivos',
  'insights.server.active': 'Contas ativas, 30 dias',
  'insights.server.activeNote': '{accounts} contas no total',
  'insights.server.of': 'de {limit}',
  'insights.server.used': '{share} usado',
  'insights.server.requests': 'Requisições, últimos 7 dias',
  'insights.server.unlimited': 'sem limite no plano gratuito',
  'insights.server.kind.rest': 'Banco de dados',
  'insights.server.kind.auth': 'Login',
  'insights.server.kind.storage': 'Arquivos',
  'insights.server.kind.realtime': 'Ao vivo',
  'insights.server.noToken':
    'A contagem de requisições não está ativada neste servidor.',
  'insights.server.tokenRefused':
    'O servidor não conseguiu ler a contagem de requisições.',
  'insights.server.tables': 'Maiores tabelas',
  'insights.server.buckets': 'Arquivos por pasta',
  'insights.server.bucketFiles': '{count} arquivos',
  'insights.server.noFiles': 'Nenhum arquivo salvo ainda.',
  'insights.server.egress': 'Dados enviados',
  'insights.server.egressBody':
    'O plano gratuito inclui {limit} por mês, e costuma ser o primeiro limite atingido: conta cada cena e imagem que um membro baixa. Nenhuma API informa esse valor; o Supabase mostra na página Usage do projeto.',
  'insights.server.openSupabase': 'Abrir o Supabase',
  'insights.server.rules':
    'O plano gratuito não tem data de término. Passar de um limite traz um e-mail e um período de carência; se continuar, o Supabase responde às requisições com “payment required” até o mês seguinte ou um upgrade. Um projeto sem requisições por {days} dias é pausado, o que o próprio tráfego do FluidEQ impede.',
} as const;

export default insights;
