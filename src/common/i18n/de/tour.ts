/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Bitte unterstützen Sie uns',
  'tour.rainbow.title': 'Willkommen im Regenbogenmodus',
  'tour.rainbow.subtitle': 'Mit einem Klick einschalten',
  'tour.rainbow.lead':
    'Regenbogenfarben, leuchtende Akzente und ein Rand, der das Farbspektrum durchläuft — und flüssigere Bewegung: Diagramm, Pegelanzeigen und Welle werden mit der vollen Bildwiederholrate des Bildschirms gezeichnet statt mit dreißig Bildern pro Sekunde. Der Klang ändert sich nie.',
  'tour.rainbow.how':
    'Hier sofort einschalten — ×10 ist nicht nötig. Ihre Wahl wird gespeichert und Sie können den Modus jederzeit ausschalten. Beiträge sind freiwillig.',
  'tour.rainbow.enable': 'Regenbogenmodus einschalten',
  'tour.rainbow.disable': 'Regenbogenmodus ausschalten',
  'tour.rainbow.waveform': 'Vorschau der oberen Wellenform',
  'tour.rainbow.toggleHint':
    'Klicken Sie oben auf den Schalter „RAINBOW MODE“, um den Modus ein- oder auszuschalten.',
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
  'tour.player.title': 'FluidEQ, zum Player zusammengeklappt',
  'tour.player.subtitle': 'Ein Schalter macht aus dem Fenster einen Player',
  'tour.player.lead':
    'Mit einem Schalter in der Titelleiste wechselt das Fenster in die Ansicht Kompakter Player: der Song, Ihr Equalizer, ein Visualizer und „Als Nächstes“ in einer schmalen Spalte. Derselbe Schalter bringt Sie zurück auf die Seite, die Sie verlassen haben.',
  'tour.player.point1':
    'Der ganze Equalizer kommt mit: Presets, Band-Layouts, EQ-Modus, Smart-EQ, Bass, Mitten und Höhen.',
  'tour.player.point2':
    'Klappen Sie den Player auf eine Zeile ein, halten Sie ihn über anderen Fenstern oder doppelklicken Sie auf den Visualizer für Vollbild.',
  'tour.player.point3':
    'Ein eigenes Design, Hell oder Dunkel, und Songs, die Sie auf „Als Nächstes“ ablegen, kommen in die Bibliothek und in die Warteschlange.',
  'tour.player.how':
    'Drücken Sie in der Titelleiste neben Hilfe den Schalter Kompakter Player. Im Player holt derselbe Schalter die vollständige App zurück.',
  'tour.player.open': 'Kompakter Player ausprobieren',
  'tour.player.imageAlt':
    'Zweimal die Ansicht Kompakter Player, im Design Dunkel und im Design Hell: oben der Song und seine Zeitanzeige, der Equalizer mit fünfzehn Bändern, darunter „Als Nächstes“; und derselbe Player, auf eine Zeile eingeklappt.',
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
    'Die Seite Spiel-Presets mit vier Spielen, jedes mit eigenem Klang, und die Karten, die FluidEQ auf dem Desktop zeigt, wenn ein Spiel in den Vordergrund kommt und wenn es beendet wird.',
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
  'tour.studio.subtitle': '15 Tage kostenlos oder einen Monat verdienen',
  'tour.studio.lead':
    'Das Studio macht aus einer Idee eine Szene, die sich mit Ihrer Musik bewegt. Es gehört jetzt zu Plus, und ein neues Konto kann es fünfzehn Tage kostenlos testen – ohne Karte, und am Ende der Testphase wird nichts berechnet.',
  'tour.studio.point1':
    'Veröffentlichen Sie eine Szene, und sobald sie freigegeben ist, ist Ihr nächster Monat Plus kostenlos.',
  'tour.studio.point2':
    'Jede Szene eines Mitglieds wird geprüft, bevor sie in die Galerie kommt.',
  'tour.studio.point3':
    'Alles, was Sie vorher gemacht haben, bleibt erhalten, in dem Ordner, den das Studio angibt.',
  'tour.studio.how':
    'Öffnen Sie Plus und wählen Sie Studio in der Seitenleiste. Ohne Plus bietet die Seite dort die Gratis-Testphase an.',
  'tour.studio.open': 'Plus öffnen',
  'tour.studio.imageAlt':
    'Ein im Studio gemachtes Polarlicht über Bergen, die Idee, aus der es entstand, die fünfzehntägige Testphase und der Monat, den eine freigegebene Szene einbringt.',
  'tour.studio.idea':
    'Nordlichter über einem Bergsee. Der Bass lässt das Polarlicht anschwellen, und die Sterne flackern im Takt.',
  'tour.studio.earned': 'Freigegeben: nächster Monat kostenlos',
  'tour.help.kicker': 'HILFE',
  'tour.help.title': 'Fragen Sie das Handbuch mit eigenen Worten',
  'tour.help.subtitle': 'Tippfehler, Pluralformen und zehn Sprachen',
  'tour.help.lead':
    'Durchsuchen Sie das Handbuch so, wie Sie einen Freund fragen würden – „kein Ton“, „Limiter“, „Hintergrundbild“ – in jeder der zehn Sprachen. Das beste Kapitel steht ganz oben, und das Handbuch führt Sie zum Bedienelement, auf dem Bild eingekreist.',
  'tour.help.point1':
    'Es verzeiht Tippfehler und Pluralformen und kennt die Wörter, die Menschen für die Dinge verwenden.',
  'tour.help.point2':
    'Jedes Bedienelement auf einem Bild ist nummeriert wie in einem gedruckten Handbuch, und die Bilder folgen Ihrem Design.',
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

  'tour.plus.kicker': 'FLUIDEQ PLUS',
  'tour.plus.title': 'Willkommen bei FluidEQ Plus',
  'tour.plus.subtitle': 'Visualizer, Studio, Beleuchtung und mehr',
  'tour.plus.lead':
    'Eine freiwillige Mitgliedschaft, die FluidEQ weiter wachsen lässt, mit einem ganz neuen Tab dafür: auf Ihrer Grafikkarte gezeichnete Szenen, ein Studio für eigene Szenen, die Rangliste, Desktophintergründe und Dynamische Beleuchtung. Der Equalizer, das Rack und die Player bleiben kostenlos, wie sie es immer waren.',
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
    'Eine Auswahl für alles: {styles} kostenlose Stile zum Formen und Einfärben, dazu Plus-Visualizer nach Kategorien.',
  'tour.visualizers.point2':
    'Stöbern Sie in der Galerie, testen Sie Kostproben zehn Sekunden lang und fügen Sie Ihre Lieblingsszenen hinzu.',
  'tour.visualizers.point3':
    'Lassen Sie Darstellungen automatisch wechseln, schalten Sie auf Vollbild und stellen Sie unter Ansicht Attack und Release einer Szene ein.',
  'tour.visualizers.how':
    'Klicken Sie im Diagramm auf den Namen der Darstellung und wählen Sie unter Plus-Visualizer eine Szene – alle finden Sie unter Plus → Visualizer.',
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
    'Er pausiert, solange Fenster den Monitor verdecken, bei gesperrtem PC und im Akkubetrieb.',
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
  'tour.theme.title': 'Das dunkle Design',
  'tour.theme.subtitle': 'Fast schwarz, für lange Nächte und OLED-Bildschirme',
  'tour.theme.lead':
    'FluidEQ hat jetzt ein zweites Gesicht. Das dunkle Design entfernt jede Spur des Schieferblaus, mit dem die App geboren wurde: Panels, Menüs und Leisten werden monochrom, der Akzent bleibt, und das Spektrum ist die einzige Farbe im Raum.',
  'tour.theme.point1':
    'Fast schwarze Hintergründe: Auf einem OLED-Display wird es rund um das Diagramm beinahe dunkel.',
  'tour.theme.point2':
    'Jede Seite zieht mit: Menüs, Dialoge, die Karaoke-Bühne und die Bibliothek wechseln gemeinsam. Die Ansicht Kompakter Player behält ein eigenes Design.',
  'tour.theme.point3':
    'Akzentfarbe und Regenbogenmodus bleiben erhalten. Am Klang ändert sich nichts – nur der Anstrich.',
  'tour.theme.howTitle': 'So wechseln Sie',
  'tour.theme.how':
    'Öffnen Sie das Menü hinter dem Puls-Symbol oben rechts und wählen Sie in den Einstellungen unten im Menü neben Design die Option Dunkel. Hell ist einen Klick entfernt, wenn Sie zurück wollen.',
  'tour.theme.tryBlack': 'Jetzt zu Dunkel wechseln',
  'tour.theme.tryOcean': 'Zurück zu Hell',
  'tour.theme.imageAlt':
    'FluidEQ im dunklen Design: der EQ-Tab mit fünfzehn Bändern und dem Live-Spektrum eines laufenden Songs.',

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
    'Öffnen Sie dort FluidEQ, gehen Sie zu Audio teilen, wählen Sie „Audio dieses Computers senden“, fügen Sie den Code ein und drücken Sie „Verbinden und senden“. Der Systemton beginnt zu fließen, unverändert: Die Effekte werden auf dem Computer angewendet, an dem Sie hören.',
  'tour.share.step3Title': 'Hören und Pegel einstellen',
  'tour.share.step3':
    'Jeder Sender spielt mit einem kurzen Puffer, der nach einem Aussetzer von selbst aufholt. Jeder Sender wird in den Ausgang des Empfängers gemischt und von dessen EQ geformt. Die Wiedergabeleiste des Empfängers zeigt den Titel des zuletzt gestarteten Senders, und ihre Tasten wirken über das Netzwerk.',
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
    'Im EQ-Profilwähler unter dem Gerät eines seiner gespeicherten Profile auswählen. Die Abstimmung des Hauptausgangs bleibt erhalten.',
  'tour.output.point3':
    'Nur ein Player: Etwas in FluidEQ zu starten pausiert den Rest des Rechners, und umgekehrt.',
  'tour.output.point4':
    'Spiel/Video startet mit etwa 30 ms Reserve und holt nach einer Unterbrechung auf; Musik startet mit etwa 100 ms für gleichmäßigere Wiedergabe. Der Gerätepuffer erhöht die Verzögerung.',
  'tour.output.how':
    'Im EQ-Tab rechts Zweite Ausgabe öffnen. Ein Gerät einschalten, unter seinem Namen das EQ-Profil wählen, die Lautstärke einstellen und Spiel/Video oder Musik auswählen.',
  'tour.output.open': 'EQ öffnen',
  'tour.output.imageAlt':
    'Zweite Ausgabe mit aktiviertem BlackShark V2 Pro, EQ-Profilwähler, Lautstärkeregler und den Modi Spiel/Video und Musik.',

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
    'Leuchten funktioniert in jedem Modus, und der Regenbogenmodus fügt einen Rand hinzu, der das ganze Farbrad durchläuft. Darstellungen lassen sich als Datei exportieren und importieren.',
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
};

export default tour;
