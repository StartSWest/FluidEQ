const account = {
  'account.menu': 'Cuenta',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Cuenta',
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
  'account.signedIn': 'Sesión iniciada',
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
  'account.plus.pitch':
    'Visualizadores que no existen en ningún otro sitio, publicar en la comunidad, la clasificación, una línea directa para pedir funciones — y cada función nueva a partir de ahora, primero para los miembros. Todo lo que hoy es gratis sigue siendo gratis.',
  'account.plus.upgrade': 'Pasar a Plus',
  'account.plus.opening': 'Abriendo…',
  'account.plus.checkoutHint':
    'Abre Buy Me a Coffee en tu navegador. Paga con el mismo correo que esta cuenta para que FluidEQ lo reconozca; la aplicación nunca ve tu tarjeta.',
  'account.plus.active': 'Activa',
  'account.plus.renews': 'Se renueva el {date}',
  'account.plus.ends': 'Termina el {date}',
  'account.plus.manage': 'Gestionar suscripción',
  'account.plus.grace':
    'No se pudo confirmar tu suscripción. Sigue activa hasta el {date}; conéctate a internet antes para conservarla.',
  'account.plus.checkAgain': 'Comprobar de nuevo',
  'account.plus.error.rejected':
    'No se pudo abrir la página de pago. Inténtalo de nuevo en un momento.',

  'account.dev.label': 'Desarrollo',
  'account.dev.start': 'Simular un pago',
  'account.dev.cancel': 'Simular una cancelación',
  'account.dev.working': 'Enviando…',

  'account.perk.looks': 'Looks Plus, dibujados en la tarjeta gráfica.',
  'account.perk.community':
    'Una comunidad que todos pueden leer y donde los miembros publican.',
  'account.perk.board': 'Una clasificación de quién escucha más.',
} as const;

export default account;
