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
  'account.signInHint':
    'Tu contraseña va directa al servicio de cuentas y no se guarda en ningún lugar de la aplicación.',
  'account.signUpHint':
    'Enviaremos un código de seis dígitos a esa dirección. Escríbelo aquí para terminar.',
  'account.working': 'Un momento…',
  'account.signOut': 'Cerrar sesión',
  'account.signOut.confirm': '¿Cerrar la sesión de esta cuenta?',
  'account.signOut.detail': 'Puedes volver a iniciar sesión cuando quieras.',
  'account.signOut.detailPlus':
    'Tus escenas quedan bloqueadas aquí hasta que vuelvas a iniciar sesión.',
  'account.signOut.kept': 'No se borra nada de este ordenador.',
  'account.name.change': 'Cambiar nombre',
  'account.name.changeTitle': 'Cambia cómo te ven',
  'account.name.changeBody':
    'Tu alias y tu nombre en la clasificación y en las escenas que has publicado. Cambian en todas partes a la vez; tu correo sigue siendo privado.',
  'account.name.cancel': 'Cancelar',
  'account.backToSignIn': 'Volver a iniciar sesión',

  'account.field.email': 'Correo electrónico',
  'account.field.emailHint':
    'nunca se muestra a nadie; solo para iniciar sesión y los códigos',
  'account.field.password': 'Contraseña',
  'account.field.passwordHint': 'al menos {count} caracteres',
  'account.field.name': 'Nombre',
  'account.field.optional': 'opcional',
  'account.field.code': 'Código del correo',

  'account.code.sent': 'Enviamos un código de seis dígitos a {email}.',
  'account.code.confirm': 'Confirmar',
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

  'account.plus.eyebrow': 'FluidEQ Plus',
  'account.plus.active': 'Activa',

  'account.perk.looks':
    'Escenas que son tuyas para siempre, un crédito cada una.',
  'account.perk.visualizers':
    'Visualizadores: las escenas que crean los miembros, abiertas a todas las cuentas.',
  'account.perk.board': 'Una clasificación de quién escucha más.',
  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Continuar con Google',
  'account.or': 'o',
  'account.google.waiting':
    'Termina de iniciar sesión con Google en tu navegador.',
  'account.google.cancel': 'Cancelar',
  'account.error.googleUnfinished':
    'El inicio de sesión con Google no terminó. Inténtalo de nuevo o usa tu correo.',
  'account.google.doneTitle': 'Has iniciado sesión',
  'account.google.doneBody': 'Puedes cerrar esta pestaña y volver a FluidEQ.',
  'account.google.failedTitle': 'El inicio de sesión no terminó',
  'account.google.failedBody':
    'Vuelve a FluidEQ para intentarlo de nuevo o inicia sesión con tu correo.',
} as const;

export default account;
