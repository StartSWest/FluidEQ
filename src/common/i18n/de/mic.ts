/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': 'Mikrofon',
  'mic.label': 'Mikrofon',
  'mic.pickHint': 'Wählen Sie das Mikrofon, dessen Klang Sie formen möchten',
  'mic.list.heading': 'Mikrofone an diesem PC',
  'mic.list.on': 'An',
  'mic.list.off': 'Nicht eingerichtet',
  'mic.live': 'Live in jeder App',
  'mic.notSetUp': 'Auf diesem Mikrofon noch nicht eingerichtet',
  'mic.state.opening': 'Mikrofon wird geöffnet …',
  'mic.state.noInput':
    'Windows zeigt für dieses Mikrofon gerade keinen Eingang',
  'mic.state.blocked':
    'Windows hat FluidEQ dieses Mikrofon nicht öffnen lassen',
  'mic.state.waiting': 'Mikrofon offen · wartet, bis die Engine darauf startet',
  'mic.meter.gateOpen': 'Stimme geht durch',
  'mic.meter.gateClosed': 'Gate geschlossen',
  'mic.meter.compressor': 'Kompressor',
  'mic.meter.limiter': 'Limiter',
  'mic.monitor.label': 'Endergebnis anhören',
  'mic.monitor.hint':
    'Spielt, was andere hören, auf dem Ausgang ab, den Sie gerade hören',
  'mic.monitor.warning':
    'Nutzen Sie Kopfhörer: Über Lautsprecher gelangt Ihre Stimme zurück ins Mikrofon und koppelt.',
  'mic.effectsOff.short':
    'Die Audioverbesserungen von Windows sind für dieses Mikrofon aus',
  'mic.effectsOff.title': 'Audioverbesserungen sind für {mic} aus',
  'mic.effectsOff.body':
    'Solange sie aus sind, lädt Windows auf diesem Mikrofon keinen Effekt, und FluidEQ kann es nicht bearbeiten. Schalten Sie in den Eigenschaften des Mikrofons „Audioverbesserungen“ ein.',
  'mic.effectsOff.button': 'Windows-Soundeinstellungen öffnen',
  'mic.picture.label':
    'Ihre Stimme: blass, was das Mikrofon aufnimmt, und hell, was andere hören',
  'mic.picture.raw': 'Ihr Mikrofon',
  'mic.picture.heard': 'Was andere hören',
  'mic.picture.gate': 'Gate',
  'mic.profile.label': 'Mikrofonprofil',
  'mic.profile.pickHint':
    'Beginnen Sie mit einem Profil für die Art, wie Sie das Mikrofon nutzen',
  'mic.profile.group.use': 'Nach Einsatz',
  'mic.profile.group.mic': 'Nach Mikrofon',
  'mic.profile.tuned': 'angepasst',
  'mic.profile.stream': 'Streaming',
  'mic.profile.stream.hint': 'Warm, nah und gleichmäßig für Twitch und YouTube',
  'mic.profile.podcast': 'Podcast',
  'mic.profile.podcast.hint': 'Eine natürliche Stimme, sanft im Zaum gehalten',
  'mic.profile.chat': 'Spiel-Chat',
  'mic.profile.chat.hint':
    'Klar und präsent in Discord und im Team-Chat, nichts zwischen den Wörtern',
  'mic.profile.sing': 'Gesang',
  'mic.profile.sing.hint':
    'Offen und luftig, kein Pumpen, jeder Atemzug bleibt erhalten',
  'mic.profile.broadcast': 'Rundfunk',
  'mic.profile.broadcast.hint':
    'Radiostimme: kräftige Tiefen, straff und dicht',
  'mic.profile.noisy': 'Lauter Raum',
  'mic.profile.noisy.hint':
    'Lüfter, Kinder, Verkehr: der Reiniger voll und ein sanftes Gate',
  'mic.profile.meet': 'Meetings',
  'mic.profile.meet.hint':
    'Teams und Zoom: klare Worte, die eigene Bereinigung bleibt den Apps überlassen',
  'mic.profile.laptop': 'Laptop-Mikrofon',
  'mic.profile.laptop.hint':
    'Dünn, fern und hallig: Tiefensperre hoch, Stimmreiniger kräftig',
  'mic.profile.headset': 'Headset-Mikrofon',
  'mic.profile.headset.hint':
    'Eine kleine Kapsel nah am Mund: Wärme zurück, Plosive weg',
  'mic.reset': 'Auf {profile} zurücksetzen',
  'mic.setup.title':
    'Die FluidEQ Engine ist auf {mic} noch nicht eingerichtet.',
  'mic.setup.body':
    'Windows fragt einmal um Erlaubnis. Ihre Ausgaben spielen während der Einrichtung weiter.',
  'mic.setup.button': 'Auf diesem Mikrofon einrichten',
  'mic.setup.working': 'Wird eingerichtet…',
  'mic.setup.declined':
    'Windows hat keine Erlaubnis erteilt, daher wurde nichts geändert.',
  'mic.setup.failed': 'Die Einrichtung auf diesem Mikrofon ist fehlgeschlagen.',
  'mic.notFluid.title':
    'Der eigene Klang eines Mikrofons läuft über die FluidEQ Engine.',
  'mic.notFluid.body':
    'Sein Klang bleibt gespeichert und ist zu hören, sobald die FluidEQ Engine ausgewählt ist.',
  'mic.empty.backTitle': 'Windows stellt Ihre Mikrofone wieder her',
  'mic.empty.backBody':
    'Sie erscheinen hier, sobald Windows sie wieder auflistet – meist einen Moment nach dem Neustart seines Audios.',
  'mic.empty.lookAgain': 'Erneut suchen',
  'mic.stage.level': 'Stimmpegel',
  'mic.level.title': 'Stimmpegel',
  'mic.level.description':
    'Bringt Ihre Stimme beim Sprechen auf einen gleichmäßigen Pegel: lauter, wenn Sie leise oder weit vom Mikrofon sind, leiser, wenn Sie rufen. Den Raum zwischen den Wörtern hebt er nie an.',
  'mic.level.group': 'Der Pegel',
  'mic.level.groupHint':
    'Ziel ist der Pegel, auf dem Ihre Stimme gehalten wird. Höchste Anhebung sagt, wie weit eine leise Stimme angehoben werden darf.',
  'mic.level.target': 'Ziel',
  'mic.level.maxLift': 'Höchste Anhebung',
  'mic.level.live.title': 'Ihre Stimme, ausgeglichen',
  'mic.level.live.label':
    'Ihre Stimme in den letzten zehn Sekunden, wie sie ankommt und wie sie ausgeglichen wird, gegenüber dem Ziel',
  'mic.level.live.keyArrives': 'Wie sie ankommt',
  'mic.level.live.keyLevelled': 'Ausgeglichen',
  'mic.level.live.keyTarget': 'Ziel',
  'mic.level.live.target': 'Ziel {db} dB',
  'mic.level.live.lifted': 'Verstärkung jetzt',
  'mic.level.live.state': 'Jetzt',
  'mic.level.live.following': 'Folgt Ihrer Stimme',
  'mic.level.live.holding': 'Hält den Pegel',
  'mic.preset.lowCut.speech': 'Sprache',
  'mic.preset.lowCut.deep': 'Tiefe Stimme',
  'mic.preset.lowCut.headset': 'Headset nah',
  'mic.preset.lowCut.rumble': 'Rumpelschutz',
  'mic.preset.lowCut.distant': 'Tischmikrofon auf Abstand',
  'mic.preset.denoise.light': 'Leicht',
  'mic.preset.denoise.studio': 'Studio',
  'mic.preset.denoise.home': 'Homeoffice',
  'mic.preset.denoise.noisy': 'Lauter Raum',
  'mic.preset.denoise.fan': 'Lüfter und Klimaanlage',
  'mic.preset.gate.gentle': 'Sanft',
  'mic.preset.gate.calls': 'Anrufe',
  'mic.preset.gate.podcast': 'Podcast',
  'mic.preset.gate.stream': 'Streaming',
  'mic.preset.gate.tight': 'Straff',
  'mic.preset.level.gentle': 'Sanft',
  'mic.preset.level.calls': 'Anrufe',
  'mic.preset.level.podcast': 'Podcast',
  'mic.preset.level.stream': 'Streaming',
  'mic.preset.level.soft': 'Leise Stimme',
  'mic.picture.taken': 'Sichtbares Grau = was die Filter entfernt haben',
  'mic.preset.level.everyday': 'Alltagsstimme',
  'mic.stage.reverb': 'Hall',
  'mic.reverb.title': 'Hall',
  'mic.reverb.description':
    'Stellt Ihre Stimme in einen Raum: eine Plate für Gesang, ein kleiner Raum für etwas Luft. Nur die Fahne kommt hinzu, Ihre Stimme behält ihr Timing.',
  'mic.reverb.group.type': 'Raum',
  'mic.reverb.type.plate': 'Plate',
  'mic.reverb.type.vocalPlate': 'Vocal Plate',
  'mic.reverb.type.room': 'Raum',
  'mic.reverb.type.chamber': 'Kammer',
  'mic.reverb.type.hall': 'Saal',
  'mic.reverb.typeHint.plate':
    'Hell und dicht vom ersten Moment an, der klassische Klang hinter einer Gesangsstimme.',
  'mic.reverb.typeHint.vocalPlate':
    'Dunkler und kürzer: sitzt hinter der Stimme, ohne sie zu überdecken.',
  'mic.reverb.typeHint.room':
    'Klein und nah: etwas Luft um die Stimme, nie ein Echo.',
  'mic.reverb.typeHint.chamber':
    'Warm und rund, mit einem weicheren Anfang als eine Plate.',
  'mic.reverb.typeHint.hall':
    'Groß und langsam aufbauend, mit langer Fahne für Balladen.',
  'mic.reverb.group.tail': 'Die Fahne',
  'mic.reverb.group.tailHint':
    'Mix ist, wie laut die Fahne neben Ihrer Stimme ist. Pre-Delay lässt eine Lücke, damit die Wörter klar bleiben.',
  'mic.reverb.mix': 'Mix',
  'mic.reverb.decay': 'Abklingen',
  'mic.reverb.predelay': 'Pre-Delay',
  'mic.reverb.group.colour': 'Färbung',
  'mic.reverb.group.colourHint':
    'Ton macht die Fahne dunkler, Low-Cut hält den Matsch der Stimme heraus, Breite verteilt sie bei einem Stereo-Mikrofon.',
  'mic.reverb.tone': 'Ton',
  'mic.reverb.lowCut': 'Low-Cut',
  'mic.reverb.width': 'Breite',
  'mic.reverb.group.duck': 'Während Sie sprechen',
  'mic.reverb.group.duckHint':
    'Die Fahne tritt zurück, während Sie sprechen, und blüht in den Pausen auf, damit jedes Wort klar bleibt.',
  'mic.reverb.duckDb': 'Tritt zurück',
  'mic.reverb.tail.title': 'Die Form der Fahne',
  'mic.reverb.tail.label':
    'Ihre Stimme und die Hallfahne danach, von ihrem Pegel 60 dB hinab über das Abklingen',
  'mic.reverb.tail.keyVoice': 'Ihre Stimme',
  'mic.reverb.tail.keyTail': 'Die Fahne',
  'mic.reverb.tail.keyDucked': 'Während Sie sprechen',
  'mic.reverb.tail.voice': 'Stimme',
  'mic.reverb.tail.mix': '{db} dB',
  'mic.reverb.tail.decay': '−60 dB bei {time}',
  'mic.reverb.tail.ducked': '−{db} dB während Sie sprechen',
  'mic.preset.reverb.plate': 'Plate',
  'mic.preset.reverb.vocalPlate': 'Vocal Plate',
  'mic.preset.reverb.intimate': 'Kleiner Raum',
  'mic.preset.reverb.chamber': 'Kammer',
  'mic.preset.reverb.hall': 'Konzertsaal',
  'mic.preset.reverb.streamAir': 'Luft fürs Streaming',
  'mic.profile.group.singing': 'Gesang',
  'mic.profile.group.fx': 'Stimmeffekte',
  'mic.profile.singPlate': 'Gesang · Plate',
  'mic.profile.singPlate.hint': 'Gesang mit einer hellen Plate dahinter',
  'mic.profile.singHall': 'Gesang · Saal',
  'mic.profile.singHall.hint': 'Gesang in einem großen Saal mit langer Fahne',
  'mic.profile.singRoom': 'Gesang · Raum',
  'mic.profile.singRoom.hint': 'Gesang in einem kleinen Raum',
  'mic.profile.streamAir': 'Streaming · Luft',
  'mic.profile.streamAir.hint':
    'Streaming mit etwas Raum, der zurücktritt, während Sie sprechen',
  'mic.profile.radio': 'Mittelwellenradio',
  'mic.profile.radio.hint':
    'Ein altes Radio: das MW-Band und ein gepresster Pegel',
  'mic.profile.phone': 'Telefon',
  'mic.profile.phone.hint': 'Das Telefonband, an beiden Enden schmal',
  'mic.profile.whisper': 'Flüstern',
  'mic.profile.whisper.hint':
    'Ein Flüstern nach vorn geholt, mit Luft obendrauf',
  'mic.profile.megaphone': 'Megafon',
  'mic.profile.megaphone.hint':
    'Eine schmale, gedrückte Mitte und ein kurzer Raumschlag',
  'mic.empty.title': 'Kein Mikrofon gefunden',
  'mic.empty.body':
    'Schließen Sie ein Mikrofon an oder aktualisieren Sie die FluidEQ Engine, damit sie Mikrofone auflisten kann.',
  'mic.stage.lowCut': 'Tiefensperre',
  'mic.stage.cleaner': 'Geräuschunterdrückung',
  'mic.stage.gate': 'Gate',
  'mic.stage.deEsser': 'De-Esser',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'Kompressor',
  'mic.stage.limiter': 'Limiter',
  'mic.lowCut.title': 'Tiefensperre',
  'mic.lowCut.description':
    'Entfernt Rumpeln, Tischklopfen und den Lüfter unterhalb der Stimme, bevor der Stimmreiniger sie hört.',
  'mic.lowCut.group.below': 'Unter der Stimme',
  'mic.lowCut.group.belowHint':
    'Nah am Mikrofon nimmt den zusätzlichen Bass zurück, den eine Stimme wenige Zentimeter vor der Kapsel bekommt.',
  'mic.lowCut.cut': 'Schneidet unter',
  'mic.lowCut.proximity': 'Nah am Mikrofon',
  'mic.lowCut.group.pops': 'Plosive',
  'mic.lowCut.group.popsHint':
    'Dämpft den Stoß eines P oder B und lässt eine gleichmäßige Stimme unberührt.',
  'mic.lowCut.plosive': 'Poppschutz',
  'mic.gate.title': 'Gate',
  'mic.gate.description':
    'Schließt das Mikrofon zwischen den Wörtern, damit Raum, Lüfter und Tastatur draußen bleiben. Mit kleinem Bereich wird es zu einem sanften Expander.',
  'mic.gate.group.level': 'Wann es öffnet',
  'mic.gate.group.levelHint':
    'Achten Sie auf die gestrichelte Linie im Bild: Ihre Stimme sollte sie überschreiten, der Raum darunter bleiben.',
  'mic.gate.threshold': 'Öffnet ab',
  'mic.gate.range': 'Dämpft um',
  'mic.gate.group.time': 'Wie schnell',
  'mic.gate.group.timeHint':
    'Die Haltezeit lässt es zwischen den Silben offen, damit Wortenden nie abgeschnitten werden.',
  'mic.gate.attack': 'Öffnet in',
  'mic.gate.hold': 'Haltezeit',
  'mic.gate.release': 'Schließt in',
  'mic.monitor.on': 'Endergebnis wird wiedergegeben',
  'mic.delay.label': 'Verzögerung',
  'mic.delay.measured':
    'von der Engine an diesem Mikrofon gemessen, von der Kapsel bis in jede App',
  'mic.delay.unknown': 'die Engine hat dieses Mikrofon noch nicht gemessen',
  'mic.rail.master': 'Mikrofon bearbeiten',
  'mic.rail.note':
    'Jeder Schalter schaltet seine Stufe ganz ab: keine Klangänderung, keine Verzögerung. Die Zahl neben einer Stufe ist die Verzögerung, die sie hinzufügt.',
  'mic.meter.noise': 'Entferntes Rauschen',
  'mic.cleaner.description':
    'Entfernt Tastatur, Lüfter und Raum unter Ihrer Stimme, während Sie sprechen.',
  'mic.cleaner.strength': 'Stärke',
  'mic.cleaner.neverCuts': 'Schneidet nie ab',
  'mic.cleaner.neverCutsHint':
    'Kommt das Modell einmal zu spät, behält die Stimme den Pegel des letzten gereinigten Moments und wird ohne Klick angeschlossen, nie mit dem rohen Raum. Solche Momente werden hier gezählt.',
  'mic.cleaner.lateMinute': 'verspätete Blöcke in der letzten Minute',
  'mic.gate.live.title': 'Ihre Stimme am Gate',
  'mic.gate.live.hint':
    'Ziehen Sie die Linie nach oben oder unten. Die grauen Strecken zeigen, wo das Gate den Raum gedämpft hat.',
  'mic.gate.live.opens': 'öffnet bei {db} dB',
  'mic.live.ago': '−{seconds} s',
  'mic.live.now': 'jetzt',
  'mic.gate.live.stateOpen': 'Offen',
  'mic.gate.live.stateClosed': 'Geschlossen',
  'mic.gate.live.waiting': 'Wartet auf Ihre Stimme',
  'mic.gate.live.keyLevel': 'Was das Gate hört',
  'mic.gate.live.keyClosed': 'Gedämpft',
  'mic.gate.live.keyOpens': 'Öffnet',
  'mic.gate.live.keyCloses': 'Schließt',
  'mic.gate.live.label':
    'Der Pegel, den das Gate in den letzten fünf Sekunden hört, gegen die Linien, an denen es öffnet und schließt',
  'mic.gate.live.openShare': 'Offen, letzte {seconds} s',
  'mic.lowCut.live.title': 'Wo Ihre Stimme liegt',
  'mic.lowCut.live.keyKept': 'Ihre Stimme, behalten',
  'mic.lowCut.live.keyTaken': 'Entfernt',
  'mic.lowCut.live.keyCut': 'Die Sperre',
  'mic.lowCut.live.label':
    'Ihre Stimme, wie sie ankommt, und was die Tiefensperre entfernt',
  'mic.lowCut.live.chip': '{hz} Hz · {slope} dB/Okt.',
  'mic.lowCut.live.hum': 'Brummen {hz} Hz',
  'mic.lowCut.live.taken': 'Jetzt entferntes Rumpeln',
  'mic.lowCut.live.lowest': 'Tiefster Ton Ihrer Stimme',
  'mic.lowCut.live.hint':
    'Ziehen Sie den Punkt nach links oder rechts und halten Sie ihn unter Ihrem tiefsten Ton.',
  'mic.cleaner.live.title': 'Stimme und Raum, jetzt',
  'mic.cleaner.live.keyBefore': 'Was das Mikrofon hört',
  'mic.cleaner.live.keyAfter': 'Nach der Reinigung',
  'mic.cleaner.live.label':
    'Ihre Stimme und Ihr Raum vor und nach der Reinigung',
  'mic.cleaner.live.roomBefore': 'Raum vorher',
  'mic.cleaner.live.roomAfter': 'Raum nachher',
  'mic.cleaner.live.taken': 'Entfernter Raum',
  'mic.cleaner.live.over': 'Stimme über dem Raum',
  'mic.cleaner.live.hint':
    'Grau ist Ihr Raum, wie das Mikrofon ihn hört; die Farbe ist, was die Reinigung übrig lässt.',
  'mic.cleaner.strengthHint':
    'Wie viel vom Raum die Reinigung entfernt. Über 80 % klingt eine Stimme bearbeitet.',
  'mic.preset.limiter.catch': 'Spitzen abfangen',
  'mic.preset.limiter.calls': 'Anrufe',
  'mic.preset.limiter.stream': 'Streaming',
  'mic.preset.limiter.loud': 'Laut über dem Spiel',
  'mic.preset.dynamics.gentle': 'Sanfte Stimme',
  'mic.preset.dynamics.broadcast': 'Radiostimme',
  'mic.preset.dynamics.callouts': 'Ansagen im Spiel',
  'mic.preset.dynamics.singing': 'Gesang',
  'mic.preset.deEsser.soft': 'Sanft',
  'mic.preset.deEsser.podcast': 'Podcast',
  'mic.preset.deEsser.bright': 'Helles Mikrofon',
  'mic.preset.eq.warm': 'Warme Stimme',
  'mic.preset.eq.clear': 'Klare Stimme',
  'mic.preset.eq.radio': 'Radio',
  'mic.preset.eq.headset': 'Headset-Korrektur',
  'mic.preset.eq.thin': 'Dünnes Mikrofon füllen',
};
