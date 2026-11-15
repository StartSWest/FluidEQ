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
  'library.empty.feature.sound': 'Ogni brano suona attraverso il tuo EQ e DSP',
  'library.empty.feature.lyrics': 'Testi che si illuminano parola per parola',
  'library.empty.feature.browse': 'Album, Cover Flow, In coda e Sorprendimi',
  'library.karaokeSkipped':
    '{count} brani karaoke saltati — aprili nella scheda Karaoke',

  'library.add': 'Aggiungi cartella',
  'library.rescan': 'Analizza di nuovo',
  'library.rescan.force': 'Forza nuova scansione',
  'library.searchPlaceholder': 'Cerca brani, artisti, album',

  'library.browse.album': 'Album',
  'library.browse.artist': 'Artisti',
  'library.browse.genre': 'Generi',
  'library.browse.song': 'Brani',
  'library.browse.folder': 'Cartelle',
  'library.jumpTo': 'Vai a una lettera',
  'library.coverflow.previous': 'Copertina precedente',
  'library.coverflow.next': 'Copertina successiva',
  'library.filterHere': 'Filtra questi brani',
  'library.view.list': 'Dettagli',
  'library.view.grid': 'Griglia',
  'library.view.coverflow': 'Cover Flow',
  'library.rail.library': 'Libreria',
  'library.rail.allPlaylists': 'Tutte le playlist',
  'library.roots.manage': 'Le tue cartelle',
  'library.tree.more': 'Altre {count}…',
  'library.history': 'Indietro e avanti',
  'library.forward': 'Avanti',
  'library.length.minutes': '{minutes} min',
  'library.length.hours': '{hours} h {minutes} min',
  'library.status.songs': '{count} brani',
  'library.status.songsOne': '{count} brano',
  'library.status.albums': '{count} album',
  'library.status.albumsOne': '{count} album',
  'library.status.videos': '{count} video',
  'library.status.videosOne': '{count} video',
  'library.status.upToDate': 'Libreria aggiornata',
  'library.sort.plays': 'Più ascoltati',
  'library.sort.length': 'Durata',
  'library.column.genre': 'Genere',
  'library.column.format': 'Formato',
  'library.column.plays': 'Ascolti',
  'library.columns.choose': 'Scegli le colonne',
  'library.kind.album': 'Album',
  'library.kind.artist': 'Artista',
  'library.kind.genre': 'Genere',
  'library.kind.folder': 'Cartella',
  'library.kind.folderAlbum': 'Cartella · album dentro',
  'library.kind.playlist': 'Playlist',
  'library.pane.details': 'Dettagli',
  'library.pane.lyrics': 'Testo',
  'library.pane.tabs': 'Cosa mostra il pannello',
  'library.now.nothing': 'Niente in riproduzione',
  'library.now.nothingHint': 'Scegli un brano per iniziare',
  'library.facts.nothing': 'Riproduci un brano per vederne i dettagli',
  'library.facts.song': 'Brano',
  'library.facts.file': 'File',
  'library.facts.sound': 'Suono',
  'library.facts.location': 'Posizione',
  'library.facts.track': 'Traccia',
  'library.facts.disc': 'Disco',
  'library.facts.codec': 'Codec',
  'library.facts.bitrate': 'Bitrate',
  'library.facts.sampleRate': 'Frequenza di campionamento',
  'library.facts.bitDepth': 'Profondità di bit',
  'library.facts.channels': 'Canali',
  'library.facts.mono': 'Mono',
  'library.facts.stereo': 'Stereo',
  'library.facts.channelCount': '{count} canali',
  'library.facts.duration': 'Durata',
  'library.facts.size': 'Dimensione',
  'library.facts.loudness': 'Loudness',
  'library.facts.truePeak': 'Picco reale',
  'library.facts.lossless': 'Lossless',
  'library.facts.lossy': 'Lossy',
  'library.facts.kbps': '{value} kbps',
  'library.facts.khz': '{value} kHz',
  'library.facts.bits': '{value} bit',
  'library.facts.mb': '{value} MB',
  'library.facts.lufs': '{value} LUFS',
  'library.facts.dbtp': '{value} dBTP',
  'library.facts.readFailed':
    'FluidEQ non è riuscito a leggere i dettagli di questo file.',
  'library.lyrics.nothing': 'Riproduci un brano per vederne il testo',
  'library.lyrics.none': 'Nessun testo per questo brano',
  'library.lyrics.looked':
    'FluidEQ ha cercato nei tag del brano e un file .lrc o .txt con lo stesso nome accanto.',
  'library.lyrics.fromTags': 'Dai tag del brano',
  'library.lyrics.fromFile': 'Da {name}',
  'library.lyrics.reading': 'Ricerca del testo…',
  'library.lyrics.follow': 'Torna alla riga in riproduzione',
  'library.lyrics.listLabel': 'Testo. Premi una riga per riprodurre da lì.',
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
  'library.sort.name': 'Nome',
  'library.sort.count': 'Più brani',

  'library.column.title': 'Titolo',
  'library.column.artist': 'Artista',
  'library.column.album': 'Album',
  'library.column.year': 'Anno',
  'library.column.length': 'Durata',
  'library.column.trackNo': 'Numero di traccia',

  'library.unknownAlbum': 'Album sconosciuto',
  'library.unknownArtist': 'Artista sconosciuto',
  'library.genre.unknown': 'Genere sconosciuto',
  'library.trackCount': '{count} brani',
  'library.albumCount': '{count} album',
  'library.artistCount': '{count} artisti',

  'library.videos': 'Video',
  'library.videos.empty': 'Nessun video nelle cartelle che hai aggiunto.',

  'library.scan.running': 'Lettura di {name}',
  'library.scan.counted': '{parsed} di {seen} file',
  'library.scan.cancel': 'Interrompi',
  'library.scan.hide': 'Nascondi questo avviso',
  'library.scan.hideHint':
    'Nascondi questo avviso. La Libreria continua a leggere i tuoi file.',
  'library.scan.chip': 'Lettura {percent}%',
  'library.scan.chipFinding': 'Lettura…',
  'library.scan.show': 'Mostra di nuovo l’avanzamento e Interrompi',

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
  'library.place.aria': 'Dove sei nella libreria',
  'library.place.allHint':
    'Esci da questa cartella e mostra tutta la tua libreria',
  'library.search.near': 'In {folder}',
  'library.search.nearEmpty': 'Niente in {folder}',
  'library.search.elsewhere': 'Nel resto della tua libreria',

  'library.upNext': 'In coda',
  'library.upNext.empty': 'Niente in coda',
  'library.upNext.added': 'Le tue scelte',
  'library.upNext.rest': 'Poi',
  'library.upNext.continued': 'Altro dello stesso genere',
  'library.upNext.keepPlaying': 'Continua a suonare',
  'library.upNext.keepPlayingHint':
    'Quando la lista finisce, prosegui con altra musica dello stesso genere e poi con una sorpresa quando non ne resta',
  'library.upNext.surprise': 'Sorprendimi',
  'library.upNext.surpriseHint':
    'Riproduci un brano a caso dalla tua libreria, poi altro dello stesso genere',
  'library.upNext.surpriseStart':
    'Un brano a caso dalla tua libreria, poi altro dello stesso genere.',
  'library.upNext.surpriseNext':
    'Quando questo brano finisce, Sorprendimi sceglie il prossimo.',
  'library.upNext.surpriseNothing':
    'Al momento nella tua libreria non c’è niente da riprodurre.',
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
  'library.repeat.all': 'Ripeti tutto',
  'library.repeat.one': 'Ripeti questo brano',
  'library.repeat.off': 'Non ripetere',
  'library.volume': 'Volume',
  'library.mute': 'Disattiva audio',
  'library.unmute': 'Riattiva audio',
  'library.playbackOptions': 'Opzioni di riproduzione',
  'library.position': 'Posizione',
  'library.queue.remove': 'Rimuovi dalla coda',
  'library.nowPlaying': 'In riproduzione',
  'library.nothingPlaying': 'Non suona nulla',
  'library.nothingPlayingHint': 'Scegli qualcosa da ascoltare',
  'library.systemAudio': 'Audio di sistema',
  'library.remoteAudio': 'Riproduzione remota · {name}',
  'library.remoteAudioDelay':
    'Riproduzione remota · {name} · {milliseconds} ms',

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
  'library.drop.empty': 'In ciò che hai trascinato non c’è musica',
  'library.drop.already': 'Tutto ciò che hai trascinato è già «In coda»',
  'library.drop.failed': 'Impossibile aggiungere la musica trascinata',
};

export default library;
