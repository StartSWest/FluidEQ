/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const announce = {
  'announce.eyebrow': 'Novità in Visualizzatori · {count} scene',
  'announce.try': 'Provale ora',
  'announce.later': 'Più tardi',
  'announce.previewNote': 'Anteprima. Non è stato inviato né registrato nulla.',
  'announce.untitled': 'Nuove scene',
  'announce.tab': 'Annunci',
  'announce.pageHint':
    'Ogni persona vede un annuncio una sola volta, in grande, sopra qualunque cosa abbia aperto. I membri la cui prova finisce entro due giorni vedono anche una riga su come tenere Plus.',
  'announce.field.title': 'Titolo',
  'announce.field.titlePlaceholder': 'Per esempio: Guida notturna',
  'announce.field.body': 'Che cos’è',
  'announce.field.bodyPlaceholder':
    'Per esempio: sei nuove scene di città di notte che si muovono con i tuoi bassi e i tuoi acuti.',
  'announce.field.scenes':
    'Scene incluse: {count} su {most}. La prima è il riquadro grande.',
  'announce.field.noScenes':
    'Le scene di FluidEQ non sono ancora state caricate. Apri Visualizzatori una volta, poi torna qui.',
  'announce.field.when': 'Esce',
  'announce.field.audience': 'Chi lo vede',
  'announce.audience.everyone': 'Tutti quelli che hanno effettuato l’accesso',
  'announce.audience.everyoneLine':
    'Membri Plus, prove e account gratuiti. Gli account gratuiti vengono mandati in Visualizzatori per provare le scene.',
  'announce.audience.members': 'Membri Plus e prove',
  'announce.audience.membersLine':
    'Tutti quelli che possono già riprodurre le scene.',
  'announce.audience.trialEnding': 'Solo prove che finiscono entro 2 giorni',
  'announce.audience.trialEndingLine':
    'I membri che stanno per decidere se pagare.',
  'announce.trials.dayAfter': '{count} prove finiscono {date}, il giorno dopo.',
  'announce.trials.twoAfter': 'Altre {count} il giorno dopo ancora.',
  'announce.preview': 'Anteprima',
  'announce.schedule': 'Programma',
  'announce.saveChanges': 'Salva le modifiche',
  'announce.stopEditing': 'Smetti di modificare',
  'announce.done': 'Programmato. Esce il {date}.',
  'announce.listTitle': 'Programmati e visibili',
  'announce.listEmpty': 'Niente di programmato.',
  'announce.state.out': 'Visibile',
  'announce.state.later': 'Programmato',
  'announce.edit': 'Modifica',
  'announce.cancel': 'Annullalo',
  'announce.cancelAsk': 'Annullare questo annuncio?',
  'announce.cancelOut': 'Smettere di mostrarlo a chi non l’ha ancora visto?',
  'announce.keep': 'Tienilo',
} as const;

export default announce;
