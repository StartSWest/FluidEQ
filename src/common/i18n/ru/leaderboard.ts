const leaderboard = {
  'leaderboard.title': 'Таблица лидеров',
  'leaderboard.card.title': 'Таблица лидеров',
  'leaderboard.card.body':
    'Кто слушает больше всех среди участников Plus. Выключено, пока вы не присоединитесь. Если присоединитесь, приложение отправляет одно число за каждый день — целые минуты проигранной музыки, не больше шестнадцати часов — с его датой и обновляет его, когда вы возвращаетесь к компьютеру или открываете таблицу лидеров. Никогда — что вы слушали и откуда.',
  'leaderboard.card.today': 'Сегодня пока: {hours} ч',
  'leaderboard.card.join': 'Присоединиться к таблице',
  'leaderboard.card.leave': 'Покинуть таблицу',
  'leaderboard.card.remove': 'Удалить все мои данные',
  'leaderboard.card.removed': 'Удалено. В таблице ничего вашего не осталось.',
  'leaderboard.card.removeConfirmTitle': 'Удалить всё, что вы отправляли?',
  'leaderboard.card.removeConfirmBody':
    'Ваше место и каждый день прослушивания в рейтинге будут удалены навсегда. Вернуть их нельзя; при повторном участии всё начнётся с нуля.',
  'leaderboard.card.removeKeep': 'Оставить мои данные',
  'leaderboard.card.removeConfirm': 'Удалить всё',
  'leaderboard.card.plusOnly':
    'В таблицу попадают только участники Plus. До этого участие ничего не даёт.',
  'leaderboard.allTime': 'За всё время',
  'leaderboard.thisMonth': 'За месяц',
  'leaderboard.hours': '{hours} ч',
  'leaderboard.you': 'Вы',
  'leaderboard.players': 'В таблице: {count}',
  'leaderboard.points': '{points} очк.',
  'leaderboard.hero.title': 'Ваше место',
  'leaderboard.hero.of': 'из {count}',
  'leaderboard.hero.toPass': '{points} очк., чтобы обойти {name}',
  'leaderboard.hero.leading': 'Вы лидируете.',
  'leaderboard.part.hours': 'Прослушивание',
  'leaderboard.part.days': 'Активные дни',
  'leaderboard.part.messages': 'Сообщения',
  'leaderboard.part.mentions': 'Упоминания',
  'leaderboard.guide.title': 'Как заработать очки',
  'leaderboard.guide.lead': 'Все зарабатывают одинаково, автор тоже.',
  'leaderboard.guide.hours':
    'Каждый час играющей музыки, до {limit} часов в день.',
  'leaderboard.guide.days':
    'Каждый день, когда вы слушаете {limit} минут или больше.',
  'leaderboard.guide.messages': 'Каждое ваше сообщение, до {limit} в день.',
  'leaderboard.guide.mentions':
    'Каждый человек, который @упоминает вас, — один раз в день.',
  'leaderboard.guide.value': '+{points}',
  'leaderboard.guide.fairTitle': 'Откуда берутся цифры',
  'leaderboard.guide.fair':
    'Ваш компьютер считает минуты музыки и отправляет одну сумму за день, только после того как вы присоединились, и никогда — что вы слушаете. Сообщения и упоминания считает сервер. Там проверяется каждое число, а за подделку убирают из таблицы лидеров.',
  'leaderboard.guide.terms': 'Всё, что отправляет приложение',
  'leaderboard.stat.hours': '{hours} часов прослушивания',
  'leaderboard.stat.messages': '{count} сообщений',
  'leaderboard.stat.mentions': 'Упоминаний от других: {count}',
  'leaderboard.scoring':
    'Очки: {hours} за час прослушивания, {days} за активный день, {messages} за сообщение, {mentions} за каждого, кто упомянул вас за день. Автор получает их так же.',
  'leaderboard.empty': 'Пока никого нет.',
  'leaderboard.notJoined':
    'Вас нет в таблице. Присоединитесь в панели аккаунта.',
  'leaderboard.loading': 'Загрузка…',
  'leaderboard.error.network':
    'Не удалось связаться с таблицей лидеров. Проверьте подключение.',
  'leaderboard.error.plusRequired': 'В таблицу попадают только участники Plus.',
  'leaderboard.error.signedOut': 'Вы вышли из аккаунта. Войдите снова.',
  'leaderboard.error.rejected': 'Служба таблицы лидеров отклонила это.',
} as const;

export default leaderboard;
