/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription: Partial<Dictionary> = {
  'subscription.name': 'Plus',
  'subscription.get': 'Assinar o Plus',
  'subscription.getAgain': 'Assinar o Plus de novo',
  'subscription.manage': 'Gerenciar Plus',
  'subscription.included': 'Incluída no Plus',

  'subscription.plan.monthly': 'Mensal',
  'subscription.plan.yearly': 'Anual',
  'subscription.plan.perMonth': '{price} por mês',
  'subscription.plan.perYear': '{price} por ano',
  'subscription.plan.both': '{monthly} por mês ou {yearly} por ano',
  'subscription.plan.cancelAnytime': 'Cancele quando quiser.',
  'subscription.plan.monthlyEquivalent': 'Sai por {price} por mês.',
  'subscription.plan.save': 'Economize {percent}%',

  'subscription.status.grace':
    'O FluidEQ não conseguiu verificar seu Plus com o servidor. Ele continua tocando até {date}.',
  'subscription.status.waiting':
    'Aguardando a Stripe confirmar seu pagamento. O Plus é ativado aqui sozinho.',

  'subscription.ways.title': 'Plus ou créditos?',
  'subscription.ways.credits.each': 'Uma cena por vez, {credits} cada',
  'subscription.ways.credits.keep': 'Sua para sempre, mesmo sem o Plus',
  'subscription.ways.plus.every': 'Todas as cenas de Cenas, as novas também',
  'subscription.ways.plus.while': 'Enquanto você for membro',

  'subscription.scene.twoWays': 'Duas formas de tê-la',
  'subscription.scene.keep.title': 'Fique com esta cena',
  'subscription.scene.keep.body':
    'Sua para sempre, com cada atualização. {credits}.',
  'subscription.scene.plus.title': 'Todas as cenas com o Plus',
  'subscription.scene.plus.body':
    'Esta e todas as outras, enquanto você for membro. {prices}.',
  'subscription.scene.member.note':
    'Toca no seu gráfico, na sua área de trabalho e nas suas luzes enquanto você tiver o Plus.',
  'subscription.scene.member.keep':
    'Quer ficar com ela mesmo se o Plus terminar? Fique com ela com um crédito, sua para sempre.',
  'subscription.scene.member.keepButton': 'Ficar para sempre · {credits}',

  'subscription.lapse.title': 'Sua assinatura Plus terminou',
  'subscription.lapse.body':
    'Estas cenas tocavam com o Plus, e os downloads delas foram removidos deste computador. Obtenha uma com um crédito para ficar com ela para sempre, ou assine o Plus de novo para ter todas.',
  'subscription.lapse.more': '+{count} outras',
  'subscription.lapse.find': 'Procurar',
  'subscription.lapse.notNow': 'Agora não',

  'subscription.sheet.eyebrow': 'Cenas',
  'subscription.sheet.description':
    'Todas as cenas de Cenas, as do FluidEQ e as da comunidade.',
  'subscription.sheet.heading': 'Todas as cenas, enquanto você tiver o Plus',
  'subscription.sheet.lead':
    'Elas tocam no seu gráfico, na sua área de trabalho e nas suas luzes, aqui e no FluidWallpapers, em cada computador em que você entrar.',
  'subscription.sheet.choose': 'Como pagar',
  'subscription.sheet.renews':
    'O Plus é renovado até você cancelar. Cancele quando quiser na página da Stripe.',
  'subscription.sheet.ends':
    'Quando o Plus termina, as cenas que ele tocava param, e os downloads delas são removidos deste computador.',
  'subscription.sheet.pay': 'Continuar para o pagamento · {price}',
  'subscription.sheet.again': 'Abrir a página da Stripe de novo',
  'subscription.sheet.waiting':
    'Conclua na página da Stripe no seu navegador. O Plus é ativado aqui sozinho.',
  'subscription.sheet.fine':
    'Ao continuar, fica registrado que você aceita os termos. Você paga na página da Stripe; o FluidEQ nunca vê o seu cartão.',
  'subscription.sheet.notNow': 'Agora não',
  'subscription.sheet.done.title': 'O Plus está ativo',
  'subscription.sheet.done.body':
    'Todas as cenas de Cenas tocam para você agora.',
  'subscription.sheet.done.see': 'Ver as cenas',

  'subscription.error.termsChanged':
    'Os termos foram atualizados. Leia-os e depois continue.',
  'subscription.error.needsEmail':
    'Confirme seu e-mail primeiro e tente de novo.',
  'subscription.error.needsUpdate': 'Atualize o FluidEQ para assinar o Plus.',
  'subscription.error.alreadySubscribed': 'Esta conta já tem o Plus.',
  'subscription.error.notOnSale': 'O Plus não está à venda agora.',
  'subscription.error.banned': 'Esta conta não pode ter o Plus agora.',
  'subscription.error.signedOut': 'Entre de novo para assinar o Plus.',
  'subscription.error.failed':
    'Não foi possível abrir a página da Stripe. Verifique sua conexão e tente de novo.',

  'subscription.manage.opened': 'A página da Stripe abriu no seu navegador.',
  'subscription.manage.none':
    'Esta conta não tem uma assinatura Plus para gerenciar.',
  'subscription.manage.signedOut': 'Entre de novo para gerenciar o Plus.',
  'subscription.manage.failed':
    'Não foi possível abrir a página da Stripe. Verifique sua conexão e tente de novo.',

  'subscription.cardGet': 'Obter',
  'subscription.makeScenes': 'Crie suas próprias cenas no FluidWallpapers',
  'subscription.banner.title': 'Plus: todas as cenas da galeria',
  'subscription.banner.body':
    'Toque e adicione todas, as novas também. Uma assinatura para o FluidEQ e o FluidWallpapers.',
  'subscription.banner.credit':
    'Quer uma cena mesmo sem o Plus? Obtenha com um crédito e ela fica sua para sempre.',
  'subscription.banner.or': 'ou {price}',
  'subscription.line.renews':
    'Todas as cenas são suas · renova em {date} · também no FluidWallpapers',
  'subscription.line.ends':
    'Todas as cenas são suas até {date} · também no FluidWallpapers',
  'subscription.line.plain':
    'Todas as cenas são suas · também no FluidWallpapers',
  'subscription.sheet.both':
    'Uma assinatura para o FluidEQ e o FluidWallpapers: assine em qualquer um e vale nos dois.',
  'subscription.sheet.keepOne':
    'Ou fique só com {name} para sempre, mesmo sem o Plus:',

  'subscription.account.yours': 'Todas as cenas da galeria são suas',
  'subscription.account.renews': 'Renova em {date} · também no FluidWallpapers',
  'subscription.account.ends': 'Termina em {date} · também no FluidWallpapers',
  'subscription.welcome.title': 'Ou todas as cenas, com o Plus',
  'subscription.welcome.body':
    'Todas as cenas da galeria, as novas também, enquanto você for membro. Uma assinatura para o FluidEQ e o FluidWallpapers.',
  'subscription.welcome.signIn': 'Entre para assinar o Plus',
  'subscription.renew': 'Renovar o Plus',
  'subscription.pass.member': 'Membro',
  'subscription.pass.ending': 'Cancelado · continua seu até lá',
  'subscription.everyScene.title': 'Todas as cenas são suas',
  'subscription.everyScene.body':
    'Esta conta é dona de todas as cenas da galeria, então o Plus não acrescenta nada a ela.',
  'subscription.chip.until': 'Plus até {date}',
};

export default subscription;
