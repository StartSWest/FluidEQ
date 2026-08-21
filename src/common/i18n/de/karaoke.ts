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

/** The Karaoke tab, its player and the Maker. */
import { Dictionary } from '../en';

const karaoke: Partial<Dictionary> = {
  'karaoke.eyebrow': 'LOKALES KARAOKE',
  'karaoke.title': 'Eine Bühne für deine Musik',
  'karaoke.intro':
    'Hier kommen Songs, synchronisierte Texte, Mikrofon-Monitoring und Tonhöhenhilfe zusammen – vollständig lokal auf deinem PC.',
  'karaoke.fullscreen.enter': 'Vollbild öffnen',
  'karaoke.fullscreen.exit': 'Vollbild verlassen',
  'karaoke.fullscreen.hideHeader': 'FluidEQ-Kopfzeile ausblenden',
  'karaoke.fullscreen.showHeader': 'FluidEQ-Kopfzeile einblenden',
  'karaoke.actions': 'Karaoke-Aktionen',
  'karaoke.readiness.resize': 'Mikrofon- und Tonhöhenbereiche skalieren',
  'karaoke.empty.title': 'Deine Bühne ist bereit',
  'karaoke.empty.body':
    'Öffne Audiodateien mit optionalen Texten oder füge einen ganzen Ordner hinzu. FluidEQ verknüpft gleichnamige Dateien in einer Wiedergabeliste.',
  'karaoke.import.pending': 'Als Nächstes: Songs importieren',
  'karaoke.import.open': 'Song öffnen',
  'karaoke.import.replace': 'Song ersetzen',
  'karaoke.import.addFiles': 'Dateien hinzufügen',
  'karaoke.import.folder': 'Ordner hinzufügen',
  'karaoke.import.clear': 'Entfernen',
  'karaoke.import.loading': 'Song wird vorbereitet…',
  'karaoke.import.formats':
    'Audio: MP3, WAV, OGG, Opus, FLAC, M4A oder AAC · Text: LRC, eLRC oder UltraStar-TXT · Cover und Video kannst du mitgeben',
  'karaoke.import.drop': 'Songs, Texte oder Ordner hier ablegen',
  'karaoke.error.missingAudio':
    'Füge zusammen mit dieser Textdatei eine Audiodatei hinzu.',
  'karaoke.error.ambiguous':
    'Mehrere Zuordnungen sind möglich. Wähle eine Audiodatei und optional eine Textdatei.',
  'karaoke.error.unsupported':
    'Keine dieser Dateien ist bereits ein unterstütztes Karaoke-Audio- oder Textformat. Cover und Video brauchen einen Song daneben.',
  'karaoke.error.read': 'FluidEQ konnte die ausgewählten Dateien nicht lesen.',
  'karaoke.error.playback':
    'Diese Chromium-Version konnte die Audiodatei oder den Codec nicht wiedergeben.',
  'karaoke.warning.lyrics': 'konnte nicht gelesen werden.',
  'karaoke.warning.lyricsEmpty': 'ist leer.',
  'karaoke.warning.lyricsMissingTiming':
    'enthält keine Zeitangaben, die FluidEQ lesen kann.',
  'karaoke.warning.lyricsMissingBpm':
    'gibt kein BPM an, das eine UltraStar-Datei braucht.',
  'karaoke.warning.lyricsInvalidBpm':
    'gibt ein BPM an, das keine brauchbare Zahl ist.',
  'karaoke.warning.lyricsMalformedNote':
    'enthält eine Notenzeile, die FluidEQ nicht lesen konnte.',
  'karaoke.warning.lyricsUnsupportedVariant':
    'nutzt eine Karaoke-Variante, die FluidEQ noch nicht singen kann, etwa ein Duett.',
  'karaoke.warning.lyricsAtLine': 'Zeile {line}.',
  'karaoke.warning.lyricsAudioIntact':
    'Das Audio bleibt ohne synchronisierten Text verfügbar.',
  'karaoke.warning.setAside':
    'FluidEQ kann diese Dateien noch nicht als Karaoke lesen und hat sie deshalb beiseitegelegt: {formats}.',
  'karaoke.warning.unpairedLyrics':
    'Zu diesen Textdateien passt keine Audiodatei, deshalb wurden sie nicht verwendet: {files}.',
  'karaoke.warning.ambiguousLyrics':
    'Zwei Textdateien passten zum selben Song, deshalb wurde keine verwendet: {files}.',
  'karaoke.warning.andMore': 'und {count} weitere',
  'karaoke.countdown.sing': 'Sing',
  'karaoke.song.unknownArtist': 'Lokaler Song',
  'karaoke.stage.videoUnsupported':
    '{format}-Videos können hier nicht abgespielt werden',
  'karaoke.stage.videoFailed':
    '{format}-Video konnte hier nicht dekodiert werden',
  'karaoke.stage.hideArt': 'Cover ausblenden',
  'karaoke.stage.showArt': 'Cover einblenden',
  'karaoke.stage.noArt': 'Dieser Titel hat kein Cover',
  'karaoke.playlist.title': 'Wiedergabeliste',
  'karaoke.playlist.groupFolders': 'Nach Ordner gruppieren',
  'karaoke.playlist.looseFiles': 'Lose Dateien',
  'karaoke.playlist.resize': 'Wiedergabeliste und Bühne skalieren',
  'karaoke.playlist.collapse': 'Wiedergabeliste einklappen',
  'karaoke.playlist.expand': 'Wiedergabeliste ausklappen',
  'karaoke.playlist.select': '{title} auswählen',
  'karaoke.playlist.moveUp': '{title} nach oben verschieben',
  'karaoke.playlist.moveDown': '{title} nach unten verschieben',
  'karaoke.playlist.remove': '{title} entfernen',
  'karaoke.source.audioOnly': 'Nur Audio',
  'karaoke.source.lrc': 'LRC · Zeilentaktung',
  'karaoke.source.elrc': 'eLRC · Worttaktung',
  'karaoke.source.ultrastar': 'UltraStar · Silben + Tonhöhe',
  'karaoke.lyrics.none':
    'Kein synchronisierter Text ausgewählt. Wiedergabe und Live-Tuner funktionieren weiterhin.',
  'karaoke.lyrics.line': 'Textzeile {number}',
  'karaoke.lyrics.previous': 'Vorherige Textzeile',
  'karaoke.lyrics.next': 'Nächste Textzeile',
  'karaoke.lyrics.follow': 'Text folgen',
  'karaoke.lyrics.textSize': 'Songtextgröße',
  'karaoke.transport.title': 'Karaoke-Wiedergabesteuerung',
  'karaoke.transport.restart': 'Song neu starten',
  'karaoke.transport.play': 'Wiedergeben',
  'karaoke.transport.pause': 'Pause',
  'karaoke.transport.spaceShortcut': '{action} · Leertaste',
  'karaoke.transport.seek': 'Songposition',
  'karaoke.transport.volume': 'Lautstärke',
  'karaoke.transport.vocalLevel': 'Führungsstimme',
  'karaoke.transport.vocalOff': 'Nur Playback',
  'karaoke.transport.vocalFull': 'Original',
  'karaoke.transport.mixSettings': 'Mix-Einstellungen',
  'karaoke.transport.openMixSettings': 'Mix-Einstellungen für {channel} öffnen',
  'karaoke.mic.title': 'Mikrofon',
  'karaoke.mic.settings': 'Mikrofoneinstellungen',
  'karaoke.mic.off': 'Aus',
  'karaoke.mic.hint':
    'Wähle einen Eingang. FluidEQ fragt erst beim Einschalten nach Mikrofonzugriff.',
  'karaoke.mic.select': 'Mikrofoneingang',
  'karaoke.mic.default': 'Systemstandard',
  'karaoke.mic.unnamed': 'Mikrofon {number}',
  'karaoke.mic.turnOn': 'Mikrofon einschalten',
  'karaoke.mic.turnOff': 'Mikrofon ausschalten',
  'karaoke.mic.requesting': 'Verbindung…',
  'karaoke.mic.live': 'Aktiv',
  'karaoke.mic.denied': 'Zugriff verweigert',
  'karaoke.mic.unavailable': 'Kein Mikrofon',
  'karaoke.mic.disconnected': 'Getrennt',
  'karaoke.mic.error': 'Start fehlgeschlagen',
  'karaoke.mic.level': 'Mikrofon-Eingangspegel',
  'karaoke.mic.levelValue': 'Mikrofon-Eingangspegel: {percent} %',
  'karaoke.mic.privacy':
    'Nur lokale Pegel- und Tonhöhenanalyse. FluidEQ nimmt das Mikrofon nicht auf und gibt es nicht über die Lautsprecher wieder.',
  'karaoke.mic.volume': 'Mikrofonlautstärke',
  'karaoke.mic.volumeValue': 'Mikrofonlautstärke: {percent} %',
  'karaoke.pitch.title': 'Tonhöhenspur',
  'karaoke.pitch.resize': 'Tonhöhenspur skalieren',
  'karaoke.pitch.show': 'Tonhöhenanzeige einblenden',
  'karaoke.pitch.hide': 'Tonhöhenanzeige ausblenden',
  'karaoke.pitch.guide': 'Melodieführung',
  'karaoke.pitch.toneGuide': 'Melodieton',
  'karaoke.pitch.toneEnable': 'Melodie als Ton abspielen',
  'karaoke.pitch.toneDisable': 'Melodieton stoppen',
  'karaoke.pitch.toneVolume': 'Lautstärke des Melodietons',
  'karaoke.pitch.scrubHint':
    'Nach links oder rechts ziehen, um durch den Song zu gehen; loslassen, um pausiert zu bleiben.',
  'karaoke.pitch.viewSelector': 'Tonhöhenanzeige',
  'karaoke.pitch.viewNotes': 'Noten',
  'karaoke.pitch.viewWave': 'Kurve',
  'karaoke.pitch.waveCanvas':
    'Echtzeit-Tonhöhenkurve der Stimme über den Songnoten',
  'karaoke.pitch.waveSong': 'Song',
  'karaoke.pitch.waveVoice': 'Deine Stimme',
  'karaoke.pitch.waveFooter':
    'Die blauen Blöcke sind die Songnoten; die dünne Live-Kurve zeigt die vom Mikrofon erfasste Tonhöhe.',
  'karaoke.pitch.review': 'Leistungsübersicht',
  'karaoke.pitch.reviewCount': '{count} Stellen zum Üben',
  'karaoke.pitch.issueHigh':
    'Tonhöhe bei {time} zu hoch. Übe diesen Abschnitt.',
  'karaoke.pitch.issueLow':
    'Tonhöhe bei {time} zu niedrig. Übe diesen Abschnitt.',
  'karaoke.pitch.issueMissed':
    'Ausgelassene Noten bei {time}. Übe diesen Abschnitt.',
  'karaoke.practice.go': 'LOS',
  'karaoke.practice.ready': 'Mach dich bereit, erneut zu singen',
  'karaoke.countIn.ready': 'Mach dich bereit – der Song beginnt nach LOS',
  'karaoke.pitch.canvas': 'Live-Tonhöhenspur für Mikrofon und Zieltöne',
  'karaoke.pitch.micOff':
    'Schalte das Mikrofon ein, um deine Tonhöhe zu sehen.',
  'karaoke.pitch.loading': 'Tonhöhenanalyse wird gestartet…',
  'karaoke.pitch.unavailable':
    'Die Tonhöhenanalyse ist nicht verfügbar. Der Mikrofonpegel funktioniert weiterhin.',
  'karaoke.pitch.noSignal':
    'Singe ins Mikrofon, um deine Tonhöhe aufzuzeichnen.',
  'karaoke.pitch.empty':
    'Zieltöne erscheinen nur, wenn der importierte Song sie tatsächlich enthält.',
  'karaoke.pitch.high': 'Zu hoch',
  'karaoke.pitch.tuned': 'Richtig',
  'karaoke.pitch.low': 'Zu tief',
  'karaoke.pitch.ultrastar':
    'Blaue Balken sind die Zieltöne; die Spur zeigt, ob deine Stimme zu hoch, richtig oder zu tief ist.',
  'karaoke.chords.aria': 'Aus der Begleitspur geschätzte Gitarrenakkorde',
  'karaoke.chords.analyzing': 'Akkorde werden gesucht… {percent}%',
  'karaoke.chords.estimate': 'Geschätzter Akkord',
  'karaoke.chords.next': 'Nächster',
  'karaoke.chords.in': 'in {seconds}s',
  'karaoke.chords.none': 'Kein stabiler Akkord gefunden',
  'karaoke.chords.confidence': 'Konfidenz der Audioschätzung: {percent}%',
  'karaoke.maker.open': 'Erstellen',
  'karaoke.maker.openTitle': 'Dieses Karaoke erstellen oder bearbeiten',
  'karaoke.maker.dialog': 'Karaoke-Editor',
  'karaoke.maker.eyebrow': 'FLUIDEQ KARAOKE-EDITOR',
  'karaoke.maker.close': 'Editor schließen',
  'karaoke.maker.songTitle': 'Songtitel',
  'karaoke.maker.untitled': 'Karaoke ohne Titel',
  'karaoke.maker.undo': 'Rückgängig',
  'karaoke.maker.redo': 'Wiederholen',
  'karaoke.maker.preview': 'Vorschau · 1, 2, 3',
  'karaoke.maker.apply': 'Im Player verwenden',
  'karaoke.maker.applyHint':
    'Diese Änderungen im Player verwenden. Die Originaldatei bleibt unverändert; Export erstellt eine neue Datei.',
  'karaoke.maker.lyrics': 'Liedtext',
  'karaoke.maker.toolsEdit': 'Bearbeitungswerkzeuge',
  'karaoke.maker.toolsAnalysis': 'Analysewerkzeuge',
  'karaoke.maker.lyricsTiming': 'Liedtext-Timing',
  'karaoke.maker.timingAll': 'Ganzer Song',
  'karaoke.maker.timingFromWord': 'Ab gewähltem Wort',
  'karaoke.maker.timingAllHint':
    'Verschiebt alle synchronisierten Wörter und Noten gemeinsam.',
  'karaoke.maker.timingFromWordHint':
    'Verschiebt „{word}“ und alles danach. Frühere Zeiten bleiben fixiert.',
  'karaoke.maker.earlier': 'Gesamten Liedtext vorziehen',
  'karaoke.maker.later': 'Gesamten Liedtext verzögern',
  'karaoke.maker.openProject': 'Karaoke importieren',
  'karaoke.maker.projectLoaded':
    'Projekt geladen. Das aktuelle Audio bleibt verknüpft.',
  'karaoke.maker.karaokeImported':
    'Karaoke-Timing importiert. Das aktuelle Audio bleibt verknüpft.',
  'karaoke.maker.tapWords': 'Wörter takten',
  'karaoke.maker.recordLines': 'Zeilenanfänge aufnehmen',
  'karaoke.maker.syncLinesFromHere': 'Zeilen ab hier synchronisieren',
  'karaoke.maker.syncWordsFromHere': 'Wörter ab hier synchronisieren',
  'karaoke.maker.syncNow': 'Jetzt',
  'karaoke.maker.syncNext': 'Als Nächstes: {item}',
  'karaoke.maker.markLine': 'Zeilenanfang markieren',
  'karaoke.maker.markLineEnd': 'Zeilenende markieren',
  'karaoke.maker.captureEnd': 'Auf Zeilenende achten',
  'karaoke.maker.capturePressStart': 'Schritt 1 · Enter beim START',
  'karaoke.maker.captureReplaceStart':
    'Nächste Zeile bereit · Enter ersetzt den START',
  'karaoke.maker.captureStartSaved':
    'Start bei {time} gespeichert · Enter beim ENDE',
  'karaoke.maker.captureAutomaticStart':
    'Automatischer Start {time} · Enter beim ENDE',
  'karaoke.maker.captureAutomaticSuggestion':
    'Startvorschlag {time} · Enter speichert den START',
  'karaoke.maker.captureFixEnd':
    'Zeile aufgenommen · Enter korrigiert das ENDE',
  'karaoke.maker.captureStartPoint': 'START',
  'karaoke.maker.captureEndPoint': 'ENDE',
  'karaoke.maker.captureGuideTitle': 'Zeilen-Timing',
  'karaoke.maker.captureSetupTitle': 'Bereit, das Liedtext-Timing aufzunehmen?',
  'karaoke.maker.captureSetupBody':
    'Höre auf den Gesang. Drücke am Zeilenanfang Enter, optional bei jedem neuen Wort Tab und am Zeilenende erneut Enter. So behält ein langes letztes Wort seine volle Dauer.',
  'karaoke.maker.captureSetupStatus':
    'Lies die Anleitung in der Live-Vorschau und starte dann die Aufnahme.',
  'karaoke.maker.captureStartRecording': 'Aufnahme starten',
  'karaoke.maker.captureMoveGuide':
    'Zum Verschieben ziehen. Doppelklicken, um die Position zurückzusetzen.',
  'karaoke.maker.selectionPanel': 'Auswahlwerkzeuge',
  'karaoke.maker.selectionMoveGuide':
    'Werkzeuge zum Verschieben ziehen. Doppelklicken, um die Position zurückzusetzen.',
  'karaoke.maker.dismissSelection': 'Auswahlwerkzeuge schließen',
  'karaoke.maker.captureCountdownReady': 'Bereit für die erste Zeile',
  'karaoke.maker.captureGuideNext': 'Als Nächstes',
  'karaoke.maker.captureGuideAudio':
    'Audio um 2 Sekunden verschieben · Umschalt: 1 Sekunde',
  'karaoke.maker.captureGuideLyrics': 'Liedtextzeile auswählen',
  'karaoke.maker.captureGuidePlayback': 'abspielen oder pausieren',
  'karaoke.maker.captureGuideWords': 'nächstes Wort markieren',
  'karaoke.maker.captureGuideUndo': 'letzte Markierung rückgängig',
  'karaoke.maker.stopRecording': 'Aufnahme beenden',
  'karaoke.maker.markWord': 'Wort markieren',
  'karaoke.maker.markNextWord': 'Nächstes Wort',
  'karaoke.maker.done': 'Fertig',
  'karaoke.maker.ignoreLine': 'Zeile ignorieren',
  'karaoke.maker.lineTimingComplete':
    'Zeilensynchronisierung abgeschlossen. Bereit zum Prüfen und Abspielen.',
  'karaoke.maker.recordLinesHint':
    'ENTER markiert Start/Ende · ↑/↓ wählt die Zeile · ←/→ verschiebt nur das Audio um 2 s · LEERTASTE spielt oder pausiert · Rücktaste macht rückgängig',
  'karaoke.maker.panView': 'Hand · Zeitleiste verschieben',
  'karaoke.maker.panHint':
    'Handwerkzeug: Ziehen Sie auf der Fläche, um ohne Bearbeitung durch den Song zu navigieren.',
  'karaoke.maker.scrubHint':
    'Klicken oder ziehen Sie den Abspielkopf, um durch den Song zu navigieren.',
  'karaoke.maker.addNote': 'Note',
  'karaoke.maker.selectNotes': 'Noten auswählen',
  'karaoke.maker.paintNotes': 'Noten zeichnen',
  'karaoke.maker.selectNotesHint':
    'Ziehe einen Rahmen um Noten. Ziehe eine ausgewählte Note, um die Gruppe zu bewegen. Halte Strg und ziehe sie auf ein Wort oder eine Silbe, um sie zu verknüpfen.',
  'karaoke.maker.paintNotesHint':
    'Ziehe über das Tonhöhenraster, um eine Note zu zeichnen. Das Werkzeug bleibt für weitere Noten aktiv.',
  'karaoke.maker.notesSelected': 'Noten ausgewählt',
  'karaoke.maker.copyNotes': 'Ausgewählte Noten kopieren',
  'karaoke.maker.pasteNotes': 'Noten am Abspielkopf einfügen',
  'karaoke.maker.notePasted': 'Note am Abspielkopf eingefügt.',
  'karaoke.maker.notesPasted': '{count} Noten am Abspielkopf eingefügt.',
  'karaoke.maker.attachNotesByTime': 'Mit Liedtext verknüpfen',
  'karaoke.maker.detachNotes': 'Vom Liedtext lösen',
  'karaoke.maker.noteAttachHelp':
    'Halte Strg und ziehe eine Note auf ein Wort oder eine Silbe. Verknüpfte Noten folgen dem Liedtext und sind gesperrt.',
  'karaoke.maker.noteCopyHelp':
    'Strg+C kopiert die Auswahl · Strg+V fügt die erste Note am Abspielkopf ein.',
  'karaoke.maker.attachedTo': 'Mit „{word}“ verknüpft',
  'karaoke.maker.noteUnattached': 'Nicht mit Liedtext verknüpft',
  'karaoke.maker.splitWordSyllables': 'Wort in Silben teilen',
  'karaoke.maker.syllableEditorEyebrow': 'Silbeneditor',
  'karaoke.maker.syllableEditorTitle': '„{word}“ teilen',
  'karaoke.maker.syllableEditorHint':
    'Zwischen Buchstaben klicken, um eine Silbengrenze zu setzen oder zu entfernen.',
  'karaoke.maker.syllableSplitPoint': 'Trennung nach „{text}“ umschalten',
  'karaoke.maker.syllableEditorPreview': 'Ergebnis-Silben',
  'karaoke.maker.applySyllableSplit': 'Silbentrennung anwenden',
  'karaoke.maker.hearNote': 'Note anhören',
  'karaoke.maker.split': 'Teilen',
  'karaoke.maker.delete': 'Löschen',
  'karaoke.maker.analyze': 'Melodie analysieren',
  'karaoke.maker.prepare': 'Karaoke vorbereiten',
  'karaoke.maker.advanced': 'Erweitert',
  'karaoke.maker.prepared':
    'Dieses Karaoke enthält bereits synchronisierte Melodienoten.',
  'karaoke.maker.repairLyrics': 'Liedtext-Timing neu erkennen',
  'karaoke.maker.repairMelody': 'Melodienoten neu erkennen',
  'karaoke.maker.rebuildKaraoke': 'Liedtext + Melodie neu erstellen',
  'karaoke.maker.autoAlign': 'Automatisch ausrichten',
  'karaoke.maker.aiMelody': 'KI-Melodie',
  'karaoke.maker.transcribe': 'Transkribieren',
  'karaoke.maker.vocalStem': 'Gesangsspur verwenden',
  'karaoke.maker.vocalStemLoaded': 'Gesangsspur geladen',
  'karaoke.maker.groupVoice': 'Stimme und Musik',
  'karaoke.maker.stemsTitle': 'Getrennte Spuren',
  'karaoke.maker.stemBacking': 'Playback',
  'karaoke.maker.stemSaveAs': '{name} speichern als',
  'karaoke.maker.stemSaveFormat': '{name} als {format} speichern',
  'karaoke.maker.stemMp3Encoding': 'MP3 wird codiert…',
  'karaoke.maker.stemMp3Saved': 'MP3 gespeichert.',
  'karaoke.maker.stemMp3Failed': 'Die MP3 konnte nicht codiert werden.',
  'karaoke.maker.stemVoice': 'Stimme',
  'karaoke.maker.stemSave': 'Speichern',
  'karaoke.maker.groupLyrics': 'Text und Timing',
  'karaoke.maker.removeBackground': 'Stimme von Musik trennen',
  'karaoke.maker.removeBackgroundDone': 'Stimme bereits getrennt',
  'karaoke.maker.separationDownloading':
    'Trennmodell wird geladen ({percent}%) · einmalig, etwa 700 MB',
  'karaoke.maker.separationReading': 'Song wird gelesen',
  'karaoke.maker.separating': 'Stimme wird von der Musik getrennt',
  'karaoke.maker.separationDone':
    'Stimme getrennt. Die Texterkennung ist bereit.',
  'karaoke.maker.separationSlow':
    'Keine Grafikbeschleunigung auf diesem Rechner – das dauert einige Minuten statt unter einer.',
  'karaoke.maker.separationRequired':
    'Trenne zuerst die Stimme – die Texterkennung liest die isolierte Gesangsspur.',
  'karaoke.maker.separationRequiredMelody':
    'Trenne zuerst die Stimme – die Notenerkennung folgt einer einzigen Stimme, und in einem Mix ist das meist ein Instrument.',
  'karaoke.maker.wizardTitle': 'Diesen Song automatisch einrichten',
  'karaoke.maker.wizardIntro':
    'Dieser Song hat noch kein Texttiming. FluidEQ kann die Stimme von der Musik trennen und daraus die Wörter und ihr Timing lesen. Alles läuft auf diesem Computer.',
  'karaoke.maker.wizardStepSeparate': 'Stimme trennen',
  'karaoke.maker.wizardStepTranscribe': 'Wörter und Timing lesen',
  'karaoke.maker.wizardLanguage': 'Sprache des Textes',
  'karaoke.maker.wizardLanguageAuto': 'Automatisch erkennen',
  'karaoke.maker.wizardStart': 'Automatisch einrichten',
  'karaoke.maker.wizardSkip': 'Ich mache es selbst',
  'karaoke.maker.wizardCancel': 'Stopp',
  'karaoke.maker.wizardHide': 'Im Hintergrund fortsetzen',
  'karaoke.maker.wizardCancelled': 'Gestoppt. Fertiges wurde behalten.',
  'karaoke.maker.vocalFocus': 'Mittigen Gesang fokussieren',
  'karaoke.maker.export': 'Exportieren',
  'karaoke.maker.exportProject': 'FluidEQ-Projekt',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'Erweitertes LRC',
  'karaoke.maker.exportInstrumental': 'Playback (ohne Gesang)',
  'karaoke.maker.tapHint':
    'LEERTASTE oder EINGABE für „{word}“ · Rücktaste macht rückgängig',
  'karaoke.maker.editHint':
    'Noten ziehen, um Tonhöhe/Zeit zu ändern. An Kanten ziehen zum Skalieren. Strg + Rad zoomt.',
  'karaoke.maker.stats': '{notes} Noten · {words} Wörter · {checks} Prüfungen',
  'karaoke.maker.wordStateLegend': 'Status der Liedtext-Zeitsetzung',
  'karaoke.maker.userAdjustedWords': '{count} angepasst',
  'karaoke.maker.pendingWords': '{count} ausstehend',
  'karaoke.maker.artist': 'Interpret',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Zoom',
  'karaoke.maker.songPosition': 'Position im Song',
  'karaoke.maker.previousView': 'Vorheriger Abschnitt',
  'karaoke.maker.nextView': 'Nächster Abschnitt',
  'karaoke.maker.resetZoom': 'Doppelklicken, um Liedtext einzupassen',
  'karaoke.maker.livePreview': 'Live-Vorschau',
  'karaoke.maker.showPreview': 'Vorschau anzeigen',
  'karaoke.maker.hidePreview': 'Vorschau ausblenden',
  'karaoke.maker.previewEmpty':
    'Füge zeitlich abgestimmten Liedtext hinzu, um die Vorschau zu sehen.',
  'karaoke.maker.noteNormal': 'Note',
  'karaoke.maker.noteGolden': 'Gold',
  'karaoke.maker.noteFree': 'Frei',
  'karaoke.maker.untimed': 'Ohne Zeit',
  'karaoke.maker.applyUntimed':
    '{count} Liedtextwörter haben noch kein bestätigtes Sprach-Timing. Erkennen oder platzieren Sie sie, bevor Sie dieses Karaoke im Player verwenden.',
  'karaoke.maker.selectHint':
    'Wählen Sie ein Wort oder eine Melodienote zum Prüfen.',
  'karaoke.maker.rights':
    'Ich darf dieses Audio und diesen Liedtext verwenden und exportieren.',
  'karaoke.maker.cancel': 'Abbrechen',
  'karaoke.maker.localAnalysis': 'Lokale Analyse',
  'karaoke.maker.lyricsEyebrow': 'LIEDTEXT',
  'karaoke.maker.lyricsTitle':
    'Pro Zeile eine Liedtextzeile einfügen oder bearbeiten',
  'karaoke.maker.lyricsWarning':
    'Beim Ersetzen werden Wortverknüpfungen gelöscht, damit die Wörter sicher neu getaktet werden können.',
  'karaoke.maker.lyricsReferenceHint':
    'Geben Sie den vollständigen Liedtext einschließlich Wiederholungen und Markierungen wie [Strophe] oder [Refrain] an. FluidEQ behält diesen Text und ermittelt sein Timing mit lokaler Spracherkennung.',
  'karaoke.maker.referenceLyrics': 'Referenz-Liedtext',
  'karaoke.maker.wordTiming': 'Wort-Timing',
  'karaoke.maker.lyricsWordCount': '{count} Wörter in der Vorlage',
  'karaoke.maker.lyricsTimedCount': '{timed} von {total} zeitlich zugeordnet',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Erkennen Sie den neuen Liedtext, bevor Sie das Wort-Timing bearbeiten',
  'karaoke.maker.lyricsNoTimedWords': 'Noch keine Wörter zeitlich zugeordnet',
  'karaoke.maker.lyricsTimingEditorHint':
    'Wählen Sie nach der Erkennung ein Wort aus, um Text, Startzeit oder Länge zu korrigieren.',
  'karaoke.maker.lyricsSelectWord':
    'Wählen Sie ein Wort aus, um sein Timing zu bearbeiten.',
  'karaoke.maker.lyricsSelectedWord': 'Ausgewähltes Wort',
  'karaoke.maker.lyricsWordNavigation': 'Wortnavigation',
  'karaoke.maker.previousWord': 'Vorheriges Wort',
  'karaoke.maker.nextWord': 'Nächstes Wort',
  'karaoke.maker.lyricsPlaceholder':
    'Vollständigen Liedtext hier einfügen…\n\n[Strophe]\nErste Zeile\nZweite Zeile',
  'karaoke.maker.loadLyricsFile': 'Liedtextdatei laden',
  'karaoke.maker.lyricsFileLoaded': 'Liedtext aus {file} geladen.',
  'karaoke.maker.lyricsRequired':
    'Fügen Sie den vollständigen Liedtext hinzu, bevor Timing und Melodie erkannt werden.',
  'karaoke.maker.detectTimingMelody': 'Timing und Melodie erkennen',
  'karaoke.maker.acceptLyrics': 'Liedtext übernehmen',
  'karaoke.maker.acceptAndRecordLines': 'Übernehmen und Zeiten aufnehmen',
  'karaoke.maker.continueInBackground': 'Im Hintergrund fortsetzen',
  'karaoke.maker.clearLyrics': 'Liedtext löschen',
  'karaoke.maker.clearLyricsTitle': 'Gesamten Liedtext löschen?',
  'karaoke.maker.clearLyricsBody':
    'Dadurch werden der gesamte Liedtext und sein Timing entfernt. Melodienoten bleiben erhalten, ihre Wortverknüpfungen werden jedoch gelöst. Danach kann rückgängig gemacht werden.',
  'karaoke.maker.clearNotes': 'Noten löschen',
  'karaoke.maker.clearNotesTitle': 'Alle Melodienoten löschen?',
  'karaoke.maker.clearNotesBody':
    'Dadurch werden alle Melodienoten entfernt, Liedtext und Wort-Timing bleiben erhalten. Danach kann rückgängig gemacht werden.',
  'karaoke.maker.notesCleared': 'Alle Melodienoten wurden gelöscht.',
  'karaoke.maker.lyricsCleared':
    'Der gesamte Liedtext wurde gelöscht. Vorhandene Noten blieben ohne Wortverknüpfung erhalten.',
  'karaoke.maker.restore': 'Original wiederherstellen',
  'karaoke.maker.restoreTitle': 'Das ursprüngliche Karaoke wiederherstellen?',
  'karaoke.maker.restoreBody':
    'Damit werden alle Änderungen dieser Sitzung verworfen und das Karaoke wird so aufgebaut, wie es importiert wurde — einschließlich seines gespeicherten Entwurfs. Nach dem Wiederherstellen ist Rückgängig verfügbar.',
  'karaoke.maker.restored': 'Das importierte Original wurde wiederhergestellt.',
  'karaoke.maker.replaceLyricsWarning':
    'Die Wörter wurden geändert. Beim Ersetzen werden Wort-IDs und automatisches Timing neu erstellt; vorhandene manuelle Korrekturen können nicht zuverlässig übertragen werden. Die Noten bleiben erhalten und werden neu verknüpft.',
  'karaoke.maker.replaceAndDetect': 'Ersetzen und erkennen',
  'karaoke.maker.wordText': 'Wort',
  'karaoke.maker.wordStart': 'Start (ms)',
  'karaoke.maker.wordPosition': 'Position',
  'karaoke.maker.wordDuration': 'Länge (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'Passt die gemeinsame Grenze an; das Nachbarwort gibt Zeit ab oder erhält sie, während der Zeilenbereich gleich bleibt.',
  'karaoke.maker.usePlayhead': 'Abspielposition verwenden',
  'karaoke.maker.playWord': 'Wort abspielen',
  'karaoke.maker.allowAutoTiming': 'Automatisches Timing erlauben',
  'karaoke.maker.replaceLyrics': 'Liedtext ersetzen',
  'karaoke.maker.lyricsAutoAligned':
    'Neuer Liedtext angewendet und an der verfügbaren Melodie ausgerichtet.',
  'karaoke.maker.lyricsNeedPreparation':
    'Neuer Liedtext angewendet. Wählen Sie Karaoke vorbereiten, um das Timing zu erkennen.',
  'karaoke.maker.transcriptionEyebrow': 'OPTIONALE LOKALE TRANSKRIPTION',
  'karaoke.maker.transcriptionTitle': 'Lokales Sprachmodell herunterladen?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ lädt das MIT-lizenzierte Modell {model} von Hugging Face und legt es auf diesem PC ab — einmalig, etwa 570 MB mit Grafikbeschleunigung und etwa 1,1 GB ohne sie. Dein Audio verlässt diesen Computer nie. Der erste Lauf dauert einige Minuten und braucht viel Speicher.',
  'karaoke.maker.transcriptionReview':
    'Die Erkennung ist nur ein Ausgangspunkt. FluidEQ behält beim Abgleich Ihre Schreibweise bei und alle Zeiten bleiben bearbeitbar.',
  'karaoke.maker.notNow': 'Nicht jetzt',
  'karaoke.maker.downloadTranscribe': 'Herunterladen und transkribieren',
  'karaoke.maker.downloadPrepare': 'Herunterladen und Liedtext vorbereiten',
  'karaoke.maker.downloadingWhisper': 'Whisper-Modell wird heruntergeladen',
  'karaoke.maker.downloadOverall': 'Gesamtdownload',
  'karaoke.maker.downloadFiles': '{complete} von {total} Dateien',
  'karaoke.maker.loadingWhisper': 'Whisper-Modell wird geladen',
  'karaoke.maker.analysisRunning': 'Tonhöhe wird lokal analysiert',
  'karaoke.maker.analysisAligned':
    'Unbearbeitete Wörter wurden an {count} erkannte Notenbereiche angepasst. Manuelle Zeitangaben blieben erhalten.',
  'karaoke.maker.analysisFound':
    'Die Analyse hat {count} Notenbereiche gefunden.',
  'karaoke.maker.basicPitchRunning':
    'Integriertes Basic-Pitch-Modell wird ausgeführt',
  'karaoke.maker.basicPitchFound':
    '{count} bearbeitbare Melodienoten aus der Stimme erkannt.',
  'karaoke.maker.whisperPreparing': 'Whisper wird vorbereitet',
  'karaoke.maker.whisperDecoding': 'Audio wird lokal dekodiert',
  'karaoke.maker.whisperTranscribing': 'Lokale Transkription läuft',
  'karaoke.maker.whisperTranscribingProgress':
    'Timing wird erkannt · Durchlauf {pass}/{passes} · Block {chunk}/{chunks}',
  'karaoke.maker.whisperAligning': 'Liedtext wird auf den Gesang gelegt',
  'karaoke.maker.whisperComplete': 'Transkription abgeschlossen',
  'karaoke.maker.whisperMatched':
    'Whisper hat {count} erkannte Wörter zugeordnet. Prüfen Sie vor dem Export die bearbeitbaren Zeitangaben.',
  'karaoke.maker.autoAlignComplete':
    'Unbearbeiteter Liedtext wurde an die erkannte Melodie angepasst. Manuelle Zeitangaben blieben erhalten.',
  'karaoke.maker.speechMemory': 'KI-Modellspeicher',
  'karaoke.maker.speechMemoryReady': 'Im Arbeitsspeicher bereit',
  'karaoke.maker.speechMemoryCached': 'Auf Datenträger zwischengespeichert',
  'karaoke.maker.speechMemoryMissing': 'Nicht heruntergeladen',
  'karaoke.maker.modelWhisper': 'Sprache (Whisper)',
  'karaoke.maker.modelPitch': 'Tonhöhe (RMVPE)',
  'karaoke.maker.modelSeparation': 'Trennung (RoFormer)',
  'karaoke.maker.freeMemory': 'Arbeitsspeicher jetzt freigeben',
  'karaoke.maker.memoryReleased':
    'Das Sprachmodell wurde aus dem Arbeitsspeicher entfernt. Die heruntergeladenen Dateien bleiben zwischengespeichert.',
  'karaoke.maker.memoryReleaseBusy':
    'Das Sprachmodell ist beschäftigt und kann noch nicht freigegeben werden.',
  'karaoke.maker.memoryAfterUse': 'Wenn es inaktiv ist',
  'karaoke.maker.memoryPolicy.ask': 'Nachfragen',
  'karaoke.maker.memoryPolicy.auto': 'Automatisch freigeben',
  'karaoke.maker.memoryPolicy.keep': 'Geladen lassen',
  'karaoke.maker.memoryAfter': 'Nach',
  'karaoke.maker.memoryMinutes': '{count} Min.',
  'karaoke.maker.memoryPromptTitle': 'Speicher des Sprachmodells freigeben?',
  'karaoke.maker.memoryPromptBody':
    'Das lokale Sprachmodell ist inaktiv. Das Freigeben spart Arbeitsspeicher; seine Dateien bleiben für ein schnelleres Neuladen zwischengespeichert.',
  'karaoke.maker.keepLoaded': 'Geladen lassen',
  'karaoke.maker.exported': '{file} wurde exportiert',
  'karaoke.maker.exportedPartialLrc':
    '{file} wurde exportiert, ohne {lines} Liedtextzeilen: LRC braucht ein Timing auf der Zeile oder auf einem ihrer Wörter, und diese haben beides nicht. Timen Sie sie im Maker und exportieren Sie erneut für eine vollständige Datei.',
  'karaoke.maker.exportedPartialUltraStar':
    '{file} wurde exportiert, ohne {words} Liedtextwörter: UltraStar übernimmt ein Wort nur dort, wo die Melodie eine Note hat, und diese haben keine. Erkennen oder zeichnen Sie ihre Noten und exportieren Sie erneut für eine vollständige Datei.',
  'karaoke.maker.exportFallback': 'Karaoke-Datei',
  'karaoke.maker.projectTooLarge': 'Das Projekt ist größer als 16 MB.',
  'karaoke.maker.previewResize': 'Live-Vorschau skalieren',
  'karaoke.maker.seekBack': '{seconds} Sekunden zurück',
  'karaoke.maker.seekForward': '{seconds} Sekunden vor',
  'karaoke.maker.jumpToStart': 'Zum Songanfang springen',
  'karaoke.maker.jumpToEnd': 'Zum Songende springen',
  'karaoke.maker.errorAudioLimits':
    'Die lokale Analyse unterstützt Audiodateien bis 1 GB und Aufnahmen unter 30 Minuten.',
  'karaoke.maker.errorComponentUnavailable':
    'Eine erforderliche Komponente für die lokale Analyse ist nicht verfügbar. Starten Sie FluidEQ neu und versuchen Sie es erneut.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ konnte dieses Audio nicht lokal analysieren.',
  'karaoke.maker.errorExportNeedsNotes':
    'Für den UltraStar-Export ist mindestens eine Melodienote erforderlich.',
  'karaoke.maker.errorExport':
    'FluidEQ konnte dieses Karaoke nicht exportieren.',
  'karaoke.maker.errorProjectVersion':
    'Dieses Projekt wurde mit einer nicht unterstützten FluidEQ-Version erstellt.',
  'karaoke.maker.errorImport':
    'FluidEQ konnte dieses Karaoke oder Projekt nicht importieren.',
  'karaoke.maker.errorParse':
    'Die ausgewählte Liedtext- oder Karaoke-Datei konnte nicht gelesen werden.',
  'karaoke.maker.downloadFailed': 'Download des Whisper-Modells fehlgeschlagen',
  'karaoke.maker.localAnalysisFailed': 'Lokale Analyse fehlgeschlagen',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ konnte das Modell nicht von Hugging Face herunterladen. Prüfen Sie Verbindung oder Firewall und versuchen Sie es erneut.',
  'karaoke.maker.tryAgain': 'Erneut versuchen',
  'karaoke.maker.dismiss': 'Fehler schließen',
  'karaoke.maker.analysisSource':
    '„{file}“ wird nur als lokale Analysequelle verwendet.',
  'karaoke.maker.rightsRequired':
    'Bestätigen Sie vor dem Veröffentlichen die Rechte an Audio und Liedtext.',
  'karaoke.maker.draftRestored': 'Entwurf wiederhergestellt',
  'karaoke.maker.playerTimingLoaded':
    'Die aktuelle Player-Zeitsetzung wird verwendet. Rückgängig stellt den gespeicherten Entwurf wieder her.',
};

export default karaoke;
