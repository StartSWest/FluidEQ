/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Bitte unterstütze uns',
  'tour.rainbow.title': 'Willkommen im Regenbogenmodus',
  'tour.rainbow.subtitle': 'Mit einem Klick einschalten',
  'tour.rainbow.lead':
    'Regenbogenfarben, leuchtende Akzente und ein Rand, der das Farbspektrum durchläuft. Nur das Aussehen ändert sich, nie der Klang.',
  'tour.rainbow.how':
    'Hier sofort einschalten — ×10 ist nicht nötig. Deine Wahl wird gespeichert und du kannst den Modus jederzeit ausschalten. Beiträge sind freiwillig.',
  'tour.rainbow.enable': 'Regenbogenmodus einschalten',
  'tour.rainbow.disable': 'Regenbogenmodus ausschalten',
  'tour.rainbow.waveform': 'Vorschau der oberen Wellenform',
  'tour.rainbow.toggleHint':
    'Klicke oben auf den Schalter „RAINBOW MODE“, um den Modus ein- oder auszuschalten.',
  'tour.eyebrow': 'NEU IN DIESER VERSION',
  'tour.title': 'Neu in FluidEQ',
  'tour.close': 'Schließen',
  'tour.rail': 'Neue Funktionen',
  'tour.stepOf': '{current} von {total}',
  'tour.back': 'Zurück',
  'tour.next': 'Weiter',
  'tour.done': 'Verstanden',
  'tour.dontShowAgain': 'Für diese Version nicht mehr anzeigen',
  'tour.releaseNotes': 'Vollständige Versionshinweise',
  'tour.rail.new': 'NEU IN DIESER VERSION',
  'tour.rail.always': 'AUSSERDEM IN FLUIDEQ',
  'tour.newBadge': 'NEU',
  'tour.howTitle': 'So geht es los',
  'tour.beta': 'Beta',

  'tour.engine.kicker': 'UNSERE EIGENE AUDIO-ENGINE',
  'tour.engine.title': 'Die FluidEQ-Engine',
  'tour.engine.subtitle': 'EQ und DSP für alles, was Sie hören',
  'tour.engine.lead':
    'FluidEQ hat jetzt eine eigene Audio-Engine. Sie läuft im Audiodienst von Windows, nach den Effekten Ihrer Soundkarte, und wendet Ihren EQ und das ganze DSP-Rack auf alles an, was der Computer abspielt: Spiele, Browser, Streaming-Apps – nicht nur auf die Bibliothek.',
  'tour.engine.point1':
    'Das DSP-Rack für das gesamte Systemaudio, ohne dass in FluidEQ etwas läuft.',
  'tour.engine.point2':
    'Live-Pegelausgleich, der den Song kennt, und Rauschentfernung, die den Ton beim Abspielen säubert.',
  'tour.engine.point3':
    'Beenden Sie FluidEQ, und Ihr Klang ist sofort wieder normal, selbst nach einem Absturz.',
  'tour.engine.how':
    'Wählen Sie die FluidEQ-Engine bei der Installation oder öffnen Sie das Aktionsmenü und wählen Sie sie dort. Öffnen Sie dann DSP und schalten Sie eine Stufe ein, während eine beliebige App etwas abspielt.',
  'tour.engine.open': 'DSP öffnen',
  'tour.engine.flow.label':
    'Alles, was der Computer abspielt, läuft durch die FluidEQ-Engine – Ihren EQ, dann das DSP-Rack – auf dem Weg zu Ihren Kopfhörern und Lautsprechern.',
  'tour.engine.flow.games': 'Spiele',
  'tour.engine.flow.browser': 'Browser',
  'tour.engine.flow.music': 'Musik-Apps',
  'tour.engine.flow.video': 'Videos',
  'tour.engine.flow.inside': 'Innerhalb von Windows-Audio',
  'tour.engine.flow.eq': 'Ihr EQ',
  'tour.engine.flow.rack': 'DSP-Rack',
  'tour.engine.flow.headphones': 'Kopfhörer',
  'tour.engine.flow.speakers': 'Lautsprecher',

  'tour.plus.kicker': 'FLUIDEQ PLUS',
  'tour.plus.title': 'Willkommen bei FluidEQ Plus',
  'tour.plus.subtitle': 'Visualizer, Studio, Beleuchtung und mehr',
  'tour.plus.lead':
    'Eine freiwillige Mitgliedschaft, die FluidEQ weiter wachsen lässt, mit einem ganz neuen Tab dafür: auf Ihrer Grafikkarte gezeichnete Szenen, ein Studio für eigene Szenen, die Rangliste, Desktophintergründe und Dynamische Beleuchtung. Alles, was kostenlos war, bleibt kostenlos.',
  'tour.plus.point1':
    'Melden Sie sich im Aktionsmenü unter Konto an; bezahlt wird in Ihrem Browser, und Plus schaltet sich von selbst ein.',
  'tour.plus.point2':
    'Monatlich oder jährlich, mit Bedingungen in klaren Worten, bevor Sie zahlen. Die App sieht Ihre Karte nie.',
  'tour.plus.point3':
    'Auf bis zu fünf Computern angemeldet, mit neuen Visualizern, die nach und nach hinzukommen.',
  'tour.plus.how':
    'Öffnen Sie den Tab Plus: Links untereinander stehen Rangliste, Visualizer, Studio und Dynamische Beleuchtung.',
  'tour.plus.open': 'Plus öffnen',
  'tour.plus.imageAlt':
    'Der Tab Plus: Rangliste, Visualizer, Studio und Dynamische Beleuchtung seitlich untereinander und die Visualizer-Galerie mit Chrom, Blüte, Aurora, Alpin und Neonstadt.',
  'tour.scene.alpine': 'Alpin',
  'tour.scene.aurora': 'Aurora',
  'tour.scene.bloom': 'Blüte',
  'tour.scene.chrome': 'Chrom',
  'tour.scene.neonCity': 'Neonstadt',

  'tour.visualizers.kicker': 'VISUALIZER',
  'tour.visualizers.title': 'Szenen, die sich mit Ihrer Musik bewegen',
  'tour.visualizers.subtitle': 'Auf Ihrer Grafikkarte gezeichnet',
  'tour.visualizers.lead':
    'Plus-Visualizer sind lebendige Szenen – Berge unter dem Sternenhimmel, Vorhänge aus Polarlicht, eine Neonstadt –, die auf Ihrer Grafikkarte unter Ihren EQ-Kurven gezeichnet werden. Bass, Beat und Höhen bewegen jeweils etwas anderes, und das Fenster um sie herum kann ihre Farben annehmen.',
  'tour.visualizers.point1':
    'Eine Auswahl für alles: 28 kostenlose Stile zum Formen und Einfärben, dazu Plus-Visualisierungen nach Kategorien.',
  'tour.visualizers.point2':
    'Stöbern Sie in der Galerie, testen Sie zehn Sekunden lang die Kostproben von FluidEQ und fügen Sie die Szenen hinzu, die Ihnen gefallen.',
  'tour.visualizers.point3':
    'Lassen Sie Darstellungen automatisch wechseln, schalten Sie auf Vollbild und stellen Sie unter Ansicht Attack und Release einer Szene ein.',
  'tour.visualizers.how':
    'Klicken Sie im Diagramm auf den Namen der Darstellung und wählen Sie unter Plus-Visualisierungen eine Szene, oder sehen Sie sich alle unter Plus → Visualizer an.',
  'tour.visualizers.open': 'EQ öffnen',
  'tour.visualizers.imageAlt':
    'Alpin, ein Plus-Visualizer mit Bergen über einem See bei Nacht, läuft im Diagramm unter den EQ-Kurven, darunter vier weitere Szenen.',

  'tour.desktop.kicker': 'DESKTOP-VISUALIZER',
  'tour.desktop.title': 'Ihre Musik hinter Ihrem Desktop',
  'tour.desktop.subtitle': 'Eine Szene auf jedem Monitor',
  'tour.desktop.lead':
    'Legen Sie einen Plus-Visualizer hinter Ihre Desktopsymbole. Er bewegt sich zu allem, was Sie gerade hören, oder ruhig für sich, und jeder Monitor kann eine eigene Szene zeigen.',
  'tour.desktop.point1':
    'Wählen Sie Monitore auf einer Karte Ihres Schreibtischs, jeden mit seinem eigenen Visualizer.',
  'tour.desktop.point2':
    'Er pausiert bei Vollbild-Apps, gesperrtem PC und im Akkubetrieb.',
  'tour.desktop.point3':
    'Beim nächsten Start von FluidEQ kommt er von selbst zurück.',
  'tour.desktop.how':
    'Läuft ein Plus-Visualizer im Diagramm, drücken Sie den Monitor-Knopf neben seinem Namen oder wählen Sie Ansicht → Als Desktophintergrund festlegen.',
  'tour.desktop.open': 'EQ öffnen',
  'tour.desktop.imageAlt':
    'Drei Monitore, jeder mit einem Plus-Visualizer – Aurora, Alpin und Neonstadt – hinter seinen Desktopsymbolen und seiner Taskleiste.',

  'tour.lighting.kicker': 'DYNAMISCHE BELEUCHTUNG',
  'tour.lighting.title': 'Ihr Schreibtisch leuchtet mit der Szene',
  'tour.lighting.subtitle': 'Beta · Ihre RGB-Geräte folgen dem Visualizer',
  'tour.lighting.lead':
    'Tastatur, Maus, Mauspad, Headset und Ständer übernehmen die Farben und den Rhythmus des Plus-Visualizers im Diagramm, über Windows Dynamic Lighting und Razer Chroma.',
  'tour.lighting.point1':
    'Vier Stile für jeden Visualizer: Szene, Farbwelle, Spektrum und Beat-Welle.',
  'tour.lighting.point2':
    'Stimmen Sie jedes Gerät einzeln ab und wählen Sie, was passiert, wenn die Musik stoppt.',
  'tour.lighting.point3':
    'Eine Live-Vorschau zeichnet Ihren eigenen Schreibtisch, während er leuchtet. Die Funktion ist in der Betaphase: Sagen Sie uns, wie sich Ihre Geräte verhalten.',
  'tour.lighting.how':
    'Öffnen Sie Plus → Dynamische Beleuchtung und schalten Sie sie ein; lassen Sie dann einen Plus-Visualizer im Diagramm laufen.',
  'tour.lighting.open': 'Plus öffnen',
  'tour.lighting.imageAlt':
    'Eine Tastatur, eine Maus und ein Mauspad, beleuchtet im Pink, Violett und Cyan von Neonstadt.',

  'tour.theme.kicker': 'EIN NEUER LOOK',
  'tour.theme.title': 'Das Schwarz-Theme',
  'tour.theme.subtitle': 'Reines Schwarz für lange Nächte und OLED-Bildschirme',
  'tour.theme.lead':
    'FluidEQ hat jetzt ein zweites Gesicht. Schwarz entfernt jede Spur des Schieferblaus, mit dem die App geboren wurde: Panels, Menüs und Leisten werden monochrom, der Akzent bleibt, und das Spektrum ist die einzige Farbe im Raum.',
  'tour.theme.point1':
    'Echtes Schwarz im Hintergrund: Auf einem OLED-Display schalten sich die Pixel rund um den Graphen ab.',
  'tour.theme.point2':
    'Jedes Fenster zieht mit: Menüs, Dialoge, die Karaoke-Bühne und die Bibliothek wechseln gemeinsam.',
  'tour.theme.point3':
    'Akzentfarbe und Regenbogenmodus bleiben erhalten. Am Klang ändert sich nichts – nur der Anstrich.',
  'tour.theme.howTitle': 'So wechseln Sie',
  'tour.theme.how':
    'Öffnen Sie das Menü hinter dem Puls-Symbol oben rechts und wählen Sie ganz unten unter Design die Option Schwarz. Ozean ist einen Klick entfernt, wenn Sie zurück wollen.',
  'tour.theme.tryBlack': 'Jetzt zu Schwarz wechseln',
  'tour.theme.tryOcean': 'Zurück zu Ozean',
  'tour.theme.imageAlt':
    'FluidEQ im Schwarz-Theme: der EQ-Tab mit fünfzehn Bändern und dem Live-Spektrum eines laufenden Songs.',

  'tour.share.kicker': 'JEDEN PC HÖREN',
  'tour.share.title': 'Audio zwischen Ihren Computern teilen',
  'tour.share.subtitle': 'Ein Headset, jede Maschine auf Ihrem Schreibtisch',
  'tour.share.lead':
    'Gaming-PC, Arbeitslaptop und Media-Box spielen alle in das eine Headset, das Sie tragen – über Ihr eigenes Netzwerk, verlustfrei, verschlüsselt und durch den EQ, den Sie bereits eingestellt haben.',
  'tour.share.receiverLabel': 'EMPFÄNGER',
  'tour.share.receiverName': 'Der PC mit Ihrem Headset',
  'tour.share.senderLabel': 'SENDER',
  'tour.share.senderName': 'Jeder andere Computer',
  'tour.share.wireLabel': 'Verlustfrei · Verschlüsselt · Privates LAN',
  'tour.share.stepsTitle': 'In drei Schritten eingerichtet',
  'tour.share.step1Title': 'Am Headset-PC einen Code erstellen',
  'tour.share.step1':
    'Öffnen Sie den Tab Audio teilen, wählen Sie „Audio auf diesem Computer wiedergeben“ und drücken Sie „Verbindungscode erstellen“. Kopieren Sie den Code für Ihr Netzwerk.',
  'tour.share.step2Title': 'An jedem anderen PC einfügen',
  'tour.share.step2':
    'Öffnen Sie dort FluidEQ, gehen Sie zu Audio teilen, wählen Sie „Audio dieses Computers senden“, entscheiden Sie sich für Musik oder Spiel/Video, fügen Sie den Code ein und drücken Sie „Verbinden und senden“. Der Systemton beginnt zu fließen.',
  'tour.share.step3Title': 'Hören und Pegel einstellen',
  'tour.share.step3':
    'Musik hält einen größeren Sicherheitspuffer für unterbrechungsfreies Hören; Spiel/Video läuft mit der geringsten Verzögerung für Lippensynchronität. Jeder Sender wird in den Ausgang des Empfängers gemischt, von dessen EQ geformt und von dessen Lautstärke geregelt. Die Wiedergabeleiste des Empfängers zeigt den Titel des zuletzt gestarteten Senders, und ihre Tasten wirken über das Netzwerk.',
  'tour.share.fact1Title': 'Verlustfrei',
  'tour.share.fact1':
    'Float32-PCM von Ende zu Ende. Kein Codec, kein Generationsverlust.',
  'tour.share.fact2Title': 'Verschlüsselt',
  'tour.share.fact2':
    'AES-256-GCM auf jedem Paket. Der Code ist der Schlüssel; ohne ihn hört niemand mit.',
  'tour.share.fact3Title': 'Bleibt gekoppelt',
  'tour.share.fact3':
    'Die Kopplung übersteht Schließen und Neustarts. Nur ein neuer Code trennt sie.',
  'tour.share.tip':
    'Leise anfangen: Mehrere Computer summieren sich schnell. Drehen Sie das Headset vor der ersten Verbindung herunter.',
  'tour.share.open': 'Audio teilen öffnen',

  'tour.library.kicker': 'IHRE MUSIK, IHR PLAYER',
  'tour.library.title': 'Eine Bibliothek für die Musik, die Ihnen gehört',
  'tour.library.subtitle': 'Ordner hinein, Alben heraus',
  'tour.library.lead':
    'Zeigen Sie FluidEQ einen Ordner, und es liest jeden Song und jedes Video darin, samt Tags und Cover, und macht daraus eine Sammlung, die Sie nach Album, Künstler, Genre, Titel oder Ordner durchstöbern. Die Wiedergabe läuft über den eigenen Player von FluidEQ, sodass EQ und DSP-Rack immer im Signalweg liegen.',
  'tour.library.point1':
    'Drei Ansichten auf dasselbe Regal: Liste, Raster und Cover Flow, mit Buchstabensprung für große Sammlungen.',
  'tour.library.point2':
    'Eine „Als Nächstes“-Warteschlange mit „Weiterspielen“, die nach dem Ende der Liste mit mehr vom selben Genre weitermacht.',
  'tour.library.point3':
    'Playlists und eine feste Favoritenliste. Rechtsklick auf einen Song, um ihn dort oder in die Warteschlange zu legen.',
  'tour.library.point4':
    'Smart-EQ-Songgedächtnis: „Für diesen Song speichern“ während der Wiedergabe umlegen, und die Korrektur bleibt für diesen Titel gemerkt.',
  'tour.library.how':
    'Öffnen Sie den Tab Bibliothek, drücken Sie „Ordner hinzufügen“ oder ziehen Sie einen Ordner auf die Seite und warten Sie, bis das Einlesen fertig ist. Wählen Sie Alben, Interpreten, Genres, Songs, Ordner oder Baum und drücken Sie dann Wiedergeben.',
  'tour.library.open': 'Bibliothek öffnen',

  'tour.dsp.kicker': 'EIN MASTERING-RACK',
  'tour.dsp.title': 'Das DSP-Rack',
  'tour.dsp.subtitle': 'Neun Stufen, jede mit eigenem Graphen',
  'tour.dsp.lead':
    'Ein Rack aus Studiostufen, in dieser Reihenfolge: Normalisierung, Rauschentfernung, Exciter, Bass-Schmiede, Equalizer, Bass-Punch, Dimension, Maximizer und Master, plus eine Überblendung zwischen Titeln der Bibliothek. Unter der FluidEQ-Engine wirkt es auf alles, was der Computer abspielt; unter Equalizer APO auf die Bibliothek. Jede Stufe ist eine Karte mit Live-Graph, Presets und einem Isolieren-Knopf, um nur zu hören, was sie tut.',
  'tour.dsp.point1':
    'Rauschentfernung repariert Rauschen, Brummen und Knackser während der Wiedergabe, und ein neuronaler Stimmreiniger arbeitet an Titeln der Bibliothek.',
  'tour.dsp.point2':
    'Bass-Schmiede legt eine echte Oktave unter den Bass; Bass-Punch formt Attack, Sustain und Blüte, mit einem Mix bis 200 %.',
  'tour.dsp.point3':
    'Ein parametrischer Equalizer mit fünfzehn Bändern, minimal- oder linearphasig, Mid/Side, Oversampling und Dutzenden benannten Presets.',
  'tour.dsp.point4':
    'Master mit LUFS-Lautheitsziel und True-Peak-Schutz, Liefer-Presets von Streaming bis Vinyl und einem Gain-Match, um Klang statt Lautstärke zu vergleichen.',
  'tour.dsp.how':
    'Öffnen Sie den Tab DSP, wählen Sie unter Voreinstellungen eine Kette, klicken Sie dann in den Seitentabs auf eine Stufe und schalten Sie sie auf Ein. Unter Equalizer APO spielen Sie vorher einen Titel aus der Bibliothek ab.',
  'tour.dsp.open': 'DSP öffnen',

  'tour.output.kicker': 'SPIELT AN ZWEI ORTEN',
  'tour.output.title': 'Profile für den zweiten Ausgang',
  'tour.output.subtitle':
    'Headset und Lautsprecher zugleich, jedes mit eigenem Profil',
  'tour.output.lead':
    'Kopfhörer und Lautsprecher gleichzeitig mit getrenntem EQ hören. Der zweite Ausgang erhält den Ton vor dem EQ des Hauptausgangs und wendet sein eigenes gespeichertes Profil an. Kein Routing-Treiber nötig.',
  'tour.output.point1':
    'Ein weiteres Gerät unter Zweiter Ausgang einschalten und seine Lautstärke einstellen.',
  'tour.output.point2':
    'Im EQ-Profilwähler unter dem Gerät eines seiner gespeicherten Profile auswählen. Die Abstimmung des Hauptausgangs bleibt erhalten.',
  'tour.output.point3':
    'Ein Player zur Zeit: Etwas in FluidEQ zu starten pausiert den Rest des Rechners, und umgekehrt.',
  'tour.output.point4':
    'Spiel/Video startet mit etwa 30 ms Reserve und holt nach einer Unterbrechung auf; Musik startet mit etwa 100 ms für gleichmäßigere Wiedergabe. Der Gerätepuffer erhöht die Verzögerung.',
  'tour.output.how':
    'Im EQ-Tab rechts Zweiter Ausgang öffnen. Ein Gerät einschalten, unter seinem Namen das EQ-Profil wählen, die Lautstärke einstellen und Spiel/Video oder Musik auswählen.',
  'tour.output.open': 'EQ öffnen',
  'tour.output.imageAlt':
    'Zweiter Ausgang mit aktiviertem BlackShark V2 Pro, EQ-Profilwähler, Lautstärkeregler und den Modi Spiel/Video und Musik.',

  'tour.looks.kicker': 'IHR EIGENER VISUALIZER',
  'tour.looks.title': 'Eigene Darstellungen für den Graphen',
  'tour.looks.subtitle': 'Achtundzwanzig Formen, Ihre Farben, Ihre Bewegung',
  'tour.looks.lead':
    'Das Spektrum unter dem EQ lässt sich zeichnen, wie Sie wollen. Wählen Sie eine von achtundzwanzig Formen, von schlichten Balken und Linien bis zu Terrassen, Skylines und einer nächtlichen Brücke mit Verkehr; färben Sie sie in ihrer eigenen Auto-Färbung, nach Frequenz, Pegel oder Hitze; legen Sie fest, wie schnell sie anspricht und wie lange eine Spitze hängt; markieren Sie Spitzen mit Funken, Kometen oder Wellen. Speichern Sie das Ergebnis als eigene Darstellung und teilen Sie es als Datei.',
  'tour.looks.point1':
    'Achtundzwanzig Formen, jede mit eigenen Reglern: Teile, Abstand, Füllung, Stärke und ob sie gefüllt oder als Kontur gezeichnet wird.',
  'tour.looks.point2':
    'Färben Sie jede Form in ihrer eigenen Auto-Färbung, nach Frequenz, Pegel oder Hitze mit einem Verlauf aus Ihren eigenen Farben oder in einer einheitlichen Farbe.',
  'tour.looks.point3':
    'Attack und Release bestimmen die Bewegung; leuchtende Spitzen, gefüllte Spitzen und zwölf Spitzenmarken bestimmen, wie ein Schlag aussieht.',
  'tour.looks.point4':
    'Leuchten funktioniert in jedem Modus, und der Regenbogenmodus fügt einen Rand hinzu, der das ganze Farbrad durchläuft. Darstellungen lassen sich als Datei exportieren und importieren.',
  'tour.looks.how':
    'Drücken Sie im Tab EQ „Neue Darstellung“ in der Leiste des Graphen. Wählen Sie eine Form mit dem Wähler oder blättern Sie mit der Leertaste, stellen Sie Farben und Bewegung bei laufender Musik ein und dann Speichern.',
  'tour.looks.open': 'EQ öffnen',

  'tour.karaoke.kicker': 'EINE BÜHNE ZU HAUSE',
  'tour.karaoke.title': 'Karaoke mit Tonhöhenführung',
  'tour.karaoke.subtitle': 'Ihre Songs, Ihre Texte, Ihr Mikrofon',
  'tour.karaoke.lead':
    'Legen Sie einen Song mit oder ohne Textdatei ab: FluidEQ fügt beides zu einer Playlist zusammen, zeigt den getimten Text über Cover oder Video, hört auf Ihr Mikrofon und zeichnet Ihre Tonhöhe gegen die Melodie. Alles bleibt auf diesem Computer; das Mikrofon wird nie aufgenommen oder wiedergegeben.',
  'tour.karaoke.point1':
    'Ein Guide-Gesang-Regler von Original bis nur Begleitung, der die Hauptstimme ohne separate Datei entfernt.',
  'tour.karaoke.point2':
    'Eine Tonhöhenspur in der Ansicht Noten oder Kurve: die Noten des Songs als Blöcke, Ihre Stimme als Live-Linie, mit Rückmeldung Hoch, Richtig und Tief.',
  'tour.karaoke.point3':
    'Eine Auswertung danach, die die Stellen zum Üben auflistet, mit Einzähler für den nächsten Durchlauf.',
  'tour.karaoke.point4':
    'Liest LRC, erweitertes LRC mit Wort-Timing und UltraStar mit Silben und Tonhöhe, über MP3, FLAC, WAV, OGG, M4A und mehr. Übersetzte Texte und geschätzte Gitarrenakkorde kommen dazu.',
  'tour.karaoke.how':
    'Öffnen Sie den Tab Karaoke, drücken Sie „Song öffnen“ oder „Ordner hinzufügen“, wählen Sie einen Titel in der Playlist, schalten Sie das Mikrofon ein, blenden Sie die Tonhöhenführung ein und drücken Sie Wiedergabe.',
  'tour.karaoke.open': 'Karaoke öffnen',

  'tour.maker.kicker': 'SELBST GEMACHT',
  'tour.maker.title': 'Der Karaoke-Maker',
  'tour.maker.subtitle': 'Jeder Song wird zur Karaoke-Datei',
  'tour.maker.lead':
    'Ein vollständiges Autorenstudio im Tab Karaoke. Es kann die ganze Arbeit allein erledigen: die Stimme von der Musik trennen, Wörter und Timing mit einem lokalen Sprachmodell lesen und die Melodienoten erkennen. Oder Sie tippen, nehmen auf und zeichnen jedes Timing von Hand auf einer zoombaren Zeitleiste. Alles läuft auf diesem Computer.',
  'tour.maker.point1':
    '„Diesen Song automatisch einrichten“: Stimme trennen, dann Wörter und Timing lesen, mit der Option, im Hintergrund weiterzumachen.',
  'tour.maker.point2':
    'Behalten Sie die getrennten Spuren: Stimme und Begleitung, jede speicherbar, auch als MP3.',
  'tour.maker.point3':
    'Handwerkzeug für die Details: Wörter tippen, Zeileneinsätze aufnehmen, ein Wortinspektor mit Start und Länge, und ein Wort in Silben teilen.',
  'tour.maker.point4':
    'Malen Sie die Melodie auf ein Tonhöhenraster, markieren Sie goldene Noten und exportieren Sie als FluidEQ-Projekt, UltraStar TXT, LRC, erweitertes LRC oder Begleitspur.',
  'tour.maker.how':
    'Laden Sie in Karaoke einen Song und drücken Sie „Erstellen“. Nehmen Sie im Assistenten „Automatisch einrichten“ an, korrigieren Sie die Wörter auf der Zeitleiste, dann „Im Player verwenden“ und „Exportieren“.',
  'tour.maker.open': 'Karaoke öffnen',

  'tour.media.kicker': 'DAS WEB, DURCH IHREN EQ',
  'tour.media.title': 'Online-Medien',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch und Suno',
  'tour.media.lead':
    'Ein eingebauter Player für die Streaming-Seiten, damit das, was Sie online sehen und hören, durch Ihren EQ läuft statt durch einen separaten Browser. Fünf Seiten sind angebunden, jede mit eigener Suche, und Links nach draußen werden mit der Wahl „Im Browser öffnen“ angehalten.',
  'tour.media.point1':
    'Ein Suchfeld, das die gerade geöffnete Seite durchsucht, mit letzten Suchen, die Sie löschen können.',
  'tour.media.point2':
    '„Werbung blockieren“ überspringt Videowerbung und blendet Werbeplätze auf YouTube aus.',
  'tour.media.point3':
    'Fortsetzen: Der Player merkt sich die letzte Seite und die Stelle darin und bringt Sie dorthin zurück.',
  'tour.media.point4':
    'Downloads mit Fortschrittsanzeige und „Im Ordner anzeigen“ am Ende, und ein Knopf „Von allen Seiten abmelden“, der jedes Cookie und jede Anmeldung auf einmal löscht.',
  'tour.media.how':
    'Öffnen Sie den Tab Online-Medien, wählen Sie oben eine Seite, tippen Sie ins Suchfeld und drücken Sie Suchen. Zurück, Vor und Neu laden funktionieren wie im Browser.',
  'tour.media.open': 'Online-Medien öffnen',
};

export default tour;
