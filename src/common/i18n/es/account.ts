const account = {
  'account.validation.passwordRequired': 'Escribe tu contraseña.',
  'account.validation.passwordShort': 'Usa al menos {count} caracteres.',
  'account.validation.passwordLong': 'Usa como máximo 128 caracteres.',
  'account.validation.nameLong': 'Usa como máximo 80 caracteres.',
  'account.validation.code': 'Escribe el código de seis dígitos.',
  'account.menu': 'Cuenta',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Cuenta',
  'account.checking': 'Comprobando tu cuenta…',
  'account.close': 'Cerrar',

  'account.optional':
    'Iniciar sesión es opcional. FluidEQ funciona exactamente como siempre sin cuenta: todo se ejecuta en esta máquina y nada se rastrea. La cuenta solo existe para las partes que de verdad la necesitan.',

  'account.signIn': 'Iniciar sesión',
  'account.signUp': 'Crear cuenta',
  'account.working': 'Un momento…',
  'account.signOut': 'Cerrar sesión',
  'account.signOut.confirm': '¿Cerrar la sesión de esta cuenta?',
  'account.signOut.detail': 'Puedes volver a iniciar sesión cuando quieras.',
  'account.suspended.failed':
    'No se pudo pedir el reembolso. Inténtalo de nuevo.',
  'account.suspended.until': 'hasta el {date}',
  'account.suspended.daysLeft.other': 'Quedan {count} días',
  'account.suspended.daysLeft.many': 'Quedan {count} días',
  'account.suspended.daysLeft.few': 'Quedan {count} días',
  'account.suspended.daysLeft.one': 'Queda {count} día',
  'account.suspended.asked':
    'Reembolso pedido: {amount}. Te llegará el {date}, cuando se borre la cuenta.',
  'account.suspended.ask': 'Pedir reembolso',
  'account.suspended.maker':
    'Tus escenas ya no están en la galería y se canceló lo que tenías pendiente de cobrar.',
  'account.suspended.paid': 'Pagaste en esos días',
  'account.suspended.bodyAsked':
    'Tu cuenta está suspendida por incumplir las normas. Ya no puedes usarla ni comprar.',
  'account.suspended.bodyNothing':
    'Tu cuenta está suspendida por incumplir las normas. Ya no puedes usarla ni comprar. El {until} tu cuenta se borrará.',
  'account.suspended.body':
    'Tu cuenta está suspendida por incumplir las normas. Ya no puedes usarla ni comprar. Puedes pedir el reembolso de lo que pagaste entre el {from} y el {to} hasta el {until}. Ese día tu cuenta se borrará.',
  'account.suspended.title': 'Cuenta suspendida',
  'account.suspended.eyebrow': 'Cuenta',
  'account.signOut.detailPlus':
    'Tus escenas quedan bloqueadas aquí hasta que vuelvas a iniciar sesión.',
  'account.signOut.kept': 'No se borra nada de este ordenador.',
  'account.cover.onGraph': '{name} en la gráfica',
  'account.stats.owned': 'Tuyas',
  'account.stats.likes': 'Me gusta',
  'account.scenes.title': 'Tu colección',
  'account.scenes.openGallery': 'Abrir la galería',
  'account.scenes.empty':
    'Las escenas que consigas son tuyas para siempre y se ponen en la gráfica desde aquí.',
  'account.scenes.playing': 'Sonando',
  'account.scenes.unpublished': 'Despublicada',
  'account.scenes.unpublishedHint':
    'Su creador la quitó de la galería. Sigue siendo tuya.',
  'account.scenes.play': 'Poner {name} en la gráfica',
  'account.published.title': 'Publicadas',
  'account.published.live': 'En la galería',
  'account.name.change': 'Cambiar nombre',
  'account.name.changeTitle': 'Cambia cómo te ven',
  'account.name.changeBody':
    'Tu alias y tu nombre en las escenas que has publicado. Cambian en todas partes a la vez; tu correo sigue siendo privado.',
  'account.name.cancel': 'Cancelar',
  'account.backToSignIn': 'Volver a iniciar sesión',

  'account.field.email': 'Correo electrónico',
  'account.field.emailHint':
    'nunca se muestra a nadie; solo para iniciar sesión y los códigos',
  'account.field.password': 'Contraseña',
  'account.field.passwordHint': 'al menos {count} caracteres',
  'account.field.code': 'Código del correo',

  'account.code.sent': 'Enviamos un código de seis dígitos a {email}.',
  'account.code.sendAgain': 'Enviar el código de nuevo',
  'account.code.sentAgain': 'Enviado de nuevo',
  'account.code.otherEmail': 'Usar otro correo',
  'account.code.hint':
    '¿No llegó nada? Revisa la carpeta de spam. Y si ya tenías una cuenta con esta dirección no se envía código: inicia sesión en su lugar.',

  'account.forgot.link': '¿Olvidaste la contraseña?',
  'account.forgot.lead':
    'Escribe la dirección con la que te registraste y enviaremos un código allí.',
  'account.forgot.submit': 'Enviar código de restablecimiento',
  'account.reset.sent':
    'Enviamos un código de seis dígitos a {email}. Escríbelo aquí junto con tu nueva contraseña.',
  'account.reset.submit': 'Establecer nueva contraseña',

  'account.unavailable': 'Iniciar sesión no está disponible en este sistema',
  'account.unavailableHint':
    'No hay un lugar seguro donde guardar una sesión en esta máquina, así que FluidEQ no la almacenará. Todo lo demás funciona con normalidad.',

  'account.error.network':
    'No se pudo contactar con el servicio de cuentas. Comprueba tu conexión e inténtalo de nuevo.',
  'account.error.rejected':
    'El servicio de cuentas lo rechazó. Inténtalo de nuevo en un momento.',
  'account.error.expired':
    'Esa sesión ya no es válida. Vuelve a iniciar sesión.',
  'account.error.signedOutElsewhere':
    'Se cerró la sesión en este equipo porque tu cuenta inició sesión en otro. Una cuenta puede tener la sesión abierta en hasta 5 equipos a la vez: vuelve a iniciar sesión para usarla aquí, y se cerrará la del que se usó hace más tiempo.',
  'account.error.malformed':
    'El servicio de cuentas envió algo que FluidEQ no pudo leer.',
  'account.error.wrongCredentials': 'Correo o contraseña incorrectos.',
  'account.error.unconfirmed':
    'Esa cuenta aún no está confirmada. Escribe el código del correo para terminar.',
  'account.error.weakPassword':
    'Esa contraseña es demasiado fácil de adivinar. Prueba una más larga, y que no hayas usado antes.',
  'account.error.badCode':
    'Ese código es incorrecto o ha caducado. Pide uno nuevo.',
  'account.error.rateLimited':
    'Demasiados intentos en poco tiempo. Espera un minuto y vuelve a intentarlo.',
  'account.error.invalidEmail': 'Eso no parece una dirección de correo.',
  'account.error.alreadyRegistered':
    'Ya existe una cuenta con esa dirección. Inicia sesión en su lugar.',

  'account.plus.eyebrow': 'FluidEQ',

  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Continuar con Google',
  'account.google.waiting':
    'Termina de iniciar sesión con Google en tu navegador.',
  'account.google.cancel': 'Cancelar',
  // The sign-in screens Ivan approved on 2026-11-13 (`AccountWelcome`).
  'account.welcome.createTitle.one': 'Tu {count} escena te espera',
  'account.welcome.createTitle.few': 'Tus {count} escenas te esperan',
  'account.welcome.createTitle.many': 'Tus {count} escenas te esperan',
  'account.welcome.createTitle.other': 'Tus {count} escenas te esperan',
  'account.welcome.createLine.one':
    'Una cuenta gratis empieza con {count} crédito. Te da una escena para quedártela para siempre.',
  'account.welcome.createLine.few':
    'Una cuenta gratis empieza con {count} créditos. Cada uno te da una escena para quedártela para siempre.',
  'account.welcome.createLine.many':
    'Una cuenta gratis empieza con {count} créditos. Cada uno te da una escena para quedártela para siempre.',
  'account.welcome.createLine.other':
    'Una cuenta gratis empieza con {count} créditos. Cada uno te da una escena para quedártela para siempre.',
  'account.welcome.step.create': 'Crea tu cuenta',
  'account.welcome.step.confirm': 'Confirma tu correo',
  'account.welcome.step.pick.one': 'Elige tu {count} escena',
  'account.welcome.step.pick.few': 'Elige tus {count} escenas',
  'account.welcome.step.pick.many': 'Elige tus {count} escenas',
  'account.welcome.step.pick.other': 'Elige tus {count} escenas',
  'account.welcome.backTitle': 'Hola de nuevo',
  'account.welcome.backLine':
    'Tus escenas, tus créditos y tus proyectos del Estudio están donde los dejaste.',
  'account.welcome.back.scenes':
    'Tus escenas se reproducen en cada equipo donde inicies sesión',
  'account.welcome.back.credits': 'Tus créditos, listos para gastar',
  'account.welcome.back.studio': 'Tus escenas del Estudio y la galería',
  'account.welcome.free':
    'El ecualizador y el audio de FluidEQ siguen gratis, con o sin cuenta.',
  'account.google.note': 'Lo más rápido: un clic, sin contraseña que recordar.',
  'account.or.email': 'o con tu correo',
  'account.signUp.withEmail': 'Crear cuenta con correo',
  'account.signIn.withEmail': 'Iniciar sesión con correo',
  'account.signUp.terms':
    'Al crear una cuenta aceptas las Condiciones y la Política de privacidad.',
  'account.code.step': 'Paso 2 de 3',
  'account.code.title': 'Revisa tu correo',
  'account.code.confirmEmail': 'Confirmar mi correo',
  'account.error.googleUnfinished':
    'El inicio de sesión con Google no terminó. Inténtalo de nuevo o usa tu correo.',
  'account.google.doneTitle': 'Has iniciado sesión',
  'account.google.doneBody': 'Puedes cerrar esta pestaña y volver a FluidEQ.',
  'account.google.failedTitle': 'El inicio de sesión no terminó',
  'account.google.failedBody':
    'Vuelve a FluidEQ para intentarlo de nuevo o inicia sesión con tu correo.',
} as const;

export default account;
