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
    'Frequenz bestimmt, wo ein Band wirkt, Verstärkung die Anhebung oder Absenkung und Q seine Breite: höheres Q bedeutet schmaler. Beginne mit kleinen, breiten Änderungen und vergleiche oft.',
  'help.eq.steps':
    'Wähle ein Band in EQ → Bänder. Dreh an seinen Drehreglern Frequenz, Verstärkung und Güte (Q) oder ziehe seinen Punkt im Diagramm.\nKlicke mit der rechten Maustaste auf ein Band, um es zurückzusetzen, auszuschalten oder daneben ein Band hinzuzufügen. Strg+Klick auf einen Schieberegler oder Drehregler setzt ihn auf seinen Standardwert zurück.\nDrücke EQ zurücksetzen, um jede Verstärkung auf 0 dB zu setzen, ohne deine Bänder zu verlieren. Vorher wird nachgefragt.',
  'help.eq.tip':
    'Die Frequenzgangkurve beschreibt deine Filter, das bewegte Spektrum den Klang. Schaltest du ein Band mit Aktiv aus, bleiben seine Einstellungen für später erhalten.',
  'help.eq.bandsCaption': 'Die Seite Bänder',
  'help.eq.voicing': 'Ein schneller Klangcharakter, etwa Music oder Movies.',
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
    'Öffne in der Leiste der Seite Bänder den EQ-Modus. Probiere bei laufender Musik eine Einstellung unter Stärke, Band-Q oder Kurvenglättung; das Panel bleibt offen.\nWähle unter der FluidEQ-Engine die Phase Minimal oder Linear. Drücke Zurücksetzen, um alles auf Normal zurückzustellen.\nÖffne neben Band hinzufügen den Knopf Schnelle Anordnungen. Wähle 6, 10, 15 oder 31 Bänder oder drücke Design speichern…, um das aktuelle Layout zu benennen.',
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
  'help.eqmode.builtIn': 'Standard-Layouts mit 6, 10, 15 oder 31 Bändern.',
  'help.eqmode.save':
    'Speichert die aktuellen Frequenzen und Q als benanntes Design, aufgeführt unter Meine Designs.',

  'help.headphones.title': 'Kopfhörerkorrektur und Import',
  'help.headphones.intro':
    'Eine Korrektur gleicht ein gemessenes Modell aus und ergänzt eigene Bänder. Prüfe genaue Modellbezeichnung und Urheber der Messung.',
  'help.headphones.steps':
    'Öffne EQ → EQ-Presets und suche nach deinem Kopfhörermodell. Sieh dir die verfügbaren Messungen an und wähle den passenden Eintrag.\nFür EQ-Text aus einem anderen Programm verwende EQ-Einstellungen importieren im Aktionsmenü. Prüfe die erkannten Bänder und die Kurve, bevor du sie anwendest.\nFür Squiglink füge dessen Export in das Importfeld ein. Als EQ anwenden ersetzt deine Bänder; Als Kurve anwenden fügt ihn als Kopfhörerkorrektur mit eigener Stärke hinzu.',
  'help.headphones.tip':
    'Eine nicht angewendete Vorschau verändert keinen Ton. Vermeide versehentlich zwei vollständige Korrekturen für denselben Kopfhörer.',

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

  'help.denoise.title': 'Entrauschen und Quellenanalyse',
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
    'Klicke auf den Namen der Darstellung, um einen Stil oder eine Visualisierung zu wählen. Die Pfeile daneben, die Leertaste und Strg+Leertaste blättern durch sie.\nÖffne Ansicht für die Größe des Diagramms, für das, was es zeigt, und für Höhe und Position der Welle.\nDoppelklicke auf das Diagramm für Vollbild. Ein einfacher Klick blendet die Leiste aus oder ein.',
  'help.graph.tip':
    'Alles hier ändert nur, was gezeichnet wird, nie deinen Klang. Esc verlässt die erweiterte Ansicht und das Vollbild.',
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
  'help.graph.topWave': 'Die kleine Welle in der Titelleiste.',
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
    'Ein Konto ist freiwillig: Alles, was kostenlos war, läuft auch ohne Konto auf diesem Computer, und mit jedem Konto lässt sich eine Szene im Studio bauen. FluidEQ Plus, monatlich oder jährlich, fügt Visualizer, die Rangliste, Dynamische Beleuchtung und den Desktop-Visualizer hinzu und bringt, was das Studio baut, in deine Darstellungen, in die Galerie und zu anderen Mitgliedern.',
  'help.plus.steps':
    'Öffne Konto im Aktionsmenü. Melde dich an, oder erstelle ein Konto und gib den sechsstelligen Code ein, der an deine E-Mail-Adresse geschickt wurde.\nDrücke Auf Plus umsteigen, lies die Bedingungen, setze das Häkchen, dass du zustimmst, und bezahle in deinem Browser bei Buy Me a Coffee mit derselben E-Mail-Adresse.\nÖffne den Tab Plus. In seiner Seitenleiste findest du Rangliste, Visualizer, Studio und Dynamische Beleuchtung.',
  'help.plus.tip':
    'Die App sieht deine Karte nie; über Abonnement verwalten änderst oder kündigst du es. Ein Konto bleibt auf bis zu fünf Computern angemeldet, und Plus funktioniert eine Zeit lang auch offline.',
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
    'Szenen in deinen Darstellungen aktualisieren sich selbst, und die Seite einer Szene zeigt, was sich in jeder Version geändert hat. Im Studio öffnen zeigt, wie die eigenen Szenen von FluidEQ gemacht sind.',
  'help.gallery.search': 'Findet Szenen und Ersteller.',
  'help.gallery.sortName': 'Sortieren',
  'help.gallery.sort': 'Meiste Likes, meiste Likes dieser Woche oder neueste.',
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
    'Eine Zahl pro Tag verlässt deinen Computer – die Minuten Musik, die gelaufen sind – und nie, was du abspielst. Jede Zahl wird auf dem Server geprüft. Handle und Name lassen sich später unter Konto → Namen ändern anpassen; Rangliste und veröffentlichte Szenen ziehen mit.',
  'help.leaderboard.periodName': 'Gesamt oder Dieser Monat',
  'help.leaderboard.period': 'Der gesamte Verlauf oder nur dieser Monat.',
  'help.leaderboard.standing':
    'Dein Rang und deine Punkte und wie weit es bis zum nächsten Platz ist.',
  'help.leaderboard.earn':
    '10 Punkte pro Stunde, 20 für jeden Tag mit 30 Minuten oder mehr, 5 für jedes Like.',

  'help.studio.title': 'Szenen im Studio bauen',
  'help.studio.intro':
    'Das Studio macht aus einer Beschreibung einen Visualizer. Dein eigener KI-Assistent schreibt die Szene in einen Projektordner, und FluidEQ spielt jede Version zu deiner Musik ab, sobald sie gespeichert ist.',
  'help.studio.steps':
    'Öffne Plus → Studio und drücke Neues Projekt…. Gib ihm einen Namen; FluidEQ legt seinen Ordner mit einer Szene an, die sich schon bewegt.\nBeschreibe deine Idee, öffne den Ordner in deinem KI-Assistenten und füge den Prompt aus KI-Prompt kopieren ein.\nBeobachte die Bühne, während Dateien gespeichert werden, und probiere die Testsignale aus. Dann, mit Plus, Zu meinen Darstellungen, Veröffentlichen… oder Exportieren….',
  'help.studio.tip':
    'Doppelklicke auf die Bühne für Vollbild. In eine FluidEQ-Szene hineinschauen… öffnet eine der eigenen Szenen von FluidEQ zum Lernen; sie kann nicht veröffentlicht werden. Szenen, die stark flackern oder zu aufwendig sind, werden zurückgehalten.',
  'help.studio.project': 'Deine Projekte und FluidEQ-Szenen zum Hineinschauen.',
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
    'Er pausiert bei Vollbild-Apps, bei gesperrtem PC und, wenn du willst, im Akkubetrieb und kehrt zurück, wenn FluidEQ startet. Beim Beenden von FluidEQ stoppt er. Nur unter Windows.',
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
    'Öffne Online-Medien, wähle eine Seite und starte dort die Wiedergabe.\nWechsle zum EQ für Anpassungen beim Hören und zurück für seiteneigene Bedienelemente.\nAktiviere Nur ein Player gleichzeitig, um überlappende Wiedergabe zu vermeiden.',
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

  'help.maker.title': 'Im Karaoke Maker erstellen',
  'help.maker.intro':
    'Maker macht Audio zu einem bearbeitbaren Projekt mit Texten und Noten auf der Zeitleiste. Prüfe automatisch erzeugte Wörter und Zeiten immer nach.',
  'help.maker.steps':
    'Öffne Erstellen in Karaoke und lade Audio. Wähle benötigte Trennungs- oder Transkriptionswerkzeuge.\nBeobachte den Fortschritt; beim ersten KI-Einsatz können Modelle geladen werden. Prüfe Texte und Noten.\nHöre kurze Stellen, korrigiere Zeiten und Text, speichere das Projekt und exportiere die Dateien.',
  'help.maker.tip':
    'Modelle benötigen Verbindung und Speicherplatz. Die Dauer hängt von Hardware und Liedlänge ab. Verwende zulässiges Audio und prüfe vor dem Teilen.',

  'help.share.title': 'Audio zwischen Computern teilen',
  'help.share.intro':
    'Audio teilen überträgt Systemklang zwischen Computern im selben privaten Netzwerk. Der Empfänger hat Kopfhörer oder Lautsprecher; andere Computer senden. Das ist etwas anderes als ein zweiter Ausgang am selben Computer.',
  'help.share.steps':
    'Öffne am Hörcomputer Audio teilen, wähle Audio auf diesem Computer wiedergeben und drücke Verbindungscode erstellen. Beginne leise.\nWähle an jedem Quellcomputer Audio dieses Computers senden, entscheide dich für Musik oder Spiel/Video, füge den Code für dein Netzwerk ein und drücke Verbinden und senden.\nBehalte den Verbindungsmonitor im Blick. Drücke Senden beenden oder Empfang beenden, wenn du fertig bist; Neuen Code erstellen trennt alle gespeicherten Kopplungen.',
  'help.share.tip':
    'Halte den Verbindungscode privat: Er erlaubt die Kopplung. Mehrere Sender werden zusammengemischt und erhöhen den Pegel, und die Lautstärke des Empfängers regelt ihn. Unter der FluidEQ-Engine läuft empfangenes Audio außerdem durch das DSP-Rack.',

  'help.trouble.title': 'Wenn etwas falsch klingt',
  'help.trouble.intro':
    'Beginne bei Quelle und Ausgang und isoliere dann die Ebene. Ein Diagramm, ein gespeichertes Preset oder ein eingeschalteter Schalter allein beweist nicht, dass der Ton das gewünschte Gerät erreicht hat. Das Menü Hilfe führt außerdem zur Audioreparatur, zu Problemberichten und zum Forum.',
  'help.trouble.steps':
    'Kein Ton: Prüfe, ob die Wiedergabe läuft, der erwartete Ausgang gewählt ist, die Lautstärke aufgedreht und das Gerät verbunden ist. Prüfe, ob Nur ein Player eine andere Quelle pausiert hat.\nKeine EQ-Wirkung: Prüfe, ob System-EQ eingeschaltet ist und beim Ausgang nicht AUS steht; falls doch, drücke Aktivieren. Meldet ein Hinweis, dass die Engine nicht läuft, drücke Windows-Audio neu starten.\nVerzerrung oder zu viel Bass: Lass Automatisch normalisieren eingeschaltet, reduziere Anhebungen und umgehe Ebenen einzeln. Falls es bleibt, nutze Problem melden und prüfe den Bericht vor dem Senden.',
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
