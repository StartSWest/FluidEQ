/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.sent': 'Отправлена {date}',
  'review.reason.flashing': 'Вспышки или стробоскоп',
  'review.reason.rights': 'Чужая работа',
  'review.reason.offensive': 'Оскорбительная',
  'review.reason.broken': 'Не работает или слишком тяжёлая',
  'review.reason.other': 'Другое',
  'review.state.pending': 'На проверке',
  'review.state.pendingUpdate': 'Версия {version} на проверке',
  'review.state.rejected': 'Не одобрена',
  'review.state.rejectedUpdate': 'Версия {version} не одобрена',
  'review.withdraw': 'Отозвать',
  'review.withdrawConfirm': 'Отозвать с проверки?',
  'review.remove': 'Убрать',
  'review.removeConfirm': 'Убрать из этого списка?',
  'review.withdrawn': '{name} отозвана.',
  'review.notice.approved': '{name} в галерее',
  'review.notice.approvedBody':
    'Она одобрена. Теперь она бесплатно играет у вас везде, и любой может её получить.',
  'review.notice.approvedUpdate': 'Версия {version} сцены {name} в галерее',
  'review.notice.approvedUpdateBody':
    'Она одобрена. Все, у кого есть эта сцена, получат новую версию.',
  'review.notice.rejected': '{name} не одобрена',
  'review.notice.rejectedUpdate': 'Версия {version} сцены {name} не одобрена',
  'review.notice.keepsLive': 'У кого она есть, остаётся версия {version}.',
  'review.notice.blockAccount':
    'Вы не сможете отправлять сцены на проверку в течение {count} дней.',
  'review.notice.blockScene':
    'Вы не сможете снова отправить её на проверку в течение {count} дней.',
  'review.notice.gotIt': 'Понятно',
  'review.notice.openStudio': 'Открыть Студию',
  'review.notice.openMine': 'Ваши сцены',
  'review.next': 'Исправьте и опубликуйте снова.',
  'review.mark.rejected': 'Не одобрено для галереи',
  'review.mark.rejectedOn': 'Не одобрено {date}',
  'review.mark.show': 'Не одобрено: узнать почему',
  'review.mark.pending': 'Ожидает проверки',
} as const;

export default review;
