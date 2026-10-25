/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const store: Partial<Dictionary> = {
  'store.credit.one': '{count} crédito',
  'store.credit.few': '{count} créditos',
  'store.credit.many': '{count} créditos',
  'store.credit.other': '{count} créditos',
  'store.credits.unit.one': 'crédito',
  'store.credits.unit.few': 'créditos',
  'store.credits.unit.many': 'créditos',
  'store.credits.unit.other': 'créditos',
  'store.credits.title': 'Créditos',
  'store.credits.buyTitle': 'Obter créditos',
  'store.credits.lead':
    'Um crédito guarda uma cena para sempre. Você paga uma vez e nada é renovado.',
  'store.credits.owned': 'Cenas suas: {count}',
  'store.credits.what':
    'Cada crédito guarda para sempre uma cena da galeria: no gráfico, na sua área de trabalho e nas suas luzes.',
  'store.credits.half':
    'Você tem meio crédito à espera: a próxima cena sua obtida com um crédito pago o completa.',
  'store.credits.buy': 'Obter créditos',
  'store.credits.getFree': 'Pegar créditos grátis',
  'store.error.offline':
    'Não foi possível conectar ao FluidEQ. Verifique sua conexão e tente de novo.',
  'store.error.signedOut': 'Entre de novo para usar seus créditos.',
  'store.error.unavailable':
    'A loja de cenas ainda não está aberta. Tente mais tarde.',
  'store.error.server':
    'Algo deu errado do nosso lado. Nada foi gasto; tente de novo em instantes.',
  'store.error.unconfirmed':
    'Confirme seu e-mail primeiro. O código está na sua caixa de entrada.',
  'store.error.notOnSale': 'Esse pacote não está à venda agora. Escolha outro.',
  'store.error.noCredits': 'Você está sem créditos.',
  'store.error.alreadyOwned': 'Esta cena já é sua.',
  'store.error.gone': 'Esta cena não está mais na galeria.',
  'store.error.negative':
    'Um reembolso deixou seu saldo abaixo de zero. Um pacote o recupera.',
  'store.error.banned': 'Esta conta não pode obter cenas.',
  'store.pack.each': '{price} por cena',
  'store.pack.best': 'Melhor preço',
  'store.buy.title': 'Guardar {name} para sempre?',
  'store.buy.lead':
    'Ela passa a ser sua: no gráfico, na sua área de trabalho e nas suas luzes, em todo computador em que você entrar.',
  'store.buy.keep':
    'Sua para sempre, com cada atualização que quem a criou publicar.',
  'store.buy.balance': 'Você tem {credits}. Depois disto: {after}.',
  'store.buy.final':
    'Isto não pode ser desfeito. O crédito é gasto assim que você confirmar.',
  'store.buy.buying': 'Obtendo…',
  'store.buy.use': 'Usar {credits}',
  'store.loading': 'Lendo seus créditos…',
  'store.packs.title': 'Você precisa de um crédito',
  'store.packs.lead':
    'Cada crédito guarda uma cena para sempre. Pegue um pacote e {name} fica a um clique.',
  'store.packs.negative':
    'Um reembolso tirou créditos que você já tinha usado, então seu saldo é {credits}. Um pacote o traz de volta acima de zero.',
  'store.packs.choose': 'Escolha um pacote',
  'store.packs.waiting':
    'Termine o pagamento no navegador. Seus créditos aparecem aqui assim que o pagamento for confirmado.',
  'store.packs.fine':
    'Pagamento seguro pela Stripe. Um único pagamento; nada é renovado. Créditos não têm valor em dinheiro. Ao pagar, você aceita os termos do FluidEQ.',
  'store.packs.arrived': '{credits} na sua conta. Obrigado!',
  'store.packs.again': 'Abrir a página de pagamento de novo',
  'store.packs.pay': 'Pagar {price}',
  'store.packs.none': 'Nenhum pacote está à venda agora. Tente mais tarde.',
  'store.cancel': 'Cancelar',
  'store.done': 'Pronto',
  'store.starter.title': '{credits} grátis para começar',
  'store.starter.body': 'Uma vez por conta, com um e-mail confirmado.',
  'store.starter.claim': 'Pegar {credits}',
  'store.get': 'Obter · {credits}',
  'store.scene.tasted':
    'Essa foi uma amostra de {seconds} segundos. Obtenha a cena para continuar assistindo, para sempre.',
  'store.scene.locked':
    'Obtenha a cena para vê-la tocar aqui com a sua música.',
  'store.scene.yours': 'Sua para sempre',
  'store.scene.keep': 'Guarde-a para sempre',
  'store.scene.fine':
    'Uma cena que você obtém é sua para sempre, na sua conta. Ninguém pode revendê-la.',
  'store.official.fine':
    'Parte da coleção do FluidEQ: sua para sempre assim que você a obtiver.',
  'store.like.ownersOnly': '{count} curtidas. Obtenha a cena para curti-la.',
  'store.scene.free': 'Grátis para todos',
  'store.admin.freeTitle': 'Grátis para todos',
  'store.admin.freeOn': 'Toda conta conectada a toca sem gastar um crédito.',
  'store.admin.freeOff':
    'Um crédito, como as outras cenas. Ative para dá-la a todos.',
  'store.error.termsOutdated':
    'Os termos mudaram. Atualize o FluidEQ para ler a nova versão antes de comprar créditos.',
};

export default store;
