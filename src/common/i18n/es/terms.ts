const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': 'Condiciones y privacidad de Plus',
  'terms.meta': 'Versión {version} · En vigor desde el {date}',
  'terms.intro':
    'Estas condiciones cubren tu cuenta de FluidEQ y Plus: acceso, pagos, escenas compartidas y los datos que recibe este servicio. Otras funciones, como Compartir audio, enviar un informe de error o usar un asistente de IA externo, pueden enviar datos cuando las usas y no están cubiertas por esta lista.',
  'terms.link': 'Condiciones y privacidad de Plus',

  'terms.short.title': 'La versión corta',
  'terms.short.price.title': '{price}, cancela cuando quieras',
  'terms.short.price.body':
    'Se paga en Buy Me a Coffee. FluidEQ nunca ve tu tarjeta.',
  'terms.short.free.title': 'No se quita nada gratuito',
  'terms.short.free.body':
    'FluidEQ sigue funcionando sin conexión y sin cuenta, como siempre.',
  'terms.short.choice.title': 'Tú eliges qué se comparte',
  'terms.short.choice.body':
    'La clasificación está desactivada salvo que te unas, y tú decides cuáles de tus escenas compartes.',
  'terms.short.music.title': 'Nunca tu música',
  'terms.short.music.body':
    'El servicio Plus no recibe tu música ni los nombres de las canciones.',

  'terms.membership.title': 'La membresía',
  'terms.membership.p1':
    'Con una cuenta puedes explorar la galería y ver demostraciones breves. Necesitas Plus para descargar escenas y conservarlas, reproducirlas completas, añadirlas a tus estilos y crear las tuyas en el Estudio. Plus añade a FluidEQ visualizadores premium, el Estudio para crear los tuyos y compartirlos con otros miembros, y la clasificación. Cuesta {price} y se renueva al final de cada periodo pagado hasta que la canceles.',
  'terms.membership.p2':
    'El pago lo gestiona Buy Me a Coffee, con sus propias condiciones. FluidEQ nunca ve tu tarjeta ni tus datos bancarios. Puedes cancelar cuando quieras en Buy Me a Coffee: Plus sigue activo hasta el final del periodo que pagaste y no se cobra nada más.',
  'terms.membership.p3':
    'Si un cobro fue un error, o Plus no es para ti, pídelo dentro de los {refundDays} días siguientes a ese cobro y se te devuelve íntegro, sin preguntas.',
  'terms.membership.p4':
    'Cuando termina una membresía, los looks Plus y las escenas de los miembros vuelven a bloquearse y FluidEQ vuelve a sus looks gratuitos; nada de lo que creaste se borra. Plus sigue funcionando sin conexión hasta {graceDays} días después de la última vez que la aplicación confirmó tu membresía. Nada de lo gratuito se ve afectado, nunca.',

  'terms.account.title': 'Tu cuenta',
  'terms.account.p1':
    'Una cuenta es una dirección de correo y una contraseña, y necesitas tener al menos {age} años para crearla. La contraseña viaja cifrada al servicio de inicio de sesión y allí solo se guarda como un hash de un solo sentido, que nadie puede leer, tampoco el creador.',
  'terms.account.p2':
    'Tu correo recibe los códigos que confirman tu dirección y restablecen tu contraseña. Nunca se muestra a otros miembros: en la clasificación y en Visualizadores apareces con el nombre de usuario y el nombre visible que elijas.',
  'terms.account.p3':
    'En tu ordenador, la aplicación guarda tu sesión cifrada por el sistema operativo. Las cuentas son personales: no compartas tu contraseña.',
  'terms.account.p4':
    'Plus funciona en hasta 5 ordenadores a la vez: en casa y en el trabajo, o los ordenadores entre los que suena Compartir audio. Iniciar sesión en un sexto cierra la sesión del que lleve más tiempo sin usarse.',

  'terms.sent.title': 'Qué envía la aplicación, y cuándo',
  'terms.sent.intro':
    'La siguiente lista describe las peticiones de la cuenta y de Plus, que usan conexiones cifradas. El catálogo público no requiere una cuenta. Los proveedores de alojamiento pueden registrar datos de las peticiones, incluidas las direcciones IP. El Foro utiliza GitHub por separado, como se indica más abajo.',
  'terms.sent.when': 'Cuándo',
  'terms.sent.who': 'Quién puede verlo',
  'terms.sent.signIn.what': 'Tu correo y tu contraseña',
  'terms.sent.signIn.when':
    'Al crear una cuenta, iniciar sesión o confirmar tu dirección',
  'terms.sent.signIn.who':
    'El servicio de inicio de sesión guarda tu correo, y la contraseña solo como un hash que nadie puede leer.',
  'terms.sent.membership.what': 'Tu token de sesión',
  'terms.sent.membership.when':
    'Al abrir la aplicación, al volver al ordenador y al abrir una función de Plus',
  'terms.sent.membership.who':
    'El servicio comprueba tu membresía y mantiene sesiones por dispositivo para aplicar el límite de 5 ordenadores.',
  'terms.sent.payment.what':
    'Tu correo de pago y el estado de tu membresía, enviados por Buy Me a Coffee',
  'terms.sent.payment.when': 'Al pagar, renovar o cancelar',
  'terms.sent.payment.who':
    'El creador, para asociar el pago a tu cuenta. Paga con el mismo correo con el que inicias sesión.',
  'terms.sent.looks.what': 'Tu token de sesión',
  'terms.sent.looks.when':
    'Al descargar o actualizar looks Plus, y cuando la aplicación comprueba qué escenas compartidas se han retirado',
  'terms.sent.looks.who':
    'Cada look va firmado, y tu ordenador comprueba la firma antes de reproducirlo.',
  'terms.sent.catalogue.what': 'Petición del catálogo público (sin cuenta)',
  'terms.sent.catalogue.when':
    'Cuando el selector de looks muestra qué looks Plus existen, con o sin cuenta',
  'terms.sent.catalogue.who':
    'La petición solo descarga la lista pública de looks.',
  'terms.sent.profile.what': 'Tu nombre de usuario y tu nombre visible',
  'terms.sent.profile.when': 'Cuando los eliges en la clasificación',
  'terms.sent.profile.who':
    'Todos los miembros con sesión iniciada, junto a tu puesto en la clasificación y en las escenas que publicas.',
  'terms.sent.board.what':
    'Un número por día desde cada uno de tus ordenadores: los minutos enteros de música que sonó, hasta {capHours} horas, con su fecha y un número al azar que distingue tus ordenadores',
  'terms.sent.board.when':
    'Solo si te unes a la clasificación: al volver al ordenador, como mucho cada {uploadHours} horas, y al abrir la clasificación',
  'terms.sent.board.who':
    'Tu nombre de usuario, tu nombre visible, tus puntos y de qué están hechos: todos los miembros con sesión iniciada.',
  'terms.sent.sceneExport.what':
    'Una escena que exportas, con tu nombre visible y el id de tu cuenta',
  'terms.sent.sceneExport.when': 'Cuando pulsas Exportar en el Estudio',
  'terms.sent.sceneExport.who':
    'No se guarda nada de la escena. El creador guarda un registro de qué escena y versión exportaste, cuándo, y una huella, para poder reconocer una escena bloqueada. Quien reciba el archivo ve tu nombre visible y el id de tu cuenta.',
  'terms.sent.sceneLike.what':
    'Qué escena de un miembro está en pantalla, y tu me gusta en ella',
  'terms.sent.sceneLike.when':
    'Cuando se reproduce la escena de un miembro, para mostrar sus me gusta, y cuando pulsas el corazón o retiras un me gusta',
  'terms.sent.sceneLike.who':
    'No se guarda nada de lo que está en pantalla. Los miembros ven cuántos me gusta tiene una escena, nunca quién los dio.',
  'terms.sent.scenePublish.what':
    'Una escena que publicas, su imagen, la categoría que elegiste, tu nombre visible y el id de tu cuenta',
  'terms.sent.scenePublish.when': 'Cuando pulsas Publicar en el Estudio',
  'terms.sent.scenePublish.who':
    'En Visualizadores, hasta que la retires: cualquiera con sesión iniciada en FluidEQ ve su imagen, su nombre, su categoría y tu nombre visible y puede verla funcionar unos segundos, y los miembros Plus pueden reproducirla completa y añadirla. El creador guarda el registro de que la publicaste, como con una exportación.',
  'terms.sent.gallery.what':
    'En Visualizadores: lo que buscas, qué escenas abres y añades, y cualquier escena que denuncies con su motivo',
  'terms.sent.gallery.when':
    'Cuando exploras Visualizadores, pulsas Añadir o envías una denuncia',
  'terms.sent.gallery.who':
    'Las búsquedas y lo que abres no se guardan. Los miembros ven cuántos añadieron una escena, nunca quién. Denuncias: solo el creador.',
  'terms.sent.forum.what':
    'En la pestaña Foro: lo que publicas, editas o eliminas y tus reacciones, con tu sesión de GitHub',
  'terms.sent.forum.when':
    'Abrir el foro descarga sus temas públicos, lo que no lleva nada sobre ti; el resto, solo después de que inicies sesión con GitHub y publiques',
  'terms.sent.forum.who':
    'GitHub, con sus propias condiciones. Las publicaciones son públicas en el GitHub Discussions del proyecto; el servidor de FluidEQ nunca las recibe.',

  'terms.never.title': 'Qué datos no recoge el servicio Plus',
  'terms.never.p1':
    'Tu audio, y cualquier cosa sobre lo que escuchas: nombres de canciones, artistas, archivos, carpetas y listas.',
  'terms.never.p2': 'Tus ajustes de ecualizador, tus presets y tus perfiles.',
  'terms.never.p3':
    'Tus dispositivos de audio y sus nombres, y las demás aplicaciones de tu ordenador.',
  'terms.never.p4':
    'Tus escenas del Estudio permanecen en tu ordenador salvo que las exportes, las publiques o decidas compartirlas con otra herramienta, como tu asistente de IA.',

  'terms.protect.title': 'Cómo se protege',
  'terms.protect.p1': 'Cada petición viaja cifrada.',
  'terms.protect.p2':
    'Las reglas viven en el servidor, no en la aplicación: cada cuenta solo puede cambiar sus propios datos, y una copia modificada de FluidEQ recibe exactamente las mismas respuestas.',
  'terms.protect.p3':
    'La clasificación y Visualizadores muestran nombres de usuario y nombres visibles, nunca correos ni identificadores de cuenta.',
  'terms.protect.p4':
    'El creador administra el servidor y puede ver lo que guarda, para mantenerlo en marcha y moderar lo que publican los miembros. Nada se vende ni se usa para publicidad, y no hay rastreo ni analíticas.',
  'terms.protect.p5':
    'El servicio funciona sobre Supabase (inicio de sesión, base de datos y archivos) y envía los correos a través de Resend; los pagos pasan por Buy Me a Coffee. Cada uno recibe solo lo que su parte necesita.',
  'terms.protect.p6':
    'FluidEQ no guarda direcciones IP. El proveedor de alojamiento registra las peticiones, direcciones incluidas, en registros de corta duración para mantener el servicio funcionando y seguro.',

  'terms.fair.title': 'Juego limpio en la clasificación',
  'terms.fair.p1':
    'El tiempo de escucha lo cuenta la aplicación en tu ordenador, así que el servidor no puede verlo ocurrir. En su lugar comprueba cada número: no más de {capHours} horas al día, ningún día que no haya empezado, nada de más de {windowDays} días atrás, y ningún día que crezca más rápido que el reloj. Los números de tus ordenadores se suman en un solo día, que tampoco crece más rápido que el reloj, así que varios sonando a la vez no pueden sumar más tiempo del que ha pasado.',
  'terms.fair.p2':
    'Todo el mundo gana puntos igual, el creador también. Modificar la aplicación o lo que envía, automatizar la escucha o escalar con más de una cuenta te saca de la clasificación, y puede impedir que la cuenta publique escenas o les dé me gusta.',
  'terms.fair.p3':
    'Cada me gusta en tus escenas vale {likePoints} puntos. Un me gusta cuenta una vez por miembro y escena, solo de miembros de Plus y nunca de tu propia cuenta. Los me gusta desde una segunda cuenta tuya cuentan como escalar con más de una cuenta.',

  'terms.rules.title': 'Normas para lo que publicas',
  'terms.rules.p1':
    'Sé amable. Nada de acoso, odio, amenazas, spam, contenido ilegal ni datos personales de nadie, ya sea en una escena, en su nombre o en su imagen. Cualquiera con sesión iniciada puede ver lo que publicas, así que comparte solo lo que no te importe que se vea.',
  'terms.rules.p2':
    'Puedes retirar tus propias escenas cuando quieras. El creador puede retirar escenas y suspender cuentas que incumplan estas normas. Denuncia una escena para señalarla; solo el creador ve las denuncias.',

  'terms.keep.title': 'Qué se guarda, y cómo borrarlo',
  'terms.keep.p1':
    'Clasificación: «Eliminar todos mis datos» en el panel de Cuenta borra de una vez cada día que hayas enviado. Tu ordenador solo guarda los totales de los últimos {windowDays} días.',
  'terms.keep.p2':
    'Tu nombre de usuario y tu nombre visible: se guardan mientras tengas una cuenta, y se borran con ella.',
  'terms.keep.p3':
    'Membresía: tu correo de pago y su estado se guardan para asociar los pagos a tu cuenta, y se borran con ella.',
  'terms.keep.p4':
    'Tu cuenta: pide que se borre y desaparece en {deletionDays} días, junto con tu perfil, tus días en la clasificación y el registro de tu membresía.',
  'terms.keep.p5':
    'Escenas: una escena que publicas sigue en Visualizadores hasta que la retiras, y retirarla la quita al instante junto con su imagen. Lo que publicaste, el registro de lo que exportaste, las escenas que añadiste, los me gusta que diste y los que recibieron tus escenas se borran con tu cuenta. Una escena bloqueada por incumplir estas condiciones conserva solo su huella, sin tu nombre, para que siga bloqueada.',

  'terms.looks.title': 'Los looks Plus',
  'terms.looks.p1':
    'Los looks Plus son obra del propio creador, con licencia para tu uso personal mientras seas miembro. Por favor, no los copies, compartas ni revendas.',
  'terms.looks.p2':
    'FluidEQ sigue siendo software libre bajo la GPL. Nada de esto cambia ningún derecho que te da la GPL.',

  'terms.scenes.title': 'Las escenas que creas',
  'terms.scenes.p1':
    'Una escena que creas en el Estudio es tuya. FluidEQ no es su dueño, y la GPL que cubre a FluidEQ no la cubre.',
  'terms.scenes.p2':
    'Tus escenas del Estudio permanecen en tu ordenador salvo que las exportes, las publiques o decidas compartirlas con otra herramienta, como tu asistente de IA.',
  'terms.scenes.p3':
    'Al exportar una escena, permites que FluidEQ la revise, quite los comentarios de su shader y la firme con tu nombre, para que otros miembros de Plus puedan reproducirla y ver que la hiciste tú. Ese es todo el permiso. El creador no venderá tu escena, no la usará en publicidad ni la convertirá en uno de los looks Plus sin preguntarte antes, y no te impide hacer nada más con tu propio trabajo.',
  'terms.scenes.p4':
    'Compartir es parte de Plus, no un trabajo: nadie cobra por una escena y nadie paga por una. Lo que recibes a cambio son todas las escenas que comparten los demás miembros.',
  'terms.scenes.p5':
    'Los miembros a los que les gusta tu escena te dan puntos en la clasificación, si te has unido a ella. Los me gusta se cuentan en el servidor; consulta Juego limpio.',
  'terms.scenes.p6':
    'Comparte solo trabajo que tengas derecho a compartir: tus propias fotos y dibujos, o los de alguien que lo permita. Las normas para lo que publicas se aplican a cada escena que compartes. El creador puede impedir que una escena se abra si incumple estas condiciones o los derechos de otra persona.',
  'terms.scenes.p7':
    'Una escena que comparte otro miembro es obra suya, con licencia para tu uso personal mientras seas miembro. Puedes reproducirla, darle me gusta y pasar el archivo sin cambios a otros miembros de Plus. Por favor, no la modifiques, no la presentes como tuya, no la publiques en otro sitio ni la vendas.',
  'terms.scenes.p8':
    'Retirar una escena de la galería impide nuevas descargas desde ella. No borra ni revoca las copias ya descargadas, que siguen autorizadas para uso personal con Plus. FluidEQ puede bloquear escenas que incumplan estas condiciones o los derechos de otra persona.',
  'terms.scenes.p9':
    'Si publicas una escena en Visualizadores, también permites que FluidEQ la guarde ahí hasta que la retires, que muestre su imagen, su nombre, su categoría y tu nombre visible a cualquiera con sesión iniciada en FluidEQ, que se la reproduzca unos segundos, y que ofrezca la escena en sí a los miembros Plus, que pueden reproducirla completa y añadirla. Puedes retirarla cuando quieras, tengas Plus o no. Quien ya la añadió conserva su copia, en las mismas condiciones que un archivo que le enviaste.',
  'terms.scenes.p10':
    'Publicar es opcional y distinto de exportar un archivo. Cualquier miembro puede denunciar una escena publicada; solo el creador lee las denuncias, y puede retirar una escena que incumpla estas condiciones o los derechos de otra persona.',

  'terms.changes.title': 'Cambios, y la letra pequeña',
  'terms.changes.p1':
    'Si estas condiciones cambian, la nueva versión aparece aquí con su fecha, y la aplicación te avisa antes de que se te apliquen.',
  'terms.changes.p2':
    'FluidEQ y Plus se ofrecen tal cual, sin garantías, en la medida en que la ley lo permita. El creador no responde por más de lo que pagaste por Plus en los últimos doce meses. Nada de esto te quita los derechos que la ley te da como consumidor.',

  'terms.contact.title': 'Contacto',
  'terms.contact.p1':
    'Preguntas, reembolsos, borrar tu cuenta o denunciar una escena que usa tu trabajo: {contact}.',

  'terms.agree.check':
    'He leído estas condiciones, incluido lo que envía la aplicación, y las acepto.',
  'terms.agree.continue': 'Aceptar y continuar al pago',
  'terms.agree.opening': 'Abriendo Buy Me a Coffee…',
  'terms.agree.hint':
    'El pago se abre en tu navegador. Usa el mismo correo que tu cuenta de FluidEQ.',
  'terms.back': 'Volver',
  'terms.error.outdated':
    'Estas condiciones han cambiado. Actualiza FluidEQ para leer la nueva versión antes de suscribirte.',
  'terms.error.priceOutdated':
    'El precio ha cambiado. Actualiza FluidEQ para ver el precio actual antes de suscribirte.',
};

export default terms;
