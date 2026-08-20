/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Look Designer, the support panel, the creature and its game. */
import { Dictionary } from '../en';

const look: Partial<Dictionary> = {
  'look.edit': 'Editar estilo',
  'look.create': 'Crear estilo',
  'look.new': 'Nuevo estilo',
  'look.close': 'Cerrar el diseñador de estilos',
  'look.closeHint': 'Cerrar sin guardar (Esc)',
  'look.pickForm': 'Elige la forma con el selector superior o pulsa Espacio.',
  'look.colourBy': 'Colorear por',
  'look.palette.cycle': 'Coloreado',
  'look.palette.flat': 'Plano',
  'look.palette.flatHint': 'Un color para toda la figura',
  'look.palette.frequency': 'Frecuencia',
  'look.palette.frequencyHint':
    'El color recorre el eje e indica dónde está cada barra en el rango.',
  'look.palette.level': 'Nivel',
  'look.palette.levelHint':
    'El color sube por el eje e indica el volumen de cada barra.',
  'look.palette.heat': 'Calor',
  'look.palette.heatHint': 'El color sigue el volumen, de frío a rojo.',
  'look.colours': 'Colores',
  'look.colourValue': 'Color {number}: {colour}',
  'look.removeColour': 'Quitar color {number}',
  'look.custom': 'Personalizado',
  'look.customColour': 'Cualquier otro color',
  'look.reset': 'Restablecer',
  'look.addColour': 'Añadir un color',
  'look.addColourHint': 'Añadir un color al final del degradado',
  'look.pieces': 'Piezas',
  'look.continuous': 'Esta forma se dibuja como una figura continua',
  'look.attack': 'Ataque',
  'look.release': 'Caída',
  'look.releaseHint': 'Cuánto tarda un pico en caer',
  'look.drawnAs': 'Dibujado como',
  'look.filled': 'Relleno',
  'look.stroked': 'Trazo',
  'look.fill': 'Relleno',
  'look.weight': 'Grosor',
  'look.rainbow': 'Arcoíris',
  'look.glow': 'Resplandor',
  'look.off': 'Apagado',
  'look.glowHint': 'Cuánto crece y brilla la figura con el ritmo.',
  'look.glowNeedsRainbow':
    'Necesita el modo arcoíris. Apagado, el resplandor no cambia el dibujo.',
  'look.needsRainbow': 'Necesita el modo arcoíris.',
  'look.rainbowBorder': 'Borde arcoíris',
  'look.rainbowBorderHint':
    'Rodea la gráfica con un color que recorre todo el espectro.',
  'look.borderWeight': 'Grosor del borde',
  'look.litPeaks': 'Picos iluminados',
  'look.litPeakWeight': 'Grosor del pico',
  'look.noLitPeaks': 'Esta forma no tiene puntas iluminadas',
  'look.name': 'Nombre',
  'look.resetAll': 'Restablecer todos los ajustes',
  'look.resetAllHint': 'Restaurar los ajustes originales de esta forma',
  'look.export': 'Exportar este estilo a un archivo',
  'look.exportHint': 'Guardar este estilo en un archivo para compartirlo',
  'look.import': 'Importar un estilo desde un archivo',
  'look.delete': 'Eliminar este estilo',
  'look.save': 'Guardar',
  'look.saveHint': 'Guardar y seleccionar este estilo',
  'look.full': 'La lista está llena; elimina un estilo para dejar espacio',
  'look.error.emptyFile': 'No se encontraron estilos en ese archivo.',
  'look.error.readFile': 'FluidEQ no pudo leer ese archivo de estilo.',
  'support.eyebrow': 'TOTALMENTE OPCIONAL',
  'support.petHint': 'Pulsa espacio para hacerlo saltar',
  'support.game.hint': 'Pulsa al ritmo cuando el pico llegue a la línea',
  'support.game.howTo':
    'Toca la mascota o pulsa espacio en cada golpe. Sigue así y algo pasa al llegar a ×10.',
  'support.game.thanks':
    'Si algo de esto te ha sacado una sonrisa, tus ideas y tu apoyo son lo que lo mantiene vivo.',
  'support.game.noAudio': 'Pon algo de música y el ritmo aparecerá aquí',
  'support.game.listening': 'Buscando el ritmo…',
  'support.game.share': 'Compartir',
  'support.game.shareEuphoria': 'Comparte el arcoíris',
  'support.game.shareTitle': 'Comparte tu puntuación',
  'support.game.shareUnlock':
    'Llega a ×10 y esta tarjeta activa el modo arcoíris, con todo el espectro.',
  'support.game.shareNote':
    'Guarda la tarjeta y adjúntala a tu publicación: ninguna de estas redes puede sacar una imagen de un enlace.',
  'support.game.shareSave': 'Guardar tarjeta',
  'support.game.shareCopyCard': 'Copiar tarjeta',
  'support.game.shareCardCopied': 'Copiada — pégala ahí',
  'support.game.shareCopy': 'Copiar texto',
  'support.game.shareCopied': 'Copiado',
  'support.game.shareLinkOnly':
    'Solo comparte el enlace: pega el texto tú mismo',
  'support.game.euphoria': 'Modo arcoíris',
  'support.game.euphoriaToggle': 'Activa o desactiva el modo arcoíris',
  'support.game.perfect': 'Perfecto',
  'support.game.great': 'Muy bien',
  'support.game.good': 'Bien',
  'support.game.miss': 'Fallaste',
  'support.title': 'Apoya el proyecto',
  'support.close': 'Cerrar',
  'support.pitch':
    'FluidEQ es libre y de código abierto, y va a seguir siéndolo: el código es público, siempre puedes compilarlo tú mismo sin pagar nada, y nunca se rastrea nada. Lo que se vende es la compilación firmada, lista para usar. Si se ha ganado un sitio en tu equipo, una contribución financia el tiempo que lo mantiene vivo y las próximas ideas que salgan del mismo taller.',
  'support.craft':
    'Esto es el trabajo de una sola persona, hecho con muchísimo cariño y una atención al detalle poco razonable. Cada panel está dibujado a mano y discutido: cómo se lee la curva de un vistazo, cómo se despliega un menú, qué hace un mando cuando lo giras despacio, qué palabras van en un botón. Aquí no hay componentes de catálogo con un tema encima.',
  'support.card': 'Tarjeta o monedero',
  'support.card.hint':
    'Pago seguro alojado por Stripe. Se abre en tu navegador: la aplicación nunca ve los datos de tu tarjeta.',
  'support.coffee': 'Invítame a un café',
  'support.coffee.hint':
    'Una propina puntual, sin necesidad de cuenta. Pulsa para abrirlo en el navegador o escanea el código con el móvil.',
  'support.verify': 'Comprueba la dirección antes de enviar.',
  'support.copy': 'Copiar dirección',
  'support.copied': 'Copiada',
  'support.openWallet': 'Abrir en el monedero',
  'support.contributed': 'He colaborado: desbloquea la estrella y el baile',
  'support.thanks': 'Gracias: tu mascota ya tiene su estrella, y ahora baila.',
  'support.releaseNotes': 'Mira las novedades de esta versión',
  'support.footerBefore':
    '¿Prefieres aportar tiempo? Las incidencias y los pull requests son igual de bienvenidos en',
};

export default look;
