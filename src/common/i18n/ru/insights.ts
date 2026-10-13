/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'Любимые',
  'insights.loading': 'Загружаются сцены, которые смотрят участники',
  'insights.period': 'Период',
  'insights.period.week': '7 дней',
  'insights.period.month': '30 дней',
  'insights.period.quarter': '90 дней',
  'insights.period.all': 'За всё время',
  'insights.favourites.hint':
    'Каждая сцена, которую за этот период воспроизводили, добавляли или лайкали, по числу людей, которые её воспроизводили, затем по времени на экране. Ваши собственные проверки не учитываются.',
  'insights.favourites.summary': 'Сцен воспроизведено: {scenes}, всего {time}',
  'insights.favourites.empty':
    'За этот период ни одну сцену не воспроизводили, не добавляли и не лайкали.',
  'insights.favourites.kinds': 'Время на экране по видам',
  'insights.favourites.noPlays':
    'За этот период пока ничего не воспроизводилось.',
  'insights.favourites.advice':
    'На «{kind}» приходится {share} всего просмотра, сцен: {count}. Больше сцен вида «{kind}» — самая надёжная ставка.',
  'insights.col.rank': 'Место',
  'insights.col.scene': 'Сцена',
  'insights.col.people': 'Людей',
  'insights.col.time': 'Время',
  'insights.col.perPerson': 'На человека',
  'insights.col.adds': 'Добавления',
  'insights.col.likes': 'Лайки',
  'insights.account.title': 'Сцены',
  'insights.account.empty':
    'Пока ни одна сцена не добавлена, не лайкнута и не воспроизведена. Время воспроизведения учитывается, как только участник запускает эту версию FluidEQ и видел обновлённые условия.',
  'insights.account.played': 'Воспроизведено сцен',
  'insights.account.time': 'На экране',
  'insights.account.added': 'Добавлено',
  'insights.account.liked': 'Лайкнуто',
  'insights.account.kind': 'Любимый вид',
  'insights.account.notPlayed': 'Не воспроизводилась',
  'insights.account.days': 'Дней: {days} · последний раз {date}',
  'insights.by': 'автор: {maker}',
  'insights.byFluidEQ': 'автор: FluidEQ',
  'insights.member': 'участник',
  'insights.chip.added': 'Добавлена {date}',
  'insights.chip.liked': 'Лайк',
  'insights.kind.other': 'Без категории',
  'insights.time.hoursMinutes': '{hours} {minutes}',
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
  'insights.server.noToken': 'Для запросов нужен ключ статистики.',
  'insights.server.tokenSteps':
    'Создайте токен доступа на supabase.com в разделе Account → Access tokens (только с правом «read analytics usage», если есть выбор) и добавьте его в проект в Edge Functions → Secrets под именем USAGE_ACCESS_TOKEN.',
  'insights.server.tokenRefused':
    'Supabase отклонил ключ статистики. Создайте новый и сохраните его под тем же именем.',
  'insights.server.tables': 'Самые большие таблицы',
  'insights.server.buckets': 'Файлы по папкам',
  'insights.server.bucketFiles': 'Файлов: {count}',
  'insights.server.noFiles': 'Файлов пока нет.',
  'insights.server.egress': 'Отправленные данные',
  'insights.server.egressBody':
    'Бесплатный план включает {limit} в месяц, и обычно этот лимит заканчивается первым: считается каждая сцена и картинка, которую скачивает участник. Ни один API его не сообщает; Supabase показывает его на странице Usage проекта.',
  'insights.server.openSupabase': 'Открыть Supabase',
  'insights.server.rules':
    'У бесплатного плана нет даты окончания. При превышении лимита приходит письмо и начинается льготный период; если превышение продолжается, Supabase отвечает на запросы «payment required» до следующего месяца или перехода на платный план. Проект без единого запроса в течение {days} дней приостанавливается — этого не даёт случиться собственный трафик FluidEQ.',
} as const;

export default insights;
