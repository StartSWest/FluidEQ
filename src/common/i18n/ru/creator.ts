/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const creator: Partial<Dictionary> = {
  'creator.title': 'Выплаты авторам',
  'creator.badge.active': 'Активно',
  'creator.badge.checking': 'Проверка',
  'creator.invite':
    'Публикуйте сцены в галерее и получайте деньги, когда участники их покупают: {share}% с каждой продажи, Stripe переводит их на ваш банковский счёт.',
  'creator.unfinished':
    'Регистрация в Stripe не завершена. Продолжите с того места, где остановились.',
  'creator.newTerms':
    'Условия для авторов изменились. Прочитайте и примите их, чтобы и дальше получать выплаты.',
  'creator.checking':
    'Stripe проверяет ваши данные. Обычно это занимает несколько минут, иногда несколько дней.',
  'creator.paidLine': 'Продажи ваших сцен на сегодня: {sales}.',
  'creator.sales.one': '{count} продажа',
  'creator.sales.few': '{count} продажи',
  'creator.sales.many': '{count} продаж',
  'creator.sales.other': '{count} продажи',
  'creator.ready': 'К выплате',
  'creator.held': 'Удерживается',
  'creator.paid': 'Выплачено',
  'creator.paidHint':
    'Каждая продажа удерживается {days} дн. на случай возврата. Авторам платят раз в {every} дней, когда наберётся {amount}.',
  'creator.opened':
    'Страница Stripe открыта в браузере. Завершите там; эта карточка обновится, когда вы вернётесь.',
  'creator.setUp': 'Настроить выплаты',
  'creator.finish': 'Завершить настройку',
  'creator.readTerms': 'Прочитать новые условия',
  'creator.checkAgain': 'Проверить снова',
  'creator.dashboard': 'Панель Stripe',
  'creator.dialog.title': 'Получайте деньги за свои сцены',
  'creator.dialog.lead':
    'Выплаты делает Stripe, и он же хранит ваши личные, банковские и налоговые данные. FluidEQ их никогда не видит.',
  'creator.dialog.step1': 'Выберите страну и примите условия здесь.',
  'creator.dialog.step2': 'Зарегистрируйтесь на странице Stripe в браузере.',
  'creator.dialog.step3': 'Вернитесь в FluidEQ: заработок появится здесь.',
  'creator.dialog.country': 'Страна проживания',
  'creator.dialog.search': 'Поиск страны',
  'creator.dialog.choose': 'Выберите страну',
  'creator.dialog.countryHint':
    'Stripe может платить авторам в США, Великобритании, Канаде, Швейцарии и Европейской экономической зоне, и изменить страну потом нельзя. Вашей страны нет в списке? Участники всё равно могут покупать ваши сцены, а за каждую продажу вы получаете кредит.',
  'creator.dialog.cancel': 'Отмена',
  'creator.dialog.go': 'Принять и перейти в Stripe',
  'creator.dialog.opening': 'Открываем Stripe…',
  'creator.terms.title': 'Условия для авторов',
  'creator.terms.share':
    'Вы получаете {share}% от того, что приносит каждая продажа ваших сцен после комиссий Stripe. Остальное остаётся FluidEQ.',
  'creator.terms.paidCredits':
    'Деньги приносят только сцены, купленные за оплаченные кредиты. Бесплатные кредиты и собственные сцены FluidEQ ничего не приносят.',
  'creator.terms.hold':
    'Каждый заработок удерживается {days} дн., чтобы возврат или спор ещё могли его отменить. Если его отменят после выплаты, сумма вычтется из следующей выплаты.',
  'creator.terms.minimum':
    'FluidEQ платит авторам раз в {every} дней, когда к выплате готово {amount} или больше. Затем Stripe переводит деньги на ваш счёт по вашему собственному графику.',
  'creator.terms.stripe':
    'Stripe запрашивает ваши личные, банковские и налоговые данные и показывает свои собственные условия. Выплаты прекращаются, если Stripe больше не может вам платить.',
  'creator.terms.rights':
    'Всё, что есть в ваших сценах, должно принадлежать вам и быть доступным для продажи. Сцены по-прежнему проходят проверку, и сцену, нарушающую условия Plus, могут удалить.',
  'creator.terms.taxes':
    'Налоги с заработка вы декларируете сами по месту жительства.',
  'creator.terms.changes':
    'Эти условия могут меняться. Вас предупредят в приложении и попросят принять новые, прежде чем выплаты продолжатся.',
  'creator.error.signedOut': 'Войдите снова, чтобы управлять выплатами.',
  'creator.error.unconfirmed':
    'Сначала подтвердите адрес почты. Код во входящих.',
  'creator.error.offline':
    'Не удалось связаться с FluidEQ. Проверьте подключение и попробуйте снова.',
  'creator.error.unavailable':
    'Выплаты авторам пока не открыты. Попробуйте позже.',
  'creator.error.agreementOutdated':
    'Условия для авторов изменились. Прочитайте их снова и примите.',
  'creator.error.country':
    'Stripe пока не может платить авторам в этой стране.',
  'creator.error.banned': 'Этому аккаунту нельзя получать выплаты за сцены.',
  'creator.error.server':
    'Что-то пошло не так на нашей стороне. Ничего не изменилось; попробуйте ещё раз чуть позже.',
  'creator.admin.tab': 'Выплаты',
  'creator.admin.plan': 'Авторы, которым платит Stripe',
  'creator.admin.loading': 'Считаем, сколько должны авторам',
  'creator.admin.due': 'К выплате сейчас',
  'creator.admin.creators': 'Авторов: {count}',
  'creator.admin.available': 'Доступно в Stripe',
  'creator.admin.availableNote': 'откуда идут переводы',
  'creator.admin.pending': 'Незавершённые',
  'creator.admin.pendingNote': 'следующий запуск завершит их первыми',
  'creator.admin.short':
    'Доступный баланс FluidEQ в Stripe меньше суммы к выплате. Переводы сверх него не пройдут и дождутся следующего запуска; платите, когда баланс зачислится.',
  'creator.admin.list': 'Кому платим',
  'creator.admin.none':
    'Пока никому не причитается. Автор появится здесь, когда Stripe сможет ему платить и достаточно его заработка пройдёт удержание.',
  'creator.admin.payLead':
    'Заплатить всем в списке: всего {amount}, через Stripe.',
  'creator.admin.confirm':
    'Отправить {amount} сейчас? Это реальные деньги с баланса FluidEQ в Stripe, и отменить это нельзя.',
  'creator.admin.pay': 'Заплатить авторам',
  'creator.admin.payNow': 'Да, заплатить',
  'creator.admin.paying': 'Платим…',
  'creator.admin.ran': 'Оплачено: {paid}. Не оплачено: {failed}.',
  'creator.admin.rules':
    'Каждая выплата отправляется один раз: запуск, прерванный на полпути, завершает следующий, повторно ничего не отправляется. Когда Stripe переводит деньги в банк, авторы решают сами в своей панели Stripe.',
  'creator.admin.lastPaid': 'Последняя выплата: {date}',
  'creator.admin.neverPaid': 'Выплат ещё не было',
  'creator.admin.nextDue': 'следующая: {date}',
  'creator.admin.dueNow': 'пора делать выплату',
  'creator.notice.title': 'Авторам пора заплатить',
  'creator.notice.body':
    'К выплате готово {amount}. Авторов к выплате: {count}. Выплаты раз в {every} дней.',
  'creator.notice.later': 'Позже',
  'creator.notice.open': 'Открыть выплаты',
};

export default creator;
