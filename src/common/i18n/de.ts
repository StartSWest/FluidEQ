/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/** German. Formal "Sie" throughout, as is normal for desktop software. */
const de: Partial<Dictionary> = {
  'app.tagline': 'Ihr Klang. Auf jedem Gerät. Automatisch.',
  'app.actions': 'FluidEQ-Aktionen',
  'app.actions.title': 'Audio-Aktionen',
  'app.status.ready': 'Mit Equalizer APO verbunden',
  'app.status.checking': 'Equalizer APO wird geprüft…',
  'app.status.error': 'Equalizer APO antwortet nicht',
  'app.menu.importEq': 'EQ-Einstellungen importieren…',
  'app.menu.importConvolution': 'Impulsantwort importieren…',
  'app.menu.restartAudio': 'Windows-Audio neu starten',
  'app.menu.reconfigure': 'Equalizer APO neu einrichten',
  'app.menu.apoSettings': 'Equalizer-APO-Einstellungen',
  'app.menu.support': 'Projekt unterstützen',
  'whatsNew.eyebrow': 'VERSIONSHINWEISE',
  'whatsNew.title': 'Neu in FluidEQ',
  'whatsNew.loading': 'Versionshinweise werden geladen…',
  'whatsNew.missing':
    'Die Versionshinweise sind in diesem Build nicht zu finden. Sie stehen auch auf GitHub.',
  'app.menu.whatsNew': 'Neuerungen',
  'app.menu.language': 'Sprache',
  'app.window.minimize': 'Minimieren',
  'app.window.maximize': 'Maximieren',
  'app.window.restore': 'Wiederherstellen',
  'app.window.close': 'Schließen',
  'app.window.minimizeApp': 'FluidEQ minimieren',
  'app.window.maximizeApp': 'FluidEQ maximieren',
  'app.window.restoreApp': 'FluidEQ wiederherstellen',
  'app.window.closeApp': 'FluidEQ schließen',
  'app.dismiss': 'Ausblenden',

  'tabs.aria': 'Klang-Arbeitsbereich',
  'tabs.eq': 'EQ & Hörertyp',
  'tabs.voicing': 'Klangcharakter',
  'tabs.convolution': 'Faltung',
  'tabs.config': 'Config',
  'tabs.video': 'Video',

  'graph.resize': 'Ziehen, um die Größe des Diagramms zu ändern',
  'video.sites': 'Video-Seiten',
  'video.back': 'Zurück',
  'video.forward': 'Vorwärts',
  'video.reload': 'Neu laden',
  'video.stop': 'Stopp',
  'video.searchAria': 'Auf der aktuellen Seite suchen',
  'video.searchOn': 'Auf {site} suchen',
  'video.searchGo': 'Suchen',
  'video.searchClear': 'Suche löschen',
  'video.searchRecent': 'Letzte Suchanfragen',
  'video.searchForget': '„{term}“ vergessen',
  'video.searchForgetAll': 'Letzte Suchanfragen löschen',
  'video.adBlock': 'Werbung blockieren',
  'video.adBlockHint':
    'Überspringt Videowerbung und blendet Werbeflächen auf YouTube aus.',
  'video.blockedTitle': 'Dieser Link führt aus dem Player heraus',
  'video.blockedSignInTitle': 'Die Anmeldung passiert im Browser, nicht hier',
  'video.openInBrowser': 'Im Browser öffnen',
  'video.resize': 'Ziehen, um die Größe des Players zu ändern',

  'notice.apoReconfigured':
    'Equalizer APO wurde installiert oder neu eingerichtet. Falls kein Ton kommt, starten Sie den Windows-Audiodienst neu, statt den PC neu zu starten.',
  'notice.restartNow': 'Audio jetzt neu starten',
  'notice.importComplete': 'Import abgeschlossen',
  'notice.restartConfirm':
    'Der Ton setzt für ein paar Sekunden aus und Windows fragt nach Administratorrechten. Fortfahren?',
  'update.title': 'FluidEQ-Aktualisierung',
  'update.available': 'Version {version} ist verfügbar und wird geladen.',
  'update.downloading': 'Aktualisierung wird geladen… {percent} %',
  'update.ready':
    'Version {version} ist bereit. Starten Sie FluidEQ neu, um sie zu übernehmen.',
  'update.restart': 'Jetzt neu starten',
  'update.restarting': 'Wird neu gestartet…',
  'notice.restartDone':
    'Windows-Audio wurde neu gestartet. Öffnen Sie Programme, die noch stumm sind, erneut.',

  'sidebar.engine': 'VERARBEITUNG',
  'sidebar.systemEq': 'System-EQ',
  'sidebar.preamp': 'Vorverstärkung',
  'sidebar.preampAria': 'Vorverstärkung (dB)',
  'sidebar.preampAuto':
    'Wird für Sie gesetzt. Schalten Sie „Automatisch normalisieren“ aus, um selbst zu regeln.',
  'sidebar.headroom': 'APO-HEADROOM',
  'sidebar.autoPreamp': 'Automatisch normalisieren',
  'sidebar.visualizer': 'ANZEIGE',
  'sidebar.graphView': 'Frequenzgang',

  'output.eyebrow': 'FOLGT IHRER AUSGABE',
  'output.title': 'Automatisches Profil',
  'output.device': 'Ausgabegerät',
  'output.active': 'AKTIV',
  'output.none': 'Keine aktiven Ausgänge gefunden',
  'output.mapping': 'Automatische Zuordnung',
  'output.mapping.neutral': 'Neutrale Ausgabe',
  'output.mapping.live': 'Laufende Abstimmung zugeordnet',
  'output.mapping.hint':
    'Ändern Sie einen beliebigen EQ-Regler, um ihn zu speichern und automatisch diesem Ausgang zuzuordnen.',
  'output.hint':
    'FluidEQ merkt sich die feste Geräte-ID, dieser Klang folgt dem Gerät also immer, wenn Windows es auswählt.',

  'driver.eyebrow': 'WOMIT SIE HÖREN',
  'driver.title': 'Treibertyp',
  'driver.none': 'Keine Korrektur',
  'driver.none.hint': 'Nur Ihre Bänder und der Klangcharakter',
  'driver.strength': 'Stärke',
  'driver.range': '±1,5 dB',

  'profiles.eyebrow': 'IHR KLANG',
  'profiles.title': 'Gespeicherte Profile',
  'profiles.name': 'Profilname',
  'profiles.nameAria': 'Profilname',
  'profiles.new': 'Neues Profil',
  'profiles.newAria': 'Ein neues Profil aus dem aktuellen EQ anlegen',
  'profiles.untitled': 'Unbenanntes Profil',
  'profiles.save': 'Als neu speichern',
  'profiles.update': 'Aktualisieren',
  'profiles.saveAria': 'Einstellungen im Profil speichern',
  'profiles.restore': 'Zurücksetzen',
  'profiles.restoring': 'Wird zurückgesetzt…',
  'profiles.restoreAria':
    'Die zuletzt von Hand gespeicherte Fassung dieses Profils wiederherstellen',
  'profiles.attached': 'AKT',
  'profiles.attachedTitle': 'Läuft auf diesem Ausgang',
  'profiles.detecting': 'Ausgang wird erkannt…',
  'profiles.empty': 'Noch keine Profile. Legen Sie Ihren ersten Klang an.',
  'profiles.error.empty': 'Der Profilname darf nicht leer sein.',
  'profiles.error.restricted': 'Ungültiger Name, bitte einen anderen wählen.',
  'profiles.error.duplicate':
    'Diesen Namen gibt es schon, bitte einen anderen wählen.',
  'profiles.edit': 'Profilnamen bearbeiten',

  'autoeq.eyebrow': 'MIT EINER REFERENZ BEGINNEN',
  'autoeq.title': 'AutoEQ-Bibliothek',
  'autoeq.selectSource': 'Quelle wählen',
  'autoeq.applied': 'Angewendet: {name}',
  'autoeq.notApplied': 'Keine Referenz angewendet',
  'autoeq.source': 'Messquelle',
  'autoeq.model': 'Kopfhörermodell',
  'autoeq.target': 'Messung / Zielkurve',
  'autoeq.apply': 'Modell-EQ anwenden',
  'autoeq.applying': 'Wird angewendet…',
  'autoeq.applyAria': 'EQ des gewählten Modells anwenden',
  'autoeq.checking': 'Offizielle Datenbank wird geprüft…',
  'autoeq.updateAvailable': 'Aktualisierung verfügbar ({count} Modelle)',
  'autoeq.upToDate': 'Datenbank aktuell — {count} Modelle',
  'autoeq.updateUnknown': 'Aktualisierungsprüfung nicht möglich',
  'autoeq.update': 'Datenbank aktualisieren',
  'autoeq.updating': 'Wird aktualisiert…',
  'autoeq.updateAria': 'AutoEq-Datenbank aktualisieren',
  'autoeq.allDatabases': 'Alle Datenbanken',
  'autoeq.allDatabases.hint':
    'Durchsucht AutoEq offiziell und GadgetryTech zugleich.',
  'autoeq.pickDevice': 'Erst ein Modell wählen 🎧',
  'autoeq.noResponses': 'Keine unterstützte Messung 😞',
  'autoeq.pickResponse': 'Eine Messung wählen! 🔊',
  'autoeq.selectSourcePlaceholder': 'Quelle wählen…',
  'autoeq.searchSources': 'Quellen durchsuchen…',
  'autoeq.noModel': 'Kein gemessenes Modell passt zu Ihrer Suche.',
  'autoeq.searchModels': 'Nach Marke oder Modell suchen…',
  'voicing.quickAria': 'Klangcharakter: {name}',
  'voicing.quickNone': 'Klangcharakter: keiner',
  'voicing.quickTitle': 'Kein Klangcharakter aktiv',
  'voicing.quickLabel': 'Klangcharakter',
  'voicing.quickNoneHint': 'Nur Ihre EQ-Bänder',

  'eq.eyebrow': 'FEINABSTIMMUNG',
  'eq.title': 'Parametrischer EQ',
  'eq.smart': 'Smart-EQ',
  'eq.smart.cancel': 'Abbrechen',
  'eq.smart.aria': 'Smart-EQ aus dem laufenden Ausgangssignal',
  'eq.smart.cancelAria': 'Smart-EQ-Messung abbrechen',
  'eq.smart.continuous': 'Fortlaufend',
  'eq.smart.continuousAria':
    'Smart EQ misst und justiert weiter, solange Musik läuft',
  'eq.smart.modeAria': 'Wählen, wie Smart EQ misst',
  'eq.smart.mode.once.note': 'Eine Messung, auf einmal angewendet',
  'eq.smart.mode.detail': 'Detail',
  'eq.smart.mode.detail.note': 'Misst weiter · nur Spitzen und Senken',
  'eq.smart.mode.balance': 'Balance',
  'eq.smart.mode.balance.note':
    'Misst weiter · gleicht auch Helligkeit und Wärme an',
  'eq.smart.mode.target': 'Ziel',
  'eq.smart.mode.target.note':
    'Misst weiter · jede Aufnahme auf dieselbe Kurve',
  'eq.layers': 'Ebenfalls aktiv',
  'eq.layers.aria': 'Was diesen Ausgang außerdem formt',
  'eq.layers.eq': 'EQ',
  'eq.layers.eq.modified': '(geändert)',
  'eq.layers.eq.bands': '{count} Bänder',
  'eq.layers.convolution': 'Faltung',
  'eq.layers.voicing': 'Klangcharakter',
  'eq.layers.driver': 'Treiber',
  'eq.layers.disable': '{layer} ausschalten, ohne sie zu entfernen',
  'eq.layers.enable': '{layer} wieder einschalten',
  'eq.layers.smart': 'Smart-EQ',
  'eq.layers.smart.fullRange': 'Gemessen · voller Bereich',
  'eq.layers.smart.range': 'Gemessen · {low} bis {high}',
  'eq.layers.remove': 'Ebene {layer} entfernen',
  'eq.layers.clearBands': 'Alle Bänder auf 0 dB zurücksetzen',
  'eq.layers.clearReference':
    'Referenzmodell und die daraus erzeugten Bänder löschen',
  'eq.layers.clearSmart':
    'Gemessene Korrektur entfernen. Deine Bänder und die Referenz bleiben.',
  'eq.clear': 'EQ zurücksetzen',
  'eq.addBand': 'Band hinzufügen',
  'eq.addBandAria': 'EQ-Band hinzufügen',
  'eq.quickLayouts': 'Schnelle Anordnungen',
  'eq.bandCount': '{count} Bänder',
  'eq.selected': 'Gewähltes Band',
  'eq.filter': 'Filter',
  'eq.frequency': 'Frequenz',
  'eq.gain': 'Verstärkung',
  'eq.gainDisabled': 'Verstärkung · —',
  'eq.quality': 'Güte (Q)',
  'eq.delete': 'Band löschen',
  'eq.deleteAria': 'Gewähltes EQ-Band löschen',

  // Die Teilsätze stehen als Etikett — Bereich, Doppelpunkt, Befund — damit der
  // Bereichsname im Nominativ bleiben kann. „Zu viel Höhen“ müsste „zu viele“
  // heißen, „Überschuss an oberen Mitten“ dekliniert das Adjektiv mit: beides
  // kann eine Lücke im Satz nicht leisten, ein Doppelpunkt schon.
  'eq.smart.range.deepBass': 'Tiefbass',
  'eq.smart.range.bass': 'Bass',
  'eq.smart.range.lowMids': 'untere Mitten',
  'eq.smart.range.mids': 'Mitten',
  'eq.smart.range.upperMids': 'obere Mitten',
  'eq.smart.range.presence': 'Präsenz',
  'eq.smart.range.treble': 'Höhen',
  'eq.smart.range.highTreble': 'obere Höhen',
  'eq.smart.range.air': 'Luft',
  'eq.smart.range.separator': ', ',
  'eq.smart.shape.lifted': '{range}: angehoben',
  'eq.smart.shape.eased': '{range}: abgesenkt',
  'eq.smart.need.more': '{range}: zu wenig',
  'eq.smart.need.less': '{range}: zu viel',
  'eq.smart.status.listening': 'Hört zu',
  'eq.smart.status.listeningPercent': 'Hört zu {percent}%',
  'eq.smart.status.settling': 'Hört zu {percent}% - beruhigt sich',
  'eq.smart.status.waitingOn': 'Hört zu {percent}% - wartet auf {ranges}',
  'eq.smart.status.waitingOnMore':
    'Hört zu {percent}% - wartet auf {ranges} +{count}',
  'eq.smart.status.paused': 'Pausiert',
  'eq.smart.status.pausedResume': 'Pausiert - zum Abschließen fortsetzen',
  'eq.smart.status.pausedSilent': 'Pausiert - es läuft kein Ton',
  'eq.smart.status.waitingForSound': 'Wartet auf Ton',
  'eq.smart.status.soundChanged': 'Der Ton hat sich geändert - misst neu',
  'eq.smart.status.keptChanging': 'Der Ton änderte sich ständig - abgebrochen',
  'eq.smart.status.notEnoughRange': 'Zu wenig Bandbreite zum Messen',
  'eq.smart.status.alreadyBalanced': 'Schon ausgewogen',
  'eq.smart.status.applying': 'Wird angewendet…',
  'eq.smart.status.cancelled': 'Abgebrochen - nichts geändert',
  'eq.smart.status.failed': 'Der Ausgang konnte nicht gemessen werden.',
  'eq.smart.result.fullRange': 'Ausgewogen - voller Bereich',
  'eq.smart.result.range': 'Ausgewogen - nur {low} bis {high}',
  'eq.smart.result.withShape': '{result} · {shape}',
  'eq.smart.frequency.hz': '{value} Hz',
  'eq.smart.frequency.khz': '{value} kHz',
  'eq.smart.error.noCapture':
    'Audioaufnahme ist in dieser Umgebung nicht verfügbar.',
  'eq.smart.error.noLoopback':
    'Die Aufnahme der Systemausgabe ist in dieser Umgebung nicht verfügbar.',
  'eq.smart.error.streamStopped':
    'Die Ausgabe endete, bevor die Messung fertig war.',
  'eq.smart.error.analyserPaused':
    'Der Analysator ist pausiert, deshalb wurde die Messung beendet.',
  'eq.smart.error.noSound':
    'Es lief nichts. Starte Musik und miss noch einmal.',
  'eq.smart.error.noAudioTrack':
    'Windows hat keinen System-Audiostream geliefert.',
  'eq.smart.error.formatChanged':
    'Das Ausgabeformat hat sich während der Messung geändert. Noch einmal versuchen.',
  'eq.smart.error.deviceChanged':
    'Das Audiogerät hat sich während der Messung geändert. Noch einmal versuchen.',
  'eq.smart.error.captureFailed':
    'Die verarbeitete Systemausgabe konnte nicht aufgenommen werden.',
  'eq.smart.error.analyserOff':
    'Der Live-Ausgangsanalysator läuft nicht, es gibt also nichts zu messen.',
  'eq.smart.error.alreadyRunning': 'Es läuft bereits eine Messung.',
  'eq.smart.error.timedOut':
    'Bei der Messung ist die Zeit abgelaufen. Noch einmal versuchen.',
  'eq.smart.error.closed': 'FluidEQ hat die Messung beendet.',
  // Partizip ohne Hilfsverb, weil ein finites Verb sich nach der Zahl des
  // Bereichs richten müsste — „Höhen zählen“, aber „Bass zählt“.
  'eq.smart.presence.ignoredBelow': '{range} · unter {db} dB ignoriert',
  'eq.smart.presence.trustedAbove': '{range} · über {db} dB voll vertraut',
  'eq.smart.presence.reset': '{range} für diesen Modus zurücksetzen',

  'convolution.eyebrow': 'APO-IMPULSANTWORTEN',
  'convolution.title': 'Faltungsbibliothek',
  'convolution.intro':
    'Laden Sie eine geprüfte Minimalphasen-Impulsantwort für Ihren Hörer und wenden Sie sie vor dem parametrischen EQ an. Der Frequenzgang unten zeigt beide Kurven.',
  'convolution.import': 'WAV importieren…',
  'convolution.importing': 'Wird importiert…',
  'convolution.applied': 'Auf diesen Ausgang angewendet',
  'convolution.clear': 'Entfernen',
  'convolution.search': 'Kopfhörermodelle suchen',
  'convolution.searchPlaceholder':
    'Versuchen Sie „Kraken“, „HD 650“ oder einen Messanbieter',
  'convolution.notice':
    'Den herunterladbaren Katalog stellt AutoEq bereit. Dateien werden als 48-kHz-WAV importiert, weil Equalizer APO verlangt, dass die Impulsantwort zur Abtastrate des aktiven Ausgangs passt.',
  'convolution.loading': 'Offizieller Katalog wird geladen…',
  'convolution.empty':
    'Keine passende Impulsantwort. Versuchen Sie einen kürzeren Modellnamen.',
  'convolution.source': 'Quelle',
  'convolution.apply': 'Laden & anwenden',
  'convolution.downloading': 'Wird geladen…',
  'convolution.isApplied': 'Angewendet',
  'convolution.none':
    'Keine Faltung geladen. Der EQ-Tab bleibt davon völlig unberührt.',

  'voicing.eyebrow': 'ZIELKURVEN',
  'voicing.title': 'Klangcharakter',
  'voicing.intro':
    'Eine abgestimmte Zielkurve für das, was Sie gerade tun. Jede wird als eigene Ebene hinter Ihren Bändern geschrieben, Ihre eigene Abstimmung wird also nie angetastet und die Rückkehr zu „Keiner“ stellt sie exakt wieder her.',
  'voicing.refused': 'Voicing konnte nicht gewechselt werden',
  'voicing.groupPurpose': 'Wofür',
  'voicing.groupGenre': 'Genre',
  'voicing.none': 'Keiner',
  'voicing.none.hint': 'Nur Ihre EQ-Bänder, nichts darüber',
  'voicing.strength': 'Stärke',
  'voicing.off': 'Aus',
  'voicing.full': 'Voll',
  'voicing.inert': 'Bei 0 % Stärke bewirkt dieser Charakter nichts.',
  'voicing.headroom':
    'Fügt bis zu +{peak} dB hinzu. Die automatische Normalisierung hält den Spielraum frei; lassen Sie sie an, außer Sie setzen die Vorverstärkung selbst.',

  'config.eyebrow': 'Equalizer-APO-Konfiguration',
  'config.lede':
    'Was gerade auf der Platte steht, nicht das, was FluidEQ vorhat.',
  'config.reload': 'Neu laden',
  'config.reloadTitle': 'Die Konfiguration erneut von der Platte lesen',
  'config.reading': 'Wird gelesen…',
  'config.absent':
    'FluidEQ hat in diese Equalizer-APO-Installation noch nichts geschrieben.',
  'config.status.notIncluded':
    'Equalizer APO bindet diese Konfiguration nicht ein. Nichts davon wird angewendet.',
  'config.status.engineOff':
    'Die FluidEQ-Engine ist ausgeschaltet — diese Konfiguration nennt keinen Ausgang, Equalizer APO wendet also nichts davon an.',
  'config.status.active':
    'Aktiv — Equalizer APO wendet diese Konfiguration an.',
  'config.outputsAria': 'Ausgänge in der Equalizer-APO-Konfiguration',
  'config.filters.one': '{count} Filter',
  'config.filters.many': '{count} Filter',
  'config.impulse': 'Impuls',
  'config.playingNow': 'Läuft gerade',
  'config.liveTitle': 'Der fortlaufende EQ hält diese Messung aktuell',
  'config.layer.on': 'ein',
  'config.layer.off': 'aus',
  'config.empty': 'Nichts eingebunden — dieser Ausgang bleibt unangetastet.',
  'config.file.missing': 'fehlt',
  'config.export': 'Kette exportieren',
  'config.import': 'Kette importieren',
  'config.import.hint':
    'Der Import landet auf dem Ausgang, den Sie gerade hören.',
  'config.file.yours': 'Ihre',
  'config.hint.custom': 'Ihre Datei. Wird nie überschrieben.',
  'config.hint.generated':
    'Generiert — wird bei der nächsten Änderung neu geschrieben.',
  'config.hint.saving':
    'Speichern schreibt die Datei; Equalizer APO übernimmt sie.',
  'config.edit': 'Bearbeiten',
  'config.cancel': 'Abbrechen',
  'config.save': 'Speichern',

  'support.eyebrow': 'VÖLLIG FREIWILLIG',

  'support.petHint': 'Drücke die Leertaste, damit es hüpft',

  'support.game.hint': 'Im Takt drücken, wenn die Spitze die Linie erreicht',

  'support.game.howTo':
    'Tippe das Wesen an oder drücke bei jedem Beat die Leertaste. Bleib dran — bei ×10 passiert etwas.',

  'support.game.thanks':
    'Wenn dich davon etwas zum Lächeln gebracht hat: Ideen und Unterstützung halten das hier am Leben.',

  'support.game.noAudio': 'Spiel etwas ab, dann erscheint der Takt hier',

  'support.game.listening': 'Takt wird gesucht…',

  'support.game.share': 'Teilen',

  'support.game.shareEuphoria': 'Euphorie teilen',

  'support.game.shareTitle': 'Teile dein Ergebnis',

  'support.game.shareUnlock':
    'Erreiche ×10 und diese Karte wird zum Euphorie-Modus – mit dem ganzen Farbspektrum.',

  'support.game.shareNote':
    'Speichere die Karte und hänge sie an deinen Beitrag an – keines dieser Netzwerke kann ein Bild aus einem Link ziehen.',

  'support.game.shareSave': 'Karte speichern',

  'support.game.shareCopyCard': 'Karte kopieren',

  'support.game.shareCardCopied': 'Kopiert — einfach einfügen',

  'support.game.shareCopy': 'Text kopieren',

  'support.game.shareCopied': 'Kopiert',

  'support.game.shareLinkOnly':
    'Teilt nur den Link – den Text fügst du selbst ein',

  'support.game.euphoria': 'Euphorie-Modus',

  'support.game.euphoriaToggle': 'Euphorie-Modus ein- oder ausschalten',

  'support.game.perfect': 'Perfekt',

  'support.game.great': 'Super',

  'support.game.good': 'Gut',

  'support.game.miss': 'Daneben',
  'support.title': 'Die Arbeit unterstützen',
  'support.close': 'Schließen',
  'support.pitch':
    'FluidEQ ist frei und quelloffen und bleibt es auch — nichts steckt hinter einer Bezahlschranke, und es wird nie etwas mitgeschnitten. Wenn es sich einen Platz in Ihrem Setup verdient hat, finanziert ein Beitrag die Zeit, die es am Leben hält, und die nächsten Ideen aus derselben Werkstatt.',
  'support.craft':
    'Das hier ist die Arbeit eines Einzelnen, gebaut mit sehr viel Liebe und einer unvernünftigen Menge Sorgfalt im Detail. Jedes Panel ist von Hand gezeichnet und durchdiskutiert: wie sich die Kurve auf einen Blick liest, wie ein Menü aufklappt, was ein Regler tut, wenn man langsam zieht, welche Wörter auf einem Knopf stehen. Nichts davon ist eine Standardkomponente mit Anstrich.',
  'support.card': 'Karte oder Wallet',
  'support.card.hint':
    'Sichere Zahlung über Stripe. Öffnet sich im Browser — die App sieht Ihre Kartendaten nie.',
  'support.coffee': 'Spendier mir einen Kaffee',
  'support.coffee.hint':
    'Ein einmaliges Trinkgeld, ohne Konto. Klicken, um es im Browser zu öffnen, oder den Code mit dem Handy scannen.',
  'support.verify': 'Prüfen Sie die Adresse vor dem Senden.',
  'support.copy': 'Adresse kopieren',
  'support.copied': 'Kopiert',
  'support.openWallet': 'In der Wallet öffnen',
  'support.contributed': 'Ich habe beigetragen — Stern und Tanz freischalten',
  'support.thanks':
    'Danke — Ihr Begleiter hat seinen Stern, und jetzt tanzt er.',
  'support.releaseNotes': 'Sehen, was in dieser Version neu ist',
  'support.footerBefore':
    'Lieber Zeit beitragen? Issues und Pull Requests sind genauso willkommen auf',

  'language.title': 'Sprache',
  'language.aria': 'Sprache der Oberfläche',
  'waveform.style': 'Stil der Anzeige wechseln',
};

export default de;
