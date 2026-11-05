/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The Gaming Lab. See `en/gaming.ts`. */
export default {
  'gaming.tab': 'Gaming-Labor',
  'gaming.view.games': 'Spiele',
  'gaming.view.profiles': 'Gaming-Profile',
  'gaming.switch': 'Umschalten, wenn ein Spiel im Vordergrund ist',
  'gaming.switch.hint':
    'Aus: Ihre Spiele behalten Ihren Musikklang, und nichts schaltet von selbst um.',
  'gaming.add': 'Spiel hinzufügen',
  'gaming.list.show': 'Spieleliste anzeigen',
  'gaming.list.hide': 'Spieleliste ausblenden',
  'gaming.list.resize': 'Größe der Spieleliste ändern',
  'gaming.list.count': 'Ihre Spiele · {count}',
  'gaming.list.from': 'Aus {profile}',
  'gaming.list.tuned': 'angepasst',
  'gaming.list.playing': 'Läuft',
  'gaming.empty.title': 'Noch keine Spiele',
  'gaming.empty.more':
    'Fügen Sie ein Spiel hinzu, und es bekommt einen eigenen Klang, kopiert aus einem Gaming-Profil, das dafür gemacht ist. Sie stimmen hier die Kopie ab; das Profil bleibt, wie es war.',
  'gaming.game.where': '{source} · auf {output}',
  'gaming.profile.label': 'Gaming-Profil',
  'gaming.profile.kind.title': 'Für dieses Spiel',
  'gaming.profile.kind.kind': 'Nach Art',
  'gaming.profile.kind.yours': 'Ihre',
  'gaming.profile.kind.chain': 'DSP-Preset',
  'gaming.profile.gone': 'Ein Profil, das es nicht mehr gibt',
  'gaming.profile.pickHint':
    'Ein anderes Profil gibt diesem Spiel eine frische Kopie davon.',
  'gaming.save': 'Als Profil speichern',
  'gaming.save.new': 'Als neues Profil speichern…',
  'gaming.save.newHint':
    'Landet unter „Ihre“, damit andere Spiele davon ausgehen können. {game} geht dann davon aus.',
  'gaming.save.update': '{profile} aktualisieren',
  'gaming.save.updateHint':
    'Ihr Profil übernimmt diese Änderungen. Spiele, die davon ausgingen, behalten ihre eigenen Kopien.',
  'gaming.save.reset': 'Auf {profile} zurücksetzen',
  'gaming.save.resetHint':
    'Verwirft die Abstimmung dieses Spiels und beginnt wieder beim Profil.',
  'gaming.save.rename': 'Diese Kopie umbenennen…',
  'gaming.save.delete': 'Diese Kopie löschen',
  'gaming.save.deleteHint':
    'Entfernt dieses Spiel und seine Abstimmung. Das Profil bleibt, wie es ist.',
  'gaming.action.unload': 'Entladen',
  'gaming.action.unloadHint': 'Ihr Musikklang kommt jetzt zurück.',
  'gaming.action.try': 'Jetzt ausprobieren',
  'gaming.action.tryHint':
    'Schaltet den eigenen Klang von {game} jetzt ein, damit Sie ihn hören und abstimmen können.',
  'gaming.status.tuned':
    'Die Kopie dieses Spiels von {profile}. Angepasst: {parts}. Das Profil selbst bleibt unberührt.',
  'gaming.status.tunedNamed':
    '{copy}: die Kopie dieses Spiels von {profile}. Angepasst: {parts}. Das Profil selbst bleibt unberührt.',
  'gaming.status.same':
    'Wie das Profil. Was Sie hier ändern, bleibt bei diesem Spiel; das Profil selbst ändert sich nie.',
  'gaming.rail.game': 'Spiel',
  'gaming.rail.sound': 'Sound',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': 'angepasst',
  'gaming.stage.footsteps': 'Filter Spiel',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': 'Kurve',
  'gaming.curve.any': 'Jedes Spiel',
  'gaming.editor.notLoaded': 'Der eigene Klang von {game} spielt nicht',
  'gaming.editor.notLoadedMore':
    'Mit „Jetzt ausprobieren“ hören Sie ihn und stimmen ihn gleich hier ab. Ihr Musikklang kommt mit „Entladen“ zurück oder wenn das Spiel endet.',
  'gaming.editor.eqNote':
    'Die eigenen Bänder dieses Spiels, oben im Diagramm gezeichnet, wenn es angezeigt wird.',
  'gaming.editor.curveNote':
    'Die Kopfhörerkorrektur, die dieses Spiel spielt, aus Ihren Kurven oder der eines Kopfhörers, und jede Kurve, die mit ihr läuft – jede mit ihrem ×, um sie zu entfernen.',
  'gaming.saveDialog.title': 'Als Gaming-Profil speichern',
  'gaming.saveDialog.hint':
    'Andere Spiele können davon ausgehen, in der Liste der Gaming-Profile.',
  'gaming.saveDialog.placeholder': 'Name des Profils',
  'gaming.renameDialog.title': 'Diese Kopie umbenennen',
  'gaming.renameDialog.hint': 'Nur die Kopie dieses Spiels bekommt den Namen.',
  'gaming.renameDialog.placeholder': 'Name der Kopie',
  'gaming.addDialog.title': 'Spiel hinzufügen',
  'gaming.addDialog.intro':
    'Wählen Sie das Spiel. Es geht von einem Gaming-Profil aus und bekommt eine eigene Kopie: Sie stimmen die Kopie für dieses Spiel ab, das Profil selbst ändert sich nie.',
  'gaming.addDialog.running': 'Läuft gerade',
  'gaming.addDialog.installed': 'Auf diesem PC gefunden',
  'gaming.addDialog.startsFrom': 'Geht aus von',
  'gaming.addDialog.browse':
    'Nicht dabei? Nach dem Programm des Spiels suchen…',
  'gaming.addDialog.later':
    'Sie können jederzeit ein anderes Gaming-Profil dafür wählen.',
  'gaming.addDialog.add': '{game} hinzufügen',
  'gaming.addDialog.cancel': 'Abbrechen',
  'gaming.addDialog.loading': 'Ihre Spiele werden gesucht…',
  'gaming.addDialog.none':
    'Keiner Ihrer Launcher führt ein Spiel, das hier noch fehlt. Suchen Sie stattdessen nach dem Programm des Spiels.',
  'gaming.addDialog.close': 'Schließen',
  'gaming.profiles.intro':
    'Ein Spiel bekommt seine eigene Kopie eines Profils. Sie stimmen die Kopie ab; das Profil ändert sich nie.',
  'gaming.profiles.search': 'Profile und Spiele durchsuchen',
  'gaming.profiles.searchClear': 'Suche leeren',
  'gaming.profiles.noMatch': 'Kein Gaming-Profil passt zu „{query}“.',
  'gaming.profiles.filterLabel': 'Anzeigen',
  'gaming.profiles.noCurve': 'Keine Kurve: so, wie das Spiel gemischt wurde',
  'gaming.profiles.filter.all': 'Alle',
  'gaming.profiles.filter.yours': 'Ihre',
  'gaming.profiles.yours': 'Ihre · aus der Kopie eines Spiels gespeichert',
  'gaming.profiles.yoursEmpty':
    'Noch keine. Stimmen Sie ein Spiel ab und nutzen Sie „Als Profil speichern“, um seinen Klang hier zu behalten.',
  'gaming.profiles.readyGroup': 'Fertig · {group}',
  'gaming.profiles.savedFrom': 'Aus der Kopie von {game} gespeichert',
  'gaming.profiles.usedBy': '{games} geht davon aus',
  'gaming.profiles.use': 'Für ein Spiel nutzen',
  'gaming.profiles.rename': 'Umbenennen',
  'gaming.profiles.delete': 'Löschen',
  'gaming.profiles.confirmDelete':
    'Löschen? Spiele behalten ihre eigenen Kopien.',
  'gaming.profiles.keep': 'Behalten',
  'gaming.profiles.renameTitle': 'Gaming-Profil umbenennen',
  'gaming.profiles.renameHint':
    'Spiele, die davon ausgingen, behalten ihre Kopien; nur der Name ändert sich.',
  'gaming.toast.loaded': 'Spielprofil geladen',
  'gaming.toast.restored': 'Musikprofil wiederhergestellt',
  'gaming.paused.notice': 'Pausiert: Der eigene Klang von {game} spielt',
  'gaming.paused.tune': '{game} abstimmen',
  'gaming.paused.title': 'Ihr Musik-Rack wartet',
  'gaming.paused.body':
    'Während {game} läuft, ist sein eigener Klang an und dieses Rack pausiert. Es kommt genau so zurück, wie es war, wenn das Spiel endet, oder jetzt mit „Entladen“.',
  'gaming.paused.stages': '{preset} · was zurückkommt',
  'gaming.paused.none': 'Jede Stufe darin ist ausgeschaltet.',
  'gaming.profileSelect.game': '{game} · Spielklang',
  'gaming.preset.tuned': '{game} (angepasst)',
  'gaming.preset.openHint':
    'Der eigene Klang von {game} ist geladen. Sein Preset ändern Sie im Gaming-Labor.',
  'gaming.now.hint': 'Der eigene Klang von {game} läuft. Spiel anzeigen.',
} as const;
