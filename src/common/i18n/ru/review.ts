/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.tab': 'На одобрение',
  'review.tabCount': 'Ждут одобрения: {count}',
  'review.badge': 'Ждут вас: {count}',
  'review.hint':
    'Каждая сцена, которую публикует участник, и каждая её новая версия ждёт здесь, пока вы её не одобрите. До тех пор её не видит никто другой.',
  'review.empty.title': 'Ничего не ждёт',
  'review.empty.hint':
    'Новые сцены и новые версии появляются здесь, когда участники их публикуют.',
  'review.kind.new': 'Новая сцена',
  'review.kind.update': 'Обновление · v{from} → v{to}',
  'review.sent': 'Отправлена {date}',
  'review.open': 'Проверить',
  'review.back': 'Всё, что ждёт',
  'review.flag.takenDown': 'Снята из галереи',
  'review.flag.takenDownHint':
    'Снята из галереи: верните её во вкладке «Жалобы», чтобы одобрить новую версию',
  'review.flag.reports': 'Открытые жалобы на опубликованную версию: {count}',
  'review.note.title': 'Что нового, по словам автора',
  'review.note.none': 'Автор ничего не написал об этой версии.',
  'review.sceneFailed': 'Не удалось открыть эту сцену для просмотра.',
  'review.changed':
    'Пока вы смотрели, сцена изменилась: автор прислал более новую версию или отозвал её. В списке — то, что ждёт сейчас.',
  'review.approve': 'Одобрить и опубликовать',
  'review.approving': 'Одобряем…',
  'review.reject': 'Не одобрять',
  'review.reject.title': 'Почему не одобрено?',
  'review.reject.lead':
    'Автор узнает причину и вашу строку, если вы её напишете.',
  'review.reject.noteLabel': 'Строка для автора (необязательно)',
  'review.reject.notePlaceholder':
    'Например: белая вспышка на дропе слишком сильная',
  'review.reject.cancel': 'Назад',
  'review.reject.send': 'Отправить ответ',
  'review.reject.sending': 'Отправка…',
  'review.reason.flashing': 'Вспышки или стробоскоп',
  'review.reason.rights': 'Чужая работа',
  'review.reason.offensive': 'Оскорбительная',
  'review.reason.broken': 'Не работает или слишком тяжёлая',
  'review.reason.other': 'Другое',
  'review.done.approved': '{name} теперь в галерее.',
  'review.done.rejected': '{name} не одобрена. Автор узнает почему.',
  'review.failed': 'Ответ не отправился. Попробуйте ещё раз.',
  'review.versionRaised': 'В галерее уже есть эта или более новая версия.',
  'review.takenDown':
    'Тем временем её сняли из галереи, поэтому новую версию принять нельзя. Сначала верните её во вкладке «Жалобы».',
  'review.deleted':
    'Она удалена насовсем, поэтому новую версию принять нельзя.',
  'review.filesFailed':
    'Одобрено, но файлы сцены не попали в галерею. Нажмите «Одобрить и опубликовать» ещё раз, чтобы завершить.',
  'review.forbidden': 'Одобрять сцены может только администратор FluidEQ.',
  'review.fine.new':
    'Одобрение помещает её в галерею в версии {version}: её видят все, кто вошёл, а участники Plus могут её добавить.',
  'review.fine.update':
    'Одобрение заменяет версию {version} у всех, у кого есть эта сцена. Без одобрения версия {version} остаётся как есть.',
  'review.state.pending': 'На проверке',
  'review.state.pendingUpdate': 'Версия {version} на проверке',
  'review.state.rejected': 'Не одобрена',
  'review.state.rejectedUpdate': 'Версия {version} не одобрена',
  'review.withdraw': 'Отозвать',
  'review.withdrawConfirm': 'Отозвать с проверки?',
  'review.remove': 'Убрать',
  'review.removeConfirm': 'Убрать из этого списка?',
  'review.withdrawn': '{name} отозвана.',
  'review.notice.waitingOne': 'Сцена ждёт вашего одобрения',
  'review.notice.waitingMany': 'Сцен ждут вашего одобрения: {count}',
  'review.notice.waitingWho': '{name}, автор: {maker}',
  'review.notice.waitingNewest': 'Последняя: {name}, автор: {maker}',
  'review.notice.later': 'Позже',
  'review.notice.review': 'Проверить сейчас',
  'review.notice.approved': '{name} в галерее',
  'review.notice.approvedBody':
    'Она одобрена. Участники Plus уже могут её добавить.',
  'review.notice.approvedUpdate': 'Версия {version} сцены {name} в галерее',
  'review.notice.approvedUpdateBody':
    'Она одобрена. Все, у кого есть эта сцена, получат новую версию.',
  'review.notice.rejected': '{name} не одобрена',
  'review.notice.rejectedUpdate': 'Версия {version} сцены {name} не одобрена',
  'review.notice.keepsLive': 'У кого она есть, остаётся версия {version}.',
  'review.notice.gotIt': 'Понятно',
  'review.notice.openStudio': 'Открыть Студию',
  'review.notice.openMine': 'Ваши сцены',
} as const;

export default review;
