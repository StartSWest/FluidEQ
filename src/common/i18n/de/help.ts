/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Hilfe',
  'help.title': 'Benutzerhandbuch',
  'help.subtitle': 'Finde deinen Klang. Fühl dich zu Hause.',
  'help.intro':
    'Eine praktische Anleitung für FluidEQ mit echten Bildschirmaufnahmen. Beginne mit deiner ersten Hörsitzung und erkunde dann jeden Teil der App in deinem Tempo.',
  'help.offline': 'Offline verfügbar',
  'help.search': 'Handbuch durchsuchen',
  'help.searchHint': 'Zum Beispiel Engine, Bass, Visualizer…',
  'help.contents': 'In diesem Handbuch',
  'help.results': '{count} Kapitel',
  'help.empty':
    'Keine Kapitel gefunden. Versuche einen kürzeren Ausdruck oder lösche die Suche.',
  'help.clear': 'Suche löschen',
  'help.close': 'Handbuch schließen',
  'help.enlarge': 'Bildschirmaufnahme vergrößern: {title}',
  'help.closeImage': 'Bildschirmaufnahme schließen',
  'help.controlsOf': 'Was jedes Bedienelement tut: {title}',
  'help.captureNote':
    'Echte Aufnahmen aus FluidEQ 1.6 und 1.7. Farben, Bezeichnungen und Positionen von Bedienelementen können in deiner Version abweichen. Die Einstellungen sind Beispiele, keine empfohlenen Presets.',
  'help.steps': 'Ausprobieren',
  'help.tip': 'Gut zu wissen',
  'help.back': 'Nach oben',

  'help.group.start': 'Erste Schritte',
  'help.group.sound': 'Deinen Klang formen',
  'help.group.visuals': 'Deine Musik sehen',
  'help.group.plus': 'FluidEQ Plus',
  'help.group.listen': 'Hören, singen und teilen',
  'help.group.help': 'Wenn du Hilfe brauchst',

  'help.start.title': 'Deine ersten fünf Minuten',
  'help.start.intro':
    'Beginne mit einem vertrauten Lied bei angenehmer Lautstärke. Die linke Leiste schaltet FluidEQ ein und enthält die Vorverstärkung; die Mitte ist dein Arbeitsbereich; die rechte Leiste folgt deinem Ausgang und seinen Profilen. Die Leiste am unteren Fensterrand steuert, was gerade läuft.',
  'help.start.steps':
    'Installiere FluidEQ und lass die FluidEQ-Engine ausgewählt, wenn die Installation fragt, wie FluidEQ deinen Ton verarbeiten soll. Windows fragt einmal um Erlaubnis, ohne Neustart.\nWähle unter Ausgabegerät das Gerät, über das du hörst. Aktiviere System-EQ und lass Automatisch normalisieren eingeschaltet.\nSpiele ein Lied, öffne EQ → Bänder, ändere etwas leicht und vergleiche mit ein- und ausgeschaltetem System-EQ.',
  'help.start.tip':
    'Systemweiter EQ braucht Windows und eine Audio-Engine: die FluidEQ-Engine oder Equalizer APO. Unter macOS und Linux zeigt die App Demonstrationsausgänge, ein bewegtes Diagramm ist dort also kein Beweis, dass etwas verarbeitet wird.',

  'help.window.title': 'Rund ums Fenster',
  'help.window.intro':
    'Über die Kopfzeile wechselst du zwischen den Seiten von FluidEQ, und sie zeigt den Klang in Echtzeit. Die linke Leiste enthält den Schalter für den ganzen EQ, die Vorverstärkung und die Pegelanzeige; die rechte Leiste folgt deinem Ausgang und seinen Profilen.',
  'help.window.steps':
    'Drücke in der Kopfzeile auf eine Seite: Online-Medien, Audio teilen und EQ vor dem Signal, DSP, Bibliothek, Karaoke und Plus danach.\nSchalte in der linken Leiste System-EQ ein und lass Automatisch normalisieren eingeschaltet, damit keine Anhebung übersteuern kann.\nDrücke auf das Signal oder die Pegelanzeige, um zu ändern, wie sie gezeichnet werden, und auf Regenbogenmodus, damit sich Kurven und Pegelanzeigen mit der vollen Bildwiederholrate deines Bildschirms bewegen.',
  'help.window.tip':
    'Hilfe öffnet dieses Handbuch, Neuerungen, die Audioreparatur und Problem melden. Hinter dem Puls-Knopf daneben findest du die Karte der Engine, den Import von EQ-Einstellungen oder einer Impulsantwort, den Neustart von Windows-Audio und Prozesse, wo du siehst, was jeder Teil von FluidEQ gerade nutzt.',
  'help.window.headerLeftCaption': 'Die Kopfzeile bis zum Signal',
  'help.window.headerRightCaption': 'Die Kopfzeile nach dem Signal',
  'help.window.railCaption': 'Die linke Leiste',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch und Suno, in FluidEQ abgespielt und von deinem EQ geformt.',
  'help.window.share':
    'Sendet den Klang dieses Computers an einen anderen oder spielt den eines anderen hier ab.',
  'help.window.eq':
    'Deine Bänder, Presets, Kopfhörerkorrektur, Spielprofile und die Config der Engine.',
  'help.window.waveName': 'Audiosignal',
  'help.window.wave':
    'Was gerade läuft, in Echtzeit. Drücke darauf, um zu ändern, wie es gezeichnet wird.',
  'help.window.rainbow':
    'Färbt das Fenster und zeichnet Kurven und Pegelanzeigen mit der vollen Bildwiederholrate deines Bildschirms.',
  'help.window.dsp':
    'Das Effekt-Rack: Voreinstellungen, der Raum und jede Stufe der Kette.',
  'help.window.library': 'Deine Musikdateien, Alben und die Warteschlange.',
  'help.window.karaoke':
    'Sing mit und mach aus deinen eigenen Liedern Karaoke.',
  'help.window.plus': 'Visualizer, die Galerie, die Rangliste und das Studio.',
  'help.window.support':
    'Möglichkeiten, die Arbeit an FluidEQ zu unterstützen.',
  'help.window.help':
    'Dieses Handbuch, Neuerungen, die Audioreparatur und Problem melden.',
  'help.window.actions':
    'Die Engine, der Import von EQ-Einstellungen, der Neustart von Windows-Audio und Prozesse.',
  'help.window.systemEq':
    'Schaltet die Verarbeitung von FluidEQ für alles, was der PC abspielt, ein oder aus.',
  'help.window.preamp':
    'Senkt den Pegel vor dem EQ, damit Anhebungen Spielraum haben. Automatisch normalisieren stellt die Vorverstärkung für dich ein.',
  'help.window.autoNormalize':
    'Hält die Vorverstärkung gerade so niedrig, dass nichts, was du anhebst, übersteuern kann.',
  'help.window.responseGraph':
    'Blendet das Diagramm unter der Seite ein oder aus.',
  'help.window.meterName': 'Pegelanzeige',
  'help.window.meter':
    'Der Ausgangspegel, links und rechts, in echten Dezibel. Drücke darauf, um den Stil der Anzeige zu ändern.',

  'help.requirements.title': 'Was Ihr PC braucht',
  'help.requirements.intro':
    'FluidEQ läuft auf jedem Windows-PC der letzten zehn Jahre. Zwei Teile verlangen mehr als der Rest: die Plus-Visualizer zeichnen auf der Grafikkarte, und die Karaoke-KI lädt ihre Modelle beim ersten Mal herunter.',
  'help.requirements.steps':
    'Prüfen Sie Ihr Windows: Windows 10 Version 1803 oder neuer oder Windows 11, 64 Bit, 4 GB Arbeitsspeicher und rund 600 MB Festplatte. Damit alles verarbeitet wird, was der PC abspielt, braucht es die FluidEQ-Engine oder Equalizer APO; Windows fragt einmal nach der Erlaubnis, während sie installiert wird.\nÖffnen Sie einen Visualizer: jede Grafikkarte oder integrierte Grafik ab 2013. Bei 1080p genügt die integrierte Grafik; für 4K oder einen Desktop-Hintergrund auf mehreren Bildschirmen zugleich ist eine eigene Karte besser. Ist die Karte ausgelastet, zeichnet FluidEQ die Szene kleiner und gibt die Szenen frei, die Sie nicht sehen.\nProbieren Sie das Karaoke mit KI: Das Trennen der Stimme lädt beim ersten Mal ein Modell von 713 MB, das Tonhöhenmodell kommt mit etwa 180 MB dazu und die Rauschentfernung mit 11 MB. Mit einer Grafikkarte mit DirectX 12 ist ein vierminütiges Lied in etwa einer halben Minute getrennt; allein mit dem Prozessor dauert es rund vier Minuten. Halten Sie währenddessen 2 GB Arbeitsspeicher frei.\nStreben Sie das an, wenn es geht: Windows 11, 8 GB Arbeitsspeicher, Grafik ab 2018 und 3 GB freier Speicher, wenn Sie die KI-Funktionen nutzen.',
  'help.requirements.tip':
    'Alles außer den KI-Modellen steckt im Installationsprogramm, und die Modelle laden erst beim ersten Einsatz der Funktion. Prozesse im Aktionsmenü zeigt, was jeder Teil von FluidEQ auf Ihrem Rechner gerade benutzt.',

  'help.engine.title': 'Die FluidEQ-Engine',
  'help.engine.intro':
    'FluidEQ verarbeitet deinen Ton mit seiner eigenen Engine oder mit Equalizer APO. Die FluidEQ-Engine läuft im Audiodienst von Windows nach den Effekten deiner Soundkarte, wendet deinen EQ und das DSP-Rack auf alles an, was der PC abspielt, und zieht sich zurück, sobald FluidEQ geschlossen wird.',
  'help.engine.steps':
    'Öffne das Aktionsmenü – den Puls-Knopf oben rechts – und klicke ganz oben auf die Karte der Engine.\nWähle FluidEQ-Engine und drücke Übernehmen. Windows fragt um Erlaubnis, und der Ton setzt ein paar Sekunden aus, während Windows-Audio neu startet.\nZeigt ein Ausgang AUS, drücke in seinem Hinweis Aktivieren. Meldet ein Hinweis, dass die Engine nicht läuft, drücke Windows-Audio neu starten.',
  'help.engine.tip':
    'Equalizer APO bleibt für eigene APO-Befehle, Peace und VST-Plugins verfügbar. Bringt ein Update eine neuere Engine mit, bietet ein Hinweis Engine aktualisieren an. Beendest du FluidEQ über den Infobereich, schaltet das den EQ auf jedem Ausgang aus.',
  'help.engine.fluid':
    'Empfohlen. Die Effekte deiner Soundkarte laufen weiter, und EQ und DSP-Rack erreichen jede App.',
  'help.engine.apo':
    'Führt eigene APO-Befehle, Peace und VST-Plugins aus. Das DSP-Rack bleibt bei der Wiedergabe aus der Bibliothek.',
  'help.engine.apply':
    'Wechselt die Engine. Windows fragt einmal nach, und Audio startet neu, was ein paar Sekunden dauert.',

  'help.eq.title': 'Forme deinen Klang mit EQ',
  'help.eq.intro':
    'Frequenz bestimmt, wo ein Band wirkt, Verstärkung die Anhebung oder Absenkung und Q seine Breite: höheres Q bedeutet schmaler. Ist kein Band ausgewählt, verändern Bass, Mitten und Höhen die ganze Kurve auf einmal. Beginne mit kleinen, breiten Änderungen und vergleiche oft.',
  'help.eq.steps':
    'Öffne EQ → Bänder. Ist nichts ausgewählt, dreh an Bass, Mitten oder Höhen, um den Klang schnell zu verändern.\nKlicke auf die Frequenz eines Bands oder auf seinen Punkt im Diagramm, um es auszuwählen. Dreh an seinen Drehreglern Frequenz, Verstärkung und Güte (Q), wähle einen Filter oder schalte es mit Aktiv aus.\nKlicke mit der rechten Maustaste auf ein Band, um es zurückzusetzen, auszuschalten oder daneben ein Band hinzuzufügen. Drücke EQ zurücksetzen, um jede Verstärkung auf 0 dB zu setzen, ohne deine Bänder zu verlieren. Vorher wird nachgefragt.',
  'help.eq.tip':
    'Unter Ebenfalls aktiv steht, was diesen Ausgang außer deinen Bändern noch formt, jeweils mit eigener Stärke und ×. Der Spielmodus verkürzt für Spiele und Anrufe die Verzögerung durch FluidEQ; Gaming-Presets schalten ihn ein.',
  'help.eq.bandsCaption': 'Die Seite Bänder, nichts ausgewählt',
  'help.eq.bandCaption': 'Ein Band ausgewählt',
  'help.eq.gameMode':
    'Verkürzt für Spiele und Anrufe die Verzögerung durch FluidEQ. Gaming-Presets schalten ihn ein.',
  'help.eq.layers':
    'Was diesen Ausgang sonst noch formt – eine Kopfhörerkorrektur, Smart-EQ, eine Faltung –, jeweils mit Stärke, Schalter und ×.',
  'help.eq.bandName': 'Ein Band',
  'help.eq.band':
    'Ziehe seinen Punkt, um anzuheben oder abzusenken. Klicke auf seine Frequenz, um es auszuwählen.',
  'help.eq.bass': 'Hebt oder senkt die Tiefen der ganzen Kurve.',
  'help.eq.mid': 'Hebt oder senkt die Mitten, wo die Stimmen liegen.',
  'help.eq.treble': 'Hebt oder senkt die Höhen, die Luft und die Details.',
  'help.eq.selected':
    'Das Band, das du gerade bearbeitest. Mit Strg+Klick oder Umschalt+Klick wählst du mehrere aus.',
  'help.eq.filter':
    'Seine Form: eine Glocke, ein Bass- oder Höhenshelf, eine Kerbe oder ein Tief-, Hoch- oder Bandpass.',
  'help.eq.voicing':
    'Eine fertige Kette für den Klang, etwa Musik oder ein Genre. Keiner lässt nur Ihre Bänder übrig.',
  'help.eq.smart':
    'Hört, was läuft, und korrigiert es: Detail, Balance oder Ziel.',
  'help.eq.clear':
    'Setzt jede Verstärkung auf 0 dB und behält deine Bänder. Fragt vorher nach.',
  'help.eq.mode':
    'Wie stark dein EQ und deine Kurven wirken, Band-Q und Phase.',
  'help.eq.add': 'Fügt neben dem ausgewählten Band ein weiteres hinzu.',
  'help.eq.layouts':
    'Bandanzahlen und die Band-Designs, die du gespeichert hast.',
  'help.eq.frequency': 'Wo das ausgewählte Band wirkt, von 1 Hz bis 20 kHz.',
  'help.eq.gain':
    'Wie stark es anhebt oder absenkt. Strg+Klick setzt es auf 0 dB zurück.',
  'help.eq.q': 'Wie breit es ist: höher ist schmaler.',
  'help.eq.delete':
    'Zweimal drücken löscht das Band; mit Behalten überlegst du es dir anders.',
  'help.eq.menuCaption': 'Das Rechtsklickmenü eines Bands',
  'help.eq.reset': 'Verstärkung zurück auf 0 dB und Q zurück auf 2.',
  'help.eq.disable':
    'Nimmt das Band aus dem Klang und behält seine Einstellungen.',
  'help.eq.addLeft':
    'Fügt ein Band auf halbem Weg zum tieferen Nachbarn hinzu.',
  'help.eq.addRight':
    'Fügt ein Band auf halbem Weg zum höheren Nachbarn hinzu.',

  'help.eqmode.title': 'EQ-Modus und Band-Designs',
  'help.eqmode.intro':
    'Der EQ-Modus ändert, wie deine Bänder und deine Korrekturkurven angewendet werden, ohne sie zu bearbeiten. Band-Designs bewahren die Frequenzen und das Q eines Layouts, das dir gefällt, bereit für jeden Ausgang.',
  'help.eqmode.steps':
    'Öffne in der Leiste der Seite Bänder den EQ-Modus. Probiere bei laufender Musik eine Einstellung unter Stärke, Band-Q oder Kurvenglättung; das Panel bleibt offen.\nWähle unter der FluidEQ-Engine die Phase Minimal oder Linear. Drücke Zurücksetzen, um alles auf Normal zurückzustellen.\nÖffne neben Band hinzufügen den Knopf Schnelle Anordnungen. Wähle 6, 10, 15, 20 oder 31 Bänder oder drücke Design speichern…, um das aktuelle Layout zu benennen.',
  'help.eqmode.tip':
    'Ein Design speichert nur Frequenzen und Q: Wird eines geladen, beginnt jedes Band bei 0 dB. Lineare Phase fügt Verzögerung hinzu und kann vor harten Schlägen vorschwingen.',
  'help.eqmode.modeCaption': 'EQ-Modus',
  'help.eqmode.strength':
    'Normal, Studio ×1.5 oder ×2, getrennt für deinen EQ und deine Kurven.',
  'help.eqmode.q':
    'Konstant behält jedes Q; Proportional und Asymmetrisch machen Bänder schmaler, je stärker sie werden.',
  'help.eqmode.smoothing': 'Glättet abgetastete Korrekturkurven.',
  'help.eqmode.phase': 'Minimal oder Linear. Nur mit der FluidEQ-Engine.',
  'help.eqmode.reset': 'Alles zurück auf Normal.',
  'help.eqmode.designsCaption': 'Band-Designs',
  'help.eqmode.builtIn': 'Standard-Layouts mit 6, 10, 15, 20 oder 31 Bändern.',
  'help.eqmode.save':
    'Speichert die aktuellen Frequenzen und Q als benanntes Design, aufgeführt unter Meine Designs.',

  'help.games.title': 'Spielprofile',
  'help.games.intro':
    'Gib jedem Spiel seinen eigenen Klang. Kommt das Spiel in den Vordergrund, wechselt FluidEQ zu diesem Klang und behält ihn, bis du das Spiel beendest – ganz gleich, wohin du zwischendurch mit Alt+Tab wechselst. Danach stellt FluidEQ wieder her, was du vorher hattest.',
  'help.games.steps':
    'Öffne EQ → Spielprofile und drücke Spiel hinzufügen. Nimm eines aus deinen Launchern, ein Programm, das gerade offen ist, oder wähle sein Programm selbst aus.\nWähle in seiner Zeile aus, welchen Klang es bekommen soll: ein Gaming-Preset oder ein beliebiges anderes.\nStarte das Spiel. Eine Karte auf dem Desktop zeigt, zu welchem Klang FluidEQ gewechselt hat, und eine weitere, welcher zurückkommt, wenn du es beendest.',
  'help.games.tip':
    'Solange ein Spiel den Klang hält, zeigt die Leiste am unteren Fensterrand seinen Namen. Wählst du beim Spielen einen anderen Klang, bleibt er: FluidEQ nimmt nur zurück, was es selbst gesetzt hat. Gaming-Presets schalten außerdem den Spielmodus ein.',
  'help.games.tab': 'Deine Spiele und der Klang, den jedes bekommt.',
  'help.games.add':
    'Fügt ein Spiel aus Steam, Epic, EA, GOG, Ubisoft, Battle.net oder Xbox hinzu oder ein beliebiges Programm, das gerade offen ist.',
  'help.games.gameName': 'Ein Spiel',
  'help.games.game': 'Das Spiel und der Ordner, an dem FluidEQ es erkennt.',
  'help.games.soundName': 'Sein Klang',
  'help.games.sound':
    'Der Klang, zu dem FluidEQ wechselt, wenn dieses Spiel in den Vordergrund kommt, oder So lassen, wie es ist.',
  'help.games.removeName': 'Entfernen',
  'help.games.remove':
    'Vergisst das Spiel. Das Preset, das es genutzt hat, bleibt erhalten.',

  'help.headphones.title': 'Kopfhörerkorrektur und Import',
  'help.headphones.intro':
    'Eine Korrektur gleicht ein gemessenes Modell aus und ergänzt eigene Bänder und Voreinstellungen. Prüfe genaue Modellbezeichnung und Urheber der Messung.',
  'help.headphones.steps':
    'Öffne EQ → EQ-Presets und suche nach deinem Kopfhörermodell. Sieh dir die verfügbaren Messungen an und wähle den passenden Eintrag.\nFür EQ-Text aus einem anderen Programm verwende EQ-Einstellungen importieren im Aktionsmenü. Prüfe die erkannten Bänder und die Kurve, bevor du sie anwendest.\nFür Squiglink füge dessen Export in das Importfeld ein. Als EQ anwenden ersetzt deine Bänder; Als Kurve anwenden fügt ihn als Kopfhörerkorrektur mit eigener Stärke hinzu.',
  'help.headphones.tip':
    'Eine als Nicht angewendet markierte Vorschau verändert keinen Ton. Vermeide versehentlich zwei vollständige Korrekturen für denselben Kopfhörer.',

  'help.convolution.title': 'Eine Impulsantwort verwenden',
  'help.convolution.intro':
    'Faltung wendet einen WAV-Impuls als eigene Ebene an. Durchsuche AutoEq oder importiere eine WAV; parametrische Bänder bleiben unabhängig.',
  'help.convolution.steps':
    'Öffne EQ → Faltung und suche nach Modell oder Messautor.\nPrüfe die Quelle und nutze dann Laden & anwenden; der Download passt zur Abtastrate deines Ausgangs. Nutze WAV importieren für eine Datei, die du schon hast.\nVergleiche unter Ebenfalls aktiv die Faltungsebene ein- und ausgeschaltet.',
  'help.convolution.tip':
    'Die FluidEQ-Engine rechnet jede Impulsrate selbst um. Equalizer APO braucht eine importierte WAV mit der Abtastrate des Ausgangs. Katalogdownloads brauchen eine Verbindung, das Handbuch nicht.',

  'help.profiles.title': 'Geräte, Profile und zweiter Ausgang',
  'help.profiles.intro':
    'Dein EQ folgt dem Ausgabegerät. Automatische Zuordnung speichert Änderungen für den aktuellen Ausgang, während du unter Gespeicherte Profile alternative Klänge behalten kannst. Zweite Ausgabe spiegelt die Wiedergabe auf andere Geräte, mit eigenem Pegel für jedes.',
  'help.profiles.steps':
    'Prüfe vor dem Bearbeiten das Ausgabegerät. Nutze Neues Profil für einen Klang, den du behalten willst; Aktualisieren speichert Änderungen in diesem Profil, und Zurücksetzen holt seine gespeicherten Einstellungen zurück.\nÖffne Zweite Ausgabe, aktiviere ein erreichbares Gerät und stelle seinen Pegel ein. Wähle direkt darunter das gespeicherte EQ-Profil dieses Geräts.\nNutze Spiel/Video für einen kleineren Startpuffer oder Musik für mehr Reserve. Vergleiche die Synchronität auf deinen Geräten.',
  'help.profiles.tip':
    'Jeder gespiegelte Ausgang nutzt mit beiden Engines sein eigenes Profil. Die Spiegelung läuft, solange FluidEQ geöffnet ist; ein Wechsel des Hauptausgangs beendet die alten Spiegelungen. Die Gerätelatenz beeinflusst die Synchronität trotzdem.',
  'help.profiles.list':
    'Deine gespeicherten Klänge. AKT markiert das Profil, das dieser Ausgang nutzt; drücke ein anderes, um zu wechseln.',
  'help.profiles.update': 'Speichert deine Änderungen im aktuellen Profil.',
  'help.profiles.new': 'Legt aus deinem aktuellen EQ ein neues Profil an.',
  'help.profiles.restore':
    'Holt das Profil so zurück, wie du es zuletzt gespeichert hast.',
  'help.profiles.output':
    'Der Ausgang, über den du hörst. AUS bedeutet, dass dein EQ ihn nicht erreicht; AKTIV, dass Windows über ihn abspielt.',
  'help.profiles.mapping':
    'Das Profil, dem dieser Ausgang folgt. Jede Änderung wird von selbst darin gespeichert.',
  'help.profiles.onePlayer':
    'Startest du etwas in FluidEQ, hält das an, was anderswo auf dem PC läuft – und umgekehrt.',
  'help.profiles.outputs':
    'Deine anderen Ausgänge. Schalte einen ein, damit die Wiedergabe auch dort läuft, mit seinem eigenen Profil.',
  'help.profiles.driver':
    'Ein dezenter Ausgangspunkt für das, worüber du hörst – Kopfhörer, Ohrhörer, eine Treibergröße oder ein Material. Lass es bei Keine Korrektur, wenn der Klang schon stimmt.',

  'help.config.title': 'Eine Kette prüfen und sichern',
  'help.config.intro':
    'EQ → Config zeigt, was die Audio-Engine tatsächlich auf der Platte hat. Ausgangskarten und Include-Baum zeigen dir, welches Gerät und welche Ebenen beteiligt sind. Exportiere eine Kette vor einem größeren Experiment oder wenn du ein Setup umziehst.',
  'help.config.steps':
    'Öffne EQ → Config, wähle den Ausgang und prüfe Status und Ebenen.\nSpeichere mit Kette exportieren eine .fluideq-Datei.\nWähle zum Wiederherstellen zuerst den richtigen Ausgang, importiere die Kette und prüfe das Ergebnis.',
  'help.config.tip':
    'Generierte Ebenendateien werden neu geschrieben, wenn sich ihre Einstellungen ändern; dauerhafte eigene Zeilen gehören in die benutzerdefinierte Datei des jeweiligen Ausgangs. Die FluidEQ-Engine liest daraus die Zeilen Filter, Preamp, GraphicEQ und Convolution; andere APO-Befehle und Plugins brauchen Equalizer APO.',

  'help.dsp.title': 'Das DSP-Rack erkunden',
  'help.dsp.intro':
    'Das DSP-Rack ist eine Kette aus Studiostufen. Unter der FluidEQ-Engine verarbeitet es alles, was der PC abspielt; unter Equalizer APO die Audiotitel der Bibliothek. Solange FluidEQ ausgeschaltet ist, ist es aus.',
  'help.dsp.steps':
    'Öffne DSP. Such dir unter Voreinstellungen eine Kette aus oder wähle in der Seitenleiste eine Stufe und schalte sie auf Ein.\nÄndere jeweils nur einen Regler und vergleiche bei ähnlicher Lautstärke mit umgangener Stufe. Mit Isolieren hörst du nur, was eine Stufe hinzufügt.\nSpeichere ein Rack, das dir gefällt, und teile es mit Exportieren und Importieren.',
  'help.dsp.tip':
    'Lauter klingt oft nur deshalb besser, weil es lauter ist; vergleiche also bei angeglichenem Pegel. Strg+Klick auf einen Drehregler setzt ihn auf seinen Standardwert zurück.',
  'help.dsp.normalizer':
    'Gleicht die Lautheit an. Bei Live-Audio regelt sie Song für Song.',
  'help.dsp.denoise':
    'Repariert Rauschen, Brummen und Knackser. Der neuronale Stimmreiniger arbeitet an Titeln der Bibliothek.',
  'help.dsp.exciter': 'Fügt Obertöne für Fülle und Luft hinzu.',
  'help.dsp.bassForge':
    'Fügt eine echte Oktave unter dem Bass hinzu oder, für kleine Lautsprecher, ihre Obertöne.',
  'help.dsp.equaliser':
    'Fünfzehn parametrische Bänder, minimal- oder linearphasig.',
  'help.dsp.bassPunch': 'Formt Attack, Sustain und Blüte des Basses.',
  'help.dsp.dimension':
    'Verbreitert das Stereobild, ohne die Monosumme zu verändern.',
  'help.dsp.maximizer':
    'Hebt den Pegel an, ohne Spitzen über die Obergrenze zu lassen.',
  'help.dsp.master': 'Endpegel, Lautheitsziel und Spitzenschutz.',
  'help.dsp.crossfade':
    'Blendet einen Titel der Bibliothek in den nächsten über.',
  'help.dsp.presets':
    'Ketten für das ganze Rack, für Genres, Geräte und Reparaturen.',
  'help.dsp.scopeName': 'Systemweit',
  'help.dsp.scope':
    'Wo das Rack läuft und welche Verzögerung lineare Phase hinzufügt.',

  'help.room.title': 'Der Raum: Surround auf Kopfhörern',
  'help.room.intro':
    'Der Raum macht aus Kopfhörern einen Hörraum. Jeder Kanal des Klangs wird zu einem Lautsprecher um deinen Kopf, gerendert durch einen vermessenen Kopf und die Reflexionen eines Raums, den du selbst formst — so sitzt ein Film vor dir und ein Spiel umgibt dich. Er braucht die FluidEQ-Engine und Kopfhörer; auf Lautsprechern bringt er nichts.',
  'help.room.steps':
    'Öffne DSP, wähle Raum in der Leiste und schalte ihn ein. Stereo wird zu zwei Lautsprechern vor dir; ein 5.1-Film zu fünf plus Sub; ein 7.1-Spiel zum ganzen Ring. Der Chip neben dem Schalter sagt, was gerade gilt.\nWähle oben einen Raum — Studio, Wohnzimmer, Kino, Konzertsaal und mehr — oder dreh Größe, Wände und Abstand selbst und zieh einen Lautsprecher um den Ring. Lautsprecher, die der laufende Stream nicht erreicht, werden schlafend gezeichnet.\nDrück Hörtest starten und beantworte fünf kurze Hörpaare: der Raum nimmt den Kopf, der die Klänge vor dich setzt. Klein, Mittel und Groß lassen sich auch von Hand wählen.\nSpeichere einen Raum, der dir gefällt, unter einem Namen; ein gespeicherter Raum kommt mit einem Druck zurück und ändert nie deinen Kopf.',
  'help.room.tip':
    'Spiele und Filme schicken ihre Surround-Kanäle nur an einen Ausgang, der laut Windows so viele Lautsprecher hat: wenn der Treiber es annimmt, bietet das Ausgabefeld einen Druck auf 7.1 an.',
  'help.room.picker':
    'Die Räume zum Anfangen, gruppiert wie die Profile jeder anderen Stufe; Eigen, sobald du einen formst.',
  'help.room.picture':
    'Der Raum von oben: Wände, die beim Absorbieren verblassen, die Lautsprecher auf ihrem Ring, der Kopf in der Mitte. Alles ist in einem einzigen Maßstab gezeichnet, ein Lautsprecher weiter draußen als der Raum breit ist steht also außerhalb seiner Wände. Zieh einen, und sein Partner geht mit; halte Umschalt, um ihn allein zu bewegen.',
  'help.room.speaker':
    'Tipp einen Lautsprecher im Raum an, und dieses Feld gehört ihm: sein Winkel als Zahl, sein eigener Abstand, sein Pegel, und Stumm oder Solo, um ihn allein zu hören.',
  'help.room.speakerName': 'Der gewählte Lautsprecher',
  'help.room.dialsName': 'Raumanteil, Nachklang, Abstand',
  'help.room.dials':
    'Wie viel du von den Wänden hörst, die weiche Fahne danach, und wie weit die Lautsprecher stehen. Größe, Wände sowie Länge und Klang der Fahne stehen darunter unter Raumcharakter.',
  'help.room.fit': 'Fünf Hörpaare, die den Kopf für deine Ohren wählen.',
  'help.room.head':
    'Der vermessene Kopf, durch den der Raum gerendert wird: klein, mittel oder groß.',
  'help.room.saved':
    'Gib dem Raum, wie er ist, einen Namen; er kommt mit einem Druck zurück.',
  'help.room.liveName': 'Was der Raum gerade tut',
  'help.room.live':
    'Von der Engine gelesen: welche Lautsprecher der laufende Stream erreicht, oder warum der Raum ruht.',

  'help.denoise.title': 'Rauschentfernung und Quellenanalyse',
  'help.denoise.intro':
    'Rauschentfernung verringert Rauschen, Netzbrummen und Knackser. Unter der FluidEQ-Engine arbeitet sie live an allem, was der PC abspielt; der neuronale Stimmreiniger und der gemessene Rauschteppich sind für Titel der Bibliothek. Stärkere Reduktion ist nicht automatisch besser.',
  'help.denoise.steps':
    'Spiele etwas mit dem Störgeräusch ab, das du verringern willst, und wähle in DSP Rauschentfernung.\nSchalte Rauschen, Brummen oder Knackser mit einer leichten Einstellung ein und höre auf leise Stellen und auf musikalische Details.\nErhöhe die Reduktion schrittweise und umgehe dann die Stufe, um zu prüfen, ob die Verbesserung einen Detailverlust wert ist.',
  'help.denoise.tip':
    'Achte auf abgeschwächte Details und wässrige oder pumpende Klänge. Das ist keine Mikrofonbereinigung. Hörst du keinen Unterschied, prüfe, ob Rack und Stufe beide eingeschaltet sind.',

  'help.graph.title': 'Das Diagramm und seine Bedienelemente',
  'help.graph.intro':
    'Das Frequenzgangdiagramm zeichnet deine EQ-Kurven über den Live-Klang. Die Leiste darüber bestimmt, was und wie gezeichnet wird, und sie ändert sich mit der Darstellung: ein Standardstil oder eine Plus-Visualisierung.',
  'help.graph.steps':
    'Klicke auf den Namen der Darstellung, um einen Stil oder eine Visualisierung zu wählen. Die Pfeile daneben, die Leertaste und Strg+Leertaste blättern durch sie.\nÖffne Ansicht für die Größe des Diagramms, für das, was es zeigt, und für Höhe und Position der Welle. Die Bildrate steht ebenfalls dort: jedes Bild, das Ihr Bildschirm anbietet, oder 60 oder 30, und 60 im Akkubetrieb.\nEin Plus-Visualizer fügt Ansicht seine eigenen Regler hinzu — was sein Autor Ihnen überlassen hat — und Eigene Welle der Szene bringt die Welle auf Höhe und Position zurück, die dieser Autor gewählt hat.\nDoppelklicke auf das Diagramm für Vollbild. Ein einfacher Klick blendet die Leiste aus oder ein.',
  'help.graph.tip':
    'Alles hier ändert nur, was gezeichnet wird, nie deinen Klang. Der Regenbogenmodus (einzuschalten unter Hilfe → Neuerungen) zeichnet die Standardstile, die Pegelanzeigen und die Welle mit der vollen Bildwiederholrate des Bildschirms statt mit 30 Bildern pro Sekunde. Esc verlässt die erweiterte Ansicht und das Vollbild.',
  'help.graph.stripCaption': 'Mit einem Standardstil',
  'help.graph.live': 'Blendet die Live-Welle ein oder aus.',
  'help.graph.previous': 'Springt zur vorherigen Darstellung zurück.',
  'help.graph.picker': 'Öffnet alle Stile und Visualisierungen.',
  'help.graph.next': 'Springt zur nächsten Darstellung weiter.',
  'help.graph.autoName': 'Auto',
  'help.graph.auto': 'Wechselt die Darstellung alle 10 Sekunden bis 2 Minuten.',
  'help.graph.colouring':
    'Färbt den Stil: Auto, Einheitlich, Frequenz, Pegel oder Hitze.',
  'help.graph.newLook': 'Gestaltet aus diesem Stil eine eigene Darstellung.',
  'help.graph.bandsName': 'Hörbereiche',
  'help.graph.bands': 'Schattiert die Bereiche, die du am meisten hörst.',
  'help.graph.bandsMenu':
    'Dieselbe Schattierung; ausgegraut bei einer Plus-Visualisierung, die sie nie zeichnet.',
  'help.graph.gridName': 'Raster',
  'help.graph.grid': 'Blendet Raster und Skalen ein oder aus.',
  'help.graph.viewName': 'Ansicht',
  'help.graph.view': 'Größe, was gezeichnet wird, und die Welle.',
  'help.graph.plusCaption': 'Mit einer Plus-Visualisierung',
  'help.graph.tintName': 'Fensterfarben',
  'help.graph.tint':
    'Das App-Design, die Farben der Visualisierung oder ihre Farben mit Licht (Ambiente).',
  'help.graph.lighting': 'Beleuchtet deine RGB-Geräte mit dieser Szene.',
  'help.graph.desktop':
    'Legt diese Visualisierung hinter deine Desktopsymbole.',
  'help.graph.viewCaption': 'Das Menü Ansicht',
  'help.graph.expand': 'Das Diagramm wächst über den Editor.',
  'help.graph.fullscreen': 'Das Diagramm füllt den Bildschirm.',
  'help.graph.showingName': 'Anzeige',
  'help.graph.showing': 'Schaltet durch, was das Diagramm zeigt.',
  'help.graph.waveName': 'Die Welle',
  'help.graph.wave': 'Die Live-Zeichnung des Spektrums.',
  'help.graph.topWaveName': 'Obere Welle',
  'help.graph.topWave': 'Die kleine Welle in der Kopfzeile.',
  'help.graph.meterName': 'Pegelanzeige',
  'help.graph.meter': 'Die Ausgangsanzeige in der linken Leiste.',
  'help.graph.waveHeight': 'Wie hoch die Welle gezeichnet wird.',
  'help.graph.wavePosition': 'Vom unteren Rand bis zur Mitte.',
  'help.graph.attack':
    'Wie schnell eine Plus-Visualisierung zur Musik ansteigt.',
  'help.graph.release': 'Wie langsam sie nach jedem Schlag wieder fällt.',
  'help.graph.ownTiming': 'Zurück zum Timing, mit dem die Visualisierung kam.',
  'help.looks.title': 'Stile und Plus-Visualisierungen',
  'help.looks.intro':
    'Standardstile sind kostenlose Zeichnungen des Live-Klangs, die du selbst einfärben und gestalten kannst: Linie und Fläche für eine klare Spur, LED-Blöcke und Spitzen für Wucht, Fachwerk, Skyline und Tanzende Flammen für ganze Szenen. Plus-Visualisierungen sind auf der Grafikkarte gezeichnete Szenen wie Alpin, Aurora, Blüte und Neonstadt, in denen Bass, Beat und Höhen jeweils etwas anderes bewegen.',
  'help.looks.steps':
    'Klicke im Diagramm auf den Namen der Darstellung. Suche oder filtere die Stile über Linien, Flächen, Balken, Punkte oder Szenen.\nWähle rechts eine Plus-Visualisierung. Ohne Plus ist sie gesperrt, und wenn du sie wählst, erfährst du, wie du sie bekommst.\nDrücke bei einem Standardstil Neue Darstellung, um Farben, Bewegung und Spitzen zu ändern, und speichere sie dann; sie erscheint unter dem Filter Deine.',
  'help.looks.tip':
    'Eine Plus-Visualisierung bringt ihre eigenen Farben mit: Attack und Release stellst du unter Ansicht ein. Kann eine Szene auf diesem Computer nicht laufen, zeichnet das Diagramm statt einer leeren Fläche einen kostenlosen Stil.',
  'help.looks.searchName': 'Suche',
  'help.looks.search':
    'Findet Stile und Visualisierungen nach Name, Ersteller oder Kategorie.',
  'help.looks.styles':
    'Kostenlose Stile, die FluidEQ zeichnet, und die Darstellungen, die du gespeichert hast.',
  'help.looks.familiesName': 'Stilfilter',
  'help.looks.families': 'Linien, Flächen, Balken, Punkte, Szenen und Deine.',
  'help.looks.plus':
    'Szenen von FluidEQ und von Mitgliedern, jede mit einem Bild.',
  'help.looks.categoriesName': 'Kategorien',
  'help.looks.categories': 'Natur, Städte, Abstrakt und mehr.',

  'help.plus.title': 'FluidEQ Plus und dein Konto',
  'help.plus.intro':
    'Ein Konto ist freiwillig: Alles, was kostenlos war, läuft auch ohne Konto auf diesem Computer. FluidEQ Plus, monatlich oder jährlich, fügt Visualizer, die Rangliste, das Studio, Dynamische Beleuchtung und den Desktop-Visualizer hinzu. Ein neues Konto kann Plus fünfzehn Tage kostenlos testen, und eine Szene, die du veröffentlichst und die freigegeben wird, bringt dir einen Monat.',
  'help.plus.steps':
    'Öffne Konto im Aktionsmenü. Melde dich an, oder erstelle ein Konto und gib den sechsstelligen Code ein, der an deine E-Mail-Adresse geschickt wurde.\nDrücke Auf Plus umsteigen, lies die Bedingungen, setze das Häkchen, dass du zustimmst, und bezahle in deinem Browser bei Buy Me a Coffee mit derselben E-Mail-Adresse.\nÖffne den Tab Plus. In seiner Seitenleiste findest du Rangliste, Visualizer, Studio und Dynamische Beleuchtung.',
  'help.plus.tip':
    'Die App sieht deine Karte nie; über Abonnement verwalten änderst oder kündigst du es. Der kostenlose Testzeitraum verlangt keine Karte und kostet am Ende nichts. Ein Konto bleibt auf bis zu fünf Computern angemeldet, und Plus funktioniert eine Zeit lang auch offline.',
  'help.plus.leaderboard':
    'Wer am meisten hört, unter den Plus-Mitgliedern, die beitreten.',
  'help.plus.visualizers':
    'Szenen von FluidEQ und Mitgliedern, bereit für deine Musik.',
  'help.plus.studio': 'Baue mit deiner KI eigene Szenen.',
  'help.plus.lighting': 'Deine RGB-Geräte folgen der Szene.',
  'help.plus.fold':
    'Klappt die Leiste auf ihre Bilder zusammen; beim Überfahren mit der Maus öffnet sie sich wieder.',

  'help.gallery.title': 'Die Visualizer-Galerie',
  'help.gallery.intro':
    'Visualizer enthält die eigenen Szenen von FluidEQ und die, die Mitglieder veröffentlichen. Mit jedem Konto kannst du stöbern und die kostenlosen Kostproben von FluidEQ zehn Sekunden lang ausprobieren; mit Plus spielst du jede Szene zu deiner Musik ab und fügst sie deinen Darstellungen hinzu.',
  'help.gallery.steps':
    'Öffne Plus → Visualizer. Suche, sortiere nach Beliebteste, Diese Woche oder Neueste, oder wähle eine Kategorie.\nÖffne eine Szene, drücke Zu meinen Darstellungen und dann Im Diagramm abspielen. Die Pfeile oder ← und → wechseln zwischen den Szenen.\nVergib mit dem Herzsymbol Likes an Szenen von Mitgliedern und melde eine, die dort nicht hingehört.',
  'help.gallery.tip':
    'Szenen in deinen Darstellungen aktualisieren sich selbst, und die Seite einer Szene zeigt, was sich in jeder Version geändert hat. Eine Szene, die du veröffentlichst, erscheint, sobald ein Moderator sie freigegeben hat. Im Studio öffnen zeigt, wie die eigenen Szenen von FluidEQ gemacht sind.',
  'help.gallery.search': 'Findet Szenen und Ersteller.',
  'help.gallery.sortName': 'Sortieren',
  'help.gallery.sort': 'Beliebteste, meiste Likes dieser Woche oder neueste.',
  'help.gallery.categoriesName': 'Kategorien',
  'help.gallery.categories': 'Zeigt eine Art von Szenen.',
  'help.gallery.mine':
    'Die Szenen, die du veröffentlicht hast, mit ihren Likes.',
  'help.gallery.cardName': 'Eine Szene',
  'help.gallery.card':
    'Das Bild öffnet die Szene; Hinzufügen legt sie in deine Darstellungen.',
  'help.gallery.manage': 'Was jeder Monitor als Desktophintergrund zeigt.',
  'help.gallery.stop': 'Beendet alle Desktophintergründe.',
  'help.gallery.sceneCaption': 'Die Seite einer Szene',
  'help.gallery.back': 'Zurück zur Galerie, dorthin, wo du sie verlassen hast.',
  'help.gallery.stepName': 'Vorherige und nächste Szene',
  'help.gallery.step':
    'Blättert durch die Liste, aus der du die Szene geöffnet hast.',
  'help.gallery.play':
    'Fügt die Szene deinen Darstellungen hinzu oder spielt sie im Diagramm ab.',
  'help.gallery.desktop': 'Legt die Szene hinter deine Desktopsymbole.',
  'help.gallery.inspect':
    'Öffnet die Szene von FluidEQ im Studio, damit du siehst, wie sie gemacht ist.',

  'help.leaderboard.title': 'Die Rangliste',
  'help.leaderboard.intro':
    'Die Rangliste ordnet die Plus-Mitglieder, die ihr beitreten, danach, wie viel sie hören und wie viele Likes ihre Szenen bekommen. Solange du nicht beitrittst, ist sie aus.',
  'help.leaderboard.steps':
    'Öffne Konto und drücke Der Rangliste beitreten.\nÖffne Plus → Rangliste. Wähle das Kürzel und den Namen, die die Rangliste zeigt, und wechsle dann zwischen Gesamt und Dieser Monat.\nZum Aufhören drücke Rangliste verlassen. Alle meine Daten löschen entfernt alles, was du gesendet hast.',
  'help.leaderboard.tip':
    'Eine Zahl pro Tag verlässt deinen Computer – die Minuten Musik, die gelaufen sind – und nie, was du abspielst. Jede Zahl wird auf dem Server geprüft. Kürzel und Name lassen sich später unter Konto → Namen ändern anpassen; Rangliste und veröffentlichte Szenen ziehen mit.',
  'help.leaderboard.periodName': 'Gesamt oder Dieser Monat',
  'help.leaderboard.period': 'Der gesamte Verlauf oder nur dieser Monat.',
  'help.leaderboard.standing':
    'Dein Rang und deine Punkte und wie weit es bis zum nächsten Platz ist.',
  'help.leaderboard.earn':
    '10 Punkte pro Stunde, 20 für jeden Tag mit 30 Minuten oder mehr, 5 für jedes Like.',

  'help.studio.title': 'Szenen im Studio bauen',
  'help.studio.intro':
    'Das Studio macht aus einer Beschreibung einen Visualizer. Dein eigener KI-Assistent schreibt die Szene in einen Projektordner, und FluidEQ spielt jede Version zu deiner Musik ab, sobald sie gespeichert ist. Das Studio gehört zu Plus; ein neues Konto kann es mit dem kostenlosen Testzeitraum öffnen.',
  'help.studio.steps':
    'Öffne Plus → Studio und drücke Neues Projekt…. Gib ihm einen Namen; FluidEQ legt seinen Ordner mit einer Szene an, die sich schon bewegt.\nBeschreibe deine Idee, öffne den Ordner in deinem KI-Assistenten und füge den Prompt aus KI-Prompt kopieren ein.\nBeobachte die Bühne, während Dateien gespeichert werden, und probiere die Testsignale aus. Dann Zu meinen Darstellungen, Veröffentlichen… oder Exportieren….',
  'help.studio.tip':
    'Doppelklicke auf die Bühne für Vollbild. In eine FluidEQ-Szene hineinschauen… öffnet eine der eigenen Szenen von FluidEQ zum Lernen; sie kann nicht veröffentlicht werden. Szenen, die stark flackern oder zu aufwendig sind, werden zurückgehalten. Eine Szene, die du veröffentlichst, liest zuerst ein Moderator, und eine freigegebene Szene bringt dir einen Monat Plus.',
  'help.studio.project': 'Ihre Projekte und FluidEQ-Szenen zum Hineinschauen.',
  'help.studio.switchName': 'Vorheriges und nächstes Projekt',
  'help.studio.switch':
    'Blättert rückwärts oder vorwärts durch deine Projekte.',
  'help.studio.stageName': 'Bühne',
  'help.studio.stage':
    'Die Szene, live zu deiner Musik. Doppelklick für Vollbild.',
  'help.studio.code':
    'Der Code der Szene, live aktualisiert, sobald deine KI ihn speichert.',
  'help.studio.prompt':
    'Kopiert den Prompt, der deiner KI erklärt, wie Szenen gebaut werden.',
  'help.studio.hears':
    'Was die Szene empfängt: Pegel, Schlag, Bass, Mitten, Höhen.',
  'help.studio.signals': 'Testsignale, die nur diese Vorschau antreiben.',
  'help.studio.size':
    'Testet die Szene in einem Diagramm oder in einem schmalen, breiten oder Vollbild-Panel.',
  'help.studio.wave':
    'Testet Höhe und Position der Welle, die Hörer einstellen können.',

  'help.desktop.title': 'Der Desktop-Visualizer',
  'help.desktop.intro':
    'Der Desktop-Visualizer legt einen Plus-Visualizer hinter deine Desktopsymbole, auf einem Monitor oder auf jedem davon, solange FluidEQ läuft.',
  'help.desktop.steps':
    'Lass einen Plus-Visualizer im Diagramm laufen und drücke den Monitor-Knopf neben seinem Namen, oder wähle Ansicht → Als Desktophintergrund festlegen.\nDrücke die Monitore auf der Karte, wähle Mit der Musik oder Ruhig und drücke Hintergrund festlegen.\nZum Ändern oder Beenden öffne Plus → Visualizer und nutze oben Verwalten oder Beenden.',
  'help.desktop.tip':
    'Er pausiert, solange Fenster den Monitor verdecken, bei gesperrtem PC und, wenn du willst, im Akkubetrieb, und kehrt zurück, wenn FluidEQ startet. Beim Beenden von FluidEQ stoppt er. Nur unter Windows.',
  'help.desktop.monitors':
    'Deine Monitore, so wie Windows sie anordnet. Drücke die, die du nutzen willst.',
  'help.desktop.music': 'Bewegt sich zu dem, was gerade läuft.',
  'help.desktop.calm':
    'Eine langsame, ruhige Animation, die die Musik ignoriert.',
  'help.desktop.battery':
    'Spart Energie, solange der Computer nicht am Stromnetz ist.',
  'help.desktop.start': 'Startet ihn auf den Monitoren, die du gewählt hast.',

  'help.lighting.title': 'Dynamische Beleuchtung (Beta)',
  'help.lighting.intro':
    'Dynamische Beleuchtung lässt Tastatur, Maus, Mauspad, Headset und Ständer mit dem Plus-Visualizer im Diagramm leuchten, über Windows Dynamic Lighting und Razer Chroma. Die Funktion ist in der Betaphase, also sag uns, wie sich deine Geräte verhalten.',
  'help.lighting.steps':
    'Öffne Plus → Dynamische Beleuchtung und schalte sie ein, oder drücke im Diagramm den Beleuchtungsknopf neben einem Plus-Visualizer.\nWähle den Lichtstil dieses Visualizers – Szene, Farbwelle, Spektrum oder Beat-Welle – und stelle seine Helligkeit ein und worauf er reagiert.\nKlicke im Bereich Ihre Geräte auf ein Gerät, um es einzeln abzustimmen; mit Alle Geräte stimmst du wieder alle ab.',
  'help.lighting.tip':
    'Hält Windows ein Gerät für eine andere App zurück, nennt die Seite die Einstellung, die du ändern musst, und öffnet sie für dich. Razer-Geräte brauchen ein laufendes Razer Synapse, in dem Chroma Apps erlaubt sind.',
  'help.lighting.switch':
    'Lässt deine Geräte leuchten, während ein Plus-Visualizer läuft.',
  'help.lighting.browse': 'Öffnet die Galerie, um einen Visualizer zu wählen.',
  'help.lighting.previewName': 'Live-Vorschau des Schreibtischs',
  'help.lighting.preview':
    'Dein eigener Schreibtisch, beleuchtet mit den Farben, die an ihn gesendet werden.',
  'help.lighting.devices':
    'Alle gefundenen Geräte. Klicke auf eines, um es einzeln abzustimmen.',
  'help.lighting.all': 'Zurück zum Abstimmen aller Geräte auf einmal.',
  'help.lighting.style':
    'Szene, Farbwelle, Spektrum oder Beat-Welle, gespeichert für jeden Visualizer.',

  'help.online.title': 'Mit Online-Medien hören',
  'help.online.intro':
    'Online-Medien hält unterstützte Seiten neben deinem EQ bereit. Wiedergabe und Anmeldung auf den Seiten hängen weiterhin vom Anbieter und von deiner Verbindung ab. Die Leiste am unteren Rand von FluidEQ folgt dem aktiven Player, und ihre Lautstärke ist die der Seite.',
  'help.online.steps':
    'Öffne Online-Medien, wähle eine Seite und starte dort die Wiedergabe.\nWechsle zum EQ für Anpassungen beim Hören und zurück für seiteneigene Bedienelemente.\nAktiviere Nur ein Player, um überlappende Wiedergabe zu vermeiden.',
  'help.online.tip':
    'Unter der FluidEQ-Engine läuft der Tab Online-Medien wie jede andere App durch deinen EQ und das DSP-Rack. Unter Equalizer APO bleibt das Rack bei den Titeln der Bibliothek.',

  'help.library.title': 'Deine lokale Bibliothek aufbauen',
  'help.library.intro':
    'Die Bibliothek bringt Musik und Videos von deinen Laufwerken zusammen. Stöbere nach Alben, Interpreten, Genres, Songs, Ordnern, in einem Ordnerbaum oder in deinen Playlists. Cover und Details stammen aus deinen Dateien, deshalb kann dieselbe Sammlung je nach ihren Tags unterschiedlich aussehen.',
  'help.library.steps':
    'Öffne Bibliothek und füge den Ordner mit deinen Medien hinzu. Warte, bis das Einlesen fertig ist, bevor du beurteilst, was fehlt.\nWähle einen Interpreten oder ein Album oder suche nach einem Song. Starte einen Titel aus den Ergebnissen.\nMit der Leiste am unteren Fensterrand pausierst, spulst und springst du. Die Lautstärke dort ist ein gemeinsamer Pegel für alle Player.',
  'help.library.tip':
    'Fahre mit der Maus über das Symbol von FluidEQ in der Windows-Taskleiste, um Vorheriger Titel, Wiedergeben und Nächster Titel zu nutzen, auch wenn FluidEQ minimiert ist. Die Bibliothek braucht die Originaldateien: Verbinde ein Laufwerk erneut oder füge einen verschobenen Ordner neu hinzu.',

  'help.queue.title': 'Alben und Wiedergabewarteschlange',
  'help.queue.intro':
    'Die Warteschlange bestimmt die Hörreihenfolge. Ein anderes Album zu öffnen ersetzt nicht den aktuellen Titel. Aktiver Titel und Als Nächstes zeigen deinen Platz.',
  'help.queue.steps':
    'Öffne ein Album, um seine Titel anzusehen. Starte den, den du hören willst.\nKlicke mit der rechten Maustaste auf einen Song, um Zur Warteschlange, Zu Favoriten hinzufügen oder Zu Playlist hinzufügen zu wählen.\nÖffne Als Nächstes, um zu sehen, was danach läuft, und schalte Weiterspielen ein, um mit mehr aus demselben Genre weiterzuhören.',
  'help.queue.tip':
    'Startest du die Wiedergabe in der Bibliothek, übernimmt sie von den anderen Playern in FluidEQ. Am aktuellen Titel in der Leiste erkennst du, welche Quelle gerade wiedergibt.',

  'help.karaoke.title': 'Mit Karaoke singen',
  'help.karaoke.intro':
    'Karaoke verbindet eigenes Audio und Liedtexte. Zeitmarkierte Texte folgen der Wiedergabe; Zieltonhöhen erfordern Notendaten. Ein eingerichtetes Mikrofon ergänzt deine Live-Tonhöhe.',
  'help.karaoke.steps':
    'Öffne Karaoke und füge Dateien oder Ordner mit passendem Audio und Text hinzu.\nWähle ein Lied, starte es und prüfe die Zuordnung.\nRichte das Mikrofon ein, passe die Textgröße an und nutze den Vollbildknopf der Bühne.',
  'help.karaoke.tip':
    'Eine reine Textdatei enthält keine Zielnoten. Karaoke folgt der Lautstärke der App; die Pegel für Melodie, Playback und Führungsstimme findest du unter Mix-Einstellungen.',

  'help.maker.title': 'Im Karaoke-Editor erstellen',
  'help.maker.intro':
    'Der Karaoke-Editor macht Audio zu einem bearbeitbaren Projekt mit Texten und Noten auf der Zeitleiste. Prüfe automatisch erzeugte Wörter und Zeiten immer nach.',
  'help.maker.steps':
    'Öffne Erstellen in Karaoke und lade Audio. Wähle benötigte Trennungs- oder Transkriptionswerkzeuge.\nBeobachte den Fortschritt; beim ersten KI-Einsatz können Modelle geladen werden. Prüfe Texte und Noten.\nHöre kurze Stellen, korrigiere Zeiten und Text, speichere das Projekt und exportiere die Dateien.',

  'help.maker.lyricsCaption': 'Der Text, und wann jedes Wort gesungen wird',
  'help.maker.referenceName': 'Referenz-Liedtext',
  'help.maker.reference':
    'Das ganze Lied als Text, eine Zeile pro Reihe. Einfügen oder eine Datei laden; FluidEQ entnimmt daraus das Timing.',
  'help.maker.timingName': 'Wort-Timing',
  'help.maker.timing':
    'Alle Wörter der Reihe nach, mit der Zahl der bereits getimten. Ein Druck öffnet eines zum Bearbeiten.',
  'help.maker.wordName': 'Ausgewähltes Wort',
  'help.maker.word':
    'Wo das gewählte Wort beginnt und wie lange es dauert. Seine Kante zu verschieben gibt oder nimmt dem Nachbarwort Zeit; die Zeile behält ihre Länge.',
  'help.maker.toolsCaption':
    'Die KI-Werkzeuge und die Modelle, die sie brauchen',
  'help.maker.separate':
    'Trennt die Aufnahme in Stimme und Musik, damit das Karaoke ohne den Sänger läuft.',
  'help.maker.loadVocals':
    'Nutzen Sie eine Nur-Gesang-Datei, die Sie schon haben, statt hier eine zu trennen.',
  'help.maker.redetectTiming':
    'Hört die Stimme erneut ab und timet die vorhandenen Wörter neu.',
  'help.maker.redetectNotes':
    'Hört die Melodie erneut ab und schreibt die Noten unter den Wörtern neu.',
  'help.maker.modelsName': 'KI-Modellspeicher',
  'help.maker.models':
    'Was jedes Modell braucht und ob es auf diesem Rechner liegt. Sie werden beim ersten Gebrauch geladen.',
  'help.maker.idleName': 'Wenn es inaktiv ist',
  'help.maker.idle':
    'Ob ein Modell zwischen zwei Läufen im Speicher bleibt, und wie lange. Freigeben schafft Speicher; Behalten lässt den nächsten Lauf sofort beginnen.',

  'help.makerBar.caption': 'Die Werkzeuge oben im Karaoke-Editor',
  'help.makerBar.import':
    'Öffnet eine Karaoke-Datei oder ein gespeichertes Projekt und behält das bereits geladene Audio.',
  'help.makerBar.lyrics': 'Die Wörter und ihr Timing, in einem Fenster.',
  'help.makerBar.timing':
    'Verschiebt Wörter und Noten gemeinsam, für ein Lied, das von der ersten Sekunde an zu früh oder zu spät läuft.',
  'help.makerBar.pan':
    'Ziehen Sie irgendwo auf der Zeitleiste, um durch das Lied zu fahren, ohne etwas zu ändern.',
  'help.makerBar.language':
    'In welcher Sprache die Wörter stehen, und eine zweite daneben, damit beide gesungen werden können.',
  'help.makerBar.record':
    'Lassen Sie das Lied laufen und drücken Sie am Anfang und Ende jeder Zeile eine Taste. Das Timing kommt aus Ihren Anschlägen.',
  'help.makerBar.select':
    'Ziehen Sie einen Rahmen um Noten, um sie gemeinsam zu verschieben oder zu löschen.',
  'help.makerBar.paint': 'Zeichnen Sie die Melodie direkt auf das Tonraster.',
  'help.makerBar.split':
    'Teilt ein Wort in Silben, damit ein langes Wort auf jeder eine Note trägt.',
  'help.makerBar.repair':
    'Die Werkzeuge, die für Sie hinhören, und die Modelle, die sie brauchen.',
  'help.makerBar.export':
    'Schreibt das fertige Karaoke als FluidEQ-Projekt, UltraStar TXT, LRC oder erweitertes LRC.',
  'help.maker.tip':
    'Modelle benötigen Verbindung und Speicherplatz. Die Dauer hängt von Hardware und Liedlänge ab. Verwende zulässiges Audio und prüfe vor dem Teilen.',

  'help.share.title': 'Audio zwischen Computern teilen',
  'help.share.intro':
    'Audio teilen überträgt Systemklang zwischen Computern im selben privaten Netzwerk. Der Empfänger hat Kopfhörer oder Lautsprecher; andere Computer senden. Das ist etwas anderes als ein zweiter Ausgang am selben Computer.',
  'help.share.steps':
    'Öffne am Hörcomputer Audio teilen, wähle Audio auf diesem Computer wiedergeben und drücke Verbindungscode erstellen. Beginne leise.\nWähle an jedem Quellcomputer Audio dieses Computers senden, füge den Code für dein Netzwerk ein und drücke Verbinden und senden.\nBehalte den Verbindungsmonitor im Blick. Drücke Senden beenden oder Empfang beenden, wenn du fertig bist; Neuen Code erstellen trennt alle gespeicherten Kopplungen.',
  'help.share.tip':
    'Halte den Verbindungscode privat: Er erlaubt die Kopplung. Mehrere Sender werden zusammengemischt und erhöhen den Pegel, und die Lautstärke des Empfängers regelt ihn. Unter der FluidEQ-Engine läuft empfangenes Audio außerdem durch das DSP-Rack.',

  'help.trouble.title': 'Wenn etwas falsch klingt',
  'help.trouble.intro':
    'Beginne bei Quelle und Ausgang und isoliere dann die Ebene. Ein Diagramm, ein gespeichertes Preset oder ein eingeschalteter Schalter allein beweist nicht, dass der Ton das gewünschte Gerät erreicht hat. Das Menü Hilfe führt außerdem zur Audioreparatur, zu Problemberichten und zum Forum.',
  'help.trouble.steps':
    'Kein Ton: Prüfe, ob die Wiedergabe läuft, der erwartete Ausgang gewählt ist, die Lautstärke aufgedreht und das Gerät verbunden ist. Prüfe, ob Nur ein Player eine andere Quelle pausiert hat.\nKeine EQ-Wirkung: Prüfe, ob System-EQ eingeschaltet ist und beim Ausgang nicht AUS steht; falls doch, drücke Aktivieren. Meldet ein Hinweis, dass die Engine nicht läuft, drücke Windows-Audio neu starten.\nAlles sieht richtig aus und der EQ tut trotzdem nichts: Windows spielt die Musik möglicherweise an der Engine vorbei. Der Hinweis sagt das und bietet an, sie mit einem Druck dorthin zu verschieben, wo Windows sie nutzt; das kostet eine Berechtigung und eine Sekunde Stille.\nVerzerrung oder zu viel Bass: Lass Automatisch normalisieren eingeschaltet, reduziere Anhebungen und umgehe Ebenen einzeln. Falls es bleibt, nutze Problem melden und prüfe den Bericht vor dem Senden.',
  'help.trouble.tip':
    'F1 öffnet dieses Handbuch. Esc schließt zuerst eine vergrößerte Aufnahme, dann das Handbuch. Ist die Oberfläche zu groß, setzt Strg + 0 den Zoom zurück. Prozesse im Aktionsmenü zeigt, was jeder Teil von FluidEQ gerade tut.',

  'help.forum.title': 'Im Forum fragen',
  'help.forum.intro':
    'Das Forum holt die GitHub Discussions von FluidEQ in die App: Ankündigungen, Ideen, Fragen und Klangeinstellungen, auf die Leute stolz sind. Lesen kann jeder; zum Schreiben nutzt du dein GitHub-Konto, kein FluidEQ-Konto.',
  'help.forum.steps':
    'Öffne Hilfe → Forum und wähle eine Kategorie: Ankündigungen, Allgemein, Ideen, Umfragen, Q&A oder Schaufenster.\nDurchsuche das Forum oder öffne ein Thema, um die Antworten zu lesen.\nDrücke Mit GitHub anmelden, schließe die Anmeldung im Browser ab und schreibe dann ein Neues Thema oder eine Antwort.',
  'help.forum.tip':
    'Alles, was du schreibst, ist auf GitHub unter deinem GitHub-Namen öffentlich. Markiere in Q&A die Antwort, die geholfen hat, damit die nächste Person sie findet.',
};

export default help;
