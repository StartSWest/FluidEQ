/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Auto EQ on the EQ page: its button, its panel, Manage, and the note that
 * took the Output panel’s old switch’s place. */
export default {
  'autoEq.title': 'EQ automatico',
  'autoEq.aria': 'EQ automatico: cosa decide il suono di ogni brano',
  'autoEq.tagline': 'Il suono di ogni brano, scelto per te',
  'autoEq.state.measuring': 'Misurazione',
  'autoEq.state.paused': 'In pausa',
  'autoEq.state.song': 'Brano',
  'autoEq.state.album': 'Album',
  'autoEq.state.yours': 'Il tuo',
  'autoEq.aside':
    'Si fa da parte mentre il DSP è spento, è attiva una catena Gaming o un gioco riproduce il proprio suono. Poi torna com’era.',
  'autoEq.now.nothing': 'Nessuna riproduzione',
  'autoEq.now.yours': 'il tuo suono',
  'autoEq.now.yoursWhy':
    'Niente di salvato per questo brano: suona l’ultimo suono che hai scelto.',
  'autoEq.now.song': 'il suono di questo brano',
  'autoEq.now.songWhy': 'Torna ogni volta che suona questo brano.',
  'autoEq.now.album': 'il suono di {album}',
  'autoEq.now.albumUnnamed': 'il suono del suo album',
  'autoEq.now.albumWhy': 'Impostato nella Libreria per tutto l’album.',
  'autoEq.songs.title': 'Suoni dei brani',
  'autoEq.songs.hint':
    'Un brano con un suono salvato lo riproduce. Cambialo e premi Salva modifiche per tenerlo. Gli altri brani suonano con il tuo.',
  'autoEq.songs.nothing': 'Riproduci un brano per salvarne il suono',
  'autoEq.songs.saved': 'Salvato per questo brano',
  'autoEq.songs.none': 'Niente di salvato per questo brano',
  'autoEq.songs.save': 'Salva per questo brano',
  'autoEq.songs.forget': 'Dimentica',
  'autoEq.button.save': 'Salva',
  'autoEq.state.changed': 'Modificato',
  'autoEq.songs.changed': 'Modificato, non salvato',
  'autoEq.songs.revert': 'Torna al salvato',
  'autoEq.songs.saveChanges': 'Salva modifiche',
  'autoEq.button.saveFor': 'Salva ciò che suona per {title}',
  'autoEq.button.saved': 'Salvato',
  'autoEq.holds.preset': 'Preset',
  'autoEq.holds.eq': 'Il tuo EQ',
  'autoEq.holds.curves': 'Curve',
  'autoEq.holds.bands': '{count} bande',
  'autoEq.holds.bandsOne': '1 banda',
  'autoEq.holds.flat': 'Piatto',
  'autoEq.holds.none': 'Nessuna',
  'autoEq.holds.curve': 'Curva di {preset}',
  'autoEq.holds.correction': 'La correzione delle cuffie resta con l’uscita',
  'autoEq.albums.title': 'Suoni degli album',
  'autoEq.albums.hint':
    'Solo nella Libreria. Ogni brano dell’album suona con quello, tranne un brano con un preset suo.',
  'autoEq.albums.nothing':
    'Imposta il suono di un album nella sua pagina della Libreria',
  'autoEq.albums.libraryOnly': 'Solo Libreria: non per altri lettori',
  'autoEq.albums.set': '{album}: {preset}',
  'autoEq.albums.none': 'Questo album non ha un suono impostato',
  'autoEq.smart.title': 'Correzione intelligente',
  'autoEq.smart.hint':
    'Misura ogni brano dalla sorgente e conserva la sua correzione per quel brano. Sopra qualsiasi preset.',
  'autoEq.smart.modes': 'Come corregge',
  'autoEq.smart.waiting': 'In attesa di un brano',
  'autoEq.smart.willSave': 'Salvata per questo brano quando finisce',
  'autoEq.smart.savesIn': 'Salvata per questo brano tra {remaining}',
  'autoEq.smart.onceHint':
    'Una misurazione di ciò che suona, applicata in una volta',
  'autoEq.smart.once': 'Misura una volta',
  'autoEq.smart.phase.listening': 'In ascolto',
  'autoEq.smart.phase.settling': 'Si assesta',
  'autoEq.smart.phase.held': 'Fissata per questo brano',
  'autoEq.smart.phase.paused': 'In pausa',
  'autoEq.smart.heard': '{seconds} s',
  'autoEq.smart.note.listening':
    'Ciò che suona ora continua finché la correzione di questo brano non è fissata.',
  'autoEq.smart.note.waitingOn':
    'In attesa: {ranges}. Ciò che suona ora continua finché la correzione di questo brano non è fissata.',
  'autoEq.smart.note.settling':
    'Verifica che la curva abbia smesso di muoversi prima di scriverla.',
  'autoEq.smart.note.held':
    'La misura si è fermata. Riprende al prossimo brano.',
  'autoEq.smart.note.heldMissing':
    'Assente in questa registrazione, quindi lasciato com’è: {ranges}. La misura si è fermata.',
  'autoEq.smart.note.heldShort':
    'Troppo poco della registrazione per correggere, il suono resta com’era.',
  'autoEq.smart.again': 'Misura di nuovo',
  'autoEq.smart.againHint':
    'Riascolta questo brano e sostituisci la sua correzione',
  'autoEq.savedCount': 'Salvati: {songs} · {albums}',
  'autoEq.manage': 'Gestisci',
  'autoEq.manage.title': 'Suoni salvati',
  'autoEq.manage.back': 'Torna a EQ automatico',
  'autoEq.manage.songs': 'Brani',
  'autoEq.manage.albums': 'Album',
  'autoEq.manage.search': 'Cerca suoni salvati',
  'autoEq.manage.wholeSound': '{preset} con il suo Tono ed EQ',
  'autoEq.manage.forget': 'Dimentica',
  'autoEq.manage.others': 'Brani da altri lettori: {count}',
  'autoEq.manage.othersHint':
    'Spotify, YouTube e il browser. I loro titoli non vengono mai conservati.',
  'autoEq.manage.empty': 'Ancora niente di salvato',
  'autoEq.manage.noMatch': 'Nessun risultato',
  'autoEq.manage.resetKeeps':
    'Ripristina tutte le impostazioni li conserva. Solo Dimentica li rimuove.',
  'autoEq.manage.forgetAll': 'Dimentica tutto',
  'autoEq.manage.forgetAllConfirm': 'Dimentica tutto, per sempre',
  'autoEq.moved.title': 'Il suono di ogni brano ora è in EQ automatico',
  'autoEq.moved.body':
    'Ricorda il suono di ogni brano si è spostato in EQ automatico, nella pagina EQ. I tuoi {count} brani salvati sono venuti con lui.',
  'autoEq.moved.bodyOne':
    'Ricorda il suono di ogni brano si è spostato in EQ automatico, nella pagina EQ. Il tuo brano salvato è venuto con lui.',
  'autoEq.moved.open': 'Apri EQ automatico',
  'autoEq.moved.dismiss': 'Ho capito',
  'autoEq.eqs.title': 'EQ salvati',
  'autoEq.eqs.saveThis': 'Salva questo EQ',
  'autoEq.eqs.empty': 'Ancora niente di salvato',
  'autoEq.eqs.name': 'Nome',
  'autoEq.eqs.defaultName': 'Il mio EQ {count}',
  'autoEq.eqs.keepPreset': 'Tieni anche il preset',
  'autoEq.eqs.anyPreset': 'Suona sopra qualsiasi preset',
  'autoEq.eqs.stays':
    'La correzione delle cuffie e la correzione intelligente restano dove sono.',
  'autoEq.eqs.cancel': 'Annulla',
  'autoEq.eqs.save': 'Salva',
  'autoEq.eqs.saveFailed': 'Non è stato possibile salvarlo. Riprova.',
  'autoEq.eqs.putOn': 'Metti',
  'autoEq.eqs.update': 'Aggiorna',
  'autoEq.eqs.updateWithLive': 'Aggiorna con ciò che suona',
  'autoEq.eqs.playing': 'In riproduzione',
  'autoEq.eqs.more': 'Altro per {name}',
  'autoEq.eqs.renameLabel': 'Nuovo nome per {name}',
  'autoEq.eqs.deleteAsk': 'Eliminare {name}?',
  'autoEq.eqs.deleteKeeps':
    'Usato da {what}. Ognuno tiene il suo suono come proprio.',
  'autoEq.eqs.usedBy': 'su {what}',
  'autoEq.eqs.use': 'Usa un EQ salvato',
  'autoEq.eqs.saveNew': 'Salva come nuovo EQ…',
  'autoEq.eqs.updateNamed': 'Aggiorna «{name}» con ciò che suona',
  'autoEq.eqs.manageAll': 'Gestisci EQ salvati…',
  'autoEq.eqs.search': 'Cerca EQ salvati',
  'autoEq.eqs.putOnNamed': 'Metti {name}',
  'autoEq.songs.follows': 'Segue {name}',
};
