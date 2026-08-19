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

/** The Library tab: local music and video files. */
import { Dictionary } from '../en';

const library: Partial<Dictionary> = {
  'tabs.library': 'Libreria',

  'library.empty.title': 'Ancora nessuna musica',
  'library.empty.body':
    'Aggiungi una cartella e FluidEQ leggerà i brani e i video al suo interno.',
  'library.empty.add': 'Aggiungi cartella',
  'library.empty.drop': 'oppure trascina qui una cartella',
  'library.karaokeSkipped':
    '{count} brani karaoke saltati — aprili nella scheda Karaoke',

  'library.add': 'Aggiungi cartella',
  'library.rescan': 'Analizza di nuovo',
  'library.search': 'Cerca nella libreria',
  'library.searchPlaceholder': 'Cerca brani, artisti, album',

  'library.browse.album': 'Album',
  'library.browse.artist': 'Artisti',
  'library.browse.song': 'Brani',
  'library.view.list': 'Elenco',
  'library.view.grid': 'Griglia',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Come viene mostrata la libreria',
  'library.browse.aria': 'Cosa sta mostrando la libreria',

  'library.sort': 'Ordina',
  'library.sort.title': 'Titolo',
  'library.sort.artist': 'Artista',
  'library.sort.album': 'Album',
  'library.sort.year': 'Anno',
  'library.sort.added': 'Aggiunti di recente',

  'library.column.title': 'Titolo',
  'library.column.artist': 'Artista',
  'library.column.album': 'Album',
  'library.column.year': 'Anno',
  'library.column.length': 'Durata',

  'library.unknownAlbum': 'Album sconosciuto',
  'library.unknownArtist': 'Artista sconosciuto',
  'library.trackCount': '{count} brani',
  'library.albumCount': '{count} album',

  'library.videos': 'Video',
  'library.videos.empty': 'Nessun video nelle cartelle che hai aggiunto.',

  'library.scan.running': 'Lettura di {name}',
  'library.scan.counted': '{parsed} di {seen} file',
  'library.scan.cancel': 'Interrompi',
  'library.scan.background': 'Continua in background',
  'library.scan.done': '{count} brani aggiunti',

  'library.roots': 'Cartelle',
  'library.root.remove': 'Rimuovi questa cartella',
  'library.root.offline': 'Questa cartella non è disponibile al momento',
  'library.reveal': 'Mostra in Esplora file',

  'library.unplayable': 'FluidEQ non può riprodurre questo formato',
  'library.indexReset':
    'Non è stato possibile leggere l’indice della libreria, che è stato ricostruito.',

  'library.play': 'Riproduci',
  'library.pause': 'Pausa',
  'library.previous': 'Precedente',
  'library.next': 'Successivo',
  'library.shuffle': 'Casuale',
  'library.repeat': 'Ripeti',
  'library.repeat.all': 'Ripeti tutto',
  'library.repeat.one': 'Ripeti questo brano',
  'library.repeat.off': 'Non ripetere',
  'library.volume': 'Volume',
  'library.position': 'Posizione',
  'library.queue': 'Coda',
  'library.queue.remove': 'Rimuovi dalla coda',
  'library.nowPlaying': 'In riproduzione',
  'library.fullScreen': 'Schermo intero',
};

export default library;
