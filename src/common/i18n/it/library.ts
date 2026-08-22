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
  'library.rescan.force': 'Forza nuova scansione',
  'library.search': 'Cerca nella libreria',
  'library.searchPlaceholder': 'Cerca brani, artisti, album',

  'library.browse.album': 'Album',
  'library.browse.artist': 'Artisti',
  'library.browse.song': 'Brani',
  'library.browse.folder': 'Cartelle',
  'library.browse.directory': 'Albero',
  'library.browse.folderHint': 'Ogni cartella con musica, tutte insieme',
  'library.browse.directoryHint': 'Dalla cartella radice verso l’interno',
  'library.browse.folderReading': 'Come si leggono le cartelle',
  'library.jumpTo': 'Vai a una lettera',
  'library.coverflow.previous': 'Copertina precedente',
  'library.coverflow.next': 'Copertina successiva',
  'library.folderCount': '{count} cartelle',
  'library.filterHere': 'Filtra questi brani',
  'library.view.list': 'Elenco',
  'library.view.grid': 'Griglia',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Come viene mostrata la libreria',
  'library.browse.aria': 'Cosa sta mostrando la libreria',

  'library.sort': 'Ordina',
  'library.sortBy': 'Ordina: {value}',
  'library.sort.direction': 'Direzione di ordinamento',
  'library.sort.title': 'Titolo',
  'library.sort.artist': 'Artista',
  'library.sort.album': 'Album',
  'library.sort.year': 'Anno',
  'library.sort.added': 'Aggiunti di recente',
  'library.sort.track': 'Ordine del disco',

  'library.column.title': 'Titolo',
  'library.column.artist': 'Artista',
  'library.column.album': 'Album',
  'library.column.year': 'Anno',
  'library.column.length': 'Durata',
  'library.column.trackNo': 'Numero di traccia',

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
  'library.trackMenu': 'Altre azioni',

  'library.unplayable': 'FluidEQ non può riprodurre questo formato',
  'library.metadataError':
    'FluidEQ non è riuscito a leggere i tag di questo file.',
  'library.pending':
    'Questo file è stato trovato e i suoi dettagli sono ancora in lettura.',
  'library.indexReset':
    'Non è stato possibile leggere l’indice della libreria, che è stato ricostruito.',

  'library.back': 'Indietro',

  'library.upNext': 'In coda',
  'library.upNext.empty': 'Niente in coda',
  'library.upNext.added': 'Le tue scelte',
  'library.upNext.rest': 'Poi',
  'library.queueAdd': 'Aggiungi alla coda',

  'library.alsoInFolder': 'In questa cartella, non in questo album',
  'library.play': 'Riproduci',
  'library.pause': 'Pausa',
  'library.stop': 'Ferma',
  'library.previous': 'Precedente',
  'library.back5': 'Indietro di 5 secondi',
  'library.forward5': 'Avanti di 5 secondi',
  'library.next': 'Successivo',
  'library.shuffle': 'Casuale',
  'library.repeat': 'Ripeti',
  'library.repeat.all': 'Ripeti tutto',
  'library.repeat.one': 'Ripeti questo brano',
  'library.repeat.off': 'Non ripetere',
  'library.volume': 'Volume',
  'library.mute': 'Disattiva audio',
  'library.unmute': 'Riattiva audio',
  'library.playbackOptions': 'Opzioni di riproduzione',
  'library.position': 'Posizione',
  'library.queue': 'Coda',
  'library.queue.remove': 'Rimuovi dalla coda',
  'library.nowPlaying': 'In riproduzione',
  'library.nothingPlaying': 'Non suona nulla',
  'library.nothingPlayingHint': 'Scegli qualcosa da ascoltare',
  'library.systemAudio': 'Audio di sistema',
  'library.fullScreen': 'Schermo intero',

  'library.trackActions': 'Cosa fare con questo brano',
  'library.browse.playlist': 'Playlist',
  'library.playlist.favorites': 'Preferiti',
  'library.playlist.addToFavorites': 'Aggiungi ai Preferiti',
  'library.playlist.removeFromFavorites': 'Togli dai Preferiti',
  'library.playlist.favorite': 'Nei tuoi Preferiti',
  'library.playlist.addTo': 'Aggiungi a una playlist',
  'library.playlist.alreadyIn': 'Già in questa playlist',
  'library.playlist.removeFrom': 'Togli da questa playlist',
  'library.playlist.new': 'Nuova playlist',
  'library.playlist.newName': 'Nome della playlist',
  'library.playlist.create': 'Crea',
  'library.playlist.rename': 'Rinomina',
  'library.playlist.keep': 'Tienila',
  'library.playlist.delete': 'Elimina la playlist',
  'library.playlist.deleteConfirm':
    'Eliminare «{name}»? I brani restano nella tua libreria.',
  'library.playlist.builtIn': 'Preferiti c’è sempre e non si può eliminare',
  'library.playlist.songCount': '{count} brani',
  'library.playlist.songCountOne': '1 brano',
  'library.playlist.empty': 'In questa playlist non c’è ancora niente',
  'library.playlist.emptyHint':
    'Clic destro su un brano e scegli «Aggiungi a una playlist».',
  'library.playlist.missing':
    '{count} brani di questa playlist al momento non sono nella tua libreria',
  'library.playlist.reset':
    'Non è stato possibile leggere le tue playlist e sono state azzerate.',
  'library.karaoke.send': 'Manda al Karaoke',
  'library.karaoke.sending': 'Invio al Karaoke…',
  'library.karaoke.failed':
    'Non è stato possibile mandare questo file al Karaoke: forse è troppo grande o illeggibile.',
};

export default library;
