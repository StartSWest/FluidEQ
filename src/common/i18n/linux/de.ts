/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dictionary } from '../en';

/** German of `./en.ts`, the Linux wording; see there. */
const de: Partial<Dictionary> = {
  'wallpaper.manage.empty':
    'Jeder Monitor zeigt seinen normalen Desktop-Hintergrund.',
  'wallpaper.monitor.ordinary': 'Desktop-Hintergrund',
  'wallpaper.pause.locked': 'Pausiert, während der Bildschirm gesperrt ist',
  'wallpaper.error.unsupported':
    'Desktop-Hintergründe benötigen GNOME und die Erweiterung FluidEQ Desktop.',
  'wallpaper.error.host':
    'Der Visualizer konnte den Desktop nicht erreichen. Aktivieren Sie FluidEQ Desktop unter Erweiterungen und versuchen Sie es erneut.',
  'app.menu.restartAudio': 'Audio neu starten',
  'restart.title': 'Audio neu starten',
  'restart.failed': 'Audio konnte nicht neu gestartet werden.',
  'notice.restartConfirm':
    'Der Ton setzt für ein paar Sekunden aus, während die FluidEQ-Engine neu startet. Fortfahren?',
  'notice.restartDone':
    'Audio wurde neu gestartet. Öffnen Sie Programme, die noch stumm sind, erneut.',
  'troubleshoot.restart.title': 'Audio neu starten',
  'troubleshoot.restart.cost':
    'Ein paar Sekunden Stille, während die FluidEQ-Engine neu startet. Kein Passwort.',
  'engine.title': 'Wie FluidEQ Ihren Ton verarbeitet',
  'engine.subtitle':
    'Die FluidEQ-Engine läuft neben Ihrem Soundserver, PipeWire oder PulseAudio, solange FluidEQ geöffnet ist.',
  'engine.fluid.l1':
    'Funktioniert mit PipeWire und PulseAudio, auf jeder Distribution',
  'engine.fluid.l2':
    'EQ und DSP-Rack gelten für alles, was Sie hören, ohne Neustart',
  'engine.fluid.l3':
    'Plugin:-Zeilen und VST-Plugins in der Konfiguration laufen nicht',
  'output.hint':
    'Änderungen werden im aktiven Profil gespeichert und folgen dieser Ausgabe, wann immer sie gerade spielt.',
  'extraOutput.ambiguous':
    'Zwei Ausgänge tragen denselben Namen, deshalb kann FluidEQ sie nicht unterscheiden. Benennen Sie einen in Ihren Soundeinstellungen um.',
  'extraOutput.unmatched':
    'Ihre Soundeinstellungen führen diesen Ausgang auf, FluidEQ erreicht ihn aber nicht, deshalb ist Spiegeln darauf nicht möglich.',
  'convolution.eyebrow': 'IMPULSANTWORTEN',
  'convolution.notice.fluid':
    'Den herunterladbaren Katalog stellt AutoEq bereit. Jeder Download passt zur Abtastrate, mit der Ihr Ausgang läuft, und die FluidEQ-Engine rechnet jede andere Rate selbst um.',
  'graph.scene.gpu.auto': 'Das System entscheidet',
  'settingsReset.body':
    'Diagramm und Visualizer, Fensterfarben, Player, Bibliothek, Sprache, Animationen, „Beim Anmelden starten“ und der Desktop-Hintergrund werden so eingestellt wie bei einer neuen Installation von FluidEQ.',
  'app.processes.hint':
    'Ihr System benennt jeden davon nach der App, weil es dasselbe Programm ist. Hier steht, was jeder davon tatsächlich für FluidEQ tut.',
  'app.processes.what.engine':
    'Die eigene Engine von FluidEQ. Dekodiert, was Sie abspielen, und wendet dabei den Equalizer an. Ein eigenständiges Programm, damit ein ausgelastetes Fenster die Musik nicht ins Stocken bringt.',
  'app.processes.what.devices':
    'Wird von Chromium gestartet, wenn die App fragt, welche Audiogeräte es gibt; dieselbe Abfrage listet auch Videogeräte auf. Es öffnet keine Kamera und nimmt nichts auf.',
  'app.processes.name.systemEngine': 'FluidEQ-Engine (Systemaudio)',
  'app.processes.what.systemEngine':
    'Der Equalizer zwischen Ihren Apps und Ihrem Soundserver, der ihn auf alles anwendet, was Sie hören. FluidEQ startet und beendet ihn mit sich selbst; sein Speicher und seine CPU werden angezeigt, aber nicht zur Summe addiert.',
  'dsp.normalizer.liveGuidance':
    'Der Live-Pegelausgleich folgt dem Titel, der gerade läuft. Eine laute Passage senkt die Verstärkung für den Rest des Titels; der nächste Titel behält diesen Pegel, außer er ist deutlich leiser. Bereits gehörte Titel werden ab der ersten Sekunde ausgeglichen. Anhebung höchstens 6 dB innerhalb des Spitzenpegelspielraums; der Zielwert ist nicht garantiert. Zum Neueinmessen aus- und einschalten. Vorhandene Verzerrung wird nicht behoben.',
  'dsp.latency.hint':
    'Von der Engine hinzugefügte Verarbeitungsverzögerung. Soundserver, Gerät und Netzwerk sind nicht enthalten.',
  'dsp.latency.note':
    'Von der Engine gemeldete Puffer bei der aktuellen Abtastrate. Soundserver, Gerät und Netzwerk sind nicht enthalten.',
  'dsp.surround.onHint':
    'Lässt das Rack auf jedem Kanal eines 5.1- oder 7.1-Ausgangs laufen, so wie Ihr Ausgang eingestellt ist, mit einer Pegelentscheidung für alle.',
  'update.mandatory.failedInstall':
    'Das Update wurde geladen, aber das Installationsprogramm ist nicht gestartet. Möglicherweise ist die geladene Datei beschädigt.',
  'startup.label': 'Beim Anmelden starten',
  'startup.blocked': 'Ihr Desktop hat das in seinen Autostart-Apps deaktiviert',
  'startup.failed': 'Ihr System ließ die Änderung nicht zu',
  'disclaimer.liability':
    'FluidEQ verändert die Audioverarbeitung auf Ihrem Rechner: Seine Engine sitzt zwischen Ihren Apps und Ihrem Soundserver und verarbeitet alles, was Sie hören. Soweit das Gesetz es zulässt, haftet {author} nicht für Schäden, die aus der Nutzung entstehen — an Ihrem Gehör, an Lautsprechern, Kopfhörern oder anderen Geräten, an Daten oder anderer Software oder an sonst etwas, einschließlich Schäden, die Sie nicht vorhersehen konnten.',
  'provenance.body':
    'Die offiziellen Pakete von FluidEQ werden ausschließlich über fluideq.com bereitgestellt. Builds aus dem Quellcode sollten aus dem offiziellen Repository stammen. Die GPL erlaubt es Dritten, FluidEQ zu kopieren, zu verändern, neu zu erstellen und zu verkaufen, aber deren Builds sind nicht von FluidEQ geprüft, unterstützt oder gebilligt. Wenn ein Download vorgibt, offiziell zu sein, und weder von fluideq.com noch aus dem offiziellen Repository stammt, schließen Sie ihn und melden Sie ihn.',
  'engineHealth.offBody':
    'Auf diesem Ausgang läuft Ton ohne Ihren EQ. Ein Neustart des Audios holt die Engine meist zurück, und alles andere in FluidEQ funktioniert währenddessen weiter.',
  'engineHealth.rackNeedsEngine':
    'Die DSP-Effekte laufen in der Engine selbst. Ein Neustart des Audios startet sie erneut; hilft das nicht, setzt eine Neuinstallation von FluidEQ seine eigene Engine wieder ein.',
  'tour.engine.lead':
    'FluidEQ hat jetzt eine eigene Audio-Engine. Sie läuft neben Ihrem Soundserver, PipeWire oder PulseAudio, und wendet Ihren EQ und das ganze DSP-Rack auf alles an, was der Computer abspielt: Spiele, Browser, Streaming-Apps – nicht nur auf die Bibliothek.',
  'tour.engine.flow.inside': 'Neben Ihrem Soundserver',
  'tour.dsp.lead':
    'Ein Rack aus Studiostufen: Normalisierung, Rauschentfernung, Exciter, Bass-Schmiede, Equalizer, Bass-Punch, Dimension, Raum, Maximizer und Master, plus eine Überblendung zwischen Titeln der Bibliothek. Es wirkt auf alles, was der Computer abspielt. Jede Stufe hat eine eigene Seite mit Live-Ansicht, die meisten haben Presets, und fünf haben einen Isolieren-Schalter, um nur zu hören, was sie tun.',
  'tour.dsp.how':
    'Öffnen Sie den Tab DSP, wählen Sie unter Presets eine Kette, klicken Sie dann in den Seitentabs auf eine Stufe und schalten Sie sie auf Ein.',
  'help.start.steps':
    'Installieren Sie FluidEQ aus seinem .deb oder AppImage und öffnen Sie es: Die FluidEQ-Engine startet mit, ohne Passwort und ohne Neustart.\nWählen Sie unter Ausgabegerät das Gerät, über das Sie hören. Aktivieren Sie System-EQ und lassen Sie Automatisch normalisieren eingeschaltet.\nSpielen Sie ein Lied, öffnen Sie EQ → Bänder, ändern Sie etwas leicht und vergleichen Sie mit ein- und ausgeschaltetem System-EQ.',
  'help.start.tip':
    'Systemweiter EQ braucht unter Linux PipeWire oder PulseAudio, die jeder aktuelle Desktop verwendet. Solange FluidEQ geöffnet ist, läuft alles, was Sie abspielen, durch FluidEQ; beim Beenden bekommen Sie Ihren Ton unverändert zurück.',
  'help.window.tip':
    'Hilfe öffnet dieses Handbuch, Neuerungen, die Audioreparatur und Problem melden. Hinter dem Puls-Knopf daneben finden Sie die Karte der Engine, Ihr Konto, den Import von EQ-Einstellungen oder einer Impulsantwort, den Neustart des Audios und Prozesse, wo Sie sehen, was jeder Teil von FluidEQ gerade nutzt; ganz unten stehen Helligkeit und Transparenz, die Animationen, Beim Anmelden starten und die Sprache. Mit dem Schalter danach wechselt das Fenster in die Ansicht Kompakter Player.',
  'help.window.actions':
    'Die Engine, Ihr Konto, der Import von EQ-Einstellungen, der Neustart des Audios und Prozesse; Helligkeit und Transparenz, die Animationen, Beim Anmelden starten und die Sprache.',
  'help.player.tip':
    'Die Lautstärke des Players ist die Ihres Computers und regelt daher den Pegel von allem, was der Computer abspielt. Landet der Player außerhalb des Bildschirms, klicken Sie in der oberen Leiste mit der rechten Maustaste auf das Symbol von FluidEQ und wählen Sie Fenster wiederherstellen.',
  'help.player.volume':
    'Die Lautstärke Ihres Computers; sie regelt den Pegel von allem, was der Computer abspielt.',
  'help.requirements.intro':
    'FluidEQ läuft auf jedem 64-Bit-Linux-Desktop der letzten Jahre – Ubuntu, Debian, Fedora, Mint, Arch und allen übrigen. Zwei Teile verlangen mehr als der Rest: die Plus-Visualizer zeichnen auf der Grafikkarte, und die Karaoke-KI lädt ihre Modelle beim ersten Mal herunter.',
  'help.requirements.steps':
    'Prüfen Sie Ihr System: 64-Bit-Linux mit PipeWire oder PulseAudio (jeder aktuelle Desktop hat eines davon), 4 GB Arbeitsspeicher und rund 600 MB Festplatte. Das .deb ist für Ubuntu, Debian und ihre Verwandten; das AppImage läuft auf den übrigen.\nÖffnen Sie einen Visualizer: jede Grafikkarte oder integrierte Grafik ab 2013. Bei 1080p genügt die integrierte Grafik; für 4K ist eine eigene Karte besser. Ist die Karte ausgelastet, zeichnet FluidEQ die Szene kleiner und gibt die Szenen frei, die Sie nicht sehen.\nProbieren Sie das Karaoke mit KI: Das Trennen der Stimme lädt beim ersten Mal ein Modell von 713 MB, das Tonhöhenmodell kommt mit etwa 180 MB dazu und die Rauschentfernung mit 11 MB. Es läuft auf dem Prozessor, wo ein vierminütiges Lied in rund vier Minuten getrennt ist. Halten Sie währenddessen 2 GB Arbeitsspeicher frei.\nStreben Sie das an, wenn es geht: 8 GB Arbeitsspeicher, Grafik ab 2018 und 3 GB freier Speicher, wenn Sie die KI-Funktionen nutzen.',
  'help.requirements.keywords':
    'systemanforderungen, systemvoraussetzungen, mindestanforderungen, anforderungen, voraussetzungen, empfohlen, hardware, specs, GPU, onboard-grafik, CPU, RAM, speicherplatz, laptop, notebook, leistung, performance, langsam, ruckelt, lag, kompatibilität, kompatibel, Linux, Ubuntu, Debian, Fedora, Mint, Arch, PipeWire, PulseAudio, deb, AppImage',
  'help.engine.intro':
    'FluidEQ verarbeitet Ihren Ton mit seiner eigenen Engine. Die FluidEQ-Engine läuft neben Ihrem Soundserver (PipeWire oder PulseAudio): Sie wird zur Ausgabe des Systems, wendet Ihren EQ und das DSP-Rack auf alles an, was der Computer abspielt, leitet das Ergebnis an Ihren echten Ausgang weiter und zieht sich zurück, sobald FluidEQ geschlossen wird.',
  'help.engine.steps':
    'Öffnen Sie das Aktionsmenü – den Puls-Knopf oben rechts. Die Karte der Engine ganz oben zeigt, ob die Engine läuft.\nWählen Sie im Bereich Ausgabe den Ausgang, über den Sie hören. FluidEQ spielt darauf ab und folgt Ihnen, wenn Sie in Ihren Soundeinstellungen einen anderen wählen.\nMeldet ein Hinweis, dass die Engine nicht läuft, drücken Sie Audio neu starten.',
  'help.engine.tip':
    'Lassen Sie FluidEQ die Ausgabe des Systems sein: Lautsprecher oder ein Headset in Ihren Soundeinstellungen zu wählen ist in Ordnung, FluidEQ folgt ihnen. Beim Beenden von FluidEQ geht jede App an die Ausgabe zurück, die Sie gewählt haben.',
  'help.engine.keywords':
    'audio-engine, audiotreiber, treiber, systemweit, alle programme, Spotify, Discord, browser, PipeWire, PulseAudio, soundserver, ausgabe, standardausgabe, audio neu starten',
  'help.engine.apo':
    'Nicht unter Linux: Equalizer APO ist ein Windows-Programm, und hier übernimmt die FluidEQ-Engine seine Arbeit.',
  'help.engine.apply':
    'Unter Linux nicht nötig: Die FluidEQ-Engine ist die einzige Engine und bereits in Gebrauch.',
  'help.convolution.tip':
    'Die FluidEQ-Engine rechnet jede Impulsrate selbst um. Katalogdownloads brauchen eine Verbindung, das Handbuch nicht.',
  'help.profiles.output':
    'Der Ausgang, über den Sie hören, bei Bluetooth-Kopfhörern mit ihrem Akku. AUS bedeutet, dass Ihr EQ ihn nicht erreicht; AKTIV, dass er gerade spielt.',
  'help.config.tip':
    'Generierte Ebenendateien werden neu geschrieben, wenn sich ihre Einstellungen ändern; dauerhafte eigene Zeilen gehören in die benutzerdefinierte Datei des jeweiligen Ausgangs. Die FluidEQ-Engine liest daraus die Zeilen Filter, Preamp, GraphicEQ und Convolution; Plugin:-Zeilen und VST-Plugins laufen unter Linux nicht.',
  'help.dsp.intro':
    'Das DSP-Rack ist eine Kette aus Studiostufen. Unter der FluidEQ-Engine verarbeitet es alles, was der Computer abspielt. Solange FluidEQ ausgeschaltet ist, ist es aus.',
  'help.room.tip':
    'Spiele und Filme schicken ihre Surround-Kanäle nur an einen Ausgang, der mit so vielen Lautsprechern eingerichtet ist: Hat Ihr Gerät sie, wählen Sie dafür in Ihren Soundeinstellungen 5.1 oder 7.1.',
  'help.online.tip':
    'Unter der FluidEQ-Engine läuft der Tab Online-Medien wie jede andere App durch Ihren EQ und das DSP-Rack.',
  'help.library.tip':
    'Die Bibliothek braucht die Originaldateien: Verbinden Sie ein Laufwerk erneut oder fügen Sie einen verschobenen Ordner neu hinzu.',
  'help.share.tip':
    'Halten Sie den Verbindungscode privat: Er erlaubt das Verbinden. Dieser Computer lässt sein DSP beim Teilen an, und der Computer, der seinen Ton abspielt, wendet sein eigenes an. Gleichzeitig abspielen und senden erfordert auf diesem Computer Windows oder unter Linux die FluidEQ-Engine; anderswo läuft eine Verbindung in eine Richtung.',
  'help.trouble.steps':
    'Kein Ton: Prüfen Sie, ob die Wiedergabe läuft, der erwartete Ausgang gewählt ist, die Lautstärke aufgedreht und das Gerät verbunden ist. Prüfen Sie, ob Nur ein Player eine andere Quelle pausiert hat.\nKeine EQ-Wirkung: Prüfen Sie, ob System-EQ eingeschaltet ist und beim Ausgang nicht AUS steht. Meldet ein Hinweis, dass die Engine nicht läuft, drücken Sie Audio neu starten.\nAlles sieht richtig aus und der EQ tut trotzdem nichts: Prüfen Sie, ob FluidEQ in Ihren Soundeinstellungen noch die Ausgabe ist; ein Neustart des Audios stellt das wieder her.\nVerzerrung oder zu viel Bass: Lassen Sie Automatisch normalisieren eingeschaltet, reduzieren Sie Anhebungen und umgehen Sie Ebenen einzeln. Falls es bleibt, nutzen Sie Problem melden und prüfen Sie den Bericht vor dem Senden.',
  'troubleshoot.description':
    'Unter Linux behebt ein einziger Schritt fast jedes Problem: der Neustart der FluidEQ-Engine, der ein paar Sekunden dauert.',
  'troubleshoot.footer':
    'Stimmt danach immer noch etwas nicht? Nutzen Sie **{report}** im selben Menü – es sammelt die Protokolle, entfernt alles, was Sie identifizieren könnte, und zeigt Ihnen alles, bevor etwas gesendet wird.',
  'help.window.plus': 'Visualizer, die Galerie und das Studio.',
  'help.plus.intro':
    'Ein Konto ist optional: Alles, was kostenlos war, läuft auf diesem Computer auch ohne. Angemeldet bündelt der Plus-Tab „Visualizer“ und das Studio. Eine Szene aus „Visualizer“ kostet einen Credit und gehört Ihnen für immer; ein bestätigtes Konto erhält einige Credits gratis, und Credit-Pakete werden einmalig bezahlt.',
  'help.library.steps':
    'Öffnen Sie Bibliothek und fügen Sie den Ordner mit Ihren Medien hinzu. Warten Sie, bis das Einlesen fertig ist, bevor Sie beurteilen, was fehlt.\nWählen Sie einen Interpreten oder ein Album oder suchen Sie nach einem Song. Starten Sie einen Titel aus den Ergebnissen.\nMit der Leiste am unteren Fensterrand pausieren, spulen und springen Sie. Die Lautstärke dort ist die Ihres Computers.',
};

export default de;
