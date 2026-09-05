/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.share.title': 'Audio zwischen Computern teilen',
  'help.share.intro':
    'Audio teilen überträgt Systemklang zwischen Computern im selben privaten Netzwerk. Der Empfänger hat Kopfhörer oder Lautsprecher; andere Computer senden. Das ist etwas anderes als ein zweiter Ausgang am selben Computer.',
  'help.share.steps':
    'Öffne am Hörcomputer Audio teilen, wähle Wiedergabe auf diesem Computer und erstelle einen Code. Beginne leise.\nWähle an jeder Quelle Senden von diesem Computer, füge den Empfängercode ein und verbinde. Lasse FluidEQ auf beiden Geräten geöffnet.\nPrüfe den Monitor und beende Senden oder Empfangen nach Gebrauch. Bei Fehlern prüfe gemeinsames privates Netzwerk und Firewallfreigabe.',
  'help.share.tip':
    'Der Code erlaubt die Kopplung: halte ihn privat. Mehrere Sender werden gemischt und können den Pegel erhöhen. Empfangenes Audio umgeht das Bibliotheks-DSP-Rack.',
  'help.menu': 'Hilfe',
  'help.title': 'Benutzerhandbuch',
  'help.subtitle': 'Finde deinen Klang. Fühl dich zu Hause.',
  'help.intro':
    'Eine praktische Anleitung für FluidEQ mit echten Bildschirmaufnahmen. Beginne mit dem ersten Hörtest und erkunde jeden Arbeitsbereich in deinem Tempo.',
  'help.offline': 'Offline verfügbar',
  'help.search': 'Handbuch durchsuchen',
  'help.searchHint': 'Zum Beispiel Profile, Bass, Liedtext…',
  'help.contents': 'In diesem Handbuch',
  'help.results': '{count} Kapitel',
  'help.empty':
    'Keine Kapitel gefunden. Versuche einen kürzeren Ausdruck oder lösche die Suche.',
  'help.clear': 'Suche löschen',
  'help.close': 'Handbuch schließen',
  'help.enlarge': 'Bildschirmaufnahme vergrößern: {title}',
  'help.closeImage': 'Bildschirmaufnahme schließen',
  'help.captureNote':
    'Echte Aufnahmen aus FluidEQ 1.6.x. Farben, Bezeichnungen und Positionen können in deiner Version abweichen. Die Einstellungen sind Beispiele, keine empfohlenen Presets.',
  'help.steps': 'Ausprobieren',
  'help.tip': 'Gut zu wissen',
  'help.back': 'Nach oben',
  'help.start.title': 'Deine ersten fünf Minuten',
  'help.start.intro':
    'Beginne mit einem vertrauten Lied bei angenehmer Lautstärke. Links stehen System-EQ und Aussteuerungsreserve, in der Mitte der Arbeitsbereich, rechts Ausgang und Profile. Die Wiedergabesteuerung bleibt unten.',
  'help.start.steps':
    'Installiere unter Windows Equalizer APO, wenn es angeboten wird. Markiere dein Gerät in dessen Geräteauswahl und starte neu, wenn verlangt.\nWähle dasselbe Ausgabegerät. Aktiviere System-EQ und lasse die automatische Normalisierung eingeschaltet.\nSpiele ein Lied, öffne EQ → Bänder, ändere etwas leicht und vergleiche mit ein- und ausgeschaltetem System-EQ.',
  'help.start.tip':
    'Systemweiter EQ erfordert Windows und Equalizer APO. macOS und Linux verwenden Demonstrationsausgänge; ein bewegtes Diagramm beweist keine systemweite Verarbeitung.',
  'help.eq.title': 'Forme deinen Klang mit EQ',
  'help.eq.intro':
    'Frequenz bestimmt den Wirkungsbereich, Gain die Anhebung oder Absenkung und Q die Breite: höheres Q bedeutet schmaler. Bass gibt Körper, Mitten tragen Stimmen und Höhen sorgen für Brillanz.',
  'help.eq.steps':
    'Wähle ein Band in EQ → Bänder. Stelle Frequenz, Gain und Q ein oder ziehe seinen Punkt im Diagramm.\nBeginne mit einem breiten, sanften Band. Vergleiche vor dem nächsten; die Filterauswahl ändert die Form.\nVergleiche Kopfhörer, EQ, Voicing und Smart EQ mit ihren Schaltern und Stärken. Lasse bei Anhebungen die Normalisierung aktiv.',
  'help.eq.tip':
    'Die Kurve zeigt Filter, das bewegte Spektrum das gemessene Signal. Smart EQ benötigt hörbares Material. Detail, Balance und Target korrigieren unterschiedlich; vergleiche jeweils einen Modus.',
  'help.headphones.title': 'Kopfhörerkorrektur und Import',
  'help.headphones.intro':
    'Eine Korrektur gleicht ein gemessenes Modell aus und ergänzt eigene Bänder. Prüfe genaue Modellbezeichnung und Urheber der Messung.',
  'help.headphones.steps':
    'Öffne EQ → EQ-Presets, suche deinen Kopfhörer und wähle die passende Messung.\nFür Text anderer Programme verwende EQ-Einstellungen importieren in den Audioaktionen. Prüfe Bänder und Kurve.\nExportiere in Squiglink den EQ-Text, füge ihn im Importfeld ein und wende ihn nach Prüfung der Vorschau an.',
  'help.headphones.tip':
    'Eine nicht angewendete Vorschau verändert keinen Ton. Vermeide versehentlich zwei vollständige Korrekturen für denselben Kopfhörer.',
  'help.convolution.title': 'Eine Impulsantwort verwenden',
  'help.convolution.intro':
    'Faltung wendet einen WAV-Impuls als eigene Ebene an. Durchsuche AutoEq oder importiere eine WAV; parametrische Bänder bleiben unabhängig.',
  'help.convolution.steps':
    'Öffne EQ → Faltung und suche nach Modell oder Messautor.\nPrüfe Quelle und Abtastrate, dann Herunterladen und anwenden oder WAV importieren.\nVergleiche die Ebene ein- und ausgeschaltet und passe ihre Stärke an.',
  'help.convolution.tip':
    'Für Equalizer APO muss die Abtastrate des Impulses zum Ausgang passen. Katalogdownloads benötigen Internet; dieses Handbuch nicht.',
  'help.profiles.title': 'Geräte, Profile und zweiter Ausgang',
  'help.profiles.intro':
    'EQ folgt deinem Ausgang. Die automatische Zuordnung speichert Änderungen am aktuellen Gerät; benannte Profile halten Alternativen fest. Zweiter Ausgang spiegelt Audio mit eigenem Pegel pro Gerät.',
  'help.profiles.steps':
    'Prüfe vor Änderungen den Ausgang. Neues Profil hält einen Klang fest; Aktualisieren speichert Änderungen und Wiederherstellen lädt gespeicherte Werte.\nÖffne Zweiter Ausgang, aktiviere ein erreichbares Gerät und stelle seinen Pegel ein. Aktuelle Versionen bieten darunter dessen EQ-Profil an.\nSpiel/Video verwendet weniger Anfangspuffer, Musik mehr Reserve. Prüfe die tatsächliche Synchronität.',
  'help.profiles.tip':
    'Jeder gespiegelte Windows-Ausgang verwendet sein eigenes APO-Profil. FluidEQ muss geöffnet bleiben; ein Wechsel des Hauptausgangs beendet alte Spiegelungen. Auch Gerätelatenz zählt.',
  'help.config.title': 'Eine Kette prüfen und sichern',
  'help.config.intro':
    'EQ → Config zeigt die tatsächlichen Dateien von Equalizer APO. Ausgangskarten und Include-Baum zeigen Geräte und Ebenen. Exportiere vor größeren Experimenten.',
  'help.config.steps':
    'Öffne EQ → Config, wähle den Ausgang und prüfe Status und Ebenen.\nSpeichere mit Kette exportieren eine .fluideq-Datei.\nWähle zum Wiederherstellen zuerst den richtigen Ausgang, importiere die Kette und prüfe das Ergebnis.',
  'help.config.tip':
    'Generierte Dateien werden bei Änderungen überschrieben. Dauerhafte eigene APO-Befehle gehören in die benutzerdefinierte Ausgangsdatei, die FluidEQ unverändert lässt.',
  'help.online.title': 'Mit Online-Medien hören',
  'help.online.intro':
    'Online-Medien hält unterstützte Seiten neben dem EQ. Wiedergabe und Anmeldung hängen von Anbieter und Verbindung ab. Die untere Steuerung folgt dem aktiven Player.',
  'help.online.steps':
    'Öffne Online-Medien, wähle eine Seite und starte dort die Wiedergabe.\nWechsle zum EQ für Anpassungen beim Hören und zurück für seiteneigene Bedienelemente.\nAktiviere Nur ein Player gleichzeitig, um überlappende Wiedergabe zu vermeiden.',
  'help.online.tip':
    'Das DSP-Rack verarbeitet Audiotitel der Bibliothek, keine Online-Medien. Unter Windows kann System-EQ weiterhin auf den APO-Ausgang wirken.',
  'help.library.title': 'Deine lokale Bibliothek aufbauen',
  'help.library.intro':
    'Die Bibliothek sammelt Musik und Videos deiner Laufwerke nach Alben, Künstlern, Titeln, Ordnern oder Videos. Cover und Metadaten stammen aus den Dateien.',
  'help.library.steps':
    'Öffne Bibliothek und füge den Medienordner hinzu. Warte die Indizierung ab.\nWähle Künstler oder Album oder suche einen Titel und spiele ihn ab.\nNutze unten Pause, Suche, Titelsprung und Lautstärke in jedem Tab.',
  'help.library.tip':
    'Die Originaldateien müssen erreichbar bleiben. Verbinde entfernte Laufwerke erneut oder füge den neuen Speicherort verschobener Ordner hinzu.',
  'help.queue.title': 'Alben und Wiedergabewarteschlange',
  'help.queue.intro':
    'Die Warteschlange bestimmt die Hörreihenfolge. Ein anderes Album zu öffnen ersetzt nicht den aktuellen Titel. Aktiver Titel und Als Nächstes zeigen deinen Platz.',
  'help.queue.steps':
    'Öffne ein Album und starte den gewünschten Titel.\nWähle im Titelmenü als Nächstes abspielen oder zur Warteschlange hinzufügen.\nPrüfe Als Nächstes und verwende Zufall oder Wiederholung nach Wunsch.',
  'help.queue.tip':
    'Der Start der Bibliothek übernimmt von anderen FluidEQ-Playern. Die Wiedergabesteuerung nennt aktuellen Titel und Quelle.',
  'help.dsp.title': 'Das DSP-Rack erkunden',
  'help.dsp.intro':
    'DSP verarbeitet nur Audiotitel der Bibliothek. Karaoke, Videos, empfangenes geteiltes Audio und andere Apps umgehen das Rack. Es enthält Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension, Maximizer und Master.',
  'help.dsp.steps':
    'Spiele Bibliotheksaudio ab, öffne DSP und aktiviere das Rack. Beginne mit einem Preset oder einer Stufe.\nÄndere einen Regler und vergleiche bei ähnlicher Lautstärke mit deaktivierter Stufe.\nBeobachte Ausgangspegel und speichere das Rack. Export und Import tauschen vollständige Racks aus.',
  'help.dsp.tip':
    'DSP-Equaliser und System-EQ sind getrennte Stufen und können unter Windows beide wirken. Vergleiche bei ähnlicher Lautstärke, um Klang statt Lautheit zu beurteilen.',
  'help.denoise.title': 'Entrauschen und Quellenanalyse',
  'help.denoise.intro':
    'Denoise reduziert Rauschen im Bibliotheksaudio. Das Diagramm hilft bei der Beurteilung. Zu starke Reduktion kann Details abschwächen oder Pumpen verursachen.',
  'help.denoise.steps':
    'Spiele einen verrauschten Bibliothekstitel und wähle Denoise in DSP.\nAktiviere eine leichte Reduktion und höre leise Stellen und Details an.\nErhöhe schrittweise und vergleiche mit deaktivierter Stufe.',
  'help.denoise.tip':
    'Das bereinigt weder Mikrofon noch Online-Medien. Ohne hörbaren Effekt prüfe Bibliotheksaudio als Quelle sowie eingeschaltetes Rack und Stufe.',
  'help.visuals.title': 'Den Player gestalten',
  'help.visuals.intro':
    'Kurve, Spektrum und Pegelmesser zeigen unterschiedliche Aspekte. Formen, Paletten und Spitzen der Visualisierung ändern das Aussehen ohne EQ-Änderung.',
  'help.visuals.steps':
    'Aktiviere links das Frequenzgangdiagramm und wähle unter Ansicht seine Größe.\nWähle eine Form und öffne Neuer Look für Farbe, Füllung, Leuchten, Abstände und Spitzen. Speichere einen Namen.\nWähle in Audioaktionen Thema oder Sprache. Strg + Plus, Minus oder 0 vergrößert, verkleinert oder setzt den Zoom zurück.',
  'help.visuals.tip':
    'Ein bewegtes Spektrum beweist nicht, dass EQ das Gerät erreicht. Vergleiche hörbar und prüfe den Ausgangsstatus.',
  'help.karaoke.title': 'Mit Karaoke singen',
  'help.karaoke.intro':
    'Karaoke verbindet eigenes Audio und Liedtexte. Zeitmarkierte Texte folgen der Wiedergabe; Zieltonhöhen erfordern Notendaten. Ein eingerichtetes Mikrofon ergänzt deine Live-Tonhöhe.',
  'help.karaoke.steps':
    'Öffne Karaoke und füge Dateien oder Ordner mit passendem Audio und Text hinzu.\nWähle ein Lied, starte es und prüfe die Zuordnung.\nRichte das Mikrofon ein, passe die Textgröße an und nutze den Vollbildknopf der Bühne.',
  'help.karaoke.tip':
    'Eine reine Textdatei enthält keine Zielnoten. Fehlende Ziele beweisen keinen Mikrofondefekt.',
  'help.maker.title': 'Im Karaoke Maker erstellen',
  'help.maker.intro':
    'Maker macht Audio zu einem bearbeitbaren Projekt mit Texten und Noten auf der Zeitleiste. Prüfe automatisch erzeugte Wörter und Zeiten immer nach.',
  'help.maker.steps':
    'Öffne Erstellen in Karaoke und lade Audio. Wähle benötigte Trennungs- oder Transkriptionswerkzeuge.\nBeobachte den Fortschritt; beim ersten KI-Einsatz können Modelle geladen werden. Prüfe Texte und Noten.\nHöre kurze Stellen, korrigiere Zeiten und Text, speichere das Projekt und exportiere die Dateien.',
  'help.maker.tip':
    'Modelle benötigen Verbindung und Speicherplatz. Die Dauer hängt von Hardware und Liedlänge ab. Verwende zulässiges Audio und prüfe vor dem Teilen.',
  'help.trouble.title': 'Wenn etwas falsch klingt',
  'help.trouble.intro':
    'Beginne bei Quelle und Ausgang und isoliere dann Ebenen. Ein Diagramm oder Schalter beweist nicht den Audioweg. Hilfe führt zu Audioreparatur und Problemberichten.',
  'help.trouble.steps':
    'Kein Ton: prüfe Wiedergabe, Ausgang, Lautstärke und Verbindung. Nur ein Player gleichzeitig könnte eine andere Quelle pausiert haben.\nKeine EQ-Wirkung: prüfe System-EQ und Gerät in Equalizer APO. Nutze Audioprobleme beheben; Neustarts unterbrechen den Ton.\nVerzerrung oder zu viel Bass: lasse Normalisierung an, reduziere Anhebungen und schalte Ebenen einzeln aus. Falls es bleibt, prüfe den Bericht vor dem Senden.',
  'help.trouble.tip':
    'F1 öffnet das Handbuch. Escape schließt zuerst die große Aufnahme, dann das Handbuch. Strg + 0 setzt Zoom zurück. Teste DSP mit einem Audiotitel der Bibliothek.',
};

export default help;
