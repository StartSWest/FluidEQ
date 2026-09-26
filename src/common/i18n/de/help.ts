/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Hilfe',
  'help.title': 'Benutzerhandbuch',
  'help.subtitle': 'Finden Sie Ihren Klang. Fühlen Sie sich zu Hause.',
  'help.intro':
    'Eine praktische Anleitung für FluidEQ mit echten Bildschirmaufnahmen. Beginnen Sie mit Ihrer ersten Hörsitzung und erkunden Sie dann jeden Teil der App in Ihrem Tempo.',
  'help.offline': 'Offline verfügbar',
  'help.search': 'Handbuch durchsuchen',
  'help.searchHint': 'Zum Beispiel Engine, Bass, Visualizer…',
  'help.contents': 'In diesem Handbuch',
  'help.results': '{count} Kapitel',
  'help.resultsOne': '{count} Kapitel',
  'help.empty':
    'Keine Kapitel gefunden. Versuchen Sie einen kürzeren Ausdruck oder löschen Sie die Suche.',
  'help.clear': 'Suche löschen',
  'help.close': 'Handbuch schließen',
  'help.enlarge': 'Bildschirmaufnahme vergrößern: {title}',
  'help.closeImage': 'Bildschirmaufnahme schließen',
  'help.controlsOf': 'Was jedes Bedienelement tut: {title}',
  'help.captureNote':
    'Echte Aufnahmen aus FluidEQ 1.6 und 1.7. Farben, Bezeichnungen und Positionen von Bedienelementen können in Ihrer Version abweichen. Die Einstellungen sind Beispiele, keine empfohlenen Presets.',
  'help.steps': 'Ausprobieren',
  'help.tip': 'Gut zu wissen',
  'help.back': 'Nach oben',

  'help.group.start': 'Erste Schritte',
  'help.group.sound': 'Ihren Klang formen',
  'help.group.visuals': 'Ihre Musik sehen',
  'help.group.plus': 'FluidEQ Plus',
  'help.group.listen': 'Hören, singen und teilen',
  'help.group.help': 'Wenn Sie Hilfe brauchen',

  'help.start.title': 'Ihre ersten fünf Minuten',
  'help.start.intro':
    'Beginnen Sie mit einem vertrauten Lied bei angenehmer Lautstärke. Die linke Leiste schaltet FluidEQ ein und enthält die Vorverstärkung; die Mitte ist Ihr Arbeitsbereich; die rechte Leiste folgt Ihrem Ausgang und seinen Profilen. Die Leiste am unteren Fensterrand steuert, was gerade läuft.',
  'help.start.steps':
    'Installieren Sie FluidEQ und lassen Sie die FluidEQ-Engine ausgewählt, wenn die Installation fragt, wie FluidEQ Ihren Ton verarbeiten soll. Windows fragt einmal um Erlaubnis, ohne Neustart.\nWählen Sie unter Ausgabegerät das Gerät, über das Sie hören. Aktivieren Sie System-EQ und lassen Sie Automatisch normalisieren eingeschaltet.\nSpielen Sie ein Lied, öffnen Sie EQ → Bänder, ändern Sie etwas leicht und vergleichen Sie mit ein- und ausgeschaltetem System-EQ.',
  'help.start.tip':
    'Systemweiter EQ braucht Windows und eine Audio-Engine: die FluidEQ-Engine oder Equalizer APO. Unter macOS und Linux zeigt die App Demonstrationsausgänge, ein bewegtes Diagramm ist dort also kein Beweis, dass etwas verarbeitet wird.',
  'help.start.keywords':
    'erste schritte, einstieg, einsteiger, einführung, schnellstart, kurzanleitung, anleitung, bedienungsanleitung, tutorial, anfänger, grundlagen, setup, installer, einrichten, ersteinrichtung, loslegen, benutzen, installieren, installation',

  'help.window.title': 'Rund ums Fenster',
  'help.window.intro':
    'Über die Kopfzeile wechseln Sie zwischen den Seiten von FluidEQ, und sie zeigt den Klang in Echtzeit. Die linke Leiste enthält den Schalter für den ganzen EQ, die Vorverstärkung und die Pegelanzeige; die rechte Leiste folgt Ihrem Ausgang und seinen Profilen.',
  'help.window.steps':
    'Drücken Sie in der Kopfzeile auf eine Seite: Online-Medien, Audio teilen und EQ vor dem Signal, DSP, Bibliothek, Karaoke und Plus danach.\nSchalten Sie in der linken Leiste System-EQ ein und lassen Sie Automatisch normalisieren eingeschaltet, damit keine Anhebung übersteuern kann.\nDrücken Sie auf das Signal oder die Pegelanzeige, um zu ändern, wie sie gezeichnet werden, und auf Regenbogenmodus, damit sich Kurven und Pegelanzeigen mit der vollen Bildwiederholrate Ihres Bildschirms bewegen.',
  'help.window.tip':
    'Hilfe öffnet dieses Handbuch, Neuerungen, die Audioreparatur und Problem melden. Hinter dem Puls-Knopf daneben finden Sie die Karte der Engine, Ihr Konto, den Import von EQ-Einstellungen oder einer Impulsantwort, den Neustart von Windows-Audio und Prozesse, wo Sie sehen, was jeder Teil von FluidEQ gerade nutzt; ganz unten stehen Helligkeit und Transparenz, die Animationen, Mit Windows starten und die Sprache. Mit dem Schalter danach wechselt das Fenster in die Ansicht Kompakter Player.',
  'help.window.keywords':
    'oberfläche, benutzeroberfläche, übersicht, menüleiste, titelleiste, obere leiste, symbolleiste, seitenleiste, tabs, reiter, registerkarten, navigation, layout, untere leiste, pegelmesser, VU-meter, preamp, headroom, einschalten, ausschalten, design, theme, dunkles design, helles design, dunkelmodus, dunkler modus, dark mode, nachtmodus, heller modus, light mode, sprache, sprache ändern, mit windows starten, autostart, automatisch starten, beim hochfahren, konto, account',
  'help.window.headerLeftCaption': 'Die Kopfzeile bis zum Signal',
  'help.window.headerRightCaption': 'Die Kopfzeile nach dem Signal',
  'help.window.railCaption': 'Die linke Leiste',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch und Suno, in FluidEQ abgespielt und von Ihrem EQ geformt.',
  'help.window.share':
    'Sendet den Klang dieses Computers an einen anderen oder spielt den eines anderen hier ab.',
  'help.window.eq':
    'Ihre Bänder, Presets, Kopfhörerkorrektur, Spiel-Presets und die Config der Engine.',
  'help.window.waveName': 'Audiosignal',
  'help.window.wave':
    'Was gerade läuft, in Echtzeit. Drücken Sie darauf, um zu ändern, wie es gezeichnet wird.',
  'help.window.rainbow':
    'Färbt das Fenster und zeichnet Kurven und Pegelanzeigen mit der vollen Bildwiederholrate Ihres Bildschirms.',
  'help.window.dsp':
    'Das Effekt-Rack: Presets, der Raum und jede Stufe der Kette.',
  'help.window.library': 'Ihre Musikdateien, Alben und die Warteschlange.',
  'help.window.karaoke':
    'Singen Sie mit und machen Sie aus Ihren eigenen Liedern Karaoke.',
  'help.window.plus': 'Visualizer, die Galerie, die Rangliste und das Studio.',
  'help.window.support':
    'Möglichkeiten, die Arbeit an FluidEQ zu unterstützen.',
  'help.window.help':
    'Dieses Handbuch, Neuerungen, die Audioreparatur und Problem melden.',
  'help.window.actions':
    'Die Engine, Ihr Konto, der Import von EQ-Einstellungen, der Neustart von Windows-Audio und Prozesse; Helligkeit und Transparenz, die Animationen, Mit Windows starten und die Sprache.',
  'help.window.systemEq':
    'Schaltet die Verarbeitung von FluidEQ für alles, was der PC abspielt, ein oder aus.',
  'help.window.preamp':
    'Senkt den Pegel vor dem EQ, damit Anhebungen Spielraum haben. Automatisch normalisieren stellt die Vorverstärkung für Sie ein.',
  'help.window.autoNormalize':
    'Hält die Vorverstärkung gerade so niedrig, dass nichts, was Sie anheben, übersteuern kann.',
  'help.window.responseGraph': 'Blendet den Frequenzgang ein oder aus.',
  'help.window.meterName': 'Pegelanzeige',
  'help.window.meter':
    'Der Ausgangspegel, links und rechts, in echten Dezibel. Drücken Sie darauf, um den Stil der Anzeige zu ändern.',
  'help.player.title': 'Kompakter Player',
  'help.player.intro':
    'Mit einem Schalter wechselt das Fenster von FluidEQ in die Ansicht Kompakter Player: eine schmale Spalte mit dem Song, Ihrem Equalizer, einem Visualizer und „Als Nächstes“, in Bereichen, die Sie ein- und ausblenden. Was gerade läuft, läuft weiter, und derselbe Schalter bringt die vollständige App auf der Seite zurück, die Sie verlassen haben.',
  'help.player.steps':
    'Drücken Sie in der Titelleiste neben Hilfe den Schalter Kompakter Player. Im Player holt derselbe Schalter die vollständige App zurück.\nBlenden Sie die Bereiche mit EQ, Visual und Liste ein und aus. Das Fenster wächst und schrumpft um den Platz, den jeder braucht, und der Player merkt sich Größe und Position.\nDoppelklicken Sie auf die Leiste des Players oder wählen Sie in seinem Menü Auf eine Zeile einklappen, um ihn auf eine Zeile zu verkleinern; das FluidEQ-Logo klappt ihn wieder aus.\nWählen Sie im Menü des Players sein eigenes Design und halten Sie ihn mit Immer im Vordergrund über anderen Fenstern.\nLegen Sie Musikdateien auf „Als Nächstes“ ab, und sie kommen in die Bibliothek und in die Warteschlange.',
  'help.player.tip':
    'Die Lautstärke des Players ist die Ihres Computers, dieselbe wie in Windows, und regelt daher den Pegel von allem, was der Computer abspielt. Landet der Player außerhalb des Bildschirms, klicken Sie im Infobereich der Taskleiste mit der rechten Maustaste auf FluidEQ und wählen Sie Fenster wiederherstellen.',
  'help.player.keywords':
    'mini player, miniplayer, mini-player, kleiner player, kompakt, kompaktmodus, kompakte ansicht, winamp, amp, player-modus, immer im vordergrund, immer oben, always on top, anheften, pin, einklappen, zusammenklappen, eine zeile, warteschlange, als nächstes, dateien ablegen, drag and drop, design, theme, helles design, dunkles design, dark mode, dunkelmodus, light mode, kleines fenster, schwebender player, lautstärke',
  'help.player.topCaption': 'Der obere Teil: der Song und wie er läuft',
  'help.player.eqCaption': 'Der Equalizer',
  'help.player.queueCaption': 'Als Nächstes',
  'help.player.menuCaption': 'Das Player-Menü',
  'help.player.foldedCaption': 'Auf eine Zeile eingeklappt',
  'help.player.menu':
    'Zurück zur vollständigen App oder zu einer ihrer Seiten, das Design des Players, Immer im Vordergrund und Auf eine Zeile einklappen.',
  'help.player.pin': 'Hält den Player über allen anderen Fenstern.',
  'help.player.switch':
    'Zurück zur vollständigen App, auf der Seite, die Sie verlassen haben.',
  'help.player.clock':
    'Gespielte Zeit. Klicken Sie darauf, um die verbleibende Zeit zu sehen.',
  'help.player.well':
    'Der Klang, während er läuft. Klicken Sie darauf, um zwischen Balken und Welle zu wechseln.',
  'help.player.level':
    'Der Pegel des Klangs, der FluidEQ verlässt, in Dezibel.',
  'help.player.volume':
    'Die Lautstärke Ihres Computers, dieselbe wie in Windows; sie regelt den Pegel von allem, was der Computer abspielt.',
  'help.player.decksName': 'EQ, Visual und Liste',
  'help.player.decks':
    'Blenden Sie den Equalizer, den Visualizer und „Als Nächstes“ ein und aus. Das Fenster wächst und schrumpft um den Platz, den jeder braucht.',
  'help.player.seek': 'Wo der Song gerade steht. Ziehen Sie, um zu springen.',
  'help.player.playingName': 'Wiedergabesteuerung',
  'help.player.playing':
    'Vorheriger Titel, fünf Sekunden zurück, Wiedergabe oder Pause, fünf Sekunden vor, Nächster Titel und Stopp.',
  'help.player.orderName': 'Zufallswiedergabe und Wiederholen',
  'help.player.order':
    'Mischt „Als Nächstes“ und wiederholt nichts, alles oder diesen Song.',
  'help.player.lookName': 'Nächster Look',
  'help.player.look':
    'Wechselt den Look des Visualizers. Strg+Klick geht einen zurück, und ein Rechtsklick zeigt alle.',
  'help.player.screen':
    'Was Sie hören, gezeichnet: Ihre Bänder, Smart-EQ und alles andere, was aktiv ist, über einem Visualizer-Look. Unter Ebenfalls aktiv stehen sie einzeln, und ein Chip schaltet seine Ebene aus, ohne sie zu entfernen.',
  'help.player.bands':
    'Ziehen Sie ein Band nach oben oder unten, um es anzuheben oder abzusenken. Seine Frequenz steht darunter.',
  'help.player.tone':
    'Bänder zeigt jedes Band; Klang ersetzt sie durch die Regler Bass, Mitten und Höhen.',
  'help.player.upNext':
    'Wo Sie in der Warteschlange stehen, wie viel Zeit darin noch bleibt und wie weit Sie schon sind.',
  'help.player.library': 'Öffnet die Bibliothek in der vollständigen App.',
  'help.player.songsName': 'Die Songs',
  'help.player.songs':
    'Was als Nächstes läuft. Doppelklicken Sie auf einen Song, um ihn abzuspielen, oder legen Sie Musikdateien hier ab, um sie hinzuzufügen.',
  'help.player.openIn': 'Öffnet die vollständige App auf einer ihrer Seiten.',
  'help.player.theme':
    'Das eigene Design des Players, Hell oder Dunkel, unabhängig vom Design der vollständigen App.',
  'help.player.fold':
    'Klappt den Player auf eine Zeile ein. Ein Doppelklick auf die Leiste tut dasselbe.',
  'help.player.unfold':
    'Klappt den Player wieder aus. Der Pfeil am anderen Ende tut das auch.',
  'help.player.foldedPlaying':
    'Vorheriger Titel, Wiedergabe oder Pause, Nächster Titel und Stopp.',
  'help.player.foldedClock': 'Die Zeit und wo der Song gerade steht.',

  'help.requirements.title': 'Was Ihr PC braucht',
  'help.requirements.intro':
    'FluidEQ läuft auf jedem Windows-PC der letzten zehn Jahre. Zwei Teile verlangen mehr als der Rest: die Plus-Visualizer zeichnen auf der Grafikkarte, und die Karaoke-KI lädt ihre Modelle beim ersten Mal herunter.',
  'help.requirements.steps':
    'Prüfen Sie Ihr Windows: Windows 10 Version 1803 oder neuer oder Windows 11, 64 Bit, 4 GB Arbeitsspeicher und rund 600 MB Festplatte. Damit alles verarbeitet wird, was der PC abspielt, braucht es die FluidEQ-Engine oder Equalizer APO; Windows fragt einmal nach der Erlaubnis, während sie installiert wird.\nÖffnen Sie einen Visualizer: jede Grafikkarte oder integrierte Grafik ab 2013. Bei 1080p genügt die integrierte Grafik; für 4K oder einen Desktop-Hintergrund auf mehreren Bildschirmen zugleich ist eine eigene Karte besser. Ist die Karte ausgelastet, zeichnet FluidEQ die Szene kleiner und gibt die Szenen frei, die Sie nicht sehen.\nProbieren Sie das Karaoke mit KI: Das Trennen der Stimme lädt beim ersten Mal ein Modell von 713 MB, das Tonhöhenmodell kommt mit etwa 180 MB dazu und die Rauschentfernung mit 11 MB. Mit einer Grafikkarte mit DirectX 12 ist ein vierminütiges Lied in etwa einer halben Minute getrennt; allein mit dem Prozessor dauert es rund vier Minuten. Halten Sie währenddessen 2 GB Arbeitsspeicher frei.\nStreben Sie das an, wenn es geht: Windows 11, 8 GB Arbeitsspeicher, Grafik ab 2018 und 3 GB freier Speicher, wenn Sie die KI-Funktionen nutzen.',
  'help.requirements.tip':
    'Alles außer den KI-Modellen steckt im Installationsprogramm, und die Modelle laden erst beim ersten Einsatz der Funktion. Prozesse im Aktionsmenü zeigt, was jeder Teil von FluidEQ auf Ihrem Rechner gerade benutzt.',
  'help.requirements.keywords':
    'systemanforderungen, systemvoraussetzungen, mindestanforderungen, anforderungen, voraussetzungen, empfohlen, hardware, specs, GPU, onboard-grafik, CPU, RAM, speicherplatz, laptop, notebook, leistung, performance, langsam, ruckelt, lag, kompatibilität, kompatibel, macOS, Linux',

  'help.engine.title': 'Die FluidEQ-Engine',
  'help.engine.intro':
    'FluidEQ verarbeitet Ihren Ton mit seiner eigenen Engine oder mit Equalizer APO. Die FluidEQ-Engine läuft im Audiodienst von Windows nach den Effekten Ihrer Soundkarte, wendet Ihren EQ und das DSP-Rack auf alles an, was der PC abspielt, und zieht sich zurück, sobald FluidEQ geschlossen wird.',
  'help.engine.steps':
    'Öffnen Sie das Aktionsmenü – den Puls-Knopf oben rechts – und klicken Sie ganz oben auf die Karte der Engine.\nWählen Sie FluidEQ-Engine und drücken Sie Übernehmen. Windows fragt um Erlaubnis, und der Ton setzt ein paar Sekunden aus, während Windows-Audio neu startet.\nZeigt ein Ausgang AUS, drücken Sie in seinem Hinweis Aktivieren. Meldet ein Hinweis, dass die Engine nicht läuft, drücken Sie Windows-Audio neu starten.',
  'help.engine.tip':
    'Equalizer APO bleibt für eigene APO-Befehle, Peace und VST-Plugins verfügbar. Bringt ein Update eine neuere Engine mit, bietet ein Hinweis Engine aktualisieren an. Beenden Sie FluidEQ über den Infobereich, schaltet das den EQ auf jedem Ausgang aus.',
  'help.engine.keywords':
    'audio-engine, engine wechseln, audiotreiber, treiber, systemweit, alle programme, Spotify, Discord, browser, einschalten, administrator, adminrechte, UAC, berechtigung, engine installieren',
  'help.engine.fluid':
    'Empfohlen. Die Effekte Ihrer Soundkarte laufen weiter, und EQ und DSP-Rack erreichen jede App.',
  'help.engine.apo':
    'Führt eigene APO-Befehle, Peace und VST-Plugins aus. Das DSP-Rack bleibt bei der Wiedergabe aus der Bibliothek.',
  'help.engine.apply':
    'Wechselt die Engine. Windows fragt einmal nach, und Audio startet neu, was ein paar Sekunden dauert.',

  'help.eq.title': 'Formen Sie Ihren Klang mit EQ',
  'help.eq.intro':
    'Frequenz bestimmt, wo ein Band wirkt, Verstärkung die Anhebung oder Absenkung und Q seine Breite: höheres Q bedeutet schmaler. Ist kein Band ausgewählt, formen die Klang-Regler — Bass, Mitten und Höhen, mit Tiefensperre und Höhensperre zu beiden Seiten — den Klang als eigene Kurve und lassen Ihre Bänder unverändert. Beginnen Sie mit kleinen, breiten Änderungen und vergleichen Sie oft.',
  'help.eq.steps':
    'Öffnen Sie EQ → Bänder. Ist nichts ausgewählt, drehen Sie an Bass, Mitten oder Höhen, um den Klang schnell zu verändern, und an Tiefensperre oder Höhensperre, um die Enden zu beschneiden. Sie zeichnen ihre eigene Klang-Linie ins Diagramm.\nKlicken Sie auf die Frequenz eines Bands oder auf seinen Punkt im Diagramm, um es auszuwählen. Drehen Sie an seinen Drehreglern Frequenz, Verstärkung und Güte (Q), wählen Sie einen Filter oder schalten Sie es mit Aktiv aus.\nKlicken Sie mit der rechten Maustaste auf ein Band, um es zurückzusetzen, auszuschalten oder daneben ein Band hinzuzufügen. Drücken Sie EQ zurücksetzen, um jede Verstärkung sowie Bass, Mitten und Höhen auf 0 dB zu setzen, ohne Ihre Bänder zu verlieren. Vorher wird nachgefragt.',
  'help.eq.tip':
    'Unter Ebenfalls aktiv steht, was diesen Ausgang außer Ihren Bändern noch formt, jeweils mit eigener Stärke und ×. Der Spielmodus verkürzt für Spiele und Anrufe die Verzögerung durch FluidEQ; Gaming-Presets schalten ihn ein.',
  'help.eq.keywords':
    'equalizer, Q-faktor, parametrischer EQ, grafischer EQ, EQ-einstellungen, klangeinstellungen, klangregelung, klang einstellen, klang anpassen, klang verbessern, sound, bassboost, anheben, absenken, verstärken, bandbreite, hochpass, tiefpass, lowcut, kuhschwanz, notch, schieberegler, frequenzen, voreinstellungen, latenz',
  'help.eq.bandsCaption': 'Die Seite Bänder, nichts ausgewählt',
  'help.eq.bandCaption': 'Ein Band ausgewählt',
  'help.eq.gameMode':
    'Verkürzt für Spiele und Anrufe die Verzögerung durch FluidEQ. Gaming-Presets schalten ihn ein.',
  'help.eq.layers':
    'Was diesen Ausgang sonst noch formt – eine Kopfhörerkorrektur, Smart-EQ, eine Faltung –, jeweils mit Stärke, Schalter und ×.',
  'help.eq.bandName': 'Ein Band',
  'help.eq.band':
    'Ziehen Sie seinen Punkt, um anzuheben oder abzusenken. Klicken Sie auf seine Frequenz, um es auszuwählen.',
  'help.eq.bass': 'Hebt oder senkt die Tiefen der ganzen Kurve.',
  'help.eq.mid': 'Hebt oder senkt die Mitten, wo die Stimmen liegen.',
  'help.eq.treble': 'Hebt oder senkt die Höhen, die Luft und die Details.',
  'help.eq.selected':
    'Das Band, das Sie gerade bearbeiten. Mit Strg+Klick oder Umschalt+Klick wählen Sie mehrere aus.',
  'help.eq.filter':
    'Seine Form: eine Glocke, ein Bass- oder Höhenshelf, eine Kerbe oder ein Tief-, Hoch- oder Bandpass.',
  'help.eq.voicing':
    'Eine fertige Kette für den Klang, etwa Musik oder ein Genre. Keine lässt nur Ihre Bänder übrig.',
  'help.eq.smart':
    'Hört, was läuft, und korrigiert es: Detail, Balance oder Ziel.',
  'help.eq.clear':
    'Setzt jede Verstärkung auf 0 dB und behält Ihre Bänder. Fragt vorher nach.',
  'help.eq.mode': 'Wie stark Ihr EQ und Ihre Kurven wirken, Band-Q und Phase.',
  'help.eq.add': 'Fügt neben dem ausgewählten Band ein weiteres hinzu.',
  'help.eq.layouts':
    'Bandanzahlen und die Band-Designs, die Sie gespeichert haben.',
  'help.eq.frequency': 'Wo das ausgewählte Band wirkt, von 1 Hz bis 20 kHz.',
  'help.eq.gain':
    'Wie stark es anhebt oder absenkt. Strg+Klick setzt es auf 0 dB zurück.',
  'help.eq.q': 'Wie breit es ist: höher ist schmaler.',
  'help.eq.delete':
    'Zweimal drücken löscht das Band; mit Behalten überlegen Sie es sich anders.',
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
    'Der EQ-Modus ändert, wie Ihr Klang geformt wird, ohne etwas zu bearbeiten. Ihr EQ umfasst Ihre Bänder, die Klang-Regler, Presets, den Treibertyp und Smart-EQ; Korrekturen umfasst Kopfhörerkorrekturen sowie importierte oder eigene Kurven. Band-Designs bewahren die Frequenzen und das Q eines Layouts, das Ihnen gefällt, bereit für jeden Ausgang.',
  'help.eqmode.steps':
    'Öffnen Sie in der Leiste der Seite Bänder den EQ-Modus. Probieren Sie bei laufender Musik eine Einstellung unter Stärke, Band-Q oder Kurvenglättung; das Panel bleibt offen.\nWählen Sie unter der FluidEQ-Engine die Phase Minimal oder Linear und unter Höhen Präzise oder Klassisch. Drücken Sie Zurücksetzen, um alles auf Normal zurückzustellen.\nÖffnen Sie neben Band hinzufügen den Knopf Schnelle Anordnungen. Wählen Sie 6, 10, 15, 20 oder 31 Bänder oder drücken Sie Design speichern…, um das aktuelle Layout zu benennen.',
  'help.eqmode.tip':
    'Ein Design speichert nur Frequenzen und Q: Wird eines geladen, beginnt jedes Band bei 0 dB. Lineare Phase fügt Verzögerung hinzu und kann vor harten Schlägen vorschwingen.',
  'help.eqmode.keywords':
    'bandanzahl, bandlayout, 10-band-EQ, 31-band-EQ, grafischer EQ, intensität, linearphasig, minimalphasig, konstantes Q, proportionales Q, pre-ringing, Höhen, präzise, klassisch',
  'help.eqmode.modeCaption': 'EQ-Modus',
  'help.eqmode.strength':
    'Normal, Studio ×1.5 oder ×2, getrennt für Ihren EQ und Ihre Korrekturen.',
  'help.eqmode.q':
    'Konstant behält jedes Q; Proportional und Asymmetrisch machen Bänder schmaler, je stärker sie werden.',
  'help.eqmode.smoothing': 'Glättet abgetastete Korrekturkurven.',
  'help.eqmode.phase': 'Minimal oder Linear. Nur mit der FluidEQ-Engine.',
  'help.eqmode.treble':
    'Präzise klingt wie gezeichnet, Klassisch wie in Equalizer APO. Nur mit der FluidEQ-Engine.',
  'help.eqmode.reset': 'Alles zurück auf Normal.',
  'help.eqmode.designsCaption': 'Band-Designs',
  'help.eqmode.builtIn': 'Standard-Layouts mit 6, 10, 15, 20 oder 31 Bändern.',
  'help.eqmode.save':
    'Speichert die aktuellen Frequenzen und Q als benanntes Design, aufgeführt unter Meine Designs.',

  'help.games.title': 'Spiel-Presets',
  'help.games.intro':
    'Geben Sie jedem Spiel seinen eigenen Klang. Kommt das Spiel in den Vordergrund, wechselt FluidEQ zu diesem Klang und behält ihn, bis Sie das Spiel beenden – ganz gleich, wohin Sie zwischendurch mit Alt+Tab wechseln. Danach stellt FluidEQ wieder her, was Sie vorher hatten.',
  'help.games.steps':
    'Öffnen Sie EQ → Spiel-Presets und drücken Sie Spiel hinzufügen. Nehmen Sie eines aus Ihren Launchern, ein Programm, das gerade offen ist, oder wählen Sie sein Programm selbst aus.\nWählen Sie in seiner Zeile aus, welchen Klang es bekommen soll: ein Gaming-Preset oder ein beliebiges anderes.\nStarten Sie das Spiel. Eine Karte auf dem Desktop zeigt, zu welchem Klang FluidEQ gewechselt hat, und eine weitere, welcher zurückkommt, wenn Sie es beenden.',
  'help.games.tip':
    'Solange ein Spiel den Klang hält, zeigt die Leiste am unteren Fensterrand seinen Namen. Wählen Sie beim Spielen einen anderen Klang, bleibt er: FluidEQ nimmt nur zurück, was es selbst gesetzt hat. Gaming-Presets schalten außerdem den Spielmodus ein.',
  'help.games.keywords':
    'games, zocken, spielprofil, pro app, automatisch umschalten, ego-shooter, FPS, schritte hören, footsteps, gamemode',
  'help.games.tab': 'Ihre Spiele und der Klang, den jedes bekommt.',
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
    'Eine Korrektur gleicht ein gemessenes Modell aus und ergänzt eigene Bänder und Presets. Prüfen Sie genaue Modellbezeichnung und Urheber der Messung.',
  'help.headphones.steps':
    'Öffnen Sie EQ → EQ-Presets und suchen Sie nach Ihrem Kopfhörermodell. Sehen Sie sich die verfügbaren Messungen an und wählen Sie den passenden Eintrag.\nFür EQ-Text aus einem anderen Programm verwenden Sie EQ-Einstellungen importieren im Aktionsmenü. Prüfen Sie die erkannten Bänder und die Kurve, bevor Sie sie anwenden.\nFür Squiglink fügen Sie dessen Export in das Importfeld ein. Als EQ anwenden ersetzt Ihre Bänder; Als Kurve anwenden fügt ihn als Kopfhörerkorrektur mit eigener Stärke hinzu.',
  'help.headphones.tip':
    'Eine als Nicht angewendet markierte Vorschau verändert keinen Ton. Vermeiden Sie versehentlich zwei vollständige Korrekturen für denselben Kopfhörer.',
  'help.headphones.keywords':
    'AutoEq, kopfhörer-EQ, kopfhörerprofil, Harman, zielkurve, in-ear, IEM, ohrhörer, earbuds, headset, frequenzgang, Crinacle, oratory1990, kalibrieren',

  'help.convolution.title': 'Eine Impulsantwort verwenden',
  'help.convolution.intro':
    'Faltung wendet einen WAV-Impuls als eigene Ebene an. Durchsuchen Sie AutoEq oder importieren Sie eine WAV; parametrische Bänder bleiben unabhängig.',
  'help.convolution.steps':
    'Öffnen Sie EQ → Faltung und suchen Sie nach Modell oder Messautor.\nPrüfen Sie die Quelle und nutzen Sie dann Laden & anwenden; der Download passt zur Abtastrate Ihres Ausgangs. Nutzen Sie WAV importieren für eine Datei, die Sie schon haben.\nVergleichen Sie unter Ebenfalls aktiv die Faltungsebene ein- und ausgeschaltet.',
  'help.convolution.tip':
    'Die FluidEQ-Engine rechnet jede Impulsrate selbst um. Equalizer APO braucht eine importierte WAV mit der Abtastrate des Ausgangs. Katalogdownloads brauchen eine Verbindung, das Handbuch nicht.',
  'help.convolution.keywords':
    'convolution, convolver, FIR-filter, raumkorrektur, raumeinmessung, REW, Room EQ Wizard, korrekturdatei, samplerate',

  'help.profiles.title': 'Geräte, Profile und zweite Ausgabe',
  'help.profiles.intro':
    'Ihr EQ folgt dem Ausgabegerät. Änderungen werden im Profil gespeichert, das auf dem aktuellen Ausgang aktiv ist, und unter Profile behalten Sie alternative Klänge. Zweite Ausgabe spiegelt die Wiedergabe auf andere Geräte, mit eigenem Pegel für jedes.',
  'help.profiles.steps':
    'Prüfen Sie vor dem Bearbeiten den Ausgang oben auf der Karte Ausgabe. Nutzen Sie Neues Profil für einen Klang, den Sie behalten wollen; Aktualisieren speichert Änderungen in diesem Profil, und Zurücksetzen holt seine gespeicherten Einstellungen zurück.\nÖffnen Sie Zweite Ausgabe, aktivieren Sie ein erreichbares Gerät und stellen Sie seinen Pegel ein. Wählen Sie direkt darunter das gespeicherte EQ-Profil dieses Geräts.\nNutzen Sie Spiel/Video für einen kleineren Startpuffer oder Musik für mehr Reserve. Vergleichen Sie die Synchronität auf Ihren Geräten.',
  'help.profiles.tip':
    'Jeder gespiegelte Ausgang nutzt mit beiden Engines sein eigenes Profil. Die Spiegelung läuft, solange FluidEQ geöffnet ist; ein Wechsel des Hauptausgangs beendet die alten Spiegelungen. Die Gerätelatenz beeinflusst die Synchronität trotzdem.',
  'help.profiles.keywords':
    'lautsprecher, boxen, audiogerät, wiedergabegerät, standardgerät, gerätewechsel, gerät umschalten, Bluetooth, gleichzeitig, mehrere ausgänge, einstellungen speichern, synchronisieren, verzögerung, klangprofil',
  'help.profiles.list':
    'Ihre gespeicherten Klänge. AKT markiert das Profil, das dieser Ausgang nutzt; drücken Sie ein anderes, um zu wechseln.',
  'help.profiles.update': 'Speichert Ihre Änderungen im aktuellen Profil.',
  'help.profiles.new': 'Legt aus Ihrem aktuellen EQ ein neues Profil an.',
  'help.profiles.restore':
    'Holt das Profil so zurück, wie Sie es zuletzt gespeichert haben.',
  'help.profiles.output':
    'Der Ausgang, über den Sie hören. AUS bedeutet, dass Ihr EQ ihn nicht erreicht; AKTIV, dass Windows über ihn abspielt.',
  'help.profiles.mapping':
    'Das Profil, dem dieser Ausgang folgt. Jede Änderung wird von selbst darin gespeichert.',
  'help.profiles.onePlayer':
    'Starten Sie etwas in FluidEQ, hält das an, was anderswo auf dem PC läuft – und umgekehrt.',
  'help.profiles.outputs':
    'Ihre anderen Ausgänge. Schalten Sie einen ein, damit die Wiedergabe auch dort läuft, mit seinem eigenen Profil.',
  'help.profiles.driver':
    'Ein dezenter Ausgangspunkt für das, worüber Sie hören – Kopfhörer, Ohrhörer, eine Treibergröße oder ein Material. Lassen Sie es bei Keine Korrektur, wenn der Klang schon stimmt.',

  'help.config.title': 'Eine Kette prüfen und sichern',
  'help.config.intro':
    'EQ → Config zeigt, was die Audio-Engine tatsächlich auf der Platte hat. Ausgangskarten und Include-Baum zeigen Ihnen, welches Gerät und welche Ebenen beteiligt sind. Exportieren Sie eine Kette vor einem größeren Experiment oder wenn Sie ein Setup umziehen.',
  'help.config.steps':
    'Öffnen Sie EQ → Config, wählen Sie den Ausgang und prüfen Sie Status und Ebenen.\nSpeichern Sie mit Kette exportieren eine .fluideq-Datei.\nWählen Sie zum Wiederherstellen zuerst den richtigen Ausgang, importieren Sie die Kette und prüfen Sie das Ergebnis.',
  'help.config.tip':
    'Generierte Ebenendateien werden neu geschrieben, wenn sich ihre Einstellungen ändern; dauerhafte eigene Zeilen gehören in die benutzerdefinierte Datei des jeweiligen Ausgangs. Die FluidEQ-Engine liest daraus die Zeilen Filter, Preamp, GraphicEQ und Convolution; andere APO-Befehle und Plugins brauchen Equalizer APO.',
  'help.config.keywords':
    'backup, sicherung, sicherungskopie, wiederherstellung, konfiguration, konfigurationsdatei, config.txt, textdatei, erweiterte einstellungen',

  'help.dsp.title': 'Das DSP-Rack erkunden',
  'help.dsp.intro':
    'Das DSP-Rack ist eine Kette aus Studiostufen. Unter der FluidEQ-Engine verarbeitet es alles, was der PC abspielt; unter Equalizer APO die Audiotitel der Bibliothek. Solange FluidEQ ausgeschaltet ist, ist es aus.',
  'help.dsp.steps':
    'Öffnen Sie DSP. Suchen Sie sich unter Presets eine Kette aus oder wählen Sie in der Seitenleiste eine Stufe und schalten Sie sie auf Ein.\nÄndern Sie jeweils nur einen Regler und vergleichen Sie bei ähnlicher Lautstärke mit umgangener Stufe. Mit Isolieren hören Sie nur, was eine Stufe hinzufügt.\nSpeichern Sie ein Rack, das Ihnen gefällt, und teilen Sie es mit Exportieren und Importieren.',
  'help.dsp.tip':
    'Lauter klingt oft nur deshalb besser, weil es lauter ist; vergleichen Sie also bei angeglichenem Pegel. Strg+Klick auf einen Drehregler setzt ihn auf seinen Standardwert zurück.',
  'help.dsp.keywords':
    'audioeffekte, effektkette, voreinstellungen, limiter, peak-limiter, begrenzer, loudness, normalisieren, lautstärke angleichen, lautstärkeausgleich, lautstärkeschwankungen, enhancer, stereobreite, stereoverbreiterung, subbass, tiefbass, transienten, mastering, clipping, crossfade, überblenden, gapless, lückenlos',
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
    'Der Raum macht aus Kopfhörern einen Hörraum. Jeder Kanal des Klangs wird zu einem Lautsprecher um Ihren Kopf, gerendert durch einen vermessenen Kopf und die Reflexionen eines Raums, den Sie selbst formen — so sitzt ein Film vor Ihnen und ein Spiel umgibt Sie. Er braucht die FluidEQ-Engine und Kopfhörer; auf Lautsprechern bringt er nichts.',
  'help.room.steps':
    'Öffnen Sie DSP, wählen Sie Raum in der Leiste und schalten Sie ihn ein. Stereo wird zu zwei Lautsprechern vor Ihnen; ein 5.1-Film zu fünf plus Sub; ein 7.1-Spiel zum ganzen Ring. Der Chip neben dem Schalter sagt, was gerade gilt.\nWählen Sie oben einen Raum — Studio, Wohnzimmer, Kino, Konzertsaal und mehr — oder drehen Sie Größe, Wände und Abstand selbst und ziehen Sie einen Lautsprecher um den Ring. Lautsprecher, die der laufende Stream nicht erreicht, werden schlafend gezeichnet.\nDrücken Sie Hörtest starten und beantworten Sie fünf kurze Hörpaare: der Raum nimmt den Kopf, der die Klänge vor Sie setzt. Klein, Mittel und Groß lassen sich auch von Hand wählen.\nSpeichern Sie einen Raum, der Ihnen gefällt, unter einem Namen; ein gespeicherter Raum kommt mit einem Druck zurück und ändert nie Ihren Kopf.',
  'help.room.tip':
    'Spiele und Filme schicken ihre Surround-Kanäle nur an einen Ausgang, der laut Windows so viele Lautsprecher hat: wenn der Treiber es annimmt, bietet das Ausgabefeld einen Druck auf 7.1 an.',
  'help.room.keywords':
    'raumklang, virtueller surround, räumlicher sound, spatial audio, 3D-audio, 3D-sound, binaural, HRTF, raumsimulation, mehrkanal, heimkino, hall, nachhall, reverb, klangbühne, soundstage, kopfgröße, crossfeed, surround aktivieren, surround einschalten',
  'help.room.picker':
    'Die Räume zum Anfangen, gruppiert wie die Presets jeder anderen Stufe; Eigen, sobald Sie einen formen.',
  'help.room.picture':
    'Der Raum von oben: Wände, die beim Absorbieren verblassen, die Lautsprecher auf ihrem Ring, der Kopf in der Mitte. Alles ist in einem einzigen Maßstab gezeichnet, ein Lautsprecher weiter draußen als der Raum breit ist steht also außerhalb seiner Wände. Ziehen Sie einen, und sein Partner geht mit; halten Sie Umschalt, um ihn allein zu bewegen.',
  'help.room.speaker':
    'Tippen Sie einen Lautsprecher im Raum an, und dieses Feld gehört ihm: sein Winkel als Zahl, sein eigener Abstand, sein Pegel, und Stumm oder Solo, um ihn allein zu hören.',
  'help.room.speakerName': 'Der gewählte Lautsprecher',
  'help.room.dialsName': 'Raumanteil, Nachklang, Abstand',
  'help.room.dials':
    'Wie viel Sie von den Wänden hören, der weiche Ausklang danach, und wie weit die Lautsprecher stehen. Größe, Wände sowie Nachklang-Länge und Nachklang-Ton stehen darunter unter Raumcharakter.',
  'help.room.fit': 'Fünf Hörpaare, die den Kopf für Ihre Ohren wählen.',
  'help.room.head':
    'Der vermessene Kopf, durch den der Raum gerendert wird: klein, mittel oder groß.',
  'help.room.saved':
    'Geben Sie dem Raum, wie er ist, einen Namen; er kommt mit einem Druck zurück.',
  'help.room.liveName': 'Was der Raum gerade tut',
  'help.room.live':
    'Von der Engine gelesen: welche Lautsprecher der laufende Stream erreicht, oder warum der Raum ruht.',

  'help.denoise.title': 'Rauschentfernung und Quellenanalyse',
  'help.denoise.intro':
    'Rauschentfernung verringert Rauschen, Netzbrummen und Knackser. Unter der FluidEQ-Engine arbeitet sie live an allem, was der PC abspielt; der neuronale Stimmreiniger und der gemessene Rauschteppich sind für Titel der Bibliothek. Stärkere Reduktion ist nicht automatisch besser.',
  'help.denoise.steps':
    'Spielen Sie etwas mit dem Störgeräusch ab, das Sie verringern wollen, und wählen Sie in DSP Rauschentfernung.\nSchalten Sie Rauschen, Brummen oder Knackser mit einer leichten Einstellung ein und hören Sie auf leise Stellen und auf musikalische Details.\nErhöhen Sie die Reduktion schrittweise und umgehen Sie dann die Stufe, um zu prüfen, ob die Verbesserung einen Detailverlust wert ist.',
  'help.denoise.tip':
    'Achten Sie auf abgeschwächte Details und wässrige oder pumpende Klänge. Das ist keine Mikrofonbereinigung. Hören Sie keinen Unterschied, prüfen Sie, ob Rack und Stufe beide eingeschaltet sind.',
  'help.denoise.keywords':
    'rauschunterdrückung, entrauschen, rauschen entfernen, rauschen reduzieren, denoiser, nebengeräusche, hintergrundrauschen, zischen, summen, knistern, knacken, klickgeräusche, restaurierung, vinyl',

  'help.graph.title': 'Das Diagramm und seine Bedienelemente',
  'help.graph.intro':
    'Das Frequenzgangdiagramm zeichnet Ihre EQ-Kurven über den Live-Klang. Die Leiste darüber bestimmt, was und wie gezeichnet wird, und sie ändert sich mit der Darstellung: ein Standardstil oder ein Plus-Visualizer.',
  'help.graph.steps':
    'Klicken Sie auf den Namen der Darstellung, um einen Stil oder einen Visualizer zu wählen. Die Pfeile daneben, die Leertaste und Strg+Leertaste blättern durch sie.\nÖffnen Sie Ansicht für die Größe des Diagramms, für das, was es zeigt, und für Höhe und Position der Welle. Die Bildrate steht ebenfalls dort: jedes Bild, das Ihr Bildschirm anbietet, oder 60 oder 30, und 60 im Akkubetrieb.\nEin Plus-Visualizer fügt Ansicht seine eigenen Regler hinzu — was sein Autor Ihnen überlassen hat — und Eigene Welle der Szene bringt die Welle auf Höhe und Position zurück, die dieser Autor gewählt hat.\nDoppelklicken Sie auf das Diagramm für Vollbild, mit Strg für die erweiterte Ansicht im Fenster; ein weiterer Doppelklick bringt es zurück. Ein einfacher Klick blendet die Leiste aus oder ein.\nTasten: Strg+F Vollbild, Strg+S erweiterte Ansicht, Esc zurück zur normalen Ansicht, Strg+G das Raster, Strg+W was das Diagramm zeigt, Strg+I die Richtung der Welle, Strg+A alle Bänder. Auf dem Punkt eines Bands verschieben Sie es durch Ziehen, ein Rechtsklick öffnet sein Menü; Strg+Mausrad ändert das Q eines ausgewählten Punkts.',
  'help.graph.tip':
    'Alles hier ändert nur, was gezeichnet wird, nie Ihren Klang. Der Regenbogenmodus (einzuschalten unter Hilfe → Neuerungen) zeichnet die Standardstile, die Pegelanzeigen und die Welle mit der vollen Bildwiederholrate des Bildschirms statt mit 30 Bildern pro Sekunde.',
  'help.graph.keywords':
    'graph, spektrumanalysator, analyzer, frequenzanalyse, fullscreen, FPS, framerate, bildwiederholfrequenz, wellenform, gitternetz, ausblenden, einblenden, tastenkürzel, shortcuts, doppelklick, erweitert',
  'help.graph.stripCaption': 'Mit einem Standardstil',
  'help.graph.live': 'Blendet die Live-Welle ein oder aus.',
  'help.graph.previous': 'Springt zur vorherigen Darstellung zurück.',
  'help.graph.picker': 'Öffnet alle Stile und Visualizer.',
  'help.graph.next': 'Springt zur nächsten Darstellung weiter.',
  'help.graph.autoName': 'Auto',
  'help.graph.auto': 'Wechselt die Darstellung alle 10 Sekunden bis 2 Minuten.',
  'help.graph.colouring':
    'Färbt den Stil: Auto, Einheitlich, Frequenz, Pegel oder Hitze.',
  'help.graph.newLook': 'Gestaltet aus diesem Stil eine eigene Darstellung.',
  'help.graph.bandsName': 'Hörbereiche',
  'help.graph.bands': 'Schattiert die Bereiche, die Sie am meisten hören.',
  'help.graph.bandsMenu':
    'Dieselbe Schattierung; ausgegraut bei einem Plus-Visualizer, der sie nie zeichnet.',
  'help.graph.gridName': 'Raster',
  'help.graph.grid': 'Blendet Raster und Skalen ein oder aus.',
  'help.graph.viewName': 'Ansicht',
  'help.graph.view': 'Größe, was gezeichnet wird, und die Welle.',
  'help.graph.plusCaption': 'Mit einem Plus-Visualizer',
  'help.graph.tintName': 'Fensterfarben',
  'help.graph.tint':
    'Das App-Design, die Farben des Visualizers, seine Farben mit Licht (Ambiente) oder der Visualizer hinter dem ganzen Fenster (Kulisse).',
  'help.graph.lighting': 'Beleuchtet Ihre RGB-Geräte mit dieser Szene.',
  'help.graph.desktop': 'Legt diesen Visualizer hinter Ihre Desktopsymbole.',
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
  'help.graph.attack': 'Wie schnell ein Plus-Visualizer zur Musik ansteigt.',
  'help.graph.release': 'Wie langsam er nach jedem Schlag wieder fällt.',
  'help.graph.ownTiming': 'Zurück zum Timing, mit dem der Visualizer kam.',
  'help.looks.title': 'Stile und Plus-Visualizer',
  'help.looks.intro':
    'Standardstile sind kostenlose Zeichnungen des Live-Klangs, die Sie selbst einfärben und gestalten können: Linie und Fläche für eine klare Spur, LED-Blöcke und Spitzen für Wucht, Fachwerk, Skyline und Tanzende Flammen für ganze Szenen. Plus-Visualizer sind auf der Grafikkarte gezeichnete Szenen wie Alpin, Aurora, Blüte und Neonstadt, in denen Bass, Beat und Höhen jeweils etwas anderes bewegen.',
  'help.looks.steps':
    'Klicken Sie im Diagramm auf den Namen der Darstellung. Suchen oder filtern Sie die Stile über Linien, Flächen, Balken, Punkte oder Szenen.\nWählen Sie rechts einen Plus-Visualizer. Ohne Plus ist er gesperrt, und wenn Sie ihn wählen, erfahren Sie, wie Sie ihn bekommen.\nDrücken Sie bei einem Standardstil Neue Darstellung, um Farben, Bewegung und Spitzen zu ändern, und speichern Sie sie dann; sie erscheint unter dem Filter Ihre.',
  'help.looks.tip':
    'Ein Plus-Visualizer bringt seine eigenen Farben mit: Attack und Release stellen Sie unter Ansicht ein. Kann eine Szene auf diesem Computer nicht laufen, zeichnet das Diagramm statt einer leeren Fläche einen kostenlosen Stil.',
  'help.looks.keywords':
    'visualisierung, aussehen, erscheinungsbild, skins, theme, look, farbschema, personalisieren, animationen',
  'help.looks.searchName': 'Suche',
  'help.looks.search':
    'Findet Stile und Visualizer nach Name, Ersteller oder Kategorie.',
  'help.looks.styles':
    'Kostenlose Stile, die FluidEQ zeichnet, und die Darstellungen, die Sie gespeichert haben.',
  'help.looks.familiesName': 'Stilfilter',
  'help.looks.families': 'Linien, Flächen, Balken, Punkte, Szenen und Ihre.',
  'help.looks.plus':
    'Szenen von FluidEQ und von Mitgliedern, jede mit einem Bild.',
  'help.looks.categoriesName': 'Kategorien',
  'help.looks.categories': 'Natur, Städte, Abstrakt und mehr.',

  'help.plus.title': 'FluidEQ Plus und Ihr Konto',
  'help.plus.intro':
    'Ein Konto ist freiwillig: Alles, was kostenlos war, läuft auch ohne Konto auf diesem Computer. FluidEQ Plus, monatlich oder jährlich, fügt Visualizer, die Rangliste, das Studio, Dynamische Beleuchtung und den Desktop-Visualizer hinzu. Ein neues Konto kann Plus fünfzehn Tage kostenlos testen, und eine Szene, die Sie veröffentlichen und die freigegeben wird, bringt Ihnen einen Monat.',
  'help.plus.steps':
    'Öffnen Sie Konto im Aktionsmenü. Melden Sie sich an, oder erstellen Sie ein Konto und geben Sie den sechsstelligen Code ein, der an Ihre E-Mail-Adresse geschickt wurde.\nDrücken Sie Auf Plus umsteigen, lesen Sie die Bedingungen, setzen Sie das Häkchen, dass Sie zustimmen, und bezahlen Sie in Ihrem Browser bei Buy Me a Coffee mit derselben E-Mail-Adresse.\nÖffnen Sie den Tab Plus. In seiner Seitenleiste finden Sie Rangliste, Visualizer, Studio und Dynamische Beleuchtung.',
  'help.plus.tip':
    'Die App sieht Ihre Karte nie; über Abonnement verwalten ändern oder kündigen Sie es. Die Gratis-Testphase verlangt keine Karte und kostet am Ende nichts. Ein Konto bleibt auf bis zu fünf Computern angemeldet, und Plus funktioniert eine Zeit lang auch offline.',
  'help.plus.keywords':
    'account, anmelden, anmeldung, einloggen, login, abmelden, registrieren, registrierung, passwort vergessen, mitgliedschaft, premium, vollversion, preis, kaufen, bezahlung, kreditkarte, testversion, trial, kündigung, upgrade, bestätigungscode, abo, abonnement',
  'help.plus.leaderboard':
    'Wer am meisten hört, unter den Plus-Mitgliedern, die beitreten.',
  'help.plus.visualizers':
    'Szenen von FluidEQ und Mitgliedern, bereit für Ihre Musik.',
  'help.plus.studio': 'Bauen Sie mit Ihrer KI eigene Szenen.',
  'help.plus.lighting': 'Ihre RGB-Geräte folgen der Szene.',
  'help.plus.fold':
    'Klappt die Leiste auf ihre Bilder zusammen; beim Überfahren mit der Maus öffnet sie sich wieder.',

  'help.gallery.title': 'Die Visualizer-Galerie',
  'help.gallery.intro':
    'Visualizer enthält die eigenen Szenen von FluidEQ und die, die Mitglieder veröffentlichen. Mit jedem Konto können Sie stöbern und die kostenlosen Kostproben von FluidEQ zehn Sekunden lang ausprobieren; mit Plus spielen Sie jede Szene zu Ihrer Musik ab und fügen sie Ihren Darstellungen hinzu.',
  'help.gallery.steps':
    'Öffnen Sie Plus → Visualizer. Suchen Sie, sortieren Sie nach Beliebteste, Diese Woche oder Neueste, oder wählen Sie eine Kategorie.\nÖffnen Sie eine Szene, drücken Sie Zu meinen Darstellungen und dann Im Diagramm abspielen. Die Pfeile oder ← und → wechseln zwischen den Szenen.\nGeben Sie Szenen von Mitgliedern mit dem Herzsymbol ein „Gefällt mir“ und melden Sie eine, die dort nicht hingehört.',
  'help.gallery.tip':
    'Szenen in Ihren Darstellungen aktualisieren sich selbst, und die Seite einer Szene zeigt, was sich in jeder Version geändert hat. Eine Szene, die Sie veröffentlichen, erscheint, sobald ein Moderator sie freigegeben hat. Im Studio öffnen zeigt, wie die eigenen Szenen von FluidEQ gemacht sind.',
  'help.gallery.keywords':
    'community-szenen, visualizer herunterladen, download, durchsuchen, entdecken, likes',
  'help.gallery.search': 'Findet Szenen und Ersteller.',
  'help.gallery.sortName': 'Sortieren',
  'help.gallery.sort':
    'Beliebteste, meiste „Gefällt mir“ dieser Woche oder neueste.',
  'help.gallery.categoriesName': 'Kategorien',
  'help.gallery.categories': 'Zeigt eine Art von Szenen.',
  'help.gallery.mine':
    'Die Szenen, die Sie veröffentlicht haben, mit ihren „Gefällt mir“.',
  'help.gallery.cardName': 'Eine Szene',
  'help.gallery.card':
    'Das Bild öffnet die Szene; Hinzufügen legt sie in Ihre Darstellungen.',
  'help.gallery.manage': 'Was jeder Monitor als Desktophintergrund zeigt.',
  'help.gallery.stop': 'Beendet alle Desktophintergründe.',
  'help.gallery.sceneCaption': 'Die Seite einer Szene',
  'help.gallery.back':
    'Zurück zur Galerie, dorthin, wo Sie sie verlassen haben.',
  'help.gallery.play':
    'Fügt die Szene Ihren Darstellungen hinzu oder spielt sie im Diagramm ab.',
  'help.gallery.desktop': 'Legt die Szene hinter Ihre Desktopsymbole.',
  'help.gallery.inspect':
    'Öffnet die Szene von FluidEQ im Studio, damit Sie sehen, wie sie gemacht ist.',

  'help.leaderboard.title': 'Die Rangliste',
  'help.leaderboard.intro':
    'Die Rangliste ordnet die Plus-Mitglieder, die ihr beitreten, danach, wie viel sie hören und wie viele „Gefällt mir“ ihre Szenen bekommen. Solange Sie nicht beitreten, ist sie aus.',
  'help.leaderboard.steps':
    'Öffnen Sie Konto und drücken Sie Der Rangliste beitreten.\nÖffnen Sie Plus → Rangliste. Wählen Sie das Kürzel und den Namen, die die Rangliste zeigt, und wechseln Sie dann zwischen Gesamt und Dieser Monat.\nZum Aufhören drücken Sie Rangliste verlassen. Alle meine Daten löschen entfernt alles, was Sie gesendet haben.',
  'help.leaderboard.tip':
    'Eine Zahl pro Tag verlässt Ihren Computer – die Minuten Musik, die gelaufen sind – und nie, was Sie abspielen. Jede Zahl wird auf dem Server geprüft. Kürzel und Name lassen sich später unter Konto → Namen ändern anpassen; Rangliste und veröffentlichte Szenen ziehen mit.',
  'help.leaderboard.keywords':
    'ranking, leaderboard, bestenliste, platzierung, punktestand, score, statistik, hörzeit, hördauer, wettbewerb',
  'help.leaderboard.periodName': 'Gesamt oder Dieser Monat',
  'help.leaderboard.period': 'Der gesamte Verlauf oder nur dieser Monat.',
  'help.leaderboard.standing':
    'Ihr Rang und Ihre Punkte und wie weit es bis zum nächsten Platz ist.',
  'help.leaderboard.earn':
    '10 Punkte pro Stunde, 20 für jeden Tag mit 30 Minuten oder mehr, 5 für jedes „Gefällt mir“.',

  'help.studio.title': 'Szenen im Studio bauen',
  'help.studio.intro':
    'Das Studio macht aus einer Beschreibung einen Visualizer. Ihr eigener KI-Assistent schreibt die Szene in einen Projektordner, und FluidEQ spielt jede Version zu Ihrer Musik ab, sobald sie gespeichert ist. Das Studio gehört zu Plus; ein neues Konto kann es mit der Gratis-Testphase öffnen.',
  'help.studio.steps':
    'Öffnen Sie Plus → Studio und drücken Sie Neues Projekt…. Geben Sie ihm einen Namen; FluidEQ legt seinen Ordner mit einer Szene an, die sich schon bewegt.\nBeschreiben Sie Ihre Idee, öffnen Sie den Ordner in Ihrem KI-Assistenten und fügen Sie den Prompt aus KI-Prompt kopieren ein.\nBeobachten Sie die Bühne, während Dateien gespeichert werden, und probieren Sie die Testsignale aus. Dann Zu meinen Darstellungen, Veröffentlichen… oder Exportieren….',
  'help.studio.tip':
    'Doppelklicken Sie auf die Bühne für Vollbild. In eine FluidEQ-Szene hineinschauen… öffnet eine der eigenen Szenen von FluidEQ zum Lernen; sie kann nicht veröffentlicht werden. Szenen, die stark flackern oder zu aufwendig sind, werden zurückgehalten. Eine Szene, die Sie veröffentlichen, liest zuerst ein Moderator, und eine freigegebene Szene bringt Ihnen einen Monat Plus.',
  'help.studio.keywords':
    'visualizer erstellen, szeneneditor, shader, GLSL, programmieren, ChatGPT, Claude, creator, hochladen',
  'help.studio.project': 'Ihre Projekte und FluidEQ-Szenen zum Hineinschauen.',
  'help.studio.stageName': 'Bühne',
  'help.studio.stage':
    'Die Szene, live zu Ihrer Musik. Doppelklick für Vollbild.',
  'help.studio.code':
    'Der Code der Szene, live aktualisiert, sobald Ihre KI ihn speichert.',
  'help.studio.hears':
    'Was die Szene empfängt: Pegel, Schlag, Bass, Mitten, Höhen.',
  'help.studio.signals': 'Testsignale, die nur diese Vorschau antreiben.',
  'help.studio.size':
    'Testet die Szene in einem Diagramm oder in einem schmalen, breiten oder Vollbild-Panel.',
  'help.studio.wave':
    'Testet Höhe und Position der Welle, die Hörer einstellen können.',

  'help.desktop.title': 'Der Desktop-Visualizer',
  'help.desktop.intro':
    'Der Desktop-Visualizer legt einen Plus-Visualizer hinter Ihre Desktopsymbole, auf einem Monitor oder auf jedem davon, solange FluidEQ läuft.',
  'help.desktop.steps':
    'Lassen Sie einen Plus-Visualizer im Diagramm laufen und drücken Sie den Monitor-Knopf neben seinem Namen, oder wählen Sie Ansicht → Als Desktophintergrund festlegen.\nDrücken Sie die Monitore auf der Karte, wählen Sie Mit der Musik oder Ruhig und drücken Sie Hintergrund festlegen.\nZum Ändern oder Beenden öffnen Sie Plus → Visualizer und nutzen Sie oben Verwalten oder Beenden.',
  'help.desktop.tip':
    'Er pausiert, solange Fenster den Monitor verdecken, bei gesperrtem PC und, wenn Sie wollen, im Akkubetrieb, und kehrt zurück, wenn FluidEQ startet. Beim Beenden von FluidEQ stoppt er. Nur unter Windows.',
  'help.desktop.keywords':
    'hintergrundbild, wallpaper, live-wallpaper, animiertes hintergrundbild, bildschirmhintergrund, zweiter monitor, mehrere bildschirme',
  'help.desktop.monitors':
    'Ihre Monitore, so wie Windows sie anordnet. Drücken Sie die, die Sie nutzen wollen.',
  'help.desktop.music': 'Bewegt sich zu dem, was gerade läuft.',
  'help.desktop.calm':
    'Eine langsame, ruhige Animation, die die Musik ignoriert.',
  'help.desktop.battery':
    'Spart Energie, solange der Computer nicht am Stromnetz ist.',
  'help.desktop.start': 'Startet ihn auf den Monitoren, die Sie gewählt haben.',

  'help.lighting.title': 'Dynamische Beleuchtung (Beta)',
  'help.lighting.intro':
    'Dynamische Beleuchtung lässt Tastatur, Maus, Mauspad, Headset und Ständer mit dem Plus-Visualizer im Diagramm leuchten, über Windows Dynamic Lighting und Razer Chroma. Die Funktion ist in der Betaphase, also sagen Sie uns, wie sich Ihre Geräte verhalten.',
  'help.lighting.steps':
    'Öffnen Sie Plus → Dynamische Beleuchtung und schalten Sie sie ein, oder drücken Sie im Diagramm den Beleuchtungsknopf neben einem Plus-Visualizer.\nWählen Sie den Lichtstil dieses Visualizers – Szene, Farbwelle, Spektrum oder Beat-Welle – und stellen Sie seine Helligkeit ein und worauf er reagiert.\nKlicken Sie im Bereich Ihre Geräte auf ein Gerät, um es einzeln abzustimmen; mit Alle Geräte stimmen Sie wieder alle ab.',
  'help.lighting.tip':
    'Hält Windows ein Gerät für eine andere App zurück, nennt die Seite die Einstellung, die Sie ändern müssen, und öffnet sie für Sie. Razer-Geräte brauchen ein laufendes Razer Synapse, in dem Chroma Apps erlaubt sind.',
  'help.lighting.keywords':
    'RGB, RGB-beleuchtung, LED-beleuchtung, tastaturbeleuchtung, lichteffekte, lichtshow, ambientebeleuchtung, keyboard, RGB aktivieren, beleuchtung einschalten',
  'help.lighting.switch':
    'Lässt Ihre Geräte leuchten, während ein Plus-Visualizer läuft.',
  'help.lighting.browse': 'Öffnet die Galerie, um einen Visualizer zu wählen.',
  'help.lighting.previewName': 'Live-Vorschau des Schreibtischs',
  'help.lighting.preview':
    'Ihr eigener Schreibtisch, beleuchtet mit den Farben, die an ihn gesendet werden.',
  'help.lighting.devices':
    'Alle gefundenen Geräte. Klicken Sie auf eines, um es einzeln abzustimmen.',
  'help.lighting.all': 'Zurück zum Abstimmen aller Geräte auf einmal.',
  'help.lighting.style':
    'Szene, Farbwelle, Spektrum oder Beat-Welle, gespeichert für jeden Visualizer.',

  'help.online.title': 'Mit Online-Medien hören',
  'help.online.intro':
    'Online-Medien hält unterstützte Seiten neben Ihrem EQ bereit. Wiedergabe und Anmeldung auf den Seiten hängen weiterhin vom Anbieter und von Ihrer Verbindung ab. Die Leiste am unteren Rand von FluidEQ folgt dem aktiven Player, und ihre Lautstärke ist die Ihres Computers.',
  'help.online.steps':
    'Öffnen Sie Online-Medien, wählen Sie eine Seite und starten Sie dort die Wiedergabe.\nWechseln Sie zum EQ für Anpassungen beim Hören und zurück für seiteneigene Bedienelemente.\nAktivieren Sie Nur ein Player, um überlappende Wiedergabe zu vermeiden.',
  'help.online.tip':
    'Unter der FluidEQ-Engine läuft der Tab Online-Medien wie jede andere App durch Ihren EQ und das DSP-Rack. Unter Equalizer APO bleibt das Rack bei den Titeln der Bibliothek.',
  'help.online.keywords':
    'YouTube, YouTube Music, Bandcamp, Twitch, Suno, streaming, streamingdienst, musik streamen, webseite, internet, browser',

  'help.library.title': 'Ihre lokale Bibliothek aufbauen',
  'help.library.intro':
    'Die Bibliothek bringt Musik und Videos von Ihren Laufwerken zusammen. Stöbern Sie nach Alben, Interpreten, Genres, Songs, Ordnern, in einem Ordnerbaum oder in Ihren Playlists. Cover und Details stammen aus Ihren Dateien, deshalb kann dieselbe Sammlung je nach ihren Tags unterschiedlich aussehen.',
  'help.library.steps':
    'Öffnen Sie Bibliothek und fügen Sie den Ordner mit Ihren Medien hinzu. Warten Sie, bis das Einlesen fertig ist, bevor Sie beurteilen, was fehlt.\nWählen Sie einen Interpreten oder ein Album oder suchen Sie nach einem Song. Starten Sie einen Titel aus den Ergebnissen.\nMit der Leiste am unteren Fensterrand pausieren, spulen und springen Sie. Die Lautstärke dort ist die Ihres Computers, dieselbe wie in Windows.',
  'help.library.tip':
    'Fahren Sie mit der Maus über das Symbol von FluidEQ in der Windows-Taskleiste, um Vorheriger Titel, Wiedergeben und Nächster Titel zu nutzen, auch wenn FluidEQ minimiert ist. Die Bibliothek braucht die Originaldateien: Verbinden Sie ein Laufwerk erneut oder fügen Sie einen verschobenen Ordner neu hinzu.',
  'help.library.keywords':
    'musikplayer, mediathek, musiksammlung, eigene musik, musik hinzufügen, abspielen, wiedergabeleiste, künstler, wiedergabeliste, MP3, FLAC, WAV, AAC, dateiformate, scannen, metadaten, ID3-tags, albumcover, musikordner',

  'help.queue.title': 'Alben und Wiedergabewarteschlange',
  'help.queue.intro':
    'Die Warteschlange bestimmt die Hörreihenfolge. Ein anderes Album zu öffnen ersetzt nicht den aktuellen Titel. Aktiver Titel und Als Nächstes zeigen Ihren Platz.',
  'help.queue.steps':
    'Öffnen Sie ein Album, um seine Titel anzusehen. Starten Sie den, den Sie hören wollen.\nKlicken Sie mit der rechten Maustaste auf einen Song, um Zur Warteschlange, Zu Favoriten hinzufügen oder Zu Playlist hinzufügen zu wählen.\nÖffnen Sie Als Nächstes, um zu sehen, was danach läuft, und schalten Sie Weiterspielen ein, um mit mehr aus demselben Genre weiterzuhören.',
  'help.queue.tip':
    'Starten Sie die Wiedergabe in der Bibliothek, übernimmt sie von den anderen Playern in FluidEQ. Am aktuellen Titel in der Leiste erkennen Sie, welche Quelle gerade wiedergibt.',
  'help.queue.keywords':
    'queue, zufallswiedergabe, shuffle, wiederholen, repeat, dauerschleife, nächstes lied, autoplay, lieblingssongs, playlist erstellen',

  'help.karaoke.title': 'Mit Karaoke singen',
  'help.karaoke.intro':
    'Karaoke verbindet eigenes Audio und Liedtexte. Zeitmarkierte Texte folgen der Wiedergabe; Zieltonhöhen erfordern Notendaten. Ein eingerichtetes Mikrofon ergänzt Ihre Live-Tonhöhe.',
  'help.karaoke.steps':
    'Öffnen Sie Karaoke und fügen Sie Dateien oder Ordner mit passendem Audio und Text hinzu.\nWählen Sie ein Lied, starten Sie es und prüfen Sie die Zuordnung.\nRichten Sie das Mikrofon ein, passen Sie die Textgröße an und nutzen Sie den Vollbildknopf der Bühne.',
  'help.karaoke.tip':
    'Eine reine Textdatei enthält keine Zielnoten. Karaoke spielt mit der Lautstärke Ihres Computers; die Pegel für Melodie, Playback und Führungsstimme finden Sie unter Mix-Einstellungen.',
  'help.karaoke.keywords':
    'mitsingen, songtext anzeigen, lyrics, mic, pitch, mikrofon einrichten, lieder hinzufügen, LRC, UltraStar',

  'help.maker.title': 'Im Karaoke-Editor erstellen',
  'help.maker.intro':
    'Der Karaoke-Editor macht Audio zu einem bearbeitbaren Projekt mit Texten und Noten auf der Zeitleiste. Prüfen Sie automatisch erzeugte Wörter und Zeiten immer nach.',
  'help.maker.steps':
    'Öffnen Sie Erstellen in Karaoke und laden Sie Audio. Wählen Sie benötigte Trennungs- oder Transkriptionswerkzeuge.\nBeobachten Sie den Fortschritt; beim ersten KI-Einsatz können Modelle geladen werden. Prüfen Sie Texte und Noten.\nHören Sie kurze Stellen, korrigieren Sie Zeiten und Text, speichern Sie das Projekt und exportieren Sie die Dateien.',

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
    'Modelle benötigen Verbindung und Speicherplatz. Die Dauer hängt von Hardware und Liedlänge ab. Verwenden Sie zulässiges Audio und prüfen Sie vor dem Teilen.',
  'help.maker.keywords':
    'gesang entfernen, vocals, vocal remover, instrumental, acapella, stems, spuren trennen, gesang isolieren, lyrics synchronisieren, transkribieren, modelle herunterladen',

  'help.share.title': 'Audio zwischen Computern teilen',
  'help.share.intro':
    'Audio teilen überträgt Systemklang zwischen Computern im selben privaten Netzwerk. Der Empfänger hat Kopfhörer oder Lautsprecher; andere Computer senden. Das ist etwas anderes als ein zweiter Ausgang am selben Computer.',
  'help.share.steps':
    'Öffnen Sie am Hörcomputer Audio teilen, wählen Sie Audio auf diesem Computer wiedergeben und drücken Sie Verbindungscode erstellen. Beginnen Sie leise.\nWählen Sie an jedem Quellcomputer Audio dieses Computers senden, fügen Sie den Code für Ihr Netzwerk ein und drücken Sie Verbinden und senden.\nBehalten Sie den Verbindungsmonitor im Blick. Drücken Sie Senden beenden oder Empfang beenden, wenn Sie fertig sind; Neuen Code erstellen trennt alle gespeicherten Kopplungen.',
  'help.share.tip':
    'Halten Sie den Verbindungscode privat: Er erlaubt die Kopplung. Mehrere Sender werden zusammengemischt und erhöhen den Pegel, den die Lautstärke des empfangenden Computers regelt. Unter der FluidEQ-Engine läuft empfangenes Audio außerdem durch das DSP-Rack.',
  'help.share.keywords':
    'LAN, WLAN, heimnetzwerk, lokales netzwerk, anderer PC, anderer rechner, audio streamen, audio übertragen, remote, koppeln',

  'help.trouble.title': 'Wenn etwas falsch klingt',
  'help.trouble.intro':
    'Beginnen Sie bei Quelle und Ausgang und isolieren Sie dann die Ebene. Ein Diagramm, ein gespeichertes Preset oder ein eingeschalteter Schalter allein beweist nicht, dass der Ton das gewünschte Gerät erreicht hat. Das Menü Hilfe führt außerdem zur Audioreparatur, zu Problemberichten und zum Forum.',
  'help.trouble.steps':
    'Kein Ton: Prüfen Sie, ob die Wiedergabe läuft, der erwartete Ausgang gewählt ist, die Lautstärke aufgedreht und das Gerät verbunden ist. Prüfen Sie, ob Nur ein Player eine andere Quelle pausiert hat.\nKeine EQ-Wirkung: Prüfen Sie, ob System-EQ eingeschaltet ist und beim Ausgang nicht AUS steht; falls doch, drücken Sie Aktivieren. Meldet ein Hinweis, dass die Engine nicht läuft, drücken Sie Windows-Audio neu starten.\nAlles sieht richtig aus und der EQ tut trotzdem nichts: Windows spielt die Musik möglicherweise an der Engine vorbei. Der Hinweis sagt das und bietet an, sie mit einem Druck dorthin zu verschieben, wo Windows sie nutzt; das kostet eine Berechtigung und eine Sekunde Stille.\nVerzerrung oder zu viel Bass: Lassen Sie Automatisch normalisieren eingeschaltet, reduzieren Sie Anhebungen und umgehen Sie Ebenen einzeln. Falls es bleibt, nutzen Sie Problem melden und prüfen Sie den Bericht vor dem Senden.',
  'help.trouble.tip':
    'F1 öffnet dieses Handbuch. Esc schließt zuerst eine vergrößerte Aufnahme, dann das Handbuch. Ist die Oberfläche zu groß, setzt Strg + 0 den Zoom zurück. Prozesse im Aktionsmenü zeigt, was jeder Teil von FluidEQ gerade tut.',
  'help.trouble.keywords':
    'funktioniert nicht, geht nicht, kein sound, höre nichts, stumm, fehlerbehebung, problembehandlung, fehlerbericht, bug, beheben, reparieren, aussetzer, knacken, knackt, stottern, verzerrt, übersteuert, clipping, zu leise, support, tastenkürzel, tastaturkürzel, tastenkombinationen, shortcuts, zoom zurücksetzen',

  'help.forum.title': 'Im Forum fragen',
  'help.forum.intro':
    'Das Forum holt die GitHub Discussions von FluidEQ in die App: Ankündigungen, Ideen, Fragen und Klangeinstellungen, auf die Leute stolz sind. Lesen kann jeder; zum Schreiben nutzen Sie Ihr GitHub-Konto, kein FluidEQ-Konto.',
  'help.forum.steps':
    'Öffnen Sie Hilfe → Forum und wählen Sie eine Kategorie: Ankündigungen, Allgemein, Ideen, Umfragen, Q&A oder Schaufenster.\nDurchsuchen Sie das Forum oder öffnen Sie ein Thema, um die Antworten zu lesen.\nDrücken Sie Mit GitHub anmelden, schließen Sie die Anmeldung im Browser ab und schreiben Sie dann ein Neues Thema oder eine Antwort.',
  'help.forum.tip':
    'Alles, was Sie schreiben, ist auf GitHub unter Ihrem GitHub-Namen öffentlich. Markieren Sie in Q&A die Antwort, die geholfen hat, damit die nächste Person sie findet.',
  'help.forum.keywords':
    'community, diskussionen, feedback, rückmeldung, funktionswunsch, feature-request, verbesserungsvorschlag, vorschlagen, frage stellen, kontakt, entwickler kontaktieren, support',
};

export default help;
