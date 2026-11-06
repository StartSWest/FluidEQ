/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The Gaming Lab. See `en/gaming.ts`. */
export default {
  'gaming.tab': 'Laboratorio gaming',
  'gaming.view.games': 'Giochi',
  'gaming.view.profiles': 'Profili gaming',
  'gaming.switch': 'Passa quando un gioco è in primo piano',
  'gaming.switch.hint':
    'Spento, i tuoi giochi tengono il tuo suono per la musica e niente cambia da solo.',
  'gaming.add': 'Aggiungi un gioco',
  'gaming.list.show': 'Mostra i nomi dei giochi',
  'gaming.list.hide': 'Mostra le icone dei giochi',
  'gaming.list.resize': 'Ridimensiona elenco giochi',
  'gaming.list.count': 'I tuoi giochi · {count}',
  'gaming.list.from': 'Da {profile}',
  'gaming.list.tuned': 'regolato',
  'gaming.list.playing': 'In gioco',
  'gaming.empty.title': 'Ancora nessun gioco',
  'gaming.empty.more':
    'Aggiungi un gioco e avrà un suono tutto suo, copiato da un profilo gaming fatto per lui. Qui regoli la copia; il profilo resta com’era.',
  'gaming.game.where': '{source} · su {output}',
  'gaming.profile.label': 'Profilo gaming',
  'gaming.profile.kind.title': 'Per questo gioco',
  'gaming.profile.kind.kind': 'Per tipo',
  'gaming.profile.kind.yours': 'Tuoi',
  'gaming.profile.kind.chain': 'Preset DSP',
  'gaming.profile.gone': 'Un profilo che non c’è più',
  'gaming.profile.pickHint':
    'Scegliere un altro profilo dà a questo gioco una copia nuova di quello.',
  'gaming.save': 'Salva come profilo',
  'gaming.save.new': 'Salva come nuovo profilo…',
  'gaming.save.newHint':
    'Va tra i Tuoi, così altri giochi possono partire da lì. {game} poi parte da lì.',
  'gaming.save.update': 'Aggiorna {profile}',
  'gaming.save.updateHint':
    'Il tuo profilo prende queste modifiche. I giochi partiti da lì tengono le proprie copie.',
  'gaming.save.reset': 'Torna a {profile}',
  'gaming.save.resetHint':
    'Butta via la regolazione di questo gioco e riparte dal profilo.',
  'gaming.save.rename': 'Rinomina questa copia…',
  'gaming.save.delete': 'Elimina questa copia',
  'gaming.save.deleteHint':
    'Toglie questo gioco e la sua regolazione. Il profilo resta com’è.',
  'gaming.action.unload': 'Scarica',
  'gaming.action.unloadHint': 'Il tuo suono per la musica torna adesso.',
  'gaming.action.try': 'Provalo ora',
  'gaming.action.tryHint':
    'Mette adesso il suono di {game}, così puoi sentirlo e regolarlo.',
  'gaming.status.tuned':
    'La copia di {profile} di questo gioco. Regolato: {parts}. Il profilo in sé resta intatto.',
  'gaming.status.tunedNamed':
    '{copy}: la copia di {profile} di questo gioco. Regolato: {parts}. Il profilo in sé resta intatto.',
  'gaming.status.same':
    'Uguale al profilo. Quello che cambi qui resta a questo gioco; il profilo in sé non cambia mai.',
  'gaming.rail.game': 'Gioco',
  'gaming.rail.sound': 'Suono',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': 'regolato',
  'gaming.stage.footsteps': 'Filtro Gioco',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': 'Curva',
  'gaming.curve.any': 'Qualsiasi gioco',
  'gaming.editor.notLoaded': 'Il suono di {game} non è in riproduzione',
  'gaming.editor.notLoadedMore':
    'Provalo ora per sentirlo e regolarlo proprio qui. Il tuo suono per la musica torna con Scarica, o quando il gioco si chiude.',
  'gaming.editor.eqNote':
    'Le bande di questo gioco, disegnate nel grafico sopra quando è visibile.',
  'gaming.editor.curveNote':
    'La correzione per cuffie che suona in questo gioco, dalle tue curve o da quella di una cuffia, e ogni curva applicata con essa, ognuna con la sua × per toglierla.',
  'gaming.saveDialog.title': 'Salva come profilo gaming',
  'gaming.saveDialog.hint':
    'Altri giochi possono partire da lì, nell’elenco dei profili gaming.',
  'gaming.saveDialog.placeholder': 'Nome del profilo',
  'gaming.renameDialog.title': 'Rinomina questa copia',
  'gaming.renameDialog.hint': 'Solo la copia di questo gioco prende il nome.',
  'gaming.renameDialog.placeholder': 'Nome della copia',
  'gaming.addDialog.title': 'Aggiungi un gioco',
  'gaming.addDialog.intro':
    'Scegli il gioco. Parte da un profilo gaming e riceve una copia tutta sua: regoli la copia per questo gioco, il profilo in sé non cambia mai.',
  'gaming.addDialog.running': 'Aperto ora',
  'gaming.addDialog.installed': 'Trovato su questo PC',
  'gaming.addDialog.startsFrom': 'Parte da',
  'gaming.addDialog.browse': 'Non c’è? Cerca il programma del gioco…',
  'gaming.addDialog.later':
    'Puoi scegliergli un altro profilo gaming quando vuoi.',
  'gaming.addDialog.add': 'Aggiungi {game}',
  'gaming.addDialog.cancel': 'Annulla',
  'gaming.addDialog.loading': 'Cerco i tuoi giochi…',
  'gaming.addDialog.none':
    'Nessuno dei tuoi launcher elenca un gioco che non sia già qui. Cerca invece il programma del gioco.',
  'gaming.addDialog.close': 'Chiudi',
  'gaming.profiles.intro':
    'Un gioco riceve una copia tutta sua di un profilo. Tu regoli la copia; il profilo non cambia mai.',
  'gaming.profiles.search': 'Cerca profili e giochi',
  'gaming.profiles.searchClear': 'Cancella la ricerca',
  'gaming.profiles.noMatch': 'Nessun profilo gaming corrisponde a «{query}».',
  'gaming.profiles.filterLabel': 'Mostra',
  'gaming.profiles.noCurve': 'Nessuna curva: com’è stato mixato il gioco',
  'gaming.profiles.filter.all': 'Tutti',
  'gaming.profiles.filter.yours': 'Tuoi',
  'gaming.profiles.yours': 'Tuoi · salvati dalla copia di un gioco',
  'gaming.profiles.yoursEmpty':
    'Ancora nessuno. Regola un gioco e usa Salva come profilo per tenere qui il suo suono.',
  'gaming.profiles.readyGroup': 'Pronti · {group}',
  'gaming.profiles.savedFrom': 'Salvato dalla copia di {game}',
  'gaming.profiles.usedBy': '{games} è partito da qui',
  'gaming.profiles.use': 'Usa per un gioco',
  'gaming.profiles.rename': 'Rinomina',
  'gaming.profiles.delete': 'Elimina',
  'gaming.profiles.confirmDelete':
    'Eliminarlo? I giochi tengono le proprie copie.',
  'gaming.profiles.keep': 'Tieni',
  'gaming.profiles.renameTitle': 'Rinomina profilo gaming',
  'gaming.profiles.renameHint':
    'I giochi partiti da lì tengono le loro copie; cambia solo il nome.',
  'gaming.toast.loaded': 'Profilo di gioco caricato',
  'gaming.toast.restored': 'Profilo musicale ripristinato',
  'gaming.paused.notice': 'In pausa: suona il suono di {game}',
  'gaming.paused.tune': 'Regola {game}',
  'gaming.paused.title': 'Il tuo rack per la musica aspetta',
  'gaming.paused.body':
    'Mentre {game} è aperto, il suo suono è attivo e questo rack è in pausa. Torna esattamente com’era quando il gioco si chiude, o subito con Scarica.',
  'gaming.paused.stages': '{preset} · cosa torna',
  'gaming.paused.none': 'Ogni stadio è spento.',
  'gaming.profileSelect.game': '{game} · suono del gioco',
  'gaming.preset.tuned': '{game} (personalizzato)',
  'gaming.preset.openHint':
    'Il suono di {game} è caricato. Il suo preset si cambia nel Laboratorio gaming.',
  'gaming.now.hint': 'È in riproduzione il suono di {game}. Mostra il gioco.',
} as const;
