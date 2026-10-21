/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const creator: Partial<Dictionary> = {
  'creator.title': 'Pagamentos a criadores',
  'creator.badge.active': 'Ativo',
  'creator.badge.checking': 'Em análise',
  'creator.invite':
    'Publique cenas na galeria e receba quando os membros as comprarem: {share}% de cada venda, enviados ao seu banco pela Stripe.',
  'creator.unfinished':
    'Seu cadastro na Stripe não foi concluído. Continue de onde parou.',
  'creator.newTerms':
    'Os termos para criadores mudaram. Leia e aceite para continuar recebendo.',
  'creator.checking':
    'A Stripe está verificando seus dados. Costuma levar alguns minutos, às vezes alguns dias.',
  'creator.paidLine': '{sales} das suas cenas até agora.',
  'creator.sales.one': '{count} venda',
  'creator.sales.few': '{count} vendas',
  'creator.sales.many': '{count} vendas',
  'creator.sales.other': '{count} vendas',
  'creator.ready': 'Pronto para pagar',
  'creator.held': 'Retido',
  'creator.paid': 'Pago até agora',
  'creator.paidHint':
    'Cada venda fica retida {days} dias caso haja reembolso. Os criadores recebem a cada {every} dias, quando houver {amount} prontos.',
  'creator.opened':
    'A página da Stripe está aberta no seu navegador. Conclua lá; este cartão se atualiza quando você voltar.',
  'creator.setUp': 'Configurar pagamentos',
  'creator.finish': 'Concluir a configuração',
  'creator.readTerms': 'Ler os novos termos',
  'creator.checkAgain': 'Verificar de novo',
  'creator.dashboard': 'Painel da Stripe',
  'creator.dialog.title': 'Receba pelas suas cenas',
  'creator.dialog.lead':
    'A Stripe paga você e guarda seus dados de identidade, bancários e fiscais. O FluidEQ nunca os vê.',
  'creator.dialog.step1': 'Escolha seu país e aceite os termos aqui.',
  'creator.dialog.step2': 'Cadastre-se na página da Stripe no seu navegador.',
  'creator.dialog.step3': 'Volte ao FluidEQ: seus ganhos aparecem aqui.',
  'creator.dialog.country': 'País onde você mora',
  'creator.dialog.search': 'Buscar países',
  'creator.dialog.choose': 'Escolha um país',
  'creator.dialog.countryHint':
    'A Stripe pode pagar criadores nos EUA, no Reino Unido, no Canadá, na Suíça e no Espaço Econômico Europeu, e isso não pode ser mudado depois. Não está na lista? Os membros ainda podem comprar suas cenas, e cada venda rende um crédito para você.',
  'creator.dialog.cancel': 'Cancelar',
  'creator.dialog.go': 'Aceitar e continuar na Stripe',
  'creator.dialog.opening': 'Abrindo a Stripe…',
  'creator.terms.title': 'Termos para criadores',
  'creator.terms.share':
    'Você recebe {share}% do que cada venda das suas cenas rende depois das taxas da Stripe. O FluidEQ fica com o resto.',
  'creator.terms.paidCredits':
    'Só cenas compradas com créditos pagos rendem dinheiro. Créditos gratuitos, e as cenas do próprio FluidEQ, não rendem nada.',
  'creator.terms.hold':
    'Cada ganho fica retido {days} dias, para que um reembolso ou uma contestação ainda possam desfazê-lo. Um ganho desfeito depois de pago é descontado do seu próximo pagamento.',
  'creator.terms.minimum':
    'O FluidEQ paga os criadores a cada {every} dias, quando houver {amount} ou mais prontos. Depois a Stripe envia ao seu banco no seu próprio calendário.',
  'creator.terms.stripe':
    'A Stripe pede seus dados de identidade, bancários e fiscais e mostra os próprios termos. Os pagamentos param se a Stripe não puder mais pagar você.',
  'creator.terms.rights':
    'Tudo nas suas cenas precisa ser seu para vender. As cenas continuam sendo revisadas, e uma que viole os termos do Plus pode ser retirada.',
  'creator.terms.taxes':
    'Os impostos sobre o que você ganha cabe a você declarar onde mora.',
  'creator.terms.changes':
    'Estes termos podem mudar. Você é avisado no app e precisa aceitar os novos antes de receber de novo.',
  'creator.error.signedOut': 'Entre de novo para gerenciar seus pagamentos.',
  'creator.error.unconfirmed':
    'Confirme seu e-mail primeiro. O código está na sua caixa de entrada.',
  'creator.error.offline':
    'Não foi possível acessar o FluidEQ. Verifique sua conexão e tente de novo.',
  'creator.error.unavailable':
    'Os pagamentos a criadores ainda não estão abertos. Tente mais tarde.',
  'creator.error.agreementOutdated':
    'Os termos para criadores mudaram. Leia de novo e aceite.',
  'creator.error.country':
    'A Stripe ainda não pode pagar criadores nesse país.',
  'creator.error.banned': 'Esta conta não pode receber por cenas.',
  'creator.error.server':
    'Algo deu errado do nosso lado. Nada foi alterado; tente de novo em instantes.',
  'creator.admin.tab': 'Pagamentos',
  'creator.admin.plan': 'Criadores pagos pela Stripe',
  'creator.admin.loading': 'Lendo o que é devido aos criadores',
  'creator.admin.due': 'A pagar agora',
  'creator.admin.creators': 'Criadores: {count}',
  'creator.admin.available': 'Disponível na Stripe',
  'creator.admin.availableNote': 'de onde saem as transferências',
  'creator.admin.pending': 'Inacabados',
  'creator.admin.pendingNote': 'concluídos primeiro pela próxima execução',
  'creator.admin.short':
    'O saldo disponível do FluidEQ na Stripe é menor que o devido. Transferências além dele falham e esperam a próxima execução; pague quando o saldo estiver liquidado.',
  'creator.admin.list': 'Quem recebe',
  'creator.admin.none':
    'Ninguém tem nada a receber ainda. Os criadores aparecem aqui quando a Stripe pode pagá-los e ganhos suficientes já passaram da retenção.',
  'creator.admin.payLead':
    'Pagar todos da lista: {amount} no total, pela Stripe.',
  'creator.admin.confirm':
    'Enviar {amount} agora? Isso movimenta dinheiro real do saldo do FluidEQ na Stripe e não pode ser desfeito.',
  'creator.admin.pay': 'Pagar criadores',
  'creator.admin.payNow': 'Sim, pagar agora',
  'creator.admin.paying': 'Pagando…',
  'creator.admin.ran': 'Pagos: {paid}. Não pagos: {failed}.',
  'creator.admin.rules':
    'Cada pagamento é enviado uma única vez: uma execução interrompida é concluída pela próxima, nunca enviada de novo. Os criadores escolhem quando a Stripe passa para o banco, no próprio painel da Stripe.',
  'creator.admin.lastPaid': 'Último pagamento: {date}',
  'creator.admin.neverPaid': 'Nenhum pagamento ainda',
  'creator.admin.nextDue': 'próximo: {date}',
  'creator.admin.dueNow': 'há um pagamento a fazer agora',
  'creator.notice.title': 'Os criadores esperam o pagamento',
  'creator.notice.body':
    'Há {amount} prontos para pagar. Criadores a pagar: {count}. Os pagamentos saem a cada {every} dias.',
  'creator.notice.later': 'Depois',
  'creator.notice.open': 'Abrir Pagamentos',
};

export default creator;
