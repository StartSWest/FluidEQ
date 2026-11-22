/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': '{name} teilen',
  'presetShare.menu.community': 'Mit der Community teilen…',
  'presetShare.menu.copyLink': 'Teilen-Link kopieren',
  'presetShare.menu.export': 'Exportieren…',
  'presetShare.linkCopied': 'Teilen-Link kopiert',
  'presetShare.linkMaking': 'Link wird erstellt…',
  'presetShare.linkFailed.signedOut': 'Anmelden, um einen Link zu erstellen',
  'presetShare.linkFailed.suspended': 'Dieses Konto kann gerade nicht teilen',
  'presetShare.linkFailed.rateLimited': 'Zu viele Links in dieser Stunde',
  'presetShare.linkFailed.tooMany': 'Link-Limit dieses Kontos erreicht',
  'presetShare.linkFailed.takenDown': 'Dieser Link wurde entfernt',
  'presetShare.linkFailed.offline': 'Keine Antwort vom FluidEQ-Server',

  'presetShare.text.title': '{name} · FluidEQ-Preset',
  'presetShare.text.curve': 'Kurve: {count} Bänder',
  'presetShare.text.rack': 'Rack: {stages}',
  'presetShare.text.open': 'In FluidEQ öffnen',

  'presetShare.chip.curve': 'Kurve · {count} Bänder',
  'presetShare.chip.flat': 'Keine Änderungen',

  'presetShare.export.title': '{name} exportieren',
  'presetShare.export.hint':
    'Die Kurve und jede Stufe des Racks. Ihre Normalisierung und der Kopf Ihres Raums bleiben bei Ihnen.',
  'presetShare.export.tab.forum': 'Für jedes Forum',
  'presetShare.export.tab.file': 'Datei',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit · Discord · GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · andere Foren',
  'presetShare.format.plain': 'Nur Text',
  'presetShare.format.plainFor': 'Überall sonst',
  'presetShare.export.withLink':
    'Einen kurzen Link zu seiner Seite auf fluideq.com anfügen',
  'presetShare.export.linkSignIn': 'Anmelden, um einen kurzen Link anzufügen',
  'presetShare.export.fits':
    '{count} Zeichen · passt in eine Discord-Nachricht',
  'presetShare.export.long':
    '{count} Zeichen · zu lang für eine Discord-Nachricht. Senden Sie nur den kurzen Link.',
  'presetShare.export.pasteHint':
    'Jeder mit FluidEQ kann das unter „Importieren“ einfügen.',
  'presetShare.export.fileHint':
    'Lesbares JSON mit der Kurve und jeder Stufe, die Datei, die die DSP-Seite speichert. Ziehen Sie sie auf „Importieren“, um sie zurückzuholen.',
  'presetShare.export.apoNoCurve':
    'Dieses Preset hat keine Kurve: Sein Klang steckt ganz im Rack, und das braucht FluidEQ.',
  'presetShare.export.apoRack':
    'In diesem Format wird nur die Kurve übertragen. {stages} brauchen FluidEQ.',
  'presetShare.export.copy': 'Kopieren',
  'presetShare.export.copyCurve': 'Kurve kopieren',
  'presetShare.export.save': 'Datei speichern…',
  'presetShare.export.copied': 'Kopiert',
  'presetShare.export.saved': 'Gespeichert',
  'presetShare.export.failed':
    'Das hat nicht geklappt. Versuchen Sie es noch einmal.',

  'presetShare.forum.attached': 'Angehängtes Preset',
  'presetShare.forum.remove': 'Preset entfernen',
  'presetShare.forum.template':
    'Gemacht für: \nGehört über: \nAusprobieren mit: \n\nWas es bewirkt: ',

  'presetShare.card.by': 'Geteilt von @{author}',
  'presetShare.card.sharedBy': 'Geteilt von {author}',
  'presetShare.card.sharedByMember': 'Geteilt von einem FluidEQ-Mitglied',
  'presetShare.card.add': 'Zu meinen Presets hinzufügen',
  'presetShare.card.added': 'In „Eigene“ · läuft',
  'presetShare.card.try': 'Ausprobieren',
  'presetShare.card.stopTrying': 'Ausprobieren beenden',
  'presetShare.card.tryingNote':
    'Läuft, bis Sie es beenden oder den Beitrag verlassen; dann kommt Ihr eigener Klang zurück.',

  'presetShare.import.button': 'Importieren',
  'presetShare.import.title': 'Ein Preset importieren',
  'presetShare.import.hint':
    'Fügen Sie einen Forenbeitrag, einen Teilen-Link oder eine Preset-Datei ein. Gelesen wird nur das Preset darin.',
  'presetShare.import.placeholder': 'Hier einfügen…',
  'presetShare.import.chooseFile': 'Datei wählen…',
  'presetShare.import.found': 'Ein Preset gefunden',
  'presetShare.import.missing':
    'Dieser Text enthält kein FluidEQ-Preset. Fügen Sie den ganzen Beitrag oder den Teilen-Link ein.',
  'presetShare.import.newer':
    'Dieses Preset wurde mit einem neueren FluidEQ erstellt. Aktualisieren Sie FluidEQ, um es zu lesen.',
  'presetShare.import.damaged':
    'Der Code des Presets ist abgeschnitten oder beschädigt. Kopieren Sie ihn noch einmal von Anfang bis Ende.',
  'presetShare.import.gone':
    'Dieses Preset wird nicht mehr geteilt. Fragen Sie stattdessen nach seinem Code.',
  'presetShare.import.offline':
    'FluidEQ konnte seinen Server nicht erreichen, um diesen Link zu öffnen. Prüfen Sie die Verbindung und versuchen Sie es noch einmal.',

  'presetShare.link.title': 'Dieses Preset hinzufügen?',
  'presetShare.link.hint':
    'Aus einem Link, den Sie geöffnet haben. Nichts spielt oder wird gespeichert, bevor Sie drücken.',
  'presetShare.link.notNow': 'Nicht jetzt',
  'presetShare.link.fetching': 'Preset wird von FluidEQ geholt…',
} as const;
