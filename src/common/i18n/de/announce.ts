/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const announce = {
  'announce.eyebrow': 'Neu in „Visualizer“ · {count} Szenen',
  'announce.try': 'Jetzt ausprobieren',
  'announce.later': 'Später',
  'announce.previewNote':
    'Vorschau. Es wurde nichts gesendet und nichts aufgezeichnet.',
  'announce.untitled': 'Neue Szenen',
  'announce.tab': 'Ankündigungen',
  'announce.pageHint':
    'Jede Person sieht eine Ankündigung einmal, groß, über allem, was sie gerade geöffnet hat. Mitglieder, deren Testphase innerhalb von zwei Tagen endet, sehen zusätzlich eine Zeile dazu, wie sie Plus behalten.',
  'announce.field.title': 'Titel',
  'announce.field.titlePlaceholder': 'Zum Beispiel: Nachtfahrt',
  'announce.field.body': 'Worum es geht',
  'announce.field.bodyPlaceholder':
    'Zum Beispiel: sechs neue Szenen einer Stadt bei Nacht, die sich mit Ihrem Bass und Ihren Höhen bewegen.',
  'announce.field.scenes':
    'Enthaltene Szenen: {count} von {most}. Die erste ist das große Bild.',
  'announce.field.noScenes':
    'Die Szenen von FluidEQ sind noch nicht geladen. Öffnen Sie einmal „Visualizer“ und kommen Sie dann zurück.',
  'announce.field.when': 'Erscheint',
  'announce.field.audience': 'Wer sie sieht',
  'announce.audience.everyone': 'Alle Angemeldeten',
  'announce.audience.everyoneLine':
    'Plus-Mitglieder, Testphasen und kostenlose Konten. Kostenlose Konten werden zu „Visualizer“ geschickt, um die Szenen auszuprobieren.',
  'announce.audience.members': 'Plus-Mitglieder und Testphasen',
  'announce.audience.membersLine':
    'Alle, die die Szenen jetzt abspielen können.',
  'announce.audience.trialEnding':
    'Nur Testphasen, die innerhalb von 2 Tagen enden',
  'announce.audience.trialEndingLine':
    'Die Mitglieder, die gleich entscheiden, ob sie bezahlen.',
  'announce.trials.dayAfter':
    '{count} Testphasen enden am {date}, dem Tag danach.',
  'announce.trials.twoAfter': '{count} weitere am Tag darauf.',
  'announce.preview': 'Vorschau',
  'announce.schedule': 'Planen',
  'announce.saveChanges': 'Änderungen speichern',
  'announce.stopEditing': 'Bearbeiten beenden',
  'announce.done': 'Geplant. Sie erscheint am {date}.',
  'announce.listTitle': 'Geplant und sichtbar',
  'announce.listEmpty': 'Nichts geplant.',
  'announce.state.out': 'Wird angezeigt',
  'announce.state.later': 'Geplant',
  'announce.edit': 'Bearbeiten',
  'announce.cancel': 'Zurückziehen',
  'announce.cancelAsk': 'Diese Ankündigung zurückziehen?',
  'announce.cancelOut':
    'Sie niemandem mehr zeigen, der sie noch nicht gesehen hat?',
  'announce.keep': 'Behalten',
} as const;

export default announce;
