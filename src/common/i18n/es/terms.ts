const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': 'Condiciones y privacidad de Plus',
  'terms.meta': 'Versión {version} · En vigor desde el {date}',
  'terms.intro':
    'Estas condiciones cubren tu cuenta de FluidEQ y Plus: la membresía, los pagos, Visualizadores, las escenas que compartes y la clasificación. Enumeran todo lo que la aplicación envía al servicio de FluidEQ, cuándo se envía y quién puede verlo, y, hacia el final, todos los demás lugares a los que se conecta FluidEQ.',
  'terms.link': 'Condiciones y privacidad de Plus',

  'terms.short.title': 'La versión corta',
  'terms.short.price.title': '{price}, cancela cuando quieras',
  'terms.short.price.body':
    'Se paga en Buy Me a Coffee. FluidEQ nunca ve tu tarjeta.',
  'terms.short.free.title':
    'El ecualizador, el rack y los reproductores siguen siendo gratis',
  'terms.short.free.body':
    'FluidEQ sigue funcionando sin conexión y sin cuenta, como siempre.',
  'terms.short.choice.title': 'Tú eliges qué se comparte',
  'terms.short.choice.body':
    'La clasificación está desactivada salvo que te unas, y nada de lo que haces sale de tu ordenador a menos que lo exportes o lo publiques.',
  'terms.short.music.title': 'Nunca tu música',
  'terms.short.music.body':
    'El servicio de FluidEQ nunca recibe tu audio, los nombres de tus canciones ni tu ecualización.',

  'terms.membership.title': 'La membresía',
  'terms.membership.p1':
    'Con una cuenta gratuita puedes explorar Visualizadores, ver la imagen y los detalles de cada escena publicada, probar durante {tasteSeconds} segundos cada una de las escenas de muestra gratuitas de FluidEQ y ver la clasificación. Plus desbloquea los estilos Plus y te permite reproducir y añadir todas las escenas, crear escenas en el Estudio y exportarlas o publicarlas, unirte a la clasificación y llevar escenas a tu escritorio y a tus luces RGB. Cuesta {price} y se renueva al final de cada periodo pagado hasta que lo canceles. Plus también puede llegar sin pagar. Cuando FluidEQ ofrece una prueba gratuita, una cuenta creada a partir del día en que empezó esa oferta puede usarla una vez, durante {trialDays} días, sin tarjeta y sin ningún cobro al terminar. Y una escena que publiques y que un moderador apruebe puede darte un mes de Plus. Ninguno de los dos es una suscripción: nada los renueva y nunca se cobra nada por ellos. Cuando una escena tuya ya te ha dado un mes, el Estudio te deja un proyecto abierto aunque no tengas Plus, para que puedas publicar tu siguiente escena; exportar un archivo sigue siendo de Plus.',
  'terms.membership.p2':
    'El pago lo gestiona Buy Me a Coffee, con sus propias condiciones. FluidEQ nunca ve tu tarjeta ni tus datos bancarios. Puedes cancelar cuando quieras en Buy Me a Coffee: Plus sigue activo hasta el final del periodo que pagaste y no se cobra nada más.',
  'terms.membership.p4':
    'Cuando termina una membresía, los estilos Plus y las escenas de los miembros vuelven a bloquearse y FluidEQ vuelve a sus estilos gratuitos; nada de lo que creaste se borra. Sin conexión, Plus sigue funcionando hasta el final del periodo que pagaste y, si la aplicación no pudo confirmar una renovación, hasta {graceDays} días más. Una prueba gratuita, un regalo y un mes ganado publicando terminan en su propia fecha: nada los renueva, así que después no hay margen. Nada de lo gratuito se ve afectado, nunca.',
  'terms.membership.p5':
    'El creador puede regalar Plus a una dirección de correo. Se activa cuando una cuenta confirma esa dirección y dura hasta la fecha de fin que haya elegido el creador, si la hay, o hasta que el creador lo quite.',

  'terms.account.title': 'Tu cuenta',
  'terms.account.p1':
    'Una cuenta es una dirección de correo, una contraseña y, si lo indicas, un nombre, y necesitas tener al menos {age} años para crearla. La contraseña viaja cifrada al servicio de inicio de sesión y allí solo se guarda como un hash de un solo sentido, que nadie puede leer, tampoco el creador.',
  'terms.account.p2':
    'Tu correo recibe los códigos que confirman tu dirección y restablecen tu contraseña. Nunca se muestra a otros miembros: en la clasificación y en Visualizadores apareces con el alias y el nombre visible que elijas.',
  'terms.account.p3':
    'En tu ordenador, la aplicación guarda tu sesión cifrada por el sistema operativo. Las cuentas son personales: no compartas tu contraseña.',
  'terms.account.p4':
    'Una cuenta mantiene la sesión iniciada en hasta {computers} ordenadores a la vez: en casa y en el trabajo, o los ordenadores entre los que suena Compartir audio. Si inicias sesión en uno más, en el plazo de una hora se cierra la sesión del ordenador que lleve más tiempo sin usarse.',

  'terms.sent.title': 'Qué envía la aplicación, y cuándo',
  'terms.sent.intro':
    'Todo lo que la aplicación envía al servicio de FluidEQ, siempre por una conexión cifrada. Los demás lugares a los que se conecta FluidEQ se enumeran más abajo.',
  'terms.sent.when': 'Cuándo',
  'terms.sent.who': 'Quién puede verlo',
  'terms.sent.signIn.what':
    'Tu correo y tu contraseña, y el nombre que indiques al registrarte',
  'terms.sent.signIn.when':
    'Al crear una cuenta, iniciar sesión, confirmar tu dirección o restablecer tu contraseña',
  'terms.sent.signIn.who':
    'El servicio de inicio de sesión guarda tu correo y tu nombre, y la contraseña solo como un hash que nadie puede leer.',
  'terms.sent.membership.what': 'Tu token de sesión y el id de tu cuenta',
  'terms.sent.membership.when':
    'Al abrir la aplicación, al iniciar sesión, al volver al ordenador (como mucho cada pocas horas) y al pulsar Comprobar de nuevo',
  'terms.sent.membership.who':
    'Solo tú y el creador. El servicio confirma tu membresía, busca un pago de Buy Me a Coffee hecho con tu correo confirmado y lee qué versión de estas condiciones aceptaste, para que la aplicación pueda avisarte cuando cambien. Ese mismo token pregunta si esta cuenta puede empezar una prueba gratuita y cómo están sus meses ganados.',
  'terms.sent.payment.what':
    'El correo con el que pagas, el estado y el periodo de tu membresía, y los identificadores de tu membresía en Buy Me a Coffee, enviados por Buy Me a Coffee',
  'terms.sent.payment.when': 'Al pagar, renovar o cancelar',
  'terms.sent.payment.who':
    'El creador, para asociar el pago a tu cuenta. Solo se asocia a una dirección de correo confirmada, así que paga con el mismo correo con el que inicias sesión.',
  'terms.sent.agreement.what':
    'Qué versión de estas condiciones aceptaste, y cuándo',
  'terms.sent.agreement.when':
    'Al continuar al pago, empezar una prueba gratuita, exportar una escena o publicar una',
  'terms.sent.agreement.who':
    'El creador. Se guarda con tu cuenta, aunque no llegues a pagar.',
  'terms.sent.looks.what':
    'Tu token de sesión, y los identificadores de las escenas de FluidEQ que tienes instaladas y tienen una versión nueva, para descargarlas',
  'terms.sent.looks.when':
    'Al abrir la aplicación, al volver al ordenador y al abrir la lista de estilos, para descargar las versiones nuevas y saber qué escenas compartidas se han retirado',
  'terms.sent.looks.who':
    'No se guarda nada. Cada estilo va firmado, y tu ordenador comprueba la firma antes de reproducirlo.',
  'terms.sent.catalogue.what': 'Nada sobre ti',
  'terms.sent.catalogue.when':
    'Al abrir FluidEQ, como mucho cada pocas horas, para mostrar qué estilos Plus existen, con o sin cuenta',
  'terms.sent.catalogue.who':
    'No se guarda nada. La petición solo descarga la lista pública de estilos.',
  'terms.sent.profile.what': 'El alias y el nombre visible que elijas',
  'terms.sent.profile.when': 'Cuando los eliges en la clasificación',
  'terms.sent.profile.who':
    'Todas las cuentas con sesión iniciada: en la clasificación, en las escenas que publicas y en tu página de creador en Visualizadores, donde se pueden buscar. Se rechazan los nombres que se hacen pasar por FluidEQ o por su equipo.',
  'terms.sent.board.what':
    'Un número por día desde cada uno de tus ordenadores: los minutos enteros de música que sonó, hasta {capHours} horas, con su fecha y un número al azar que distingue tus ordenadores',
  'terms.sent.board.when':
    'Solo si te unes a la clasificación: al unirte, al volver al ordenador como mucho cada {uploadHours} horas, y al abrir la clasificación o la página de un creador en Visualizadores',
  'terms.sent.board.who':
    'Tu alias, tu nombre visible, tu puesto, tus puntos y de qué están hechos: todas las cuentas con sesión iniciada, en la clasificación y en tu página de creador.',
  'terms.sent.sceneExport.what':
    'Una escena que exportas: su código, sus ajustes, sus imágenes y sus elementos de ambiente',
  'terms.sent.sceneExport.when': 'Cuando pulsas Exportar en el Estudio',
  'terms.sent.sceneExport.who':
    'El servicio revisa la escena, quita los comentarios de su código y la firma, añadiendo al archivo tu nombre visible y el id de tu cuenta. Guarda un registro de qué escena y versión exportaste, cuándo, y una huella del archivo. Quien reciba el archivo ve tu nombre visible y el id de tu cuenta.',
  'terms.sent.sceneLike.what':
    'Qué escena de un miembro está en pantalla, y tu me gusta en ella',
  'terms.sent.sceneLike.when':
    'Cuando se reproduce la escena de un miembro, para mostrar sus me gusta, y cuando pulsas el corazón o retiras un me gusta',
  'terms.sent.sceneLike.who':
    'Tu me gusta se guarda con tu cuenta. Los miembros ven cuántos me gusta tiene una escena, nunca quién los dio. No se guarda nada más de lo que está en pantalla.',
  'terms.sent.scenePublish.what':
    'Una escena que publicas, igual que en una exportación, con una imagen de portada, hasta dos categorías y una nota sobre lo que hay de nuevo, si la escribes',
  'terms.sent.scenePublish.when': 'Cuando pulsas Publicar en el Estudio',
  'terms.sent.scenePublish.who':
    'Cuando un moderador la apruebe, en Visualizadores, hasta que la retires, cualquiera con sesión iniciada en FluidEQ ve su imagen, su nombre, sus categorías, sus notas de versión, sus me gusta y cuántos la añadieron, con tu nombre visible, tu alias y tu página de creador. Solo los miembros Plus pueden reproducir la escena y añadirla. El creador de FluidEQ guarda la escena y el registro de que la publicaste, igual que con una exportación.',
  'terms.sent.gallery.what':
    'En Visualizadores: lo que buscas, las escenas y los creadores que abres, las escenas que añades y cualquier escena que denuncies con su motivo',
  'terms.sent.gallery.when':
    'Cuando exploras Visualizadores o pulsas Añadir o Denunciar, y cuando la aplicación busca versiones nuevas de las escenas que añadiste pidiendo las escenas de sus creadores',
  'terms.sent.gallery.who':
    'Las búsquedas y lo que abres no se guardan. Lo que añades se guarda con tu cuenta; los miembros ven cuántos añadieron una escena, nunca quién. Una denuncia se guarda con tu cuenta y con una huella de la escena tal como estaba; el creador de FluidEQ ve cuántas denuncias tiene una escena y por qué, nunca quién las envió.',
  'terms.sent.forum.what':
    'En el Foro: tu sesión de GitHub y, después, lo que lees, buscas, previsualizas, publicas o editas, y aquello a lo que reaccionas',
  'terms.sent.forum.when':
    'Abrir el Foro descarga sus temas públicos desde GitHub, lo que no lleva nada sobre ti; el resto, solo después de que inicies sesión con GitHub',
  'terms.sent.forum.who':
    'GitHub, con sus propias condiciones; las publicaciones son públicas en el GitHub Discussions del proyecto. Al iniciar sesión, mantener la sesión iniciada y cerrarla, tu sesión de GitHub pasa por el servicio de FluidEQ, que añade la clave de FluidEQ y no guarda nada.',

  'terms.never.title': 'Qué nunca recibe el servicio de FluidEQ',
  'terms.never.p1':
    'Tu audio, y cualquier cosa sobre lo que escuchas: nombres de canciones, artistas, archivos, carpetas y listas.',
  'terms.never.p2': 'Tus ajustes de ecualizador, tus presets y tus perfiles.',
  'terms.never.p3':
    'Tus dispositivos de audio, tus monitores y tus luces RGB, sus nombres, y las demás aplicaciones de tu ordenador.',
  'terms.never.p4':
    'Tus proyectos del Estudio, sus fotos y tus notas, salvo que exportes o publiques una escena. El prompt que copias para tu asistente de IA solo va adonde lo pegues.',
  'terms.never.p5':
    'Lo que FluidEQ recuerda en tu ordenador para funcionar: tus fondos de escritorio y tu iluminación, las versiones de escenas que has visto y cualquier escena que haya hecho reiniciarse tu controlador gráfico.',

  'terms.protect.title': 'Cómo se protege',
  'terms.protect.p1': 'Cada petición viaja cifrada.',
  'terms.protect.p2':
    'Las reglas viven en el servidor, no en la aplicación: cada cuenta solo puede cambiar sus propios datos, y una copia modificada de FluidEQ recibe exactamente las mismas respuestas.',
  'terms.protect.p3':
    'La clasificación y Visualizadores muestran alias y nombres visibles, nunca direcciones de correo. Los identificadores de cuenta nunca se muestran, pero están dentro de los archivos de escena y en lo que Visualizadores envía a la aplicación.',
  'terms.protect.p4':
    'El creador administra el servicio y puede ver lo que guarda, para mantenerlo en marcha, asociar los pagos y moderar lo que publican los miembros. Nada se vende ni se usa para publicidad, y no hay rastreo ni analíticas.',
  'terms.protect.p5':
    'El servicio funciona sobre Supabase (inicio de sesión, base de datos y archivos) y envía los correos a través de Resend; los pagos pasan por Buy Me a Coffee, y el Foro, por GitHub. Cada uno recibe solo lo que su parte necesita.',
  'terms.protect.p6':
    'FluidEQ no guarda direcciones IP. Supabase anota la dirección de cada petición en registros de corta duración, y guarda la dirección y los detalles de la aplicación de cada ordenador con sesión iniciada junto a la sesión de ese ordenador y en el propio registro de seguridad de inicio de sesión de Supabase, para que el inicio de sesión funcione y sea seguro.',
  'terms.protect.p7':
    'Las escenas van firmadas, y tu ordenador comprueba la firma antes de reproducir una. Una actualización de la aplicación solo se instala después de que se haya comprobado la firma de FluidEQ que lleva.',

  'terms.fair.title': 'Juego limpio en la clasificación',
  'terms.fair.p1':
    'Los puntos vienen de la escucha y de los me gusta: {hourPoints} por cada hora de música, {dayPoints} por cada día con al menos {activeMinutes} minutos de música y {likePoints} por cada me gusta en tus escenas. La clasificación muestra a los 100 primeros y solo incluye una cuenta mientras tiene un Plus pagado, regalado o ganado publicando: una prueba gratuita no entra en la clasificación. Sus días se conservan igualmente y vuelven a contar cuando vuelve Plus.',
  'terms.fair.p2':
    'El tiempo de escucha lo cuenta la aplicación en tu ordenador, así que el servidor no puede verlo ocurrir. En su lugar comprueba cada número: no más de {capHours} horas al día, ningún día que no haya empezado, nada de más de {windowDays} días atrás, y ningún día que crezca más rápido que el reloj. Los números de tus ordenadores se suman en un solo día, que tampoco crece más rápido que el reloj, así que varios sonando a la vez no pueden sumar más tiempo del que ha pasado.',
  'terms.fair.p3':
    'Todo el mundo gana puntos igual, el creador también. Modificar la aplicación o lo que envía, automatizar la escucha o escalar con más de una cuenta te saca de la clasificación, y puede impedir que la cuenta publique escenas, les dé me gusta o las denuncie.',
  'terms.fair.p4':
    'Un me gusta cuenta una vez por miembro y escena, solo cuando lo da un miembro Plus, y nunca desde tu propia cuenta. No cuentan los me gusta en una escena que fue retirada ni los de una cuenta que fue bloqueada. Los me gusta desde una segunda cuenta tuya cuentan como escalar con más de una cuenta.',

  'terms.rules.title': 'Normas para lo que publicas',
  'terms.rules.p1':
    'Sé amable. Nada de acoso, odio, amenazas, spam, contenido ilegal ni datos personales de nadie, ya sea en una escena, en su nombre, en su imagen o en su nota. Cualquiera con sesión iniciada puede ver lo que publicas, así que comparte solo lo que no te importe que se vea.',
  'terms.rules.p2':
    'Toma ideas de las escenas de FluidEQ, pero haz las tuyas: una escena que sea en su mayor parte una copia de una de ellas se rechaza cuando la exportas o la publicas.',
  'terms.rules.p3':
    'Puedes retirar tus propias escenas cuando quieras. Cualquiera con sesión iniciada puede denunciar una escena publicada. El creador de FluidEQ puede retirar una escena, lo que hace que deje de abrirse en todas partes, la marca como retirada en tus escenas y pausa tus exportaciones y publicaciones durante {takedownDays} días, y puede bloquear una cuenta, lo que oculta sus escenas y le impide publicar, dar me gusta y denunciar.',
  'terms.rules.p4':
    'Para que el servicio funcione para todos, una cuenta puede exportar o publicar hasta {sharesPerHour} escenas por hora, contando los intentos rechazados, y tener hasta {maxPublished} escenas publicadas. Una escena que publicas, y cada nueva versión de ella, espera a que el creador de FluidEQ la lea antes de que nadie más la vea; hay un límite de cuántas puedes enviar a revisión en un mes natural, y el Estudio te avisa cuando lo alcanzas.',

  'terms.keep.title': 'Qué se guarda, y cómo borrarlo',
  'terms.keep.p1':
    'Clasificación: los días que envías se quedan en la clasificación hasta que los eliminas. «Eliminar todos mis datos» en el panel de Cuenta borra de una vez cada día que hayas enviado; salir de la clasificación solo detiene los envíos. Tu ordenador solo guarda los totales de los últimos {windowDays} días.',
  'terms.keep.p2':
    'Tu alias y tu nombre visible: se guardan mientras tengas una cuenta, y se borran con ella.',
  'terms.keep.p3':
    'Membresía: tu correo de pago, el estado y los identificadores de tu membresía en Buy Me a Coffee se guardan para asociar los pagos a tu cuenta, y se borran con ella. El registro de cada evento de pago solo conserva los identificadores de Buy Me a Coffee y la hora.',
  'terms.keep.p4':
    'Tu cuenta: pide que se borre y desaparece en un plazo de {deletionDays} días, junto con tu perfil, tus días en la clasificación, tu membresía, tus pruebas gratuitas y tus meses ganados, tus aceptaciones de las condiciones, tus me gusta, tus añadidos, tus denuncias y las escenas que publicaste con sus archivos. Un regalo de Plus a tu correo se mantiene hasta que el creador lo quite.',
  'terms.keep.p5':
    'Escenas: retirar una escena la quita de Visualizadores junto con su imagen, su archivo y su historial de versiones. Los me gusta, las veces que se añadió y las denuncias que recibió se conservan hasta que se borren esas cuentas, y vuelven a contar si la publicas de nuevo. Una escena bloqueada por incumplir estas condiciones conserva una huella hecha a partir del id de tu cuenta y del id de la escena, con el motivo y la fecha, para que siga bloqueada.',
  'terms.keep.p6':
    'En tu ordenador: los estilos Plus y las escenas que añadiste, cifrados; las imágenes de la galería, hasta 128 MB; y la lista de escenas bloqueadas. Se quedan ahí hasta que los quites o desinstales FluidEQ.',

  'terms.looks.title': 'Los estilos Plus',
  'terms.looks.p1':
    'Los estilos Plus son obra del propio creador, con licencia para tu uso personal mientras seas miembro. Por favor, no los copies, compartas ni revendas.',
  'terms.looks.p2':
    'Los miembros Plus pueden abrir las escenas propias de FluidEQ en el Estudio para verlas por dentro y tomar ideas. Una copia abierta así no se puede añadir a tus estilos, exportar ni publicar.',
  'terms.looks.p3':
    'FluidEQ sigue siendo software libre bajo la GPL. Nada de esto cambia ningún derecho que te da la GPL.',

  'terms.scenes.title': 'Las escenas que creas',
  'terms.scenes.p1':
    'Una escena que creas en el Estudio es tuya. FluidEQ no es su dueño, y la GPL que cubre a FluidEQ no la cubre.',
  'terms.scenes.p2':
    'Tus escenas del Estudio permanecen en tu ordenador salvo que las exportes, las publiques o decidas compartirlas con otra herramienta, como tu asistente de IA.',
  'terms.scenes.p3':
    'Al exportar una escena, permites que FluidEQ la revise —también comparándola con las escenas propias de FluidEQ—, quite los comentarios de su código y la firme con tu nombre visible y el id de tu cuenta, para que otros miembros de Plus puedan reproducirla y ver que la hiciste tú. Ese es todo el permiso: el creador de FluidEQ no venderá tu escena ni la usará en publicidad, no la convertirá en uno de los estilos Plus sin preguntarte antes, y no te impide hacer nada más con tu propio trabajo.',
  'terms.scenes.p4':
    'Compartir es parte de Plus, no un trabajo: nadie cobra dinero por una escena y nadie paga dinero por una. Lo que recibes a cambio son todas las escenas que comparten los demás miembros y, cuando el creador de FluidEQ aprueba una escena tuya, un mes de Plus, que es acceso y nunca dinero.',
  'terms.scenes.p5':
    'Los miembros a los que les gusta tu escena te dan puntos en la clasificación, si te has unido a ella. Los me gusta se cuentan en el servidor; consulta Juego limpio.',
  'terms.scenes.p6':
    'Comparte solo trabajo que tengas derecho a compartir: tus propias fotos y dibujos, o los de alguien que lo permita. Las normas para lo que publicas se aplican a cada escena que compartes. El creador de FluidEQ puede impedir que una escena se abra si incumple estas condiciones o los derechos de otra persona.',
  'terms.scenes.p7':
    'Una escena que comparte otro miembro es obra suya, con licencia para tu uso personal mientras seas miembro. Puedes reproducirla, darle me gusta y pasar el archivo sin cambios a otros miembros de Plus. Por favor, no la modifiques, no la presentes como tuya, no la publiques en otro sitio ni la vendas.',
  'terms.scenes.p8':
    'Un archivo que has enviado se queda con quien lo tenga, y retirar una escena no quita las copias que los miembros ya añadieron; siguen con licencia para uso personal mientras esos miembros tengan Plus. Si quieres que una escena deje de abrirse en todas partes, pídeselo al creador de FluidEQ, que puede bloquearla igual que una escena que incumple las normas.',
  'terms.scenes.p9':
    'Si publicas una escena en Visualizadores, también permites que el creador de FluidEQ la lea antes de que nadie más la vea, y que FluidEQ la guarde ahí hasta que la retires, que muestre su imagen, su nombre, sus categorías y sus notas de versión, con tu nombre visible y tu alias, a cualquiera con sesión iniciada en FluidEQ, y que ofrezca la escena en sí a los miembros Plus, que pueden reproducirla y añadirla. Los elementos de ambiente que le pongas viajan con ella, y los miembros que eligen el modo Ambiente los ven alrededor de su ventana. Puedes retirarla cuando quieras, tengas Plus o no.',
  'terms.scenes.p10':
    'Publicar es opcional y distinto de exportar un archivo. Una nota de versión es pública, igual que la escena a la que pertenece.',

  'terms.elsewhere.title': 'A qué más se conecta FluidEQ',
  'terms.elsewhere.p1':
    'Actualizaciones: al abrirse y cuando vuelves al ordenador, FluidEQ consulta su canal de versiones por si hay una nueva, y solo la instala después de comprobar su firma. La petición lleva un número al azar que el actualizador guarda en este ordenador, y nada sobre ti.',
  'terms.elsewhere.p2':
    'Presets de auriculares: al abrirse, FluidEQ busca en GitHub presets de auriculares nuevos, y la pestaña Convolución descarga archivos de AutoEq desde GitHub cuando la abres o eliges unos auriculares.',
  'terms.elsewhere.p3':
    'Modelos que usas: el Creador de karaoke descarga sus modelos de habla, de voz y de melodía desde Hugging Face, y el reductor de ruido de voz descarga su modelo desde GitHub. Tu audio se procesa en tu ordenador.',
  'terms.elsewhere.p9':
    'Tu asistente de IA: solo mientras «Deja que tu IA vea el escenario» esté activado en el Estudio (copiar el prompt para tu IA lo activa, salvo que lo hayas desactivado tú), una herramienta de IA de este ordenador que tenga tu clave puede pedir a FluidEQ imágenes de tus escenas del Estudio, con los motivos de FluidEQ cuando una no puede reproducirse, y números que describen cómo se mueve la música que pones; nunca el sonido en sí ni qué canción es. Lo que esa herramienta haga con ellos se rige por sus propias condiciones.',
  'terms.elsewhere.p4':
    'Compartir audio: el audio, lo que está sonando y el nombre de este ordenador van cifrados y solo al ordenador con el que te emparejas en tu red local. El nombre de este ordenador también se anuncia en esa red, para que el otro ordenador pueda encontrarlo.',
  'terms.elsewhere.p5':
    'Multimedia en línea: YouTube, Bandcamp, Twitch y los demás sitios que abres dentro de FluidEQ reciben lo que haces en ellos, con sus propias condiciones.',
  'terms.elsewhere.p6':
    'Informar de un problema: abre una incidencia pública de GitHub en tu navegador o un correo privado para el creador de FluidEQ en tu aplicación de correo, o te copia el informe, con líneas recientes del registro que puedes leer antes de enviarlo. FluidEQ no envía nada por su cuenta.',
  'terms.elsewhere.p7':
    'Iluminación y fondos de escritorio: la iluminación solo se comunica con Razer Chroma y con Windows en este ordenador, y los fondos de escritorio nunca salen a internet.',
  'terms.elsewhere.p8':
    'Tu navegador: el pago, la página de tu membresía, los enlaces de apoyo y el inicio de sesión de GitHub del Foro se abren allí, con las propias condiciones de esos sitios.',

  'terms.changes.title': 'Cambios, y la letra pequeña',
  'terms.changes.p1':
    'Si estas condiciones cambian, la nueva versión aparece aquí con su fecha, y la aplicación te avisa antes de que se te apliquen.',
  'terms.changes.p2':
    'FluidEQ y Plus se ofrecen tal cual, sin garantías, en la medida en que la ley lo permita. El creador no responde por más de lo que pagaste por Plus en los últimos doce meses. Nada de esto te quita los derechos que la ley te da como consumidor.',

  'terms.contact.title': 'Contacto',
  'terms.contact.p1':
    'Preguntas, borrar tu cuenta o denunciar una escena que usa tu trabajo: {contact}.',

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
} as const;

export default terms;
