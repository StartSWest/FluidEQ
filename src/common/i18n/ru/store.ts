/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const store: Partial<Dictionary> = {
  'store.credit.one': '{count} кредит',
  'store.credit.few': '{count} кредита',
  'store.credit.many': '{count} кредитов',
  'store.credit.other': '{count} кредита',
  'store.credits.unit.one': 'кредит',
  'store.credits.unit.few': 'кредита',
  'store.credits.unit.many': 'кредитов',
  'store.credits.unit.other': 'кредита',
  'store.credits.title': 'Кредиты',
  'store.credits.buyTitle': 'Получить кредиты',
  'store.credits.lead':
    'Один кредит оставляет вам одну сцену навсегда. Вы платите один раз, ничего не продлевается.',
  'store.credits.what':
    'Каждый кредит навсегда оставляет вам одну сцену из галереи: на графике, на рабочем столе и в подсветке.',
  'store.credits.half':
    'Вас ждёт половина кредита: следующая ваша сцена, полученная за оплаченный кредит, сделает его целым.',
  'store.credits.buy': 'Получить ещё кредиты',
  'store.credits.getFree': 'Получить бесплатные кредиты',
  'store.error.offline':
    'Не удалось связаться с FluidEQ. Проверьте подключение и попробуйте ещё раз.',
  'store.error.signedOut': 'Войдите снова, чтобы пользоваться кредитами.',
  'store.error.unavailable': 'Магазин сцен ещё не открыт. Попробуйте позже.',
  'store.error.server':
    'У нас что-то пошло не так. Ничего не списано; попробуйте ещё раз чуть позже.',
  'store.error.unconfirmed':
    'Сначала подтвердите адрес почты. Код — во входящих.',
  'store.error.notOnSale': 'Этот пакет сейчас не продаётся. Выберите другой.',
  'store.error.noCredits': 'У вас закончились кредиты.',
  'store.error.alreadyOwned': 'Эта сцена уже ваша.',
  'store.error.gone': 'Этой сцены больше нет в галерее.',
  'store.error.negative':
    'Из-за возврата баланс ушёл ниже нуля. Пакет восстановит его.',
  'store.error.banned': 'Этот аккаунт не может получать сцены.',
  'store.notice.refundedBody':
    'Покупку «{name}» вернули; заработанное вами на ней списано.',
  'store.notice.refunded': 'Покупку вернули',
  'store.notice.restored': '«{name}» снова в галерее.',
  'store.notice.blockScene':
    'Вы не сможете опубликовать её снова в течение {count} дней.',
  'store.notice.blockAccount':
    'Вы не сможете публиковать в течение {count} дней.',
  'store.notice.takenDownBody':
    'Мы убрали «{name}» из галереи, потому что она нарушает правила. Те, кто её купил, получили кредит обратно, а заработанное вами на этих покупках списано.',
  'store.notice.takenDown': '«{name}» убрана из галереи',
  'store.notice.returnedBody': 'Кредит за неё вам вернули.',
  'store.notice.returned': 'Эта сцена больше недоступна.',
  'store.pack.each': '{price} за сцену',
  'store.pack.best': 'Лучшая цена',
  'store.buy.title': 'Оставить «{name}» себе навсегда?',
  'store.buy.lead':
    'Она станет вашей: на графике, на рабочем столе и в подсветке, на каждом компьютере, где вы входите.',
  'store.buy.keep':
    'Ваша навсегда, со всеми обновлениями, которые выпустит автор.',
  'store.buy.balance': 'У вас {credits}. После этого: {after}.',
  'store.buy.final':
    'Это нельзя отменить. Кредит списывается сразу после подтверждения.',
  'store.buy.buying': 'Получаем…',
  'store.buy.use': 'Потратить {credits}',
  'store.loading': 'Читаем ваши кредиты…',
  'store.packs.title': 'Нужен кредит',
  'store.packs.lead':
    'Каждый кредит оставляет вам одну сцену навсегда. Возьмите пакет — и «{name}» в одном клике.',
  'store.packs.negative':
    'Возврат забрал кредиты, которые вы уже потратили, поэтому ваш баланс — {credits}. Пакет вернёт его выше нуля.',
  'store.packs.choose': 'Выберите пакет',
  'store.packs.waiting':
    'Завершите оплату в браузере. Кредиты появятся здесь, как только платёж пройдёт.',
  'store.packs.fine':
    'Безопасная оплата через Stripe. Один платёж, ничего не продлевается. Кредиты не имеют денежной стоимости. Оплачивая, вы принимаете условия FluidEQ.',
  'store.packs.arrived': 'Добавлено: {credits}. Спасибо!',
  'store.packs.again': 'Открыть страницу оплаты снова',
  'store.packs.pay': 'Оплатить {price}',
  'store.packs.none': 'Сейчас пакеты не продаются. Попробуйте позже.',
  'store.cancel': 'Отмена',
  'store.done': 'Готово',
  'store.starter.title': 'Для начала бесплатно: {credits}',
  'store.starter.body':
    'Один раз на аккаунт, для подтверждённого адреса почты.',
  'store.starter.claim': 'Получить {credits}',
  'store.welcome.title.one': 'У вас {count} бесплатный кредит',
  'store.welcome.title.few': 'У вас {count} бесплатных кредита',
  'store.welcome.title.many': 'У вас {count} бесплатных кредитов',
  'store.welcome.title.other': 'У вас {count} бесплатных кредита',
  'store.welcome.claimedTitle.one': '{count} кредит ваш',
  'store.welcome.claimedTitle.few': '{count} кредита ваши',
  'store.welcome.claimedTitle.many': '{count} кредитов ваши',
  'store.welcome.claimedTitle.other': '{count} кредита ваши',
  'store.welcome.cardTitle.one': 'Вас ждёт {count} бесплатный кредит',
  'store.welcome.cardTitle.few': 'Вас ждут {count} бесплатных кредита',
  'store.welcome.cardTitle.many': 'Вас ждут {count} бесплатных кредитов',
  'store.welcome.cardTitle.other': 'Вас ждут {count} бесплатных кредита',
  'store.welcome.cardClaimedTitle.one': '{count} кредит готов к трате',
  'store.welcome.cardClaimedTitle.few': '{count} кредита готовы к трате',
  'store.welcome.cardClaimedTitle.many': '{count} кредитов готовы к трате',
  'store.welcome.cardClaimedTitle.other': '{count} кредита готовы к трате',
  'store.welcome.eyebrow': 'Добро пожаловать в FluidEQ',
  'store.welcome.body':
    'Каждый кредит даёт одну сцену с вкладки «{visualizers}» навсегда. Получите их сейчас и выберите свои первые сцены.',
  'store.welcome.fine':
    'Один раз на аккаунт. Любую сцену можно посмотреть несколько секунд, прежде чем тратить кредит.',
  'store.welcome.later': 'Позже',
  'store.welcome.claimedBody':
    'Выберите свои первые сцены. Включено «{notMine}», поэтому вкладка «{visualizers}» показывает только сцены, которых у вас ещё нет.',
  'store.welcome.pick': 'Выбрать первые сцены',
  'store.welcome.cardBody':
    'Получите их и выберите свои первые сцены навсегда.',
  'store.welcome.cardClaimedBody':
    'Здесь сцены, которых у вас ещё нет. Посмотрите любую несколько секунд, затем получите её за один кредит.',
  'store.welcome.gotIt': 'Понятно',
  'store.get': 'Получить · {credits}',
  'store.scene.tasted':
    'Это был предпросмотр на {seconds} с. Получите сцену, чтобы смотреть дальше — навсегда.',
  'store.scene.locked':
    'Получите сцену, чтобы увидеть её здесь под вашу музыку.',
  'store.scene.yours': 'Ваша навсегда',
  'store.scene.keep': 'Оставьте её себе навсегда',
  'store.scene.fine':
    'Полученная сцена ваша навсегда, в вашем аккаунте. Перепродать её никто не может.',
  'store.official.fine':
    'Часть коллекции FluidEQ: ваша навсегда, как только вы её получите.',
  'store.like.ownersOnly':
    'Лайков: {count}. Получите сцену, чтобы поставить лайк.',
  'store.scene.free': 'Бесплатно для всех',
  'store.error.termsOutdated':
    'Условия изменились. Обновите FluidEQ, чтобы прочитать новую версию, прежде чем покупать кредиты.',
};

export default store;
