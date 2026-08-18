/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The shell around everything: menus, tabs, updates, config, notices. */
import { Dictionary } from '../en';

const app: Partial<Dictionary> = {
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
  'app.menu.fix': 'Beheben',
  'app.menu.reportProblem': 'Problem melden',
  'app.menu.about': 'Über {product}…',
  'app.menu.reinstallApp': '{product} neu installieren…',
  'app.menu.fixAudio': 'Audioprobleme beheben…',
  'app.menu.reinstallApo': 'Equalizer APO neu installieren…',
  'whatsNew.eyebrow': 'VERSIONSHINWEISE',
  'whatsNew.title': 'Neu in FluidEQ',
  'whatsNew.loading': 'Versionshinweise werden geladen…',
  'whatsNew.missing':
    'Die Versionshinweise sind in diesem Build nicht zu finden. Sie stehen auch auf GitHub.',
  'whatsNew.ok': 'OK',
  'app.menu.whatsNew': 'Neuerungen',
  'app.menu.language': 'Sprache',
  'app.window.minimize': 'Minimieren',
  'app.window.maximize': 'Maximieren',
  'app.window.restore': 'Wiederherstellen',
  'app.window.close': 'Schließen',
  'app.tray.open': '{product} öffnen',
  'app.tray.quit': '{product} beenden',
  'app.tray.tooltip': '{product} — läuft weiterhin',
  'app.window.minimizeApp': 'FluidEQ minimieren',
  'app.window.maximizeApp': 'FluidEQ maximieren',
  'app.window.restoreApp': 'FluidEQ wiederherstellen',
  'app.window.closeApp': 'FluidEQ schließen',
  'app.media.previous': 'Vorheriger Titel',
  'app.media.playPause': 'Wiedergabe oder Pause',
  'app.media.next': 'Nächster Titel',
  'app.media.previousAria': 'Vorheriger Titel, überall auf diesem Computer',
  'app.media.playPauseAria':
    'Wiedergabe oder Pause, überall auf diesem Computer',
  'app.media.nextAria': 'Nächster Titel, überall auf diesem Computer',
  'app.dismiss': 'Ausblenden',
  'common.search': 'Suchen…',
  'common.recentSearches': 'Letzte Suchanfragen',
  'common.clearRecentSearches': 'Letzte Suchanfragen löschen',
  'common.filterOptions': 'Optionen filtern',
  'common.increase': '{item} erhöhen',
  'common.decrease': '{item} verringern',
  'common.icon.edit': 'Bearbeiten',
  'common.icon.delete': 'Löschen',
  'common.icon.trash': 'Entfernen',
  'common.icon.accept': 'Übernehmen',
  'common.icon.cancel': 'Abbrechen',
  'tabs.aria': 'Klang-Arbeitsbereich',
  'tabs.eq': 'EQ',
  'tabs.presets': 'EQ-Presets',
  'tabs.voicing': 'Klangcharakter',
  'tabs.convolution': 'Faltung',
  'tabs.config': 'Config',
  'tabs.media': 'Medien',
  'tabs.karaoke': 'Karaoke',
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
  'update.mandatory.title': 'Diese Version muss aktualisiert werden',
  'update.mandatory.body':
    'Diese Version behebt ein Problem, das schwer genug wiegt, dass FluidEQ so nicht weiterlaufen sollte. Das Update wird gerade geladen.',
  'update.mandatory.notOptional':
    'Dieses Update ist nicht optional. Sie können diesen Hinweis schließen und zu Ende bringen, woran Sie gerade sind — er kommt wieder, bis FluidEQ aktualisiert ist.',
  'update.mandatory.later': 'Jetzt nicht',
  'update.mandatory.waiting': 'Update wird geholt…',
  'update.mandatory.readyPrompt':
    'Das Update ist geladen. FluidEQ schließt sich für die Installation und öffnet sich danach wieder.',
  'update.mandatory.install': 'Installieren und neu starten',
  'update.mandatory.installing': 'Wird installiert…',
  'update.mandatory.failedDownload':
    'Das Update konnte nicht geladen werden. Entweder war der Download-Server nicht erreichbar, oder die Verbindung ist unterwegs abgebrochen.',
  'update.mandatory.failedInstall':
    'Das Update wurde geladen, aber das Installationsprogramm ist nicht gestartet. Möglicherweise hat Windows es abgelehnt, oder die geladene Datei ist beschädigt.',
  'update.mandatory.manual':
    'Sie können es auch selbst installieren: Laden Sie die neueste Version von der Release-Seite herunter und führen Sie sie aus. Ihre Einstellungen und Profile bleiben erhalten.',
  'update.mandatory.releasePage': 'Download-Seite öffnen',
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
  'config.eyebrow': 'WAS DIE ENGINE LIEST',
  'config.title': 'Equalizer-APO-Konfiguration',
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
  'config.layers.noFile': 'Keine eigene Datei',
  'config.layers.inFile': 'Steht in dieser Datei, nicht in einer eigenen.',
  'config.empty': 'Nichts eingebunden — dieser Ausgang bleibt unangetastet.',
  'config.file.missing': 'fehlt',
  'config.export': 'Kette exportieren',
  'config.import': 'Kette importieren',
  'config.import.hint':
    'Der Import landet auf dem Ausgang, den Sie gerade hören.',
  'config.import.customSkipped':
    'Eigene Datei des Absenders übersprungen: eine Include:- oder Plugin:-Zeile darin würde Code in die Windows-Audiokette laden.',
  'config.file.yours': 'Ihre',
  'config.hint.custom': 'Ihre Datei. Wird nie überschrieben.',
  'config.hint.generated':
    'Generiert — wird bei der nächsten Änderung neu geschrieben.',
  'config.hint.saving':
    'Speichern schreibt die Datei; Equalizer APO übernimmt sie.',
  'config.edit': 'Bearbeiten',
  'config.cancel': 'Abbrechen',
  'config.save': 'Speichern',
  'disclaimer.heading': 'Keine Gewährleistung, keine Haftung',
  'disclaimer.asIs':
    'FluidEQ wird so bereitgestellt, wie es ist, ohne jede Gewährleistung. Niemand verspricht, dass es funktioniert, dass es für Ihren Zweck taugt oder dass es weiter funktionieren wird. Das sagen die Abschnitte 15 und 16 der GNU General Public License, und es gilt, ob Sie diese Kopie geschenkt bekommen oder dafür bezahlt haben.',
  'disclaimer.liability':
    'FluidEQ verändert die Audioverarbeitung auf Ihrem Rechner und installiert und steuert Equalizer APO, ein eigenständiges Programm, das mit Administratorrechten läuft und im Audiopfad von Windows sitzt. Soweit das Gesetz es zulässt, haftet {author} nicht für Schäden, die aus der Nutzung entstehen — an Ihrem Gehör, an Lautsprechern, Kopfhörern oder anderen Geräten, an Daten oder anderer Software oder an sonst etwas, einschließlich Schäden, die Sie nicht vorhersehen konnten.',
  'disclaimer.volume':
    'Ton kann laut sein, und eine Entzerrung kann ihn lauter machen, als das Material war. Drehen Sie die Lautstärke herunter, bevor Sie etwas einstellen, und danach wieder hoch.',
  'disclaimer.localLaw':
    'Manche Länder erlauben es einem Verkäufer nicht, bestimmte Gewährleistungen oder Haftungen auszuschließen. Wo das so ist, gelten diese Regeln, und dieser Hinweis nimmt Ihnen keine Rechte, die das Gesetz Ihnen gibt.',
  'disclaimer.accepting':
    'Mit der Nutzung von FluidEQ nehmen Sie das Obenstehende an.',
  'disclaimer.language':
    'Dieser Hinweis wurde auf Englisch verfasst. Weicht eine Übersetzung vom englischen Text ab, gilt der englische Text.',
  'disclaimer.accept': 'Verstanden und akzeptiert',
  'disclaimer.decline': 'Beenden',
  'provenance.heading': 'Prüfen Sie, woher diese Kopie stammt',
  'provenance.body':
    'Das offizielle signierte Installationsprogramm von FluidEQ wird ausschließlich über fluideq.com bereitgestellt. Builds aus dem Quellcode sollten aus dem offiziellen Repository stammen. Die GPL erlaubt es Dritten, FluidEQ zu kopieren, zu verändern, neu zu erstellen und zu verkaufen, aber deren Builds sind nicht automatisch von FluidEQ signiert, geprüft, unterstützt oder gebilligt. Wenn ein Download vorgibt, offiziell zu sein, und keine gültige digitale Windows-Signatur besitzt, schließen Sie ihn und melden Sie ihn.',
  'provenance.site': 'Offizielle Website: fluideq.com',
  'provenance.repository':
    'Offizieller Quellcode: github.com/StartSWest/FluidEQ',
  'language.title': 'Sprache',
  'language.aria': 'Sprache der Oberfläche',
};

export default app;
