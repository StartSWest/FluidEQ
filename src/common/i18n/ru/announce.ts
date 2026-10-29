/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const announce = {
  'announce.news.title': 'Новости приложения',
  'announce.news.description':
    'Объявления FluidEQ. Их можно перечитать здесь в любое время.',
  'announce.news.read': 'Читать новости',
  'announce.news.offline':
    'Нет подключения. Показаны сохранённые новости, которые ещё актуальны.',
  'announce.news.empty': 'Актуальных объявлений нет.',

  'announce.eyebrow': 'Новое в «Визуализаторах» · сцен: {count}',
  'announce.try': 'Попробовать сейчас',
  'announce.later': 'Позже',
  'announce.previewNote':
    'Предпросмотр. Ничего не отправлено и ничего не записано.',
} as const;

export default announce;
