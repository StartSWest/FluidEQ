/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const announce = {
  'announce.eyebrow': 'Новое в «Визуализаторах» · сцен: {count}',
  'announce.try': 'Попробовать сейчас',
  'announce.later': 'Позже',
  'announce.previewNote':
    'Предпросмотр. Ничего не отправлено и ничего не записано.',
  'announce.untitled': 'Новые сцены',
  'announce.tab': 'Объявления',
  'announce.pageHint':
    'Каждый видит объявление один раз, крупно, поверх всего, что у него открыто. Участники, у которых бесплатный период заканчивается в ближайшие два дня, видят ещё и строку о том, как оставить Plus.',
  'announce.field.title': 'Заголовок',
  'announce.field.titlePlaceholder': 'Например: Ночная поездка',
  'announce.field.body': 'Что это',
  'announce.field.bodyPlaceholder':
    'Например: шесть новых сцен ночного города, которые движутся вместе с вашими басами и верхами.',
  'announce.field.scenes':
    'Сцены в нём: {count} из {most}. Первая — большой кадр.',
  'announce.field.noScenes':
    'Сцены FluidEQ ещё не загрузились. Откройте «Визуализаторы» один раз и вернитесь.',
  'announce.field.when': 'Выходит',
  'announce.field.audience': 'Кто видит',
  'announce.audience.everyone': 'Все, кто вошёл',
  'announce.audience.everyoneLine':
    'Участники Plus, бесплатные периоды и бесплатные аккаунты. Бесплатные аккаунты отправляются в «Визуализаторы», чтобы попробовать сцены.',
  'announce.audience.members': 'Участники Plus и бесплатные периоды',
  'announce.audience.membersLine': 'Все, кто уже может воспроизводить сцены.',
  'announce.audience.trialEnding':
    'Только бесплатные периоды, которые заканчиваются в ближайшие 2 дня',
  'announce.audience.trialEndingLine':
    'Участники, которые вот-вот решат, платить ли.',
  'announce.trials.dayAfter':
    'На следующий день, {date}, закончатся бесплатные периоды: {count}.',
  'announce.trials.twoAfter': 'Ещё {count} — днём позже.',
  'announce.preview': 'Предпросмотр',
  'announce.schedule': 'Запланировать',
  'announce.saveChanges': 'Сохранить изменения',
  'announce.stopEditing': 'Закончить редактирование',
  'announce.done': 'Запланировано. Выходит {date}.',
  'announce.listTitle': 'Запланированные и показываемые',
  'announce.listEmpty': 'Ничего не запланировано.',
  'announce.state.out': 'Показывается',
  'announce.state.later': 'Запланировано',
  'announce.edit': 'Изменить',
  'announce.cancel': 'Отменить',
  'announce.cancelAsk': 'Отменить это объявление?',
  'announce.cancelOut': 'Перестать показывать его тем, кто его ещё не видел?',
  'announce.keep': 'Оставить',
} as const;

export default announce;
