/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
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
    'Öffnen Sie das Menü hinter dem Puls-Symbol oben rechts und wählen Sie Design → Schwarz. Ozean ist einen Klick entfernt, wenn Sie zurück wollen.',
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
    'Öffnen Sie dort FluidEQ, gehen Sie zu Audio teilen, wählen Sie „Audio dieses Computers senden“, fügen Sie den Code ein und drücken Sie „Verbinden und senden“. Der Systemton beginnt zu fließen.',
  'tour.share.step3Title': 'Priorität wählen und hören',
  'tour.share.step3':
    'Musik hält einen größeren Sicherheitspuffer für unterbrechungsfreies Hören; Spiel/Video läuft mit der geringsten Verzögerung für Lippensynchronität. Jeder Sender wird in den Ausgang des Empfängers gemischt und von dessen EQ geformt. Die Wiedergabeleiste des Empfängers zeigt den Titel jedes Senders, und ihre Tasten wirken über das Netzwerk.',
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
    'Öffnen Sie den Tab Bibliothek, drücken Sie „Ordner hinzufügen“ oder ziehen Sie einen Ordner auf die Seite und warten Sie auf „Songs hinzugefügt“. Wählen Sie Alben, Künstler, Genres, Titel, Ordner oder Baum und drücken Sie Wiedergabe.',
  'tour.library.open': 'Bibliothek öffnen',

  'tour.dsp.kicker': 'EIN MASTERING-RACK',
  'tour.dsp.title': 'Das DSP-Rack',
  'tour.dsp.subtitle': 'Neun Stufen, jede mit eigenem Graphen',
  'tour.dsp.lead':
    'Alles, was die Bibliothek spielt, kann durch ein Rack aus Studiostufen laufen, in dieser Reihenfolge: Normalizer, Denoise, Exciter, Bass Forge, Equalizer, Bass Punch, Dimension, Maximizer und Master, plus ein Crossfade zwischen Titeln. Jede Stufe ist eine Karte mit Live-Graph, Presets und einem Isolieren-Knopf, um nur zu hören, was sie tut.',
  'tour.dsp.point1':
    'Denoise repariert die Aufnahme selbst: Rauschen, Brummen, Knackser und ein neuronaler Stimmreiniger, gemessen anhand eines Scans des Titels.',
  'tour.dsp.point2':
    'Bass Forge legt eine echte Oktave unter den Bass; Bass Punch formt Attack, Sustain, Bloom und Duck.',
  'tour.dsp.point3':
    'Ein parametrischer Equalizer mit fünfzehn Bändern, minimal- oder linearphasig, Mid/Side, Oversampling und Dutzenden benannten Presets.',
  'tour.dsp.point4':
    'Master mit LUFS-Lautheitsziel und True-Peak-Schutz, Liefer-Presets von Streaming bis Vinyl und einem Gain-Match, um Klang statt Lautstärke zu vergleichen.',
  'tour.dsp.how':
    'Spielen Sie einen Titel aus der Bibliothek, öffnen Sie den Tab DSP, wählen Sie unter Presets eine Kette, klicken Sie dann in den Seitentabs auf eine Stufe und schalten Sie sie ein.',
  'tour.dsp.open': 'DSP öffnen',

  'tour.output.kicker': 'SPIELT AN ZWEI ORTEN',
  'tour.output.title': 'Eine zweite Ausgabe',
  'tour.output.subtitle':
    'Headset und Lautsprecher zugleich, jedes mit eigenem Profil',
  'tour.output.lead':
    'Was Sie hören, kann gleichzeitig aus einem zweiten Gerät kommen: Headset und Raumlautsprecher, Schreibtisch und Küche. Das Spiegeln nimmt den Klang, nachdem Ihr EQ ihn geformt hat, und reicht ihn weiter, sodass die zweite Ausgabe dieselbe Abstimmung hört. Mit einem installierten Routing-Treiber bleiben beide Ausgaben synchron und jede kann ihr eigenes Profil tragen, so wie es ein Mischer wie Voicemeeter täte.',
  'tour.output.point1':
    'Wählen Sie unter „Spiegeln auf“ eine beliebige andere Ausgabe, und sie spielt, was Sie bereits hören, mit eigener Lautstärke.',
  'tour.output.point2':
    'Jede Ausgabe behält ihr eigenes EQ-Profil, sodass Lautsprecher und Headset getrennt abgestimmt werden.',
  'tour.output.point3':
    'Ein Player zur Zeit: Etwas in FluidEQ zu starten pausiert den Rest des Rechners, und umgekehrt.',
  'tour.output.point4':
    'Gespiegelter Klang kommt etwa eine fünftel Sekunde später an: gut für Musik im Nebenzimmer, nicht für Video oder Spiele.',
  'tour.output.how':
    'Öffnen Sie im Tab EQ „Zweite Ausgabe“ im rechten Panel, wählen Sie unter „Spiegeln auf“ ein Gerät und stellen Sie die Lautstärke ein. Die Karte zeigt SPIEGELT, solange es läuft.',
  'tour.output.open': 'EQ öffnen',

  'tour.looks.kicker': 'IHR EIGENER VISUALIZER',
  'tour.looks.title': 'Eigene Darstellungen für den Graphen',
  'tour.looks.subtitle': 'Siebenundfünfzig Formen, Ihre Farben, Ihre Bewegung',
  'tour.looks.lead':
    'Das Spektrum unter dem EQ lässt sich zeichnen, wie Sie wollen. Wählen Sie eine von siebenundfünfzig Formen, von schlichten Balken und Linien bis zu Graten, Seide, Skyline und Punktmatrix; färben Sie sie flach, nach Frequenz, Pegel oder Hitze; legen Sie fest, wie schnell sie anspricht und wie lange eine Spitze hängt; markieren Sie Spitzen mit Funken, Kometen, Halos oder Kronen. Speichern Sie das Ergebnis als eigene Darstellung und teilen Sie es als Datei.',
  'tour.looks.point1':
    'Siebenundfünfzig Formen, jede mit eigenen Reglern: Teile, Abstand, Füllung, Stärke, und ob gefüllt oder gestrichelt.',
  'tour.looks.point2':
    'Farbe nach Frequenz, Pegel oder Hitze mit einer Rampe aus Ihren eigenen Farben, oder eine flache Farbe.',
  'tour.looks.point3':
    'Attack und Release bestimmen die Bewegung; leuchtende Spitzen und achtzehn Spitzenmarken bestimmen, wie ein Schlag aussieht.',
  'tour.looks.point4':
    'Der Regenbogenmodus legt ein Glühen auf den Beat und einen Rand, der das ganze Farbrad durchläuft. Darstellungen lassen sich als Datei exportieren und importieren.',
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
