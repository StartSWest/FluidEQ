const account = {
  'account.validation.passwordRequired': 'Введите пароль.',
  'account.validation.passwordShort': 'Используйте не менее {count} символов.',
  'account.validation.passwordLong': 'Используйте не более 128 символов.',
  'account.validation.nameLong': 'Используйте не более 80 символов.',
  'account.validation.code': 'Введите шестизначный код.',
  'account.menu': 'Аккаунт',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Аккаунт',
  'account.checking': 'Проверяем аккаунт…',
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
  'account.signOut.confirm': 'Выйти из этого аккаунта?',
  'account.signOut.detail': 'Войти снова можно в любой момент.',
  'account.signOut.detailPlus':
    'Ваши сцены останутся здесь заблокированными, пока вы снова не войдёте.',
  'account.signOut.kept': 'На этом компьютере ничего не удалится.',
  'account.name.change': 'Изменить имя',
  'account.name.changeTitle': 'Измените, как вас видят',
  'account.name.changeBody':
    'Ваш ник и имя на опубликованных вами сценах. Они меняются везде сразу; ваш адрес почты остаётся скрытым.',
  'account.name.cancel': 'Отмена',
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
    'С этого компьютера выполнен выход, потому что ваш аккаунт вошёл на другом. Аккаунт может быть активен одновременно не более чем на 5 компьютерах: войдите снова, чтобы пользоваться им здесь, и вместо этого будет выполнен выход на компьютере, которым пользовались дольше всего назад.',
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

  'account.perk.looks': 'Сцены, которые ваши навсегда, по кредиту за каждую.',
  'account.perk.visualizers':
    '«Визуализаторы»: сцены, которые создают участники, открыты для любого аккаунта.',
  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Продолжить с Google',
  'account.or': 'или',
  'account.google.waiting': 'Завершите вход через Google в браузере.',
  'account.google.cancel': 'Отмена',
  'account.error.googleUnfinished':
    'Вход через Google не завершён. Попробуйте ещё раз или войдите по электронной почте.',
  'account.google.doneTitle': 'Вы вошли',
  'account.google.doneBody': 'Эту вкладку можно закрыть и вернуться в FluidEQ.',
  'account.google.failedTitle': 'Вход не завершён',
  'account.google.failedBody':
    'Вернитесь в FluidEQ, чтобы попробовать снова, или войдите по электронной почте.',
} as const;

export default account;
