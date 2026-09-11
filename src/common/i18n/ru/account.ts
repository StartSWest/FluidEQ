const account = {
  'account.menu': 'Аккаунт',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Аккаунт',
  'account.close': 'Закрыть',

  'account.optional':
    'Вход необязателен. Без аккаунта FluidEQ работает точно так же, как всегда: всё выполняется на этом компьютере, и ничего не отслеживается. Аккаунт нужен только для тех частей, которым он действительно необходим.',

  'account.signIn': 'Войти',
  'account.signUp': 'Создать аккаунт',
  'account.signInHint':
    'Пароль уходит напрямую в сервис аккаунтов и нигде в приложении не хранится.',
  'account.signUpHint':
    'На этот адрес придёт шестизначный код. Введите его здесь, чтобы завершить.',
  'account.working': 'Секунду…',
  'account.signOut': 'Выйти',
  'account.signedIn': 'Вход выполнен',
  'account.backToSignIn': 'Назад ко входу',

  'account.field.email': 'Эл. почта',
  'account.field.emailHint':
    'никому не показывается — только для входа и кодов',
  'account.field.password': 'Пароль',
  'account.field.passwordHint': 'не меньше {count} символов',
  'account.field.name': 'Имя',
  'account.field.optional': 'необязательно',
  'account.field.code': 'Код из письма',

  'account.code.sent': 'Мы отправили шестизначный код на {email}.',
  'account.code.confirm': 'Подтвердить',
  'account.code.sendAgain': 'Отправить код ещё раз',
  'account.code.sentAgain': 'Отправлено снова',
  'account.code.otherEmail': 'Другой адрес',
  'account.code.hint':
    'Ничего не пришло? Проверьте папку «Спам». А если аккаунт с этим адресом уже был, код не отправляется — просто войдите.',

  'account.forgot.link': 'Забыли пароль?',
  'account.forgot.lead':
    'Введите адрес, с которым регистрировались, и туда придёт код.',
  'account.forgot.submit': 'Отправить код для сброса',
  'account.reset.sent':
    'Мы отправили шестизначный код на {email}. Введите его здесь вместе с новым паролем.',
  'account.reset.submit': 'Задать новый пароль',

  'account.unavailable': 'Вход недоступен в этой системе',
  'account.unavailableHint':
    'На этом компьютере нет безопасного места для хранения входа, поэтому FluidEQ не будет его сохранять. Всё остальное работает как обычно.',

  'account.error.network':
    'Не удалось связаться с сервисом аккаунтов. Проверьте подключение и попробуйте снова.',
  'account.error.rejected':
    'Сервис аккаунтов отклонил запрос. Попробуйте ещё раз через минуту.',
  'account.error.expired': 'Этот вход больше не действителен. Войдите снова.',
  'account.error.signedOutElsewhere':
    'На этом компьютере выполнен выход: ваш аккаунт вошёл на другом. Plus работает максимум на 5 компьютерах одновременно: войдите снова, чтобы пользоваться им здесь, — тогда выход выполнится на компьютере, которым дольше всего не пользовались.',
  'account.error.malformed':
    'Сервис аккаунтов прислал то, что FluidEQ не смог прочитать.',
  'account.error.wrongCredentials': 'Неверная почта или пароль.',
  'account.error.unconfirmed':
    'Этот аккаунт ещё не подтверждён. Введите код из письма, чтобы завершить.',
  'account.error.weakPassword':
    'Этот пароль слишком легко угадать. Попробуйте длиннее — и не тот, что уже использовали.',
  'account.error.badCode': 'Код неверен или устарел. Запросите новый.',
  'account.error.rateLimited':
    'Слишком много попыток за короткое время. Подождите минуту и попробуйте снова.',
  'account.error.invalidEmail': 'Это не похоже на адрес электронной почты.',
  'account.error.alreadyRegistered':
    'Аккаунт с этим адресом уже существует. Просто войдите.',

  'account.plus.eyebrow': 'FluidEQ Plus',
  'account.plus.pitch':
    'Визуализаторы, которых нет больше нигде, сообщения в сообществе, таблица лидеров, прямая связь для пожеланий — и каждая новая функция отныне сначала для участников. Всё, что бесплатно сегодня, остаётся бесплатным.',
  'account.plus.upgrade': 'Перейти на Plus',
  'account.plus.opening': 'Открываем…',
  'account.plus.checkoutHint':
    'Открывает Buy Me a Coffee в браузере. Платите с той же почты, что и этот аккаунт, чтобы FluidEQ её распознал; приложение никогда не видит вашу карту.',
  'account.plus.active': 'Активна',
  'account.plus.renews': 'Продлится {date}',
  'account.plus.ends': 'Закончится {date}',
  'account.plus.manage': 'Управлять подпиской',
  'account.plus.grace':
    'Не удалось подтвердить подписку. Она действует до {date} — подключитесь к интернету до этого, чтобы её сохранить.',
  'account.plus.checkAgain': 'Проверить ещё раз',
  'account.plus.perMonth': '{price} / мес.',
  'account.plus.perYear': '{price} / год',
  'account.plus.priceChoice': '{monthly} или {yearly}',
  'account.plus.checkoutOpened':
    'Buy Me a Coffee открыт в браузере. Вернитесь сюда после оплаты — и Plus включится.',
  'account.plus.error.rejected':
    'Не удалось открыть страницу оплаты. Попробуйте ещё раз через минуту.',

  'account.dev.label': 'Разработка',
  'account.dev.start': 'Имитировать оплату',
  'account.dev.cancel': 'Имитировать отмену',
  'account.dev.working': 'Отправка…',

  'account.perk.looks': 'Стили Plus, отрисованные видеокартой.',
  'account.perk.community':
    'Сообщество, которое читают все, а пишут участники.',
  'account.perk.board': 'Рейтинг тех, кто слушает больше всех.',
} as const;

export default account;
