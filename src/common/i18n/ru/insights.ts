/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'Любимые',
  'insights.loading': 'Загружаются сцены, которые получают участники',
  'insights.period': 'Период',
  'insights.period.week': '7 дней',
  'insights.period.month': '30 дней',
  'insights.period.quarter': '90 дней',
  'insights.period.all': 'За всё время',
  'insights.favourites.hint':
    'Каждая сцена, которую за этот период добавляли или лайкали, по числу добавлений, затем по лайкам. Ваши собственные не учитываются.',
  'insights.favourites.summary':
    'Сцен добавлено: {scenes}, добавлений всего: {adds}',
  'insights.favourites.empty':
    'За этот период ни одну сцену не добавляли и не лайкали.',
  'insights.favourites.kinds': 'Добавления по видам',
  'insights.favourites.noAdds': 'За этот период пока ничего не добавлялось.',
  'insights.favourites.advice':
    'На «{kind}» приходится {share} всех добавлений, сцен: {count}. Больше сцен вида «{kind}» — самая надёжная ставка.',
  'insights.col.rank': 'Место',
  'insights.col.scene': 'Сцена',
  'insights.col.adds': 'Добавления',
  'insights.col.likes': 'Лайки',
  'insights.account.title': 'Сцены',
  'insights.account.empty': 'Пока ни одна сцена не добавлена и не лайкнута.',
  'insights.account.added': 'Добавлено',
  'insights.account.liked': 'Лайкнуто',
  'insights.account.kind': 'Любимый вид',
  'insights.by': 'автор: {maker}',
  'insights.byFluidEQ': 'автор: FluidEQ',
  'insights.member': 'участник',
  'insights.chip.added': 'Добавлена {date}',
  'insights.chip.liked': 'Лайк',
  'insights.chip.unpublished': 'Не опубликована',
  'insights.kind.other': 'Без категории',
  'insights.error.offline':
    'FluidEQ не удалось связаться со своим сервером. Проверьте подключение и попробуйте ещё раз.',
  'insights.error.signedOut': 'Войдите снова, чтобы это увидеть.',
  'insights.error.server': 'Не удалось загрузить. Попробуйте ещё раз.',
  'insights.error.forbidden': 'Это может видеть только администратор FluidEQ.',
  'insights.error.notDeployed':
    'На сервере этого пока нет. Это появится с обновлением сервера, которое выходит вместе с этой версией FluidEQ.',
  'insights.server.tab': 'Сервер',
  'insights.server.loading': 'Измеряем сервер',
  'insights.server.plan': 'Бесплатный план Supabase',
  'insights.server.measured': 'Измерено в {time}',
  'insights.server.database': 'База данных',
  'insights.server.files': 'Файлы',
  'insights.server.active': 'Активные аккаунты, 30 дней',
  'insights.server.activeNote': 'Всего аккаунтов: {accounts}',
  'insights.server.of': 'из {limit}',
  'insights.server.used': 'Занято: {share}',
  'insights.server.requests': 'Запросы за 7 дней',
  'insights.server.unlimited': 'без ограничений на бесплатном плане',
  'insights.server.kind.rest': 'База данных',
  'insights.server.kind.auth': 'Вход',
  'insights.server.kind.storage': 'Файлы',
  'insights.server.kind.realtime': 'Онлайн',
  'insights.server.noToken': 'Подсчёт запросов на этом сервере не включён.',
  'insights.server.tokenRefused': 'Сервер не смог прочитать число запросов.',
  'insights.server.tables': 'Самые большие таблицы',
  'insights.server.buckets': 'Файлы по папкам',
  'insights.server.bucketFiles': 'Файлов: {count}',
  'insights.server.noFiles': 'Файлов пока нет.',
  'insights.server.egress': 'Отправленные данные',
  'insights.server.egressBody':
    'Бесплатный план включает {limit} в месяц, и обычно этот лимит заканчивается первым: считается каждая сцена и картинка, которую скачивает участник. Ни один API его не сообщает; Supabase показывает его на странице Usage проекта.',
  'insights.server.openSupabase': 'Открыть Supabase',
  'insights.server.limit.warn': 'Сервер заполняется',
  'insights.server.limit.full': 'Сервер почти заполнен',
  'insights.server.limit.body':
    '{what}: занято {share} бесплатного тарифа Supabase. Переведите проект на платный тариф, пока место не кончилось, иначе онлайн-функции FluidEQ начнут отказывать.',
  'insights.server.limit.database': 'База данных',
  'insights.server.limit.files': 'Хранилище файлов',
  'insights.server.limit.accounts': 'Активные аккаунты',
  'insights.server.limit.later': 'Позже',
  'insights.server.limit.open': 'Открыть страницу сервера',
  'insights.server.limit.badge': 'Использовано {share} бесплатного тарифа',
  'insights.server.rules':
    'У бесплатного плана нет даты окончания. При превышении лимита приходит письмо и начинается льготный период; если превышение продолжается, Supabase отвечает на запросы «payment required» до следующего месяца или перехода на платный план. Проект без единого запроса в течение {days} дней приостанавливается — этого не даёт случиться собственный трафик FluidEQ.',
} as const;

export default insights;
