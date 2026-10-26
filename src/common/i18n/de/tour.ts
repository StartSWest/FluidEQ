/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Bitte unterstützen Sie uns',
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
  'tour.rail.newIn': 'NEU IN {version}',
  'tour.rail.always': 'AUSSERDEM IN FLUIDEQ',
  'tour.newBadge': 'NEU',
  'tour.howTitle': 'So geht es los',
  'tour.beta': 'Beta',
  'tour.player.kicker': 'KOMPAKTER PLAYER',
  'tour.player.title': 'Die ganze App in einer Spalte',
  'tour.player.subtitle': 'Ein Player, gleich in allen Fensterfarben',
  'tour.player.lead':
    'Ein Schalter in der Titelleiste klappt FluidEQ zu einer Spalte zusammen: oben der Visualizer mit dem Song, darunter die Bedienung, Ihr Klang und was als Nächstes läuft. Derselbe Player in allen Fensterfarben, und eine gewählte Szene läuft hinter allem, im Modus {backdrop}.',
  'tour.player.point1':
    'Unter {sound}: Regler für Bass, Mitten und Höhen oder Ihre EQ-Bänder, daneben Preset, Smart-EQ und EQ-Modus.',
  'tour.player.point2':
    '„{upNext}“ und {playlists} stehen unten; klappen Sie sie für ein größeres Bild ein. Musik, die Sie irgendwo auf dem Player ablegen, kommt in die Warteschlange.',
  'tour.player.point3':
    'Feste Breite, die Höhe ziehen Sie am oberen oder unteren Rand. Auf eine Zeile einklappen, über anderen Fenstern halten oder per Doppelklick aufs Bild als Vollbild.',
  'tour.player.how':
    'Drücken Sie in der Titelleiste neben Hilfe den Schalter Kompakter Player. Im Player holt derselbe Schalter die vollständige App zurück.',
  'tour.player.open': 'Kompakter Player ausprobieren',
  'tour.player.imageAlt':
    'Die Ecke der Titelleiste mit markiertem Schalter {player} und zweimal der Kompakte Player: über einer Szene im Modus {backdrop} mit geöffneten EQ-Bändern und mit einem Standard-Visualizer hinter dem Song und geöffneten Klangreglern.',
  'tour.player.scene': 'Mit einer Szene, im Modus {backdrop}',
  'tour.player.standard': 'Mit einem Standard-Visualizer',
  'tour.look.kicker': 'NEUES AUSSEHEN',
  'tour.look.title': 'Ein neues Fenster in neuen Farben',
  'tour.look.subtitle':
    'Ein Regler für das Design und ein Visualizer hinter allem',
  'tour.look.lead':
    'Die Bereiche stehen auf einer offenen Fläche in den Farben des neuen Symbols, und ein einziger Regler, {brightness}, führt das ganze Fenster von fast Schwarz bis zu einem hellen Ozeanblau. Mit einer Szene im Diagramm kann das Fenster ihre Farben annehmen oder sie hinter allem abspielen.',
  'tour.look.point1':
    '{brightness} steht im Menü hinter dem Puls-Symbol und unter {windowColours} neben {transparency}.',
  'tour.look.point2':
    '{windowColours} bietet {original}, {colours}, {ambient} und {backdrop}, jeweils mit einer Zeile dazu, was es mit dem Fenster macht.',
  'tour.look.point3':
    'Dialoge und Menüs sind aus einem Material, und „{rainbow}“ läuft durch die Farben des Symbols oder die eines Visualizers.',
  'tour.look.how':
    'Verschieben Sie {brightness} im Aktionsmenü hinter dem Puls-Symbol oben rechts. Mit einer Szene im Diagramm öffnen Sie {windowColours} über die Leiste des Diagramms und wählen {backdrop}.',
  'tour.look.open': 'EQ öffnen',
  'tour.look.imageAlt':
    'FluidEQ in seinen eigenen Farben auf der EQ-Seite, der Analyzer zeichnet einen Song unter den Kurven, und das Menü hinter dem Puls-Symbol ist über seiner Ecke geöffnet, mit Helligkeit auf halber Höhe und eingeschaltetem „Bunter Modus“.',
  'tour.gpu.kicker': 'EINE NEUE VISUALIZER-ENGINE',
  'tour.gpu.title': 'Jeder Visualizer auf Ihrer Grafikkarte',
  'tour.gpu.subtitle':
    'Vierzig Darstellungen im Takt Ihres Bildschirms, und 3D-Welten',
  'tour.gpu.lead':
    'Die vierzig Darstellungen des Diagramms laufen jetzt auf der Engine der Szenen: auf Ihrer Grafikkarte, mit der Bildwiederholrate Ihres Bildschirms, sodass Balken, Partikel und Spitzen gleiten, wo sie früher ruckelten. Und eine Szene kann jetzt eine echte 3D-Welt sein.',
  'tour.gpu.point1':
    'Achtzehn neue Darstellungen unter {scenes}, darunter {synthwave}, {horizon}, {towers} und {ledwall}; eine Darstellung ohne eigene Farben trägt die des Fensters.',
  'tour.gpu.point2':
    '3D-Welten treten auf die Kick, wiegen sich mit der Snare, springen beim Drop und wechseln mit {brightness} von Nacht zu Tag; ziehen Sie eine, um sie von einer anderen Seite zu sehen.',
  'tour.gpu.point3':
    'Beim Wechsel blendet eine Darstellung in die nächste über, und eine 3D-Welt gibt ihren Grafikspeicher frei, solange das Fenster verdeckt ist.',
  'tour.gpu.how':
    'Klicken Sie im Diagramm auf den Namen der Darstellung und wählen Sie eine unter {scenes}.',
  'tour.gpu.open': 'EQ öffnen',
  'tour.gpu.imageAlt':
    'Eine Szene als nächtliche 3D-Stadt und vier neue Darstellungen, im Diagramm fotografiert – {synthwave}, {horizon}, {towers} und {ledwall} –, bei der ersten die Auswahl der Darstellung markiert.',
  'tour.gpu.world': '3D-Welt',
  'tour.sparks.kicker': 'ZEIGER-FUNKEN',
  'tour.sparks.title': 'Visualizer, die auf Ihre Maus antworten',
  'tour.sparks.subtitle': 'Funken, Blüten oder Schnee am Mauszeiger',
  'tour.sparks.lead':
    'Bewegen Sie die Maus über eine Szene, und sie wirft, woraus sie gemacht ist – Funken, Blüten, Schnee, Glut – als Spur hinter dem Zeiger her und sprüht, wo Sie klicken. In den Modi {ambient} und {backdrop} ziehen ihre Vögel, Blüten und Lichter außerdem über das ganze Fenster.',
  'tour.sparks.point1':
    'Jeder Visualizer wirft sein Eigenes: Schnee aus einer Winterszene, Glut aus einem Lagerfeuer, Blüten aus einem Garten.',
  'tour.sparks.point2':
    'Die Bühne des Studios zeigt sie immer, damit man beim Bauen einer Szene formen kann, was sie wirft.',
  'tour.sparks.point3':
    'Ein Schalter für alle Visualizer: {sparks}, in {windowColours} unter {rainbow}.',
  'tour.sparks.how':
    'Fahren Sie mit einer Szene im Diagramm mit der Maus darüber und klicken Sie. {sparks} finden Sie in {windowColours} unter {rainbow}.',
  'tour.sparks.open': 'EQ öffnen',
  'tour.sparks.imageAlt':
    'Ein Polarlicht-Visualizer mit einer Spur leuchtender Funken hinter dem Mauszeiger und einem Funkenregen, wo geklickt wurde, dazu {windowColours} mit markiertem Schalter {sparks}.',
  'tour.sound.kicker': 'DIE FLUIDEQ-ENGINE',
  'tour.sound.title': 'Klang genau so, wie Sie ihn gezeichnet haben',
  'tour.sound.subtitle':
    'Höhen wie gezeichnet, lautlose Wechsel, Pegel in einem Schritt',
  'tour.sound.lead':
    'Auf der FluidEQ-Engine spielt Ihre Kurve jetzt genau wie gezeichnet bis 20 kHz, jede Änderung wird übergeblendet statt zu knacken, und {autoNormalize} trifft den Pegel einer neuen Kurve in einem Schritt. Wie die Höhen gebaut werden, entscheiden Sie: {precise} oder {classic}.',
  'tour.sound.point1':
    '{precise} baut jedes Band wie gezeichnet; an einem 48-kHz-Ausgang kamen die Höhen bei 20 kHz früher 3,8 dB zu schwach an. {classic} baut sie wie Equalizer APO und so, wie AutoEQ eine Korrektur abstimmt.',
  'tour.sound.point2':
    'Presets blenden beim Wechsel über: 534 von 636 Wechseln knisterten früher, jetzt steigt keiner über −80 dBFS.',
  'tour.sound.point3':
    'Jede Änderung ist in dem Moment zu hören, in dem Sie sie machen, und {autoNormalize} springt dann in einem Schritt auf ihren Pegel, berechnet aus den letzten zehn Sekunden Musik.',
  'tour.sound.how':
    'Öffnen Sie EQ und klicken Sie auf {eqMode}. Wählen Sie unter {treble} {precise} oder {classic}, für Ihren EQ und für Korrekturen getrennt.',
  'tour.sound.open': 'EQ öffnen',
  'tour.sound.imageAlt':
    'Das Menü {eqMode} unter seiner Schaltfläche geöffnet, {treble} auf {precise}; eine Höhenkurve, die {precise} wie gezeichnet und {classic} an einem 48-kHz-Ausgang bei 20 kHz 3,8 dB zu schwach spielt; und der Klang über 5 kHz bei einem Preset-Wechsel: ein Knacken mit −26 dBFS vor 2.0, jetzt nichts über −80 dBFS.',
  'tour.sound.trebleChart': 'Höhen, 1 bis 20 kHz',
  'tour.sound.switchChart': 'Über 5 kHz, beim Preset-Wechsel',
  'tour.sound.before': 'Vor 2.0',
  'tour.sound.now': '2.0',
  'tour.graph.kicker': 'STUDIO-ANSICHTEN',
  'tour.graph.title': 'Ein Diagramm, das Klang liest wie ein Studio',
  'tour.graph.subtitle': 'Zwölf Ansichten, ein Analyzer mit 80 dB',
  'tour.graph.lead':
    'Das Diagramm misst, was gerade spielt, so wie Studio-Analyzer: zwölf Ansichten, vom Spektrogramm und Wasserfall bis zu Stereo, Lautheit und Phase, auf Skalen, die stillstehen, während die Musik sich bewegt.',
  'tour.graph.point1':
    '{analyzer}, {spectrogram}, {rta}, {waterfall}, {scope} und sieben weitere, unter {analysis} in der Auswahl der Darstellungen.',
  'tour.graph.point2':
    'Der Live-Klang wird 80 dB tief und bis hinunter zu 10 Hz gezeichnet, ein Zwölftel einer Oktave pro Punkt, sodass ein Ton auf seinem wahren Pegel steht.',
  'tour.graph.point3':
    'Ihr EQ behält seine ±20 dB, mit Platz an den Rändern für eine Kurve, die weiter geht, und die Frequenzen sind mit 10, 20, 50, 100 beschriftet, wie Analyzer sie drucken.',
  'tour.graph.how':
    'Klicken Sie im Diagramm auf den Namen der Darstellung und wählen Sie unter {analysis} eine Ansicht. Ein Doppelklick auf das Diagramm füllt den Bildschirm; Strg+G blendet das Raster ein oder aus.',
  'tour.graph.open': 'EQ öffnen',
  'tour.graph.imageAlt':
    'Der Analyzer des Diagramms bei laufender Musik: das Live-Spektrum 80 dB tief mit seinen Spitzen darüber, die EQ-Kurven obenauf und in der Ecke die Liste der Ansichten unter Analyse.',

  'tour.games.kicker': 'SPIEL-PRESETS',
  'tour.games.title': 'Jedem Spiel sein eigener Klang',
  'tour.games.subtitle':
    'Umgeschaltet, sobald das Spiel in den Vordergrund kommt',
  'tour.games.lead':
    'Wählen Sie einmal für jedes Spiel einen Klang. Kommt das Spiel in den Vordergrund, wechselt FluidEQ zu diesem Klang und behält ihn, bis Sie das Spiel beenden – ganz gleich, wie oft Sie mit Alt+Tab umschalten. Danach stellt es wieder her, was Sie vorher hatten.',
  'tour.games.point1':
    'Spiele von Steam, Epic Games, EA, GOG, Ubisoft, Battle.net und Xbox oder jedes Programm, das gerade offen ist.',
  'tour.games.point2':
    'Die Gaming-Presets schalten den Spielmodus ein, der die Verzögerung durch FluidEQ verkürzt, und die Seite zeigt diese Verzögerung als Messwert.',
  'tour.games.point3':
    'Eine Karte auf Ihrem Desktop zeigt, was umgeschaltet wurde, und eine weitere, was zurückkam, als das Spiel beendet wurde.',
  'tour.games.how':
    'Öffnen Sie EQ, wählen Sie Spiel-Presets und drücken Sie Spiel hinzufügen. Wählen Sie dann seinen Klang in der Auswahl in seiner Zeile.',
  'tour.games.open': 'Spiel-Presets öffnen',
  'tour.games.imageAlt':
    'Drei Momente auf dem Desktop: ein Spiel im Vordergrund mit der Karte von FluidEQ, dass sein Klang geladen ist; dasselbe Spiel minimiert, sein Klang weiter aktiv; und das Spiel geschlossen mit der Karte, dass der Klang von vorher zurück ist.',
  'tour.games.stepFront': 'Im Vordergrund: sein Klang wird geladen',
  'tour.games.stepAway':
    'Minimiert oder per Alt+Tab verlassen: sein Klang bleibt',
  'tour.games.stepClosed': 'Geschlossen: Ihr eigener Klang kommt zurück',
  'tour.presets.kicker': 'NEUE PRESETS',
  'tour.presets.title': 'Presets, die nach ihrer Musik klingen',
  'tour.presets.subtitle': 'Ganze Ketten, alle gleich laut',
  'tour.presets.lead':
    'Jedes Preset wurde neu vermessen und im Pegel angeglichen: Ein Wechsel ändert den Charakter, nicht die Lautstärke, und jedes klingt jetzt unter der FluidEQ-Engine so deutlich wie unter Equalizer APO.',
  'tour.presets.point1':
    '{chains} Ketten, davon {styles} Musikstile, dazu Raum-Fassungen von Musik, Film und Gaming.',
  'tour.presets.point2':
    'Die Kurve eines Presets erscheint im Diagramm als eigene Ebene, mit einer Stärke, die Sie herunterdrehen können.',
  'tour.presets.point3':
    'Jeder Stil erklärt sich selbst: Zeigen Sie auf einen, und seine Notizen öffnen sich neben der Liste.',
  'tour.presets.how':
    'Öffnen Sie EQ und drücken Sie Presets, oder wählen Sie oben in DSP eine Kette.',
  'tour.presets.open': 'EQ öffnen',
  'tour.presets.imageAlt':
    'Die Preset-Auswahl, in der Rock gewählt ist, und daneben seine Notizen: seine Kurve mit nummerierten Punkten, wofür jeder Punkt steht und wie laut die Kette spielt.',
  'tour.tone.kicker': 'KLANGREGELUNG',
  'tour.tone.title': 'Bass, Mitten und Höhen wie am Verstärker',
  'tour.tone.subtitle': 'Drei Regler mit eigener Kurve',
  'tour.tone.lead':
    'Ist kein Band ausgewählt, formen Bass, Mitten und Höhen den Klang als eigene Kurve, mit Tiefen- und Höhensperre zu beiden Seiten: der schnellste Weg, einen Song wärmer oder heller zu machen, und jedes Band bleibt so, wie Sie es eingestellt haben.',
  'tour.tone.point1':
    'Der Equalizer öffnet mit allen Bändern im Blick, ohne Auswahl.',
  'tour.tone.point2':
    'Ein neues Layout mit zwanzig Bändern und jedes Layout auf den Normfrequenzen.',
  'tour.tone.point3':
    'Bänder sind so breit wie ihr Abstand: keine Lücken dazwischen und keine zwei auf demselben Ton.',
  'tour.tone.how':
    'Öffnen Sie EQ, ohne dass ein Band ausgewählt ist, und drehen Sie an Bass, Mitten oder Höhen. Strg+Klick auf einen Regler setzt sein Drittel auf 0 dB zurück.',
  'tour.tone.open': 'EQ öffnen',
  'tour.tone.imageAlt':
    'Die Kurve des Equalizers in ihren Dritteln für Bass, Mitten und Höhen, die drei Regler, die sie bewegen, und Schnelle Anordnungen von sechs bis einunddreißig Bändern.',
  'tour.studio.kicker': 'FLUIDEQ PLUS',
  'tour.studio.title': 'Bauen Sie Ihren eigenen Visualizer',
  'tour.studio.subtitle': 'Kostenlos für jedes Konto',
  'tour.studio.lead':
    'Das Studio macht aus einer Idee eine Szene, die sich mit Ihrer Musik bewegt. Es ist für jedes Konto kostenlos: Erstellen, exportieren und veröffentlichen Sie so viele Szenen, wie Sie möchten.',
  'tour.studio.point1':
    'Jede Szene wird geprüft, bevor sie in die Galerie kommt, und sobald sie freigegeben ist, läuft sie für Sie überall kostenlos.',
  'tour.studio.point2':
    'Szenen können echte 3D-Welten sein, die im Takt der Kick tanzen und beim Drop abheben.',
  'tour.studio.point3':
    'Kopieren Sie den KI-Prompt, und Ihr KI-Assistent kann Ihre Szene sehen und hören, wie sich der Song bewegt.',
  'tour.studio.how':
    'Öffnen Sie Visualizer und wählen Sie Studio in der Seitenleiste.',
  'tour.studio.open': 'Visualizer öffnen',
  'tour.studio.imageAlt':
    'Das Studio mit Alpine auf der Bühne, ein See unter verschneiten Gipfeln und ein Polarlicht, darunter die drei Schritte, mit Ihrer KI eine Szene zu erstellen, und zwei Hinweise: kostenlos für jedes Konto, und eine veröffentlichte Szene läuft für ihren Macher kostenlos.',
  'tour.studio.earned': 'Veröffentlicht: läuft für Sie kostenlos',
  'tour.help.kicker': 'HILFE',
  'tour.help.title': 'Fragen Sie das Handbuch mit eigenen Worten',
  'tour.help.subtitle': 'Tippfehler, Pluralformen und zehn Sprachen',
  'tour.help.lead':
    'Durchsuchen Sie das Handbuch so, wie Sie einen Freund fragen würden – „kein Ton“, „Limiter“, „Hintergrundbild“ – in jeder der zehn Sprachen. Das beste Kapitel steht ganz oben, und das Handbuch führt Sie zum Bedienelement, auf dem Bild eingekreist.',
  'tour.help.point1':
    'Es verzeiht Tippfehler und Pluralformen und kennt die Wörter, die Menschen für die Dinge verwenden.',
  'tour.help.point2':
    'Jedes Bedienelement auf einem Bild ist nummeriert wie in einem gedruckten Handbuch.',
  'tour.help.point3':
    'F1 öffnet es von überall, und die Eingabetaste springt zum nächsten Treffer.',
  'tour.help.how':
    'Drücken Sie F1 oder öffnen Sie das Buch-Symbol in der Titelleiste und wählen Sie Benutzerhandbuch. Tippen Sie dann ein, was Sie suchen.',
  'tour.help.open': 'Hilfe öffnen',
  'tour.help.imageAlt':
    'Das Benutzerhandbuch, durchsucht nach „kein Ton“: seine Kapitel nach Rang geordnet, mit markierten Wörtern, und ein Bild mit nummerierten Bedienelementen.',
  'tour.help.query': 'kein Ton',

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
    'Wählen Sie die FluidEQ-Engine bei der Installation oder öffnen Sie das Aktionsmenü hinter dem Puls-Symbol oben rechts, drücken Sie ganz oben auf die Karte der Engine, wählen Sie FluidEQ-Engine und drücken Sie Übernehmen. Öffnen Sie dann DSP und schalten Sie eine Stufe ein, während eine beliebige App etwas abspielt.',
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

  'tour.room.kicker': 'SURROUND AUF KOPFHÖRERN',
  'tour.room.title': 'Nehmen Sie im Raum Platz',
  'tour.room.subtitle': 'Vierundzwanzig Räume, alle kostenlos',
  'tour.room.lead':
    'Der Raum macht aus Ihren Kopfhörern einen Hörraum, jeder Kanal ein Lautsprecher rings um Sie. Dreizehn neue Räume kommen zu den elf Klassikern hinzu, jeder messbar anders, und alles ist kostenlos.',
  'tour.room.point1':
    'Stereo wird zu zwei Lautsprechern vor Ihnen oder füllt auf Wunsch den Raum; ein 5.1-Film zu fünf plus Sub; ein 7.1-Spiel zum ganzen Ring.',
  'tour.room.point2':
    'Wählen Sie einen Raum unter Empfohlen, Klassische Räume oder Eigene; alles, woraus ein Raum besteht, steht auf seiner Seite.',
  'tour.room.point3':
    'Der Hörtest wählt nach Gehör den Kopf, der die Klänge vor Sie setzt, in fünf Paaren.',
  'tour.room.how':
    'Öffnen Sie DSP, wählen Sie Raum in der Leiste und schalten Sie ihn ein. Wählen Sie einen Raum, dann ziehen Sie einen Lautsprecher oder drehen Sie einen Regler; drücken Sie unter „Ihr Kopf“ auf „Hörtest starten“.',
  'tour.room.open': 'Den Raum öffnen',
  'tour.room.imageAlt':
    'Ein Raum von oben: sieben Lautsprecher und ein Sub um einen Kopf in der Mitte, jeder mit seinem Weg zu den Ohren.',

  'tour.plus.kicker': 'VISUALIZER',
  'tour.plus.title': 'Szenen, die Ihnen für immer gehören',
  'tour.plus.subtitle': 'Visualizer, Studio, Beleuchtung und mehr',
  'tour.plus.lead':
    'Ein ganzer Tab mit Extras, der FluidEQ wachsen lässt: Szenen, die auf Ihrer Grafikkarte gezeichnet werden, ein Studio für eigene Szenen, Desktop-Hintergründe und dynamische Beleuchtung. Eine Szene kostet einen Credit und bleibt Ihre, und der Equalizer, das Rack und die Player bleiben kostenlos, wie sie es immer waren.',
  'tour.plus.point1':
    'Melden Sie sich über Konto im Aktionsmenü an: Ein bestätigtes Konto erhält zum Start Credits gratis.',
  'tour.plus.point2':
    'Credit-Pakete werden einmalig bezahlt, mit Bedingungen in klaren Worten vor der Zahlung. Nichts verlängert sich, und die App sieht Ihre Karte nie.',
  'tour.plus.point3':
    'Jede Szene lässt sich zuerst ansehen, und die geholten laufen auf jedem Computer, auf dem Sie sich anmelden.',
  'tour.plus.how':
    'Öffnen Sie den Tab Visualizer: Links untereinander stehen Galerie, Studio und Dynamische Beleuchtung.',
  'tour.plus.open': 'Visualizer öffnen',
  'tour.plus.imageAlt':
    'Der Tab Visualizer: Galerie, Studio und Dynamische Beleuchtung seitlich untereinander und die Galerie mit Chrom, Blüte, Aurora, Alpin und Neonstadt.',
  'tour.scene.alpine': 'Alpin',
  'tour.scene.aurora': 'Aurora',
  'tour.scene.bloom': 'Blüte',
  'tour.scene.chrome': 'Chrom',
  'tour.scene.neonCity': 'Neonstadt',

  'tour.visualizers.kicker': 'VISUALIZER',
  'tour.visualizers.title': 'Szenen, die sich mit Ihrer Musik bewegen',
  'tour.visualizers.subtitle': 'Auf Ihrer Grafikkarte gezeichnet',
  'tour.visualizers.lead':
    'Szenen sind lebendige Bilder – Berge unter dem Sternenhimmel, Vorhänge aus Polarlicht, eine Neonstadt –, die auf Ihrer Grafikkarte unter Ihren EQ-Kurven gezeichnet werden. Bass, Beat und Höhen bewegen jeweils etwas anderes, und das Fenster um sie herum kann ihre Farben annehmen.',
  'tour.visualizers.point1':
    'Eine Auswahl für alles: {styles} kostenlose Stile zum Formen und Einfärben, dazu Szenen nach Kategorien.',
  'tour.visualizers.point2':
    'Stöbern Sie in der Galerie, testen Sie Kostproben zehn Sekunden lang und fügen Sie Ihre Lieblingsszenen hinzu.',
  'tour.visualizers.point3':
    'Lassen Sie Darstellungen automatisch wechseln, schalten Sie auf Vollbild und stellen Sie unter Ansicht Attack und Release einer Szene ein.',
  'tour.visualizers.how':
    'Klicken Sie im Diagramm auf den Namen der Darstellung und wählen Sie unter Visualizer eine Szene – alle finden Sie unter Visualizer → Galerie.',
  'tour.visualizers.open': 'EQ öffnen',
  'tour.visualizers.imageAlt':
    'Alpin, eine Szene mit Bergen über einem See bei Nacht, läuft im Diagramm unter den EQ-Kurven, darunter vier weitere Szenen.',

  'tour.desktop.kicker': 'DESKTOP-VISUALIZER',
  'tour.desktop.title': 'Ihre Musik hinter Ihrem Desktop',
  'tour.desktop.subtitle': 'Eine Szene auf jedem Monitor',
  'tour.desktop.lead':
    'Legen Sie eine Szene hinter Ihre Desktopsymbole. Sie bewegt sich zu allem, was Sie gerade hören, oder ruhig für sich, und jeder Monitor kann eine eigene Szene zeigen.',
  'tour.desktop.point1':
    'Wählen Sie Monitore auf einer Karte Ihres Schreibtischs, jeden mit seinem eigenen Visualizer.',
  'tour.desktop.point2':
    'Er pausiert, solange Fenster den Monitor verdecken, bei gesperrtem PC und im Akkubetrieb.',
  'tour.desktop.point3':
    'Beim nächsten Start von FluidEQ kommt er von selbst zurück.',
  'tour.desktop.how':
    'Läuft eine Szene im Diagramm, drücken Sie den Monitor-Knopf neben ihrem Namen oder wählen Sie Ansicht → Als Desktophintergrund festlegen.',
  'tour.desktop.open': 'EQ öffnen',
  'tour.desktop.imageAlt':
    'Drei Monitore, jeder mit einer Szene – Aurora, Alpin und Neonstadt – hinter seinen Desktopsymbolen und seiner Taskleiste.',

  'tour.lighting.kicker': 'DYNAMISCHE BELEUCHTUNG',
  'tour.lighting.title': 'Ihr Schreibtisch leuchtet mit der Szene',
  'tour.lighting.subtitle': 'Beta · Ihre RGB-Geräte folgen dem Visualizer',
  'tour.lighting.lead':
    'Tastatur, Maus, Mauspad, Headset und Ständer übernehmen die Farben und den Rhythmus der Szene im Diagramm, über Windows Dynamic Lighting und Razer Chroma.',
  'tour.lighting.point1':
    'Vier Stile für jeden Visualizer: Szene, Farbwelle, Spektrum und Beat-Welle.',
  'tour.lighting.point2':
    'Stimmen Sie jedes Gerät einzeln ab und wählen Sie, was passiert, wenn die Musik stoppt.',
  'tour.lighting.point3':
    'Eine Live-Vorschau zeichnet Ihren eigenen Schreibtisch, während er leuchtet. Die Funktion ist in der Betaphase: Sagen Sie uns, wie sich Ihre Geräte verhalten.',
  'tour.lighting.how':
    'Öffnen Sie Visualizer → Dynamische Beleuchtung und schalten Sie sie ein; lassen Sie dann eine Szene im Diagramm laufen.',
  'tour.lighting.open': 'Visualizer öffnen',
  'tour.lighting.imageAlt':
    'Eine Tastatur, eine Maus und ein Mauspad, beleuchtet im Pink, Violett und Cyan von Neonstadt.',

  'tour.share.kicker': 'JEDER PC, IN BEIDE RICHTUNGEN',
  'tour.share.title': 'Audio zwischen Ihren Computern teilen',
  'tour.share.subtitle': 'Hören Sie beide Computer, egal an welchem Sie sitzen',
  'tour.share.lead':
    'Ihr Gaming-PC und Ihr Laptop spielen ineinander: An welchem Sie auch sitzen, Sie hören beide – über Ihr eigenes Netzwerk, verlustfrei, verschlüsselt und durch den EQ, den Sie an diesem Computer eingestellt haben.',
  'tour.share.pairLabel': 'IN BEIDE RICHTUNGEN',
  'tour.share.pairName': 'Jeder Computer spielt den Ton des anderen',
  'tour.share.wireLabel': 'Verlustfrei · Verschlüsselt · Privates LAN',
  'tour.share.stepsTitle': 'In drei Schritten eingerichtet',
  'tour.share.step1Title': 'Auf einem Computer den Code kopieren',
  'tour.share.step1':
    'Öffnen Sie den Tab „Audio teilen“ und drücken Sie „Code kopieren“. Der Code bleibt jedes Mal derselbe.',
  'tour.share.step2Title': 'Auf dem anderen einfügen und verbinden',
  'tour.share.step2':
    'Öffnen Sie dort „Audio teilen“, fügen Sie den Code unter „Code des anderen Computers“ ein und drücken Sie „Verbinden“. Beide spielen sich sofort unverändert gegenseitig, jeder mit seinem eigenen EQ.',
  'tour.share.step3Title': 'Festlegen, was wohin geht',
  'tour.share.step3':
    'Jeder verbundene Computer hat zwei Schalter, „Hier abspielen“ und „Meinen Ton senden“; mit einem davon aus geht es nur in eine Richtung. Die Leiste zeigt den Song des anderen Computers und steuert ihn. Ein Regler neben „Hier abspielen“ bestimmt die Lautstärke, und „Pausieren“ hält beide Richtungen an, bis Sie „Fortsetzen“ drücken.',
  'tour.share.fact1Title': 'Verlustfrei',
  'tour.share.fact1':
    'Float32-PCM von Ende zu Ende. Kein Codec, kein Generationsverlust.',
  'tour.share.fact2Title': 'Verschlüsselt',
  'tour.share.fact2':
    'AES-256-GCM auf jedem Paket. Der Code ist der Schlüssel; ohne ihn hört niemand mit.',
  'tour.share.fact3Title': 'Bleibt verbunden',
  'tour.share.fact3':
    'Die Verbindung übersteht das Schließen der App und Neustarts, auf beiden Seiten. Nur „Trennen“ beendet sie.',
  'tour.share.tip':
    'Leise anfangen: Zwei gleichzeitig spielende Computer addieren sich. Drehen Sie die Lautstärke vor der ersten Verbindung herunter.',
  'tour.share.open': 'Audio teilen öffnen',

  'tour.library.kicker': 'IHRE MUSIK, IHR PLAYER',
  'tour.library.title': 'Eine Bibliothek für die Musik, die Ihnen gehört',
  'tour.library.subtitle': 'Ordner hinein, Alben heraus',
  'tour.library.lead':
    'Zeigen Sie FluidEQ einen Ordner, und es liest jeden Song und jedes Video darin, samt Tags und Cover, und macht daraus eine Sammlung, die Sie nach Album, Interpret, Genre, Song oder Ordner durchstöbern. Die Wiedergabe läuft über den eigenen Player von FluidEQ, sodass EQ und DSP-Rack immer im Signalweg liegen.',
  'tour.library.point1':
    'Drei Ansichten auf dasselbe Regal: Liste, Raster und Cover Flow, mit Buchstabensprung für große Sammlungen.',
  'tour.library.point2':
    'Eine „Als Nächstes“-Warteschlange mit „Weiterspielen“, die nach dem Ende der Liste mit mehr vom selben Genre weitermacht.',
  'tour.library.point3':
    'Playlists und eine feste Favoritenliste. Rechtsklick auf einen Song, um ihn dort oder in die Warteschlange zu legen.',
  'tour.library.point4':
    'Smart-EQ-Songgedächtnis: „Für diesen Song speichern“ umlegen, während Smart-EQ laufend misst, und nach zwei Minuten bleibt seine Korrektur für diesen Titel gespeichert und kommt zurück, wenn er wieder läuft.',
  'tour.library.how':
    'Öffnen Sie den Tab Bibliothek, drücken Sie „Ordner hinzufügen“ oder ziehen Sie einen Ordner auf die Seite und warten Sie, bis das Einlesen fertig ist. Wählen Sie Alben, Interpreten, Genres, Songs, Ordner oder Baum und drücken Sie dann Wiedergeben.',
  'tour.library.open': 'Bibliothek öffnen',

  'tour.dsp.kicker': 'EIN MASTERING-RACK',
  'tour.dsp.title': 'Das DSP-Rack',
  'tour.dsp.subtitle': 'Zehn Stufen, jede auf einer eigenen Seite',
  'tour.dsp.lead':
    'Ein Rack aus Studiostufen: Normalisierung, Rauschentfernung, Exciter, Bass-Schmiede, Equalizer, Bass-Punch, Dimension, Raum, Maximizer und Master, plus eine Überblendung zwischen Titeln der Bibliothek. Unter der FluidEQ-Engine wirkt es auf alles, was der Computer abspielt; unter Equalizer APO auf die Bibliothek. Jede Stufe hat eine eigene Seite mit Live-Ansicht, die meisten haben Presets, und fünf haben einen Isolieren-Schalter, um nur zu hören, was sie tun.',
  'tour.dsp.point1':
    'Rauschentfernung repariert Rauschen, Brummen und Knackser während der Wiedergabe, und ein neuronaler Stimmreiniger arbeitet an Titeln der Bibliothek.',
  'tour.dsp.point2':
    'Bass-Schmiede legt eine echte Oktave unter den Bass; Bass-Punch formt Attack, Sustain und Blüte, mit einem Mix bis 200 %.',
  'tour.dsp.point3':
    'Ein parametrischer Equalizer mit 6 bis 31 Bändern, anfangs fünfzehn, minimal- oder linearphasig, Mid/Side, Oversampling und über hundert benannten Presets.',
  'tour.dsp.point4':
    'Master mit LUFS-Lautheitsziel und True-Peak-Schutz, Liefer-Presets von Streaming bis Vinyl und einem Pegelabgleich, um Klang statt Lautstärke zu vergleichen.',
  'tour.dsp.how':
    'Öffnen Sie den Tab DSP, wählen Sie unter Presets eine Kette, klicken Sie dann in den Seitentabs auf eine Stufe und schalten Sie sie auf Ein. Unter Equalizer APO spielen Sie vorher einen Titel aus der Bibliothek ab.',
  'tour.dsp.open': 'DSP öffnen',

  'tour.output.kicker': 'SPIELT AN ZWEI ORTEN',
  'tour.output.title': 'Profile für die zweite Ausgabe',
  'tour.output.subtitle':
    'Headset und Lautsprecher zugleich, jedes mit eigenem Profil',
  'tour.output.lead':
    'Kopfhörer und Lautsprecher gleichzeitig mit getrenntem EQ hören. Der zweite Ausgang erhält den Ton vor dem EQ des Hauptausgangs und wendet sein eigenes gespeichertes Profil an. Kein Routing-Treiber nötig.',
  'tour.output.point1':
    'Ein weiteres Gerät unter Zweite Ausgabe einschalten und seine Lautstärke einstellen.',
  'tour.output.point2':
    'Wählen Sie unter dem Gerät ein Profil, oder ändern Sie seinen Klang mit {editSound}, ohne die Hauptausgabe zu wechseln oder anzutasten.',
  'tour.output.point3':
    'Nur ein Player: Etwas in FluidEQ zu starten pausiert den Rest des Rechners, und umgekehrt.',
  'tour.output.point4':
    'Jede Ausgabe hält selbst Schritt: etwa 30 ms hinterher zum Start, etwas mehr nur nach einem Aussetzer, und ihre Verzögerung wird in Millisekunden angezeigt – samt dem Ton eines anderen Computers, wenn Audio teilen ihn hier abspielt.',
  'tour.output.how':
    'Im EQ-Tab rechts Zweite Ausgabe öffnen. Ein Gerät einschalten, unter seinem Namen das EQ-Profil wählen und die Lautstärke einstellen; darunter steht seine Verzögerung.',
  'tour.output.open': 'EQ öffnen',
  'tour.output.imageAlt':
    'Zweite Ausgabe mit aktiviertem BlackShark V2 Pro, EQ-Profilwähler, Lautstärkeregler und Verzögerung.',

  'tour.outputs.kicker': 'JEDE AUSGABE ERINNERT SICH',
  'tour.outputs.title': 'Jede Ausgabe behält ihren eigenen Klang',
  'tour.outputs.subtitle':
    'Kopfhörer und Lautsprecher, jedes eigens abgestimmt',
  'tour.outputs.lead':
    'Wechseln Sie von den Kopfhörern zu den Lautsprechern, und jede Ausgabe bringt ihren Klang mit: EQ, Preset, Bass, Mitten und Höhen, Filter, DSP-Rack, Raum und Pegelausgleich bleiben bei jeder Ausgabe gespeichert.',
  'tour.outputs.point1':
    'Wählen Sie eine Ausgabe, und alles, was Sie für sie eingestellt haben, ist sofort wieder da. Kopfhörer und Lautsprecher teilen sich kein Preset und keine Kurve mehr.',
  'tour.outputs.point2':
    'Eine zweite Ausgabe spielt mit eigenem Klang direkt aus der FluidEQ-Engine, ohne die Hauptausgabe aufzuhalten. {editSound} ändert ihn, ohne die Hauptausgabe zu wechseln.',
  'tour.outputs.point3':
    'Bluetooth-Kopfhörer zeigen ihren Akkustand, eine zweite Ausgabe ihre Verzögerung in Millisekunden.',
  'tour.outputs.how':
    'Öffnen Sie EQ und wählen Sie rechts unter {output} eine Ausgabe: Alles, was Sie danach einstellen, bleibt bei ihr. Eine zweite schalten Sie unter {secondOutput} ein und klicken auf {editSound}.',
  'tour.outputs.open': 'EQ öffnen',
  'tour.outputs.imageAlt':
    'Die Karte „Ausgabe“ mit einem Headset und Lautsprechern, jeweils mit eigenem Preset, eigener Kurve und eigenen DSP-Stufen, die abwechselnd spielen, und daneben eine zweite Ausgabe mit eigenem Klang, Akkustand und „Klang bearbeiten“.',

  'tour.bands.kicker': 'DER EQ IN ZAHLEN',
  'tour.bands.title': 'Die Werte jedes Bands direkt im Diagramm',
  'tour.bands.subtitle': 'Beschriftungen an der Kurve, EQ-Modus daneben',
  'tour.bands.lead':
    'Jedes Band kann Frequenz, Q und Verstärkung über seinem Punkt zeigen, und die Beschriftungen gehen einander aus dem Weg. Der EQ-Modus steht jetzt neben dem Diagramm statt darüber, sodass die Kurven sichtbar bleiben, während Sie ändern, wie sie spielen.',
  'tour.bands.point1':
    'Eine Beschriftung steht genau über oder unter ihrem Punkt, nie über einer anderen, bleibt beim Ziehen ihres Bands stehen und kehrt an ihren Platz zurück, sobald wieder Raum ist.',
  'tour.bands.point2':
    '{eqMode} ist die erste Karte der Seitenleiste, mit je einem Tab für {yourEq} und {corrections}. Sein Knopf über dem Diagramm holt die Karte ins Bild.',
  'tour.bands.point3':
    'Jeder Punkt, Schieberegler und Drehknopf lässt sich mit der Tastatur bedienen, und ein Schieberegler zeichnet die Kurve im selben Bild neu.',
  'tour.bands.how':
    'Öffnen Sie EQ, wählen Sie über dem Diagramm {view} → {everything} (oder drücken Sie {shortcut}) und bewegen Sie ein Band: Seine Werte folgen ihm. {eqMode} wartet oben in der Leiste rechts.',
  'tour.bands.open': 'EQ öffnen',
  'tour.bands.imageAlt':
    'Das EQ-Diagramm mit Frequenz, Q und Verstärkung jedes Bands über seinem Punkt, ein Band, das sich mit den Pfeiltasten bewegt, und darunter die Karte „EQ-Modus“ mit „Ihr EQ“ und „Korrekturen“.',
  'tour.bands.shortcut': 'Strg+W',

  'tour.ears.kicker': 'EIN BAND, ZWEI OHREN',
  'tour.ears.title': 'Jedes Ohr für sich abstimmen',
  'tour.ears.subtitle': 'Links + rechts im Menü des Bands',
  'tour.ears.lead':
    'Klicken Sie mit der rechten Maustaste auf ein Band und wählen Sie {split}: Es wird zu je einem Band pro Ohr, auf derselben Frequenz, und Sie bewegen jedes für sich. Die Kurve des linken Ohrs ist durchgezogen, die des rechten gestrichelt.',
  'tour.ears.point1':
    '{both} fügt die beiden in ihrer Mitte wieder zusammen, auf halbem Weg in Frequenz und Pegel. {reset} und {clear} tun das auch.',
  'tour.ears.point2':
    '{delete} steht im selben Menü, im Haupt-EQ und im DSP-Rack, und fragt vor dem Löschen ein zweites Mal.',
  'tour.ears.point3':
    'Eine Squiglink-Kurve lässt sich in ein Ohr importieren: {importInto} füllt nur das linke oder das rechte und lässt das andere, wie es war.',
  'tour.ears.how':
    'Öffnen Sie den EQ, klicken Sie mit der rechten Maustaste auf ein Band im Diagramm und wählen Sie {split}. Der EQ des DSP-Racks hat dasselbe Menü, solange er auf Stereo wirkt.',
  'tour.ears.open': 'EQ öffnen',
  'tour.ears.imageAlt':
    'Das EQ-Diagramm mit einem Band, geteilt in ein Band fürs linke und eines fürs rechte Ohr, die auseinandergehen und sich in ihrer Mitte wieder treffen, die Kurve des linken Ohrs durchgezogen und die des rechten gestrichelt, neben dem Band-Menü mit Beide Ohren und Links + rechts.',
  // Film voice: generated from .claude/video-kit/films/narration/lines.cjs — edit there.
  'tour.film.eachEar.intro':
    'Jedes Band in FluidEQ kann jetzt auf jedem Ohr anders klingen.',
  'tour.film.eachEar.menu':
    'Klicken Sie mit der rechten Maustaste auf ein Band, um sein Menü zu öffnen.',
  'tour.film.eachEar.split':
    'Wählen Sie Links + rechts. Das Band teilt sich in zwei Hälften, eine für jedes Ohr.',
  'tour.film.eachEar.lines':
    'Ziehen Sie jede Hälfte für sich. Die durchgezogene Linie ist Ihr linkes Ohr, die gestrichelte Ihr rechtes.',
  'tour.film.eachEar.sliders':
    'Jedes Ohr hat auch seinen eigenen Regler, mit L oder R markiert.',
  'tour.film.eachEar.join':
    'Um sie wieder zu vereinen, wählen Sie Beide Ohren. Die zwei Hälften treffen sich in der Mitte.',
  'tour.film.sound.intro':
    'Jede Änderung in FluidEQ hören Sie sofort, und ganz sanft.',
  'tour.film.sound.glide':
    'Bewegen Sie ein Band, während Musik läuft. Jede Änderung gleitet hinein, ohne jedes Klicken.',
  'tour.film.sound.precise':
    'Im Menü EQ-Modus steht Höhen auf Präzise. Jedes Band klingt genau wie gezeichnet, bis hinauf zu zwanzig Kilohertz.',
  'tour.film.sound.classic':
    'Wählen Sie Klassisch, damit die Bänder so gebaut werden wie in Equalizer APO.',
  'tour.film.games.intro':
    'FluidEQ kann jedem Ihrer Spiele einen eigenen Klang geben.',
  'tour.film.games.add':
    'Drücken Sie Spiel hinzufügen und wählen Sie es aus den Spielen Ihrer Launcher.',
  'tour.film.games.sound': 'Dann wählen Sie den Klang, den es haben soll.',
  'tour.film.games.front':
    'Sobald das Spiel im Vordergrund ist, wird sein Klang von selbst geladen.',
  'tour.film.games.closed':
    'Schließen Sie das Spiel, und Ihr eigener Klang kehrt zurück.',
  'tour.film.compact.intro':
    'Wenn Sie nur die Bedienelemente brauchen, wird FluidEQ zu einem kleinen Player.',
  'tour.film.compact.go':
    'Drücken Sie oben auf die Player-Taste, und das Fenster wird zum Kompakten Player.',
  'tour.film.compact.eq':
    'Ihr EQ kommt mit. Drehen Sie einen Regler, und Sie hören es sofort.',
  'tour.film.compact.back': 'Ein Klick bringt Sie zurück zum vollen Fenster.',
  'tour.film.deleteImport.intro':
    'Zwei kleine Änderungen, die Ihren EQ schützen.',
  'tour.film.deleteImport.asks':
    'Band löschen fragt jetzt erst nach. Drücken Sie noch einmal, um das Band wirklich zu löschen.',
  'tour.film.deleteImport.oneEar':
    'Ein Import kann auch nur ein Ohr füllen. Wählen Sie Importieren in, dann Linkes Ohr.',
  'tour.film.deleteImport.otherEar':
    'Nur das linke Ohr wird ersetzt. Das rechte bleibt genau, wie es war.',
  'tour.film.outputs.intro':
    'Jede Ausgabe Ihres Computers behält ihren eigenen Klang.',
  'tour.film.outputs.each':
    'Wechseln Sie von den Lautsprechern zum Kopfhörer, und der EQ wechselt zu dem des Kopfhörers.',
  'tour.film.outputs.back':
    'Wechseln Sie zurück, und die Lautsprecher klingen genau so, wie Sie sie verlassen haben.',
  'tour.film.outputs.second':
    'Sie können auch gleichzeitig über eine Zweite Ausgabe abspielen, mit eigenem Klang.',
  'tour.film.outputs.edit':
    'Drücken Sie Klang bearbeiten, um sie gleich hier einzustellen, während die Hauptausgabe weiterspielt.',
  'tour.film.dsp.intro':
    'Das DSP-Rack formt alles, was Sie hören, nach Ihrem EQ.',
  'tour.film.dsp.preset':
    'Wählen Sie ein Preset, und es stellt das ganze Rack auf einmal ein.',
  'tour.film.dsp.stages':
    'Jede Stufe hat eine eigene Seite, mit allen Reglern im Blick.',
  'tour.film.dsp.meters':
    'Seine Anzeigen bewegen sich mit der Musik, so sehen Sie, was es tut.',
  'tour.film.deesser.intro':
    'Das DSP-Rack hat jetzt einen De-Esser, für Stimmen mit scharfen S-Lauten.',
  'tour.film.deesser.cuts':
    'Wählen Sie ein Preset wie Podcast & Sprache. Jedes scharfe S wird leiser und bernsteinfarben angezeigt, Becken bleiben unberührt.',
  'tour.film.deesser.isolate':
    'Drücken Sie Isolieren, um nur das zu hören, was er entfernt.',
  'tour.film.headphones.intro':
    'FluidEQ kann Ihren Kopfhörer mit Messungen anderer korrigieren.',
  'tour.film.headphones.search':
    'Öffnen Sie EQ-Presets und suchen Sie Ihren Kopfhörer in der OPRA-Bibliothek.',
  'tour.film.headphones.measure':
    'Wählen Sie eine Messung. Bei jeder steht, wer sie gemacht hat.',
  'tour.film.headphones.applied':
    'Drücken Sie Modell-EQ anwenden. Die Korrektur kommt auf eine eigene Ebene, und Ihre Bänder bleiben, wie sie sind.',
  'tour.film.headphones.paste':
    'Sie können auch einen Export aus Squiglink einfügen.',
  'tour.film.headphones.ears':
    'Wenden Sie ihn als EQ an, auf beide Ohren oder nur auf eines.',
  'tour.film.headphones.curve': 'Oder wenden Sie ihn als eigene Kurve an.',
  'tour.film.karaoke.intro':
    'Karaoke macht FluidEQ zur Bühne für Ihre eigenen Songs.',
  'tour.film.karaoke.open':
    'Drücken Sie Song öffnen und wählen Sie den Song zusammen mit seiner Textdatei.',
  'tour.film.karaoke.words':
    'Drücken Sie auf Wiedergabe. Jedes Wort leuchtet auf, während es gesungen wird.',
  'tour.film.karaoke.pitch':
    'Darunter zeigt die Tonhöhenanzeige jede Note, die zu singen ist. Schalten Sie Ihr Mikrofon ein, um Ihre eigene Stimme darauf zu sehen.',
  'tour.film.maker.intro':
    'Der Karaoke-Editor macht aus einem Song eine Karaoke-Datei.',
  'tour.film.maker.timeline':
    'Laden Sie einen Song und drücken Sie Erstellen. Jedes Wort und jede Note liegt auf einer Zeitleiste.',
  'tour.film.maker.play':
    'Spielen Sie ihn ab, und der Abspielkopf läuft über jedes Wort und jede Note. Ziehen Sie eines davon, um Timing oder Tonhöhe zu korrigieren.',
  'tour.film.maker.use':
    'Der Editor kann einen Song auch selbst vorbereiten, aus der Stimme des Sängers. Wenn es stimmt, drücken Sie Im Player verwenden.',
  'tour.film.looks.intro':
    'Das Spektrum unter Ihrem EQ lässt sich ganz nach Ihrem Geschmack zeichnen.',
  'tour.film.looks.open':
    'Drücken Sie Neue Darstellung in der Werkzeugleiste des Diagramms.',
  'tour.film.looks.forms':
    'Blättern Sie mit dem Pfeil durch die Formen: LED-Balken, Neonbalken, Skylines, Glastürme und mehr.',
  'tour.film.looks.shape':
    'Dann formen Sie sie. Teile legt fest, wie viele Balken es gibt, und auch Farben, Abstände und Bewegung bestimmen Sie.',
  'tour.film.looks.save':
    'Drücken Sie Speichern, um sie als eigene Darstellung zu behalten, oder teilen Sie sie als Datei.',
  'tour.film.engine.intro':
    'FluidEQ hat eine eigene Audio-Engine. Sie bringt Ihren EQ und das DSP-Rack zu allem, was der Computer abspielt.',
  'tour.film.engine.choose':
    'Öffnen Sie das Aktionsmenü oben rechts und drücken Sie auf die Karte der Engine. Wählen Sie die FluidEQ-Engine.',
  'tour.film.engine.rack':
    'Öffnen Sie dann DSP und wählen Sie ein Preset. Spiele, Browser und Musik-Apps laufen alle hindurch.',
  'tour.film.library.intro':
    'Die Bibliothek spielt Ihre eigene Musik, durch Ihren EQ.',
  'tour.film.library.albums':
    'Ihre Alben erscheinen als Cover. Blättern Sie mit den Pfeilen durch.',
  'tour.film.library.album':
    'Klicken Sie auf ein Album, um es mit all seinen Songs zu öffnen.',
  'tour.film.library.play':
    'Drücken Sie auf Wiedergabe, und es läuft durch denselben EQ und dasselbe DSP-Rack wie alles andere.',
  // End of film voice.
  'tour.film.soundOn': 'Ton einschalten',
  'tour.film.soundOff': 'Ton ausschalten',
  'tour.film.watch': 'Video ansehen',
  'tour.film.close': 'Video schließen',

  'tour.myCurves.kicker': 'EIGENE KURVEN',
  'tour.myCurves.title': 'Ihre eigene Kurvenliste, neben der von OPRA',
  'tour.myCurves.subtitle': 'Eigene Kurven behalten, benennen, wiederverwenden',
  'tour.myCurves.lead':
    '{eqPresets} hat jetzt {myCurves} neben der OPRA-Bibliothek: jede Kurve, zu der Sie zurückkehren möchten, mit dem Namen, den Sie ihr geben, und einer Zeichnung ihrer Form. Fügen Sie eine aus einem Squiglink-Export, einer .txt-Datei, Ihrem aktuellen EQ oder einer OPRA-Auswahl hinzu.',
  'tour.myCurves.point1':
    '{applyCurve} spielt eine Kurve als Kopfhörerkorrektur, mit eigener Stärke und eigenem Schalter; {applyEq} legt ihre Bänder stattdessen in Ihren EQ.',
  'tour.myCurves.point2':
    'Der Zugang zu {squiglink} in {myCurves} öffnet die Importvorschau; {save} bewahrt Ihre Kurve für später auf.',
  'tour.myCurves.point3':
    '{exportList} schreibt die ganze Liste in eine Datei, als Sicherung oder für einen anderen Computer; {importList} liest sie wieder ein und sagt, was ausgelassen wird.',
  'tour.myCurves.how':
    'Öffnen Sie {eqPresets} unter EQ, wählen Sie {myCurves} und drücken Sie {add}.',
  'tour.myCurves.open': 'EQ-Presets öffnen',
  'tour.myCurves.imageAlt':
    'Die Seite EQ-Presets unter Meine Kurven: eine Liste von vier Kopfhörerkurven, jede mit Namen, Herkunft, dem Tag, an dem sie hinzukam, und einer Zeichnung ihrer Form. Eine gerade aus Squiglink gespeicherte Kurve kommt oben an und spielt als Kopfhörerkorrektur.',

  'tour.songs.kicker': 'EIN KLANG FÜR JEDEN SONG',
  'tour.songs.title': 'Songs, die sich merken, wie Sie sie mögen',
  'tour.songs.subtitle': 'Einmal abstimmen, jedes Mal so hören',
  'tour.songs.lead':
    'Schalten Sie {songSound} ein, und Preset, Bass, Mitten, Höhen und EQ, mit denen ein Song endet, kommen beim nächsten Abspielen zurück, auf der Ausgabe, auf der Sie ihn abgestimmt haben.',
  'tour.songs.point1':
    'Ändern Sie Preset, Bass, Mitten, Höhen oder ein Band, während ein Song läuft, und genau das behält er. Ein Song, den Sie nie anfassen, behält nichts.',
  'tour.songs.point2':
    'Er kommt mit einem Hinweis zurück, der den Song und das Mitgebrachte nennt, mit {undo} und {forget} gleich daneben.',
  'tour.songs.point3':
    'Endet der Song, kehrt der Klang von vorher zurück, und jede Ausgabe merkt sich ihren eigenen: Ein Song kann auf Kopfhörern anders klingen als auf Lautsprechern.',
  'tour.songs.how':
    'Öffnen Sie EQ und schalten Sie rechts in {output} {songSound} ein. Spielen Sie einen Song, wählen Sie ein Preset oder drehen Sie an Bass, Mitten und Höhen, und lassen Sie ihn zu Ende laufen oder überspringen Sie ihn.',
  'tour.songs.open': 'EQ öffnen',
  'tour.songs.imageAlt':
    'Eine Warteschlange aus vier Songs, die nacheinander spielen, drei mit dem Preset und der Kurve, mit denen sie verlassen wurden, einer nie abgestimmt, und darüber der Hinweis eines gemerkten Songs mit „Rückgängig“ und „Diesen Song vergessen“.',

  'tour.deesser.kicker': 'EIN WEICHERES S',
  'tour.deesser.title': 'Ein De-Esser im DSP-Rack',
  'tour.deesser.subtitle': 'Scharfe S leiser, Becken unberührt',
  'tour.deesser.lead':
    '{deEsser} senkt die scharfen S-, T- und Sch-Laute einer Stimme nur, während sie klingen, und lässt Becken, Hi-Hats und die übrigen Höhen, wie sie waren.',
  'tour.deesser.point1':
    'Er erkennt jedes S am eigenen Pegel des Songs, so werden leise und laute Titel gleich behandelt, und Sie sehen jedes erkannte S und wie viel er weggenommen hat.',
  'tour.deesser.point2':
    'Er senkt nur die Frequenzen, aus denen das S besteht, alles darüber oder die ganze Stimme, und {isolate} spielt nur, was er wegnimmt.',
  'tour.deesser.point3':
    '{speech}, {podcast} und {audiobook} schalten ihn ein. Jeder Filter des Racks kann jetzt eigene Profile speichern.',
  'tour.deesser.how':
    'Öffnen Sie DSP und wählen Sie links {deEsser} oder das Preset {podcast}. Beginnen Sie mit einem Profil und erhöhen Sie dann {sensitivity}, bis jedes S erkannt wird.',
  'tour.deesser.open': 'DSP öffnen',
  'tour.deesser.imageAlt':
    'Der Verlauf des De-Essers läuft vorbei: jedes S einer Stimme über der Linie, ab der die Stufe greift, mit seiner Absenkung in Bernstein darunter, und die Hi-Hats in Grau, unberührt; darüber die Stufe mit Spektral gewählt, darunter Sprache, Podcast und Hörbuch.',

  'tour.chat.kicker': 'EINE SZENE PER ANFRAGE',
  'tour.chat.title': 'Um eine Änderung bitten, sie auf der Bühne sehen',
  'tour.chat.subtitle': 'Ein Chat neben der Bühne des Studios',
  'tour.chat.lead':
    'Das {studio} hat jetzt einen Chat neben seiner Bühne. Sagen Sie, was sich ändern soll – Aussehen, Bewegung zur Musik, Farben oder Licht –, und Ihre eigene KI bearbeitet die Szene und spielt jede Version auf der Bühne.',
  'tour.chat.point1':
    'Jede Antwort behält die Version, die sie erstellt hat, und {bringBack} holt eine frühere zurück. Jede Szene behält ihre früheren Chats.',
  'tour.chat.point2':
    '{attach} schickt ein Bild der Szene mit, auf das Sie zeichnen können. Was Sie während der Arbeit senden, wartet in einer Schlange und geht gemeinsam hinaus.',
  'tour.chat.point3':
    'Er läuft mit Claude Code auf diesem Computer, mit Ihrem eigenen Abo, und zeigt Ihre restlichen Limits.',
  'tour.chat.how':
    'Öffnen Sie {plus}, wählen Sie in der Leiste {studio}, wählen oder beginnen Sie eine Szene und schreiben Sie in das Feld neben der Bühne.',
  'tour.chat.open': 'Visualizer öffnen',
  'tour.chat.imageAlt':
    'Die Bühne des Studios neben seinem Chat: die Bitte, das Bühnenlicht auf der Snare blitzen zu lassen, die Schritte der Antwort nacheinander abgehakt, Version 2 mit Zurückholen behalten, und das Licht der Bühne, das zu blitzen beginnt, sobald Version 2 spielt.',
  'tour.chat.ask': 'Lass das Bühnenlicht auf der Snare blitzen.',
  'tour.chat.reply':
    'Erledigt: Beide Spots blitzen auf jeder Snare weiß und klingen wieder zu Pink ab.',

  'tour.looks.kicker': 'IHR EIGENER VISUALIZER',
  'tour.looks.title': 'Eigene Darstellungen für das Diagramm',
  'tour.looks.subtitle': 'Ihre Formen, Ihre Farben, Ihre Bewegung',
  'tour.looks.lead':
    'Das Spektrum unter dem EQ lässt sich zeichnen, wie Sie wollen. Wählen Sie eine von {forms} Formen, von LED- und Neonbalken bis zu Terrassen, Skylines und Glastürmen; färben Sie sie in ihrer eigenen Auto-Färbung, nach Frequenz, Pegel oder Hitze; legen Sie fest, wie schnell sie anspricht und wie lange eine Spitze hängt; markieren Sie Spitzen mit Funken, Kometen oder Wellen. Speichern Sie das Ergebnis als eigene Darstellung und teilen Sie es als Datei.',
  'tour.looks.point1':
    '{forms} Formen, jede mit eigenen Reglern: Teile, Abstand, Füllung, Stärke und ob sie gefüllt oder als Kontur gezeichnet wird.',
  'tour.looks.point2':
    'Färben Sie jede Form in ihrer eigenen Auto-Färbung, nach Frequenz, Pegel oder Hitze mit einem Verlauf aus Ihren eigenen Farben oder in einer einheitlichen Farbe.',
  'tour.looks.point3':
    'Attack und Release bestimmen die Bewegung; leuchtende Spitzen, gefüllte Spitzen und zwölf Spitzenmarken bestimmen, wie ein Schlag aussieht.',
  'tour.looks.point4':
    'Leuchten funktioniert in jedem Modus, und Darstellungen lassen sich als Datei exportieren und importieren.',
  'tour.looks.how':
    'Drücken Sie im Tab EQ „Neue Darstellung“ in der Leiste des Diagramms. Wählen Sie eine Form mit dem Wähler oder blättern Sie mit der Leertaste, stellen Sie Farben und Bewegung bei laufender Musik ein und dann Speichern.',
  'tour.looks.open': 'EQ öffnen',

  'tour.karaoke.kicker': 'EINE BÜHNE ZU HAUSE',
  'tour.karaoke.title': 'Karaoke mit Tonhöhenanzeige',
  'tour.karaoke.subtitle': 'Ihre Songs, Ihre Texte, Ihr Mikrofon',
  'tour.karaoke.lead':
    'Legen Sie einen Song mit oder ohne Textdatei ab: FluidEQ fügt beides zu einer Playlist zusammen, zeigt den getimten Text über Cover oder Video, hört auf Ihr Mikrofon und zeichnet Ihre Tonhöhe gegen die Melodie. Alles bleibt auf diesem Computer; das Mikrofon wird nie aufgenommen oder wiedergegeben.',
  'tour.karaoke.point1':
    'Ein Regler „Führungsstimme“, sobald FluidEQ die Stimme des Songs im Karaoke-Editor getrennt hat: Er reicht von „Nur Playback“ bis zum vollen „Original“, ganz ohne Instrumentaldatei.',
  'tour.karaoke.point2':
    'Eine Tonhöhenspur: die Noten des Songs als Blöcke und Ihre Stimme als Live-Linie darüber, mit Rückmeldung Zu hoch, Richtig und Zu tief.',
  'tour.karaoke.point3':
    'Eine Leistungsübersicht danach, die die Stellen zum Üben auflistet, mit Einzähler für den nächsten Durchlauf.',
  'tour.karaoke.point4':
    'Liest LRC, erweitertes LRC mit Wort-Timing und UltraStar mit Silben und Tonhöhe, über MP3, FLAC, WAV, OGG, M4A und mehr. Übersetzte Texte und geschätzte Gitarrenakkorde kommen dazu.',
  'tour.karaoke.how':
    'Öffnen Sie den Tab Karaoke, drücken Sie „Song öffnen“ oder „Ordner hinzufügen“, wählen Sie einen Titel in der Playlist, schalten Sie das Mikrofon ein, blenden Sie die Tonhöhenanzeige ein und drücken Sie Wiedergeben.',
  'tour.karaoke.open': 'Karaoke öffnen',

  'tour.maker.kicker': 'SELBST GEMACHT',
  'tour.maker.title': 'Der Karaoke-Editor',
  'tour.maker.subtitle': 'Jeder Song wird zur Karaoke-Datei',
  'tour.maker.lead':
    'Ein vollständiges Autorenstudio im Tab Karaoke. Es kann die ganze Arbeit allein erledigen: die Stimme von der Musik trennen, Wörter und Timing mit einem lokalen Sprachmodell lesen und die Melodienoten erkennen. Oder Sie tippen, nehmen auf und zeichnen jedes Timing von Hand auf einer zoombaren Zeitleiste. Alles läuft auf diesem Computer.',
  'tour.maker.point1':
    '„Diesen Song automatisch einrichten“: Stimme trennen, dann Wörter und Timing lesen, mit der Option „Im Hintergrund fortsetzen“.',
  'tour.maker.point2':
    'Behalten Sie die getrennten Spuren: Stimme und Playback, jede speicherbar, auch als MP3.',
  'tour.maker.point3':
    'Handwerkzeug für die Details: Wörter takten, Zeilenanfänge aufnehmen, ein Wortinspektor mit Start und Länge, und ein Wort in Silben teilen.',
  'tour.maker.point4':
    'Malen Sie die Melodie auf ein Tonhöhenraster, markieren Sie goldene Noten und exportieren Sie als FluidEQ-Projekt, UltraStar TXT, LRC, erweitertes LRC oder Playback.',
  'tour.maker.how':
    'Laden Sie in Karaoke einen Song und drücken Sie „Erstellen“. Nehmen Sie im Assistenten „Automatisch einrichten“ an, korrigieren Sie die Wörter auf der Zeitleiste, dann „Im Player verwenden“ und „Exportieren“.',
  'tour.maker.open': 'Karaoke öffnen',

  'tour.media.kicker': 'DAS WEB, DURCH IHREN EQ',
  'tour.media.title': 'Online-Medien',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch und Suno',
  'tour.media.lead':
    'Ein eingebauter Player für die Streaming-Seiten, damit das, was Sie online sehen und hören, durch Ihren EQ läuft statt durch einen separaten Browser. Fünf Seiten sind angebunden, jede mit eigener Suche, und Links nach draußen werden mit der Wahl „Im Browser öffnen“ angehalten.',
  'tour.media.point1':
    'Ein Suchfeld, das die gerade geöffnete Seite durchsucht, mit letzten Suchanfragen, die Sie löschen können.',
  'tour.media.point2':
    'Einmal anmelden: Der Player behält Ihre Anmeldungen zwischen den Besuchen, bis Sie sich abmelden.',
  'tour.media.point3':
    'Fortsetzen: Der Player merkt sich die letzte Seite und die Stelle darin und bringt Sie dorthin zurück.',
  'tour.media.point4':
    'Downloads mit Fortschrittsanzeige und „Im Ordner anzeigen“ am Ende, und ein Abmelde-Knopf (die Tür am Ende der Symbolleiste), der jedes Cookie und jede Anmeldung auf einmal löscht.',
  'tour.media.how':
    'Öffnen Sie den Tab Online-Medien, wählen Sie oben eine Seite, tippen Sie ins Suchfeld und drücken Sie Suchen. Zurück, Vorwärts und Neu laden funktionieren wie im Browser.',
  'tour.media.open': 'Online-Medien öffnen',
  'tour.studio.free': 'Kostenlos für jedes Konto',
};

export default tour;
