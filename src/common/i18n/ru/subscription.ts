/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription: Partial<Dictionary> = {
  'subscription.name': 'Plus',
  'subscription.get': 'Оформить Plus',
  'subscription.getAgain': 'Вернуть Plus',
  'subscription.manage': 'Управление Plus',
  'subscription.included': 'Входит в Plus',

  'subscription.plan.monthly': 'Ежемесячно',
  'subscription.plan.yearly': 'Ежегодно',
  'subscription.plan.perMonth': '{price} в месяц',
  'subscription.plan.perYear': '{price} в год',
  'subscription.plan.both': '{monthly} в месяц или {yearly} в год',
  'subscription.plan.cancelAnytime': 'Отменить можно в любой момент.',
  'subscription.plan.monthlyEquivalent': 'Это {price} в месяц.',
  'subscription.plan.save': 'Экономия {percent}%',

  'subscription.status.grace':
    'FluidEQ не удалось проверить ваш Plus на сервере. Он продолжит работать до {date}.',
  'subscription.status.waiting':
    'Ждём, пока Stripe подтвердит оплату. Plus включится здесь сам.',

  'subscription.ways.title': 'Plus или кредиты?',
  'subscription.ways.credits.each': 'По одной сцене, {credits} за каждую',
  'subscription.ways.credits.keep': 'Ваша навсегда, даже без Plus',
  'subscription.ways.plus.every': 'Все сцены из раздела «Сцены», и новые тоже',
  'subscription.ways.plus.while': 'Пока вы участник',

  'subscription.scene.twoWays': 'Два способа получить её',
  'subscription.scene.keep.title': 'Оставить эту сцену',
  'subscription.scene.keep.body':
    'Ваша навсегда, со всеми обновлениями. {credits}.',
  'subscription.scene.plus.title': 'Все сцены с Plus',
  'subscription.scene.plus.body':
    'Эта и все остальные, пока вы участник. {prices}.',
  'subscription.scene.member.note':
    'Работает на графике, рабочем столе и в подсветке, пока у вас есть Plus.',
  'subscription.scene.member.keep':
    'Хотите её и после Plus? Оставьте её за кредит — навсегда вашей.',
  'subscription.scene.member.keepButton': 'Оставить навсегда · {credits}',

  'subscription.lapse.title': 'Ваша подписка Plus закончилась',
  'subscription.lapse.body':
    'Эти сцены работали с Plus, а их загрузки удалены с этого компьютера. Получите сцену за кредит, чтобы она осталась навсегда, или верните Plus, чтобы снова получить все.',
  'subscription.lapse.more': 'ещё {count}',
  'subscription.lapse.find': 'Найти',
  'subscription.lapse.notNow': 'Не сейчас',

  'subscription.sheet.eyebrow': 'Сцены',
  'subscription.sheet.description':
    'Все сцены из раздела «Сцены»: от FluidEQ и от сообщества.',
  'subscription.sheet.heading': 'Все сцены, пока у вас есть Plus',
  'subscription.sheet.lead':
    'Они работают на графике, рабочем столе и в подсветке — здесь и в FluidWallpapers, на каждом компьютере, где вы входите в аккаунт.',
  'subscription.sheet.choose': 'Как платить',
  'subscription.sheet.renews':
    'Plus продлевается, пока вы его не отмените. Отменить можно в любой момент на странице Stripe.',
  'subscription.sheet.ends':
    'Когда Plus заканчивается, сцены, которые он открывал, останавливаются, а их загрузки удаляются с этого компьютера.',
  'subscription.sheet.pay': 'Перейти к оплате · {price}',
  'subscription.sheet.again': 'Снова открыть страницу Stripe',
  'subscription.sheet.waiting':
    'Завершите оплату на странице Stripe в браузере. Plus включится здесь сам.',
  'subscription.sheet.fine':
    'Продолжая, вы принимаете условия, и это сохраняется. Оплата проходит на странице Stripe; FluidEQ никогда не видит вашу карту.',
  'subscription.sheet.notNow': 'Не сейчас',
  'subscription.sheet.done.title': 'Plus включён',
  'subscription.sheet.done.body':
    'Теперь вам доступны все сцены из раздела «Сцены».',
  'subscription.sheet.done.see': 'К сценам',

  'subscription.error.termsChanged':
    'Условия обновились. Прочитайте их и продолжите.',
  'subscription.error.needsEmail':
    'Сначала подтвердите адрес электронной почты, затем попробуйте снова.',
  'subscription.error.needsUpdate': 'Обновите FluidEQ, чтобы оформить Plus.',
  'subscription.error.alreadySubscribed': 'У этого аккаунта уже есть Plus.',
  'subscription.error.notOnSale': 'Plus сейчас не продаётся.',
  'subscription.error.banned': 'Этот аккаунт сейчас не может оформить Plus.',
  'subscription.error.signedOut': 'Войдите снова, чтобы оформить Plus.',
  'subscription.error.failed':
    'Не удалось открыть страницу Stripe. Проверьте подключение и попробуйте снова.',

  'subscription.manage.opened': 'Страница Stripe открылась в браузере.',
  'subscription.manage.none':
    'У этого аккаунта нет подписки Plus для управления.',
  'subscription.manage.signedOut': 'Войдите снова, чтобы управлять Plus.',
  'subscription.manage.failed':
    'Не удалось открыть страницу Stripe. Проверьте подключение и попробуйте снова.',

  'subscription.cardGet': 'Получить',
  'subscription.makeScenes': 'Создавайте свои сцены в FluidWallpapers',
  'subscription.banner.title': 'Plus: все сцены галереи',
  'subscription.banner.body':
    'Запускайте и добавляйте их все, и новые тоже. Одна подписка для FluidEQ и FluidWallpapers.',
  'subscription.banner.credit':
    'Хотите сцену и без Plus? Получите её за кредит, и она останется вашей навсегда.',
  'subscription.banner.or': 'или {price}',
  'subscription.line.renews':
    'Все сцены доступны вам · продлится {date} · работает и в FluidWallpapers',
  'subscription.line.ends':
    'Все сцены доступны вам до {date} · работает и в FluidWallpapers',
  'subscription.line.plain':
    'Все сцены доступны вам · работает и в FluidWallpapers',
  'subscription.sheet.both':
    'Одна подписка для FluidEQ и FluidWallpapers: оформите её в любом из приложений, она действует в обоих.',
  'subscription.sheet.keepOne':
    'Или оставьте себе только «{name}» навсегда, даже без Plus:',

  'subscription.account.yours': 'Все сцены галереи доступны вам',
  'subscription.account.renews':
    'Продлится {date} · работает и в FluidWallpapers',
  'subscription.account.ends':
    'Закончится {date} · работает и в FluidWallpapers',
  'subscription.welcome.title': 'Или все сцены, с Plus',
  'subscription.welcome.body':
    'Все сцены галереи, и новые тоже, пока вы участник. Одна подписка для FluidEQ и FluidWallpapers.',
  'subscription.welcome.signIn': 'Войдите, чтобы оформить Plus',
  'subscription.dev.notOnSale':
    'Разработка: Plus не продаётся этому аккаунту. Пока Stripe в тестовом режиме, цены видят только администратор и аккаунты из списка тестировщиков на сервере: добавьте этот аккаунт в этот список.',
  'subscription.renew': 'Продлить Plus',
  'subscription.pass.member': 'Участник',
  'subscription.pass.ending': 'Отменено · действует до этой даты',
  'subscription.chip.until': 'Plus до {date}',
};

export default subscription;
