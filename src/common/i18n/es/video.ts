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

/** The Remote Media tab. */
import { Dictionary } from '../en';

const video: Partial<Dictionary> = {
  'video.sites': 'Sitios de vídeo',
  'video.back': 'Atrás',
  'video.forward': 'Adelante',
  'video.reload': 'Recargar',
  'video.stop': 'Detener',
  'video.searchAria': 'Buscar en el sitio actual',
  'video.searchOn': 'Buscar en {site}',
  'video.searchGo': 'Buscar',
  'video.searchClear': 'Borrar la búsqueda',
  'video.searchRecent': 'Búsquedas recientes',
  'video.searchForget': 'Olvidar «{term}»',
  'video.searchForgetAll': 'Borrar las búsquedas recientes',
  'video.adBlock': 'Bloquear anuncios',
  'video.adBlockHint':
    'Salta los anuncios de vídeo y oculta la publicidad en YouTube.',
  'video.signOut': 'Cerrar sesión en todos los sitios',
  'video.signOutBusy': 'Cerrando sesión…',
  'video.signOutHint':
    'Borra todas las cookies, los inicios de sesión y las páginas en caché que guarda el reproductor.',
  'video.signOutDone': 'Sesión cerrada',
  'video.signOutFailed': 'No se pudo cerrar la sesión',
  'video.blockedTitle': 'Ese enlace lleva fuera del reproductor',
  'video.openInBrowser': 'Abrir en el navegador',
  'video.downloadChoosing': 'Elige dónde guardar este archivo',
  'video.downloadSaving': 'Guardando {file}',
  'video.downloadComplete': 'Guardado en tu computadora',
  'video.downloadFailed': 'No se pudo guardar la descarga',
  'video.downloadProgress': 'Progreso de la descarga',
  'video.downloadCopyPath': 'Copiar ruta',
  'video.downloadCopied': 'Ruta copiada',
  'video.downloadShowFolder': 'Mostrar en la carpeta',
  'video.resize': 'Arrastra para cambiar el tamaño del reproductor',
};

export default video;
