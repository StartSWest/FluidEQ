/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'Dynamik: leise und laute Passagen',
  'help.dynamics.intro':
    'Dynamik ist ein Dreiband-Kompressor, der leise Passagen anhebt und laute zurückhält, ohne zusätzliche Verzögerung. Er eignet sich für Musik, Filme, Sprache und den eigenen Klang eines Spiels.',
  'help.dynamics.steps':
    'Öffnen Sie DSP → Dynamik, schalten Sie die Stufe ein und wählen Sie eine Vorgabe. Spielvorgaben finden Sie im Gaming Lab.\nDie Bänder umfassen Bässe unter 150 Hz, Mitten von 150 Hz bis 4 kHz und Höhen darüber. Bearbeiten Sie das Band des betreffenden Klangs.\nBei Anheben bestimmt Unter, wann leise Töne angehoben werden, Verhältnis die Stärke und Bis zu die maximale Anhebung. 1:1 lässt sie unverändert.\nBei Zurückhalten bestimmt Über den Einsatz der Absenkung und Verhältnis ihre Stärke. Ein niedrigerer Schwellenwert greift häufiger ein.\nStellen Sie Attack und Release ein, mit Mischung den Originalanteil und mit Ausgleich den Ausgangspegel. Vergleichen Sie bei ähnlicher Lautstärke.\nDie Grafik zeigt das Signal davor und danach sowie die tatsächlich angewandte Verstärkung: nach oben wird angehoben, nach unten abgesenkt. Ein Engine-Update kann nur für die Liveanzeige nötig sein, obwohl der Ton bereits verarbeitet wird.',
  'help.dynamics.tip':
    'Starke Anhebung bringt auch Hintergrundrauschen nach vorn. Weniger Mischung erhält mehr von der ursprünglichen Dynamik.',
  'help.dynamics.keywords':
    'dynamics, compressor, compression, upward compression, downward compression, lift, hold, attack, release, mix, makeup, quiet passages, loud passages',
  'help.deesser.title': 'De-Esser: scharfe Stimmen mildern',
  'help.deesser.intro':
    'Er reduziert scharfe S-, T- und SH-Laute, wenn sie auftreten. Vier Gruppen legen fest, was erkannt, wie reduziert, wie schnell reagiert und welcher Stereobereich bearbeitet wird.',
  'help.deesser.steps':
    'Öffnen Sie DSP → De-Esser, aktivieren Sie die Stufe und probieren Sie eine Vorgabe mit einer zischenden Stimme.\nGrenzen Sie bei Finden die störenden Laute mit unterer und oberer Frequenz ein. Erhöhen Sie Empfindlichkeit, ohne jede helle Note auszulösen.\nBei Absenken folgt Spektral nur den betroffenen Frequenzen; Höhen senkt das obere Band. Ganze Stimme senkt das ganze Signal und ist für eine einzeln aufgenommene Stimme gedacht. Stellen Sie maximale Absenkung und verfügbare Breite ein.\nUnter Timing bestimmen Sie das Erfassen des Anfangs und die Rückkehr der Höhen. Unter Wo konzentriert sich Mitte auf die mittige Stimme, während Becken schonen helle Schläge schützt.\nMit Isolieren hören Sie nur das Entfernte. Schalten Sie es danach aus, um die ganze Aufnahme zu beurteilen. Die Anzeige folgt dem gerade bearbeiteten Regler.\nSpeichern Sie die Stufeneinstellung in ihrer Vorgabenleiste. Speichern Sie auch die ganze Kette, wenn Sie die Kombination behalten möchten: eine andere Kette kann mehrere Stufen ersetzen.',
  'help.deesser.tip':
    'Lispelt die Stimme oder verliert die Musik Luft, reduzieren Sie Empfindlichkeit oder maximale Absenkung. Bearbeitet wird die Wiedergabe, nicht das Mikrofon.',
  'help.deesser.keywords':
    'de-esser, deesser, de essing, sibilance, sharp voice, harsh voice, spectral, centre only, center only, cymbals, isolate',
  'help.normalizer.title': 'Normalisierung und Live-Pegelregelung',
  'help.normalizer.intro':
    'Er regelt den Quellpegel vor den kreativen Stufen. Bibliotheksdateien können vollständig analysiert werden; andere Quellen werden während der Wiedergabe gelernt.',
  'help.normalizer.steps':
    'Öffne DSP → Normalisierer und wähle Aus, True Peak oder Lautheit. Bei externem Audio heißt dieselbe Karte Live-Pegelregelung und bietet Spitzenschutz und Live-Pegelausgleich.\nStelle für True Peak die Spitzenobergrenze ein. Dieser Modus senkt eine Quelle ab, wenn ihre Spitzen die Grenze überschreiten; leisere Quellen werden nicht verstärkt.\nStelle für Lautheit den Lautheitszielwert und die Spitzenobergrenze ein. Das Ziel gilt für die lautesten Drei-Sekunden-Passagen; bei kürzeren Clips wird die integrierte Lautheit verwendet.\nLass bei der Bibliothekswiedergabe die Quellenanalyse fertiglaufen. Lies die Lautheit der stärksten Passagen, die integrierte Lautheit und die angewendete Verstärkung ab. Die integrierte Lautheit beschreibt den gesamten Titel.\nLass die Live-Quelle spielen, während die Quelle gelernt wird, und achte auf den gehaltenen Pegel. Eine lautere Passage kann die Verstärkung senken; leise Passagen behalten ihren relativen Pegel.\nPrüfe die angewendete Verstärkung und einen möglichen Begrenzungsgrund, bevor du das Ziel erhöhst. Spitzenreserve und maximale Anhebung können das Erreichen verhindern. Vergleiche bei ähnlicher Hörlautstärke; dasselbe Passagenziel ergibt nicht bei jedem Titel dieselbe Gesamtlautheit.',
  'help.normalizer.tip':
    'Das unterscheidet sich von der automatischen Vorverstärkung links, die EQ-Spielraum schafft, und von Master für die fertige Ausgabe. Vorhandene Verzerrungen können diese Funktionen nicht reparieren.',
  'help.normalizer.keywords':
    'normalizer, normalisation, normalization, lufs, loudness target, true peak, peak ceiling, applied gain, leveling, live level control, learning source, holding gain',
  'help.crossfade.title': 'Überblendung und eigene Überblendkurven',
  'help.crossfade.intro':
    'Er überlappt aufeinanderfolgende Bibliothekstitel. Die Wiedergabeoption ist von den DSP-Filtern getrennt und überblendet keine anderen Apps oder Karaoke.',
  'help.crossfade.steps':
    'Legen Sie mindestens zwei Titel in die Bibliothekswarteschlange. Wählen und aktivieren Sie in DSP unter den Wiedergabeoptionen Überblendung.\nStellen Sie die Dauer ein und wählen Sie gleiche Leistung, weich oder linear. Lassen Sie den ersten Titel sein Ende erreichen.\nWählen Sie Benutzerdefiniert und ziehen Sie die Punkte der aus- und einblendenden Kurven. Fokussierte Punkte lassen sich auch mit den Pfeiltasten bewegen.\nBeachten Sie beide Kurven und ihre Summe: bleiben beide hoch, kann die Überblendung lauter werden.\nKurve speichern legt die Form unter einem Namen ab. Wählen Sie sie später aus der Liste; Form zurücksetzen setzt die bearbeitbare Form zurück.',
  'help.crossfade.tip':
    'Starten Sie einen Bibliotheks-Audiotitel, wenn die Regler nicht verfügbar sind. Die Kurve ändert den Übergang, nicht den EQ der Titel.',
  'help.crossfade.keywords':
    'crossfade, fade, transition, overlap, dj, equal power, custom curve, save curve, outgoing, incoming',
  'help.gamefilter.title': 'Spiel: Schritte, Umgebung und Stimmen',
  'help.gamefilter.intro':
    'Jedes Spiel erhält eigene Regler für leise Hinweise, Umgebung und Dialog. Beginnen Sie mit seinem Profil und bearbeiten Sie beim Hören dessen eigene Kopie.',
  'help.gamefilter.steps':
    'Wählen Sie im Gaming Lab ein Spiel und laden Sie seinen Klang zum Ausprobieren, falls er noch nicht aktiv ist. Wählen Sie Spiel unter seinen Teilen.\nHeben Sie leise Schritte, Nachladen und Türen an. Calm hält störende laute Ereignisse zurück; vergleichen Sie, bevor Sie beide Regler stark aufdrehen.\nHufe und schwere Schritte verstärkt das tiefe Gewicht von Stiefeln, Pferden und Fahrzeugen. Schalten Sie es aus, wenn Hinweise zu schwer werden.\nUmgebung senkt oder hebt den Hintergrund. Ragt ein Schritt oder ein deutlicher Ton heraus, lässt die Bearbeitung los, damit er nicht mit abgesenkt wird.\nDialog holt eine mittige Stimme nach vorn. Platz schaffen senkt den Rest während des Sprechens etwas ab.\nHören Sie mit Isolation nur die Änderungen und danach wieder das ganze Spiel. Als Profil speichern bewahrt die Abstimmung für andere Spiele; Zurücksetzen stellt das Ausgangsprofil wieder her.',
  'help.gamefilter.tip':
    'Für Spiele mit eigenem 3D-Audio kann ein Profil Room ausgeschaltet lassen, damit die Ortung nicht doppelt erfolgt. Room ist für Kopfhörer gedacht. Nach dem Entladen des Spielklangs kehrt Ihr Musikklang zurück.',
  'help.gamefilter.keywords':
    'game filter, footsteps, lift, calm, environment, ambience, dialogue, voices, make room, hooves, heavy steps, isolate, hrtf, spatial audio',
  'help.songs.title': 'Den Klang jedes Titels merken',
  'help.songs.intro':
    'Ein Titel kann seine Vorgabe, Tone und EQ getrennt für jede Ausgabe merken. Eine Kopfhörerabstimmung verändert nicht die gespeicherte Lautsprecherfassung.',
  'help.songs.steps':
    'Aktivieren Sie unter den Ausgabeprofilen Klang jedes Songs merken. Anfangs ist diese Option ausgeschaltet.\nSpielen Sie einen erkennbaren Titel und ändern Sie Vorgabe, Tone oder EQ. Ein Hinweis kündigt das Speichern an; lehnen Sie es bei einem bloßen Versuch ab.\nBeim nächsten Abspielen auf derselben Ausgabe wird der Klang vorübergehend geladen. Rückgängig überspringt ihn für diese Wiedergabe; Titel vergessen löscht zusätzlich die Erinnerung.\nNach dem Titel kehrt der vorherige Ausgabeklang zurück. Mit einer bewussten Profilwahl übernehmen Sie wieder selbst.\nSmart EQ hat während der Messung einen eigenen Schalter zum Speichern für den Titel. Die gemessene Korrektur ist von Ihrer manuell gespeicherten Abstimmung getrennt.',
  'help.songs.tip':
    'Die Identität stammt aus der Datei oder den Medieninformationen des Players. Fehlende oder falsche Titel können einen Treffer verhindern. Der Vorverstärker wird nicht gespeichert; ein geladener Spielklang hat Vorrang.',
  'help.songs.keywords':
    'per song, song sound, song memory, remember song, save song eq, smart eq, undo, forget this song, preset per song, tone per song',
  'help.mycurves.title': 'Meine Kurven: importieren, bearbeiten und teilen',
  'help.mycurves.intro':
    'Ihre eigene Kurvensammlung liegt neben der Messbibliothek. Prüfen Sie die Antwort und entscheiden Sie zwischen Korrekturebene und bearbeitbaren EQ-Bändern.',
  'help.mycurves.steps':
    'Öffnen Sie EQ-Vorgaben → Meine Kurven. Suchen oder sortieren Sie die gespeicherten Kurven.\nKurve hinzufügen nimmt den aktuellen EQ, Textdateien, Messungen oder eingefügten Text an. Der Squiglink-Import verwendet dessen EQ-Export. Prüfen Sie die Vorschau.\nAls Kurve anwenden ergänzt eine Ebene und lässt Ihre Bänder bestehen. Als EQ anwenden ersetzt nach Bestätigung die Bänder für beide Ohren, links oder rechts, je nach Importziel.\nDas Kurvenmenü bietet Umbenennen, Bänder bearbeiten, Duplizieren, Text kopieren und Löschen. Ein erneuter Import ist zum Bearbeiten nicht nötig.\nListe exportieren und importieren übertragen die Sammlung zwischen Computern. Behalten Sie Modell und Messautor beim Teilen bei.',
  'help.mycurves.tip':
    'Eine Kurve beschreibt einen Frequenzgang; ein Ausgabeprofil bewahrt auch den restlichen Klang des Geräts. Prüfen Sie Modell und Quelle vor der Korrektur.',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
