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

/** The shell around everything: menus, tabs, updates, config, notices. */
import { Dictionary } from '../en';

const app: Partial<Dictionary> = {
  'app.tagline': 'Tu sonido. En cada dispositivo. Automáticamente.',
  'app.actions': 'Acciones de FluidEQ',
  'app.actions.title': 'Acciones de audio',
  'app.status.ready': 'Conectado a Equalizer APO',
  'app.status.checking': 'Comprobando Equalizer APO…',
  'app.status.error': 'Equalizer APO no responde',
  'app.menu.importEq': 'Importar ajustes de EQ…',
  'app.menu.importConvolution': 'Importar respuesta al impulso…',
  'app.menu.restartAudio': 'Reiniciar el audio de Windows',
  'app.menu.reconfigure': 'Reconfigurar Equalizer APO',
  'app.menu.apoSettings': 'Ajustes de Equalizer APO',
  'app.menu.support': 'Apoya el proyecto',
  'app.menu.fix': 'Solucionar',
  'app.menu.reportProblem': 'Informar de un problema',
  'app.menu.about': 'Acerca de {product}…',
  'app.menu.reinstallApp': 'Reinstalar {product}…',
  'app.menu.fixAudio': 'Solucionar problemas de audio…',
  'app.menu.reinstallApo': 'Reinstalar Equalizer APO…',
  'whatsNew.eyebrow': 'NOTAS DE LA VERSIÓN',
  'whatsNew.title': 'Novedades de FluidEQ',
  'whatsNew.loading': 'Cargando las notas de la versión…',
  'whatsNew.missing':
    'No se han encontrado las notas de la versión en esta compilación. También están en GitHub.',
  'whatsNew.ok': 'Aceptar',
  'app.menu.whatsNew': 'Novedades',
  'app.menu.language': 'Idioma',
  'app.window.minimize': 'Minimizar',
  'app.window.maximize': 'Maximizar',
  'app.window.restore': 'Restaurar',
  'app.window.close': 'Cerrar',
  'app.window.minimizeApp': 'Minimizar FluidEQ',
  'app.window.maximizeApp': 'Maximizar FluidEQ',
  'app.window.restoreApp': 'Restaurar FluidEQ',
  'app.window.closeApp': 'Cerrar FluidEQ',
  'app.media.previous': 'Pista anterior',
  'app.media.playPause': 'Reproducir o pausar',
  'app.media.next': 'Pista siguiente',
  'app.media.previousAria': 'Pista anterior, en cualquier parte de este equipo',
  'app.media.playPauseAria':
    'Reproducir o pausar, en cualquier parte de este equipo',
  'app.media.nextAria': 'Pista siguiente, en cualquier parte de este equipo',
  'app.dismiss': 'Descartar',
  'common.search': 'Buscar…',
  'common.recentSearches': 'Búsquedas recientes',
  'common.clearRecentSearches': 'Borrar búsquedas recientes',
  'common.filterOptions': 'Filtrar opciones',
  'common.increase': 'Aumentar {item}',
  'common.decrease': 'Reducir {item}',
  'common.icon.edit': 'Editar',
  'common.icon.delete': 'Eliminar',
  'common.icon.trash': 'Quitar',
  'common.icon.accept': 'Aceptar',
  'common.icon.cancel': 'Cancelar',
  'tabs.aria': 'Espacio de trabajo de sonido',
  'tabs.eq': 'EQ',
  'tabs.autoeq': 'AutoEQ',
  'tabs.voicing': 'Carácter',
  'tabs.convolution': 'Convolución',
  'tabs.config': 'Config',
  'tabs.media': 'Multimedia',
  'tabs.karaoke': 'Karaoke',
  'notice.apoReconfigured':
    'Equalizer APO se instaló o se reconfiguró. Si no hay sonido, reinicia el servicio de audio de Windows en lugar de reiniciar el equipo.',
  'notice.restartNow': 'Reiniciar el audio ahora',
  'notice.importComplete': 'Importación completada',
  'notice.restartConfirm':
    'El audio se detendrá unos segundos y Windows pedirá permisos de administrador. ¿Continuar?',
  'update.title': 'Actualización de FluidEQ',
  'update.available':
    'La versión {version} está disponible. Descargándola ahora.',
  'update.downloading': 'Descargando la actualización… {percent}%',
  'update.ready':
    'La versión {version} está lista. Reinicia FluidEQ para terminar.',
  'update.restart': 'Reiniciar ahora',
  'update.restarting': 'Reiniciando…',
  'update.mandatory.title': 'Esta versión debe actualizarse',
  'update.mandatory.body':
    'Esta versión corrige un problema lo bastante grave como para que FluidEQ no deba seguir funcionando tal cual. La actualización se está descargando ahora.',
  'update.mandatory.notOptional':
    'No es una actualización opcional. Puedes cerrar este aviso y terminar lo que estabas haciendo: volverá a aparecer hasta que FluidEQ esté actualizado.',
  'update.mandatory.later': 'Ahora no',
  'update.mandatory.waiting': 'Obteniendo la actualización…',
  'update.mandatory.readyPrompt':
    'La actualización ya está descargada. FluidEQ se cerrará mientras se instala y volverá a abrirse después.',
  'update.mandatory.install': 'Instalar y reiniciar',
  'update.mandatory.installing': 'Instalando…',
  'update.mandatory.failedDownload':
    'No se ha podido descargar la actualización. O no se ha podido conectar con el servidor de descargas, o la conexión se ha cortado a mitad.',
  'update.mandatory.failedInstall':
    'La actualización se ha descargado, pero el instalador no ha arrancado. Puede que Windows lo haya rechazado o que el archivo descargado esté dañado.',
  'update.mandatory.manual':
    'También puedes instalarla tú: descarga la última versión desde la página de versiones y ejecútala. Tus ajustes y perfiles se conservan.',
  'update.mandatory.releasePage': 'Abrir la página de descargas',
  'notice.restartDone':
    'El audio de Windows se ha reiniciado. Vuelve a abrir cualquier aplicación que siga en silencio.',
  'sidebar.engine': 'MOTOR',
  'sidebar.systemEq': 'EQ del sistema',
  'sidebar.preamp': 'Preamplificación',
  'sidebar.preampAria': 'Ganancia de preamplificación (dB)',
  'sidebar.preampAuto':
    'Se ajusta sola. Desactiva Normalizar automáticamente para cambiarla.',
  'sidebar.headroom': 'MARGEN DE APO',
  'sidebar.autoPreamp': 'Normalizar automáticamente',
  'sidebar.visualizer': 'VISUALIZADOR',
  'sidebar.graphView': 'Gráfica de respuesta',
  'config.eyebrow': 'LO QUE LEE EL MOTOR',
  'config.title': 'Configuración de Equalizer APO',
  'config.lede':
    'Lo que hay ahora mismo en el disco, no lo que FluidEQ pretende.',
  'config.reload': 'Recargar',
  'config.reloadTitle': 'Volver a leer la configuración del disco',
  'config.reading': 'Leyendo…',
  'config.absent':
    'FluidEQ todavía no ha escrito nada en esta instalación de Equalizer APO.',
  'config.status.notIncluded':
    'Equalizer APO no está incluyendo esta configuración. No se aplica nada de lo que hay debajo.',
  'config.status.engineOff':
    'El motor de FluidEQ está apagado: esta configuración no nombra ninguna salida, así que Equalizer APO no aplica nada de ella.',
  'config.status.active':
    'Activa: Equalizer APO está aplicando esta configuración.',
  'config.outputsAria': 'Salidas en la configuración de Equalizer APO',
  'config.filters.one': '{count} filtro',
  'config.filters.many': '{count} filtros',
  'config.impulse': 'impulso',
  'config.playingNow': 'Sonando ahora',
  'config.liveTitle': 'El EQ continuo mantiene esta medición al día',
  'config.layer.on': 'activo',
  'config.layer.off': 'inactivo',
  'config.layers.noFile': 'Sin archivo propio',
  'config.layers.inFile': 'Se escribe en este archivo, no en uno propio.',
  'config.empty': 'No incluye nada: esta salida se deja sin tocar.',
  'config.file.missing': 'falta',
  'config.export': 'Exportar cadena',
  'config.import': 'Importar cadena',
  'config.import.hint':
    'La importación se aplica a la salida que estás escuchando.',
  'config.import.customSkipped':
    'Se omitió el archivo propio del remitente: una línea Include: o Plugin: cargaría código en el audio de Windows.',
  'config.file.yours': 'tuyo',
  'config.hint.custom': 'Es tuyo. Nunca se sobrescribe.',
  'config.hint.generated': 'Generado: se reescribe con el próximo cambio.',
  'config.hint.saving':
    'Al guardar se escribe el archivo; Equalizer APO lo recoge.',
  'config.edit': 'Editar',
  'config.cancel': 'Cancelar',
  'config.save': 'Guardar',
  'disclaimer.heading': 'Sin garantía y sin responsabilidad',
  'disclaimer.asIs':
    'FluidEQ se entrega tal cual, sin garantía de ningún tipo. Nadie promete que funcione, que sirva para lo que quieres hacer con él, ni que vaya a seguir funcionando. Es lo que dicen las secciones 15 y 16 de la GNU General Public License, y se aplica tanto si te dieron esta copia como si pagaste por ella.',
  'disclaimer.liability':
    'FluidEQ cambia cómo se procesa el audio en tu ordenador, e instala y gobierna Equalizer APO, un programa aparte que se ejecuta con permisos de administrador y se sitúa en la ruta de audio de Windows. En la máxima medida que permita la ley, {author} no responde de ningún daño derivado de su uso: a tu oído, a altavoces, auriculares u otros equipos, a datos o a otros programas, ni a nada más, incluidas las pérdidas que no hubieras podido prever.',
  'disclaimer.volume':
    'El sonido puede ser fuerte, y la ecualización puede hacerlo más fuerte de lo que era el material original. Baja el volumen antes de cambiar un ajuste y súbelo después.',
  'disclaimer.localLaw':
    'Algunos países no permiten que un vendedor excluya determinadas garantías o responsabilidades. Donde sea así, se aplican esas normas y este aviso no te quita los derechos que te da la ley.',
  'disclaimer.accepting': 'Al usar FluidEQ aceptas lo anterior.',
  'disclaimer.language':
    'Este aviso se redactó en inglés. Si una traducción difiere del texto en inglés, prevalece el texto en inglés.',
  'disclaimer.accept': 'Lo entiendo y lo acepto',
  'disclaimer.decline': 'Salir',
  'provenance.heading': 'Comprueba de dónde proviene esta copia',
  'provenance.body':
    'El instalador oficial firmado de FluidEQ se entrega únicamente a través de fluideq.com. Las compilaciones desde el código fuente deben partir del repositorio oficial. La GPL permite que terceros copien, modifiquen, recompilen y vendan FluidEQ, pero sus versiones no están automáticamente firmadas, revisadas, respaldadas ni aprobadas por FluidEQ. Si una descarga afirma ser oficial y no tiene una firma digital de Windows válida, ciérrala e informa de ella.',
  'provenance.site': 'Sitio oficial: fluideq.com',
  'provenance.repository': 'Código oficial: github.com/StartSWest/FluidEQ',
  'language.title': 'Idioma',
  'language.aria': 'Idioma de la interfaz',
};

export default app;
