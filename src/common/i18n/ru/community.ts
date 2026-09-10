const community = {
  'community.title': 'Сообщество',
  'community.signIn.title': 'Войдите, чтобы присоединиться к сообществу',
  'community.signIn.body':
    'Любой с аккаунтом может читать все каналы. Писать — и влиять на то, что будет сделано дальше — можно с Plus.',
  'community.signIn.button': 'Войти',
  'community.loading': 'Загрузка…',
  'community.live': 'В эфире',
  'community.connecting': 'Подключение…',
  'community.offline': 'Лента не подключена',
  'community.loadOlder': 'Показать более ранние сообщения',
  'community.empty': 'Пока пусто. Будьте первым.',
  'community.composer.placeholder': 'Сообщение в #{channel}',
  'community.send': 'Отправить',

  'community.plusOnly.title': 'Писать могут участники Plus',
  'community.plusOnly.body':
    'Читать бесплатно для всех, кто вошёл. Писать и влиять на то, что будет сделано, — с Plus.',
  'community.upgrade': 'Перейти на Plus',
  'community.contributorsOnly':
    'Здесь пишут звёздные участники. Читать могут все.',

  'community.handle.title': 'Выберите имя',
  'community.handle.body':
    'Ник для @упоминаний — буквы, цифры и подчёркивания, от 3 до 20 — и имя, которое видят другие.',
  'community.handle.handle': 'Ник',
  'community.handle.name': 'Отображаемое имя',
  'community.handle.save': 'Присоединиться',

  'community.conduct.title': 'Перед первым сообщением',
  'community.conduct.rules':
    'Будьте доброжелательны. Никаких травли, оскорблений, спама и пиратских ссылок. Спорьте с идеями, а не с людьми. Что угодно и кого угодно могут удалить без обжалования.',
  'community.conduct.accept': 'Согласен',

  'community.action.report': 'Пожаловаться',
  'community.action.reported': 'Отправлено',
  'community.action.block': 'Заблокировать',
  'community.action.delete': 'Удалить',
  'community.blocked.count': 'Заблокировано: {count}',
  'community.blocked.unblockAll': 'Разблокировать всех',
  'community.role.contributor': 'Звёздный участник',
  'community.role.admin': 'Автор',
  'community.mentions.unread': 'Непрочитанных упоминаний: {count}',

  'community.channel.general': 'Общий',
  'community.channel.looks': 'Визуализации',
  'community.channel.help': 'Помощь',
  'community.channel.featureRequests': 'Идеи',
  'community.channelDescription.general': 'Всё о FluidEQ. Скажите привет.',
  'community.channelDescription.looks':
    'Визуализации, свои стили и премиум-сцены.',
  'community.channelDescription.help': 'Что-то не выходит? Спросите здесь.',
  'community.channelDescription.featureRequests':
    'Звёздные участники: прямая линия к автору.',

  'community.error.banned': 'Этот аккаунт не может писать в сообществе.',
  'community.error.handleRequired': 'Сначала выберите ник.',
  'community.error.handleTaken': 'Этот ник занят. Попробуйте другой.',
  'community.error.conductRequired': 'Сначала примите правила сообщества.',
  'community.error.plusRequired': 'Писать могут только участники Plus.',
  'community.error.contributorRequired':
    'В этом канале пишут только звёздные участники.',
  'community.error.adminRequired': 'В этом канале пишет только автор.',
  'community.error.rateLimited': 'Чуть медленнее — попробуйте через минуту.',
  'community.error.empty': 'Сначала напишите что-нибудь.',
  'community.error.immutable': 'Отправленные сообщения нельзя изменить.',
  'community.error.network':
    'Не удалось связаться с сообществом. Проверьте подключение.',
  'community.error.signedOut': 'Вы вышли из аккаунта. Войдите снова.',
  'community.error.rejected': 'Служба сообщества отклонила это.',

  'community.hero.read': 'Читайте все каналы',
  'community.hero.post': 'Пишите с Plus',
  'community.hero.board': 'Поднимайтесь в рейтинге',
  'community.composer.hint': 'Enter — отправить · Shift+Enter — новая строка',
} as const;

export default community;
