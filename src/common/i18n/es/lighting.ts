const lighting = {
  'lighting.tuning.foregroundBrightness': 'Brillo del primer plano',
  'lighting.tuning.backgroundBrightness': 'Brillo del fondo',
  'lighting.status.ambient': 'Flujo suave · {scene}',
  'lighting.scene.title': 'Iluminación para {scene}',
  'lighting.scene.saved': 'Guardado para este visualizador',
  'lighting.device.edit': 'Ajustar {name}',
  'lighting.target.all': 'Todos los dispositivos',
  'lighting.target.shared': 'Iluminación compartida: {devices}',
  'lighting.tuning.title': 'Estilo de iluminación',
  'lighting.tuning.reset': 'Restablecer',
  'lighting.effect.scene': 'Escena',
  'lighting.effect.flow': 'Onda de color',
  'lighting.effect.spectrum': 'Espectro',
  'lighting.effect.pulse': 'Onda al ritmo',
  'lighting.tuning.sensitivity': 'Sensibilidad musical',
  'lighting.tuning.speed': 'Velocidad de movimiento',
  'lighting.tuning.saturation': 'Intensidad del color',
  'lighting.tuning.smoothing': 'Suavidad',
  'lighting.tuning.spread': 'Amplitud del patrón',
  'lighting.tuning.reverse': 'Invertir dirección',
  'lighting.tuning.focus': 'Responder a',
  'lighting.focus.balanced': 'Mezcla completa',
  'lighting.focus.bass': 'Graves',
  'lighting.focus.mid': 'Medios',
  'lighting.focus.treble': 'Agudos',
  'lighting.tuning.advanced': 'Ajustes precisos',
  'lighting.idle.title': 'Cuando la música se detiene',
  'lighting.idle.flow': 'Seguir fluyendo',
  'lighting.idle.breathe': 'Respiración lenta',
  'lighting.idle.hold': 'Mantener color',
  'lighting.idle.brightness': 'Brillo en reposo',
  'lighting.idle.speed': 'Movimiento en reposo',
  'lighting.preview.live': 'Vista previa del escritorio',
  'lighting.tuning.master': 'Brillo general',
  'lighting.title': 'Iluminación dinámica',
  'lighting.rail.blurb': 'Tu escritorio sigue la escena',
  'lighting.description':
    'Tu teclado, ratón, alfombrilla, auriculares y soporte se iluminan con la escena',

  'lighting.gate.title':
    'Ilumina tu teclado, ratón y auriculares con cada escena Plus',
  'lighting.gate.body':
    'La iluminación dinámica es parte de FluidEQ Plus. Tus dispositivos toman los colores de la escena del gráfico y laten con su ritmo.',
  'lighting.gate.cta': 'Ver Plus',

  'lighting.unsupported.title': 'La iluminación dinámica funciona en Windows',
  'lighting.unsupported.body':
    'Ilumina los dispositivos mediante Windows Dynamic Lighting y Razer Chroma, y ambos existen solo en Windows.',

  'lighting.switch': 'Iluminar mis dispositivos mientras suena una escena Plus',
  'lighting.status.live': 'Siguiendo {scene}',
  'lighting.status.waiting': 'Esperando música',
  'lighting.status.nothingLit':
    'La escena está sonando, pero ningún dispositivo se ilumina',
  'lighting.status.off': 'Apagada: tus dispositivos mantienen su propia luz',
  'lighting.status.noScene':
    'Elige una escena Plus y tus dispositivos la seguirán',
  'lighting.pickScene': 'Ver visualizadores',
  'lighting.showGraph': 'Mostrar el gráfico',

  'lighting.brightness': 'Brillo',
  'lighting.brightness.value': '{percent} %',
  'lighting.pulse': 'Latir con el ritmo',
  'lighting.pulse.off': 'No',
  'lighting.pulse.gentle': 'Suave',
  'lighting.pulse.full': 'Fuerte',
  'lighting.colours.hint':
    'Los colores salen de la propia escena, así que no hay nada que elegir.',

  'lighting.devices.title': 'Tus dispositivos',
  'lighting.devices.found': 'Encontrados en tu escritorio',
  'lighting.devices.searching': 'Buscando dispositivos…',
  'lighting.devices.none.title':
    'No se encontraron dispositivos de iluminación',
  'lighting.devices.none.body':
    'Aquí aparecen los dispositivos compatibles con Windows Dynamic Lighting, y los de Razer una vez instalado Razer Chroma. Conecta uno y aparecerá.',
  'lighting.devices.together':
    'Los dispositivos Razer se iluminan juntos, a través de Razer Chroma.',

  'lighting.route.synapse': 'Razer Chroma',
  'lighting.route.windows': 'Windows Dynamic Lighting',
  'lighting.route.none': 'No disponible',

  'lighting.kind.keyboard': 'Teclado',
  'lighting.kind.mouse': 'Ratón',
  'lighting.kind.mousepad': 'Alfombrilla',
  'lighting.kind.headset': 'Auriculares',
  'lighting.kind.keypad': 'Teclado auxiliar',
  'lighting.kind.stand': 'Soporte',
  'lighting.kind.speaker': 'Altavoz',
  'lighting.kind.accessory': 'Accesorio',

  'lighting.device.toggle': 'Iluminar {name}',

  'lighting.notice.windows.title':
    'Windows reserva {devices} para la aplicación en primer plano.',
  'lighting.notice.windows.body':
    'Para que sigan iluminados cuando FluidEQ quede detrás de otras ventanas, permite a FluidEQ controlar la luz en segundo plano en la configuración de iluminación dinámica de Windows.',
  'lighting.notice.windows.action': 'Abrir la configuración de iluminación',
  'lighting.notice.chroma.title': 'Razer Chroma no responde.',
  'lighting.notice.chroma.body':
    'Tus dispositivos Razer reciben sus colores a través de Razer Chroma. Ábrelo y se sumarán.',
  'lighting.notice.chroma.action': 'Abrir Razer Chroma',
  'lighting.notice.appsOff.title':
    'Razer Chroma no deja que las aplicaciones iluminen tus dispositivos.',
  'lighting.notice.appsOff.body':
    'Activa Chroma Apps en Razer Chroma y permite FluidEQ allí.',

  'lighting.graph.on': 'Dejar de iluminar mis dispositivos',
  'lighting.graph.off': 'Iluminar mis dispositivos con esta escena',
} as const;

export default lighting;
