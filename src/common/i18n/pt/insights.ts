/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'Favoritas',
  'insights.loading': 'Carregando as cenas que os membros obtêm',
  'insights.period': 'Período',
  'insights.period.week': '7 dias',
  'insights.period.month': '30 dias',
  'insights.period.quarter': '90 dias',
  'insights.period.all': 'Desde sempre',
  'insights.favourites.hint':
    'Cada cena adicionada ou curtida no período, ordenada pelas vezes que foi adicionada e depois pelas curtidas. As suas ficam de fora.',
  'insights.favourites.summary': '{scenes} cenas adicionadas {adds} vezes',
  'insights.favourites.empty':
    'Nenhuma cena foi adicionada ou curtida neste período.',
  'insights.favourites.kinds': 'Adições por tipo',
  'insights.favourites.noAdds': 'Nada foi adicionado ainda neste período.',
  'insights.favourites.advice':
    '{kind} concentra {share} de todas as adições, em {count} cenas. Mais cenas de {kind} são a aposta mais segura.',
  'insights.col.rank': 'Posição',
  'insights.col.scene': 'Cena',
  'insights.col.adds': 'Adições',
  'insights.col.likes': 'Curtidas',
  'insights.account.title': 'Cenas',
  'insights.account.empty': 'Nenhuma cena adicionada ou curtida ainda.',
  'insights.account.added': 'Adicionadas',
  'insights.account.liked': 'Curtidas',
  'insights.account.kind': 'Tipo favorito',
  'insights.by': 'de {maker}',
  'insights.byFluidEQ': 'do FluidEQ',
  'insights.member': 'um membro',
  'insights.chip.added': 'Adicionada em {date}',
  'insights.chip.liked': 'Curtida',
  'insights.chip.unpublished': 'Não publicada',
  'insights.kind.other': 'Sem categoria',
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
  'insights.server.limit.warn': 'O servidor está enchendo',
  'insights.server.limit.full': 'O servidor está quase cheio',
  'insights.server.limit.body':
    '{what} está em {share} do plano gratuito da Supabase. Passe o projeto para um plano pago antes que encha, ou os recursos online do FluidEQ começam a falhar.',
  'insights.server.limit.database': 'O banco de dados',
  'insights.server.limit.files': 'O armazenamento de arquivos',
  'insights.server.limit.accounts': 'As contas ativas',
  'insights.server.limit.later': 'Depois',
  'insights.server.limit.open': 'Abrir a página do servidor',
  'insights.server.limit.badge': '{share} do plano gratuito usado',
  'insights.server.rules':
    'O plano gratuito não tem data de término. Passar de um limite traz um e-mail e um período de carência; se continuar, o Supabase responde às requisições com “payment required” até o mês seguinte ou um upgrade. Um projeto sem requisições por {days} dias é pausado, o que o próprio tráfego do FluidEQ impede.',
} as const;

export default insights;
