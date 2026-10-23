const listening = {
  'listening.notice.title': 'FluidEQ считает, сколько вы слушаете',
  'listening.notice.body':
    'Одно число в день: минуты музыки, которая играла, за последние {days} дней и не больше {hours} часов в день. Ни что играло, ни откуда. Это видит только администратор FluidEQ — в сумме со всеми остальными и никогда с вашим именем.',
  'listening.notice.keep': 'Оставить включённым',
  'listening.notice.off': 'Выключить',
  'listening.notice.change':
    'Изменить это можно в любой момент в вашем аккаунте.',
  'listening.card.title': 'Время прослушивания',
  'listening.card.today': 'Сегодня на этом компьютере',
  'listening.card.notCounted': 'Не считается',
  'listening.card.switch': 'Делиться с FluidEQ, сколько я слушаю',
  'listening.card.what': 'Что видит FluidEQ',
  'listening.card.offNote':
    'Выключено: ничего не считается, а все отправленные вами дни удалены.',
  'listening.card.unknownNote':
    'Подключитесь к интернету, чтобы увидеть или изменить это.',
  'listening.error.offline':
    'Не удалось связаться с FluidEQ. Проверьте подключение и попробуйте ещё раз.',
  'listening.error.signedOut': 'Войдите снова, чтобы изменить это.',
  'listening.error.server': 'Не получилось. Попробуйте ещё раз.',
  'listening.admin.tab': 'Прослушивание',
  'listening.admin.plan': 'Сколько слушают люди',
  'listening.admin.loading': 'Загрузка данных о прослушивании',
  'listening.admin.time': 'Время прослушивания',
  'listening.admin.timeNote': '{time} в день за период',
  'listening.admin.listeners': 'Слушатели',
  'listening.admin.listenersNote': 'из {accounts} аккаунтов',
  'listening.admin.average': 'День прослушивания',
  'listening.admin.averageNote': 'на слушателя, в дни, когда он слушал',
  'listening.admin.sharing': 'Делятся',
  'listening.admin.sharingNote':
    '{declined} выключили · {unasked} ещё не спрошены',
  'listening.admin.chart': 'По дням',
  'listening.admin.chartKey.time': 'Время прослушивания',
  'listening.admin.chartKey.listeners': 'Слушатели',
  'listening.admin.day': '{date}: {time}, слушателей: {listeners}',
  'listening.admin.peak': 'Самый активный день: {date}, {time}',
  'listening.admin.empty': 'За этот период ещё никто не слушал.',
  'listening.admin.rules':
    'Считается только для аккаунтов, которые были предупреждены и оставили это включённым. Ваш собственный аккаунт и заблокированные не учитываются. День — это календарный день каждого слушателя, и он считается не больше {hours} часов; два компьютера, играющие одновременно, считаются один раз.',
};

export default listening;
