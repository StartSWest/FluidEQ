/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': 'Condividi {name}',
  'presetShare.menu.community': 'Condividi con la community…',
  'presetShare.menu.copyLink': 'Copia link di condivisione',
  'presetShare.menu.export': 'Esporta…',
  'presetShare.linkCopied': 'Link di condivisione copiato',

  'presetShare.text.title': '{name} · preset FluidEQ',
  'presetShare.text.curve': 'Curva: {count} bande',
  'presetShare.text.rack': 'Rack: {stages}',
  'presetShare.text.open': 'Apri in FluidEQ',

  'presetShare.chip.curve': 'Curva · {count} bande',
  'presetShare.chip.flat': 'Nessuna modifica',

  'presetShare.export.title': 'Esporta {name}',
  'presetShare.export.hint':
    'La curva e ogni stadio del rack. Il tuo Normalizzatore e la testa della tua Stanza restano tuoi.',
  'presetShare.export.tab.forum': 'Per qualsiasi forum',
  'presetShare.export.tab.file': 'File',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit · Discord · GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · altri forum',
  'presetShare.format.plain': 'Testo semplice',
  'presetShare.format.plainFor': 'Ovunque altro',
  'presetShare.export.withCode':
    'Aggiungi anche il codice come testo, per i forum che accorciano i link',
  'presetShare.export.fits': '{count} caratteri · sta in un messaggio Discord',
  'presetShare.export.long':
    '{count} caratteri · troppo lungo per un messaggio Discord, togli il codice',
  'presetShare.export.pasteHint':
    'Chiunque abbia FluidEQ può incollarlo in Importa.',
  'presetShare.export.fileHint':
    'JSON leggibile con la curva e ogni stadio, il file che salva la pagina DSP. Trascinalo su Importa per riaverlo.',
  'presetShare.export.apoNoCurve':
    'Questo preset non ha una curva: il suo suono è tutto nel rack, che richiede FluidEQ.',
  'presetShare.export.apoRack':
    'In questo formato viaggia solo la curva. {stages} richiedono FluidEQ.',
  'presetShare.export.copy': 'Copia',
  'presetShare.export.copyCurve': 'Copia curva',
  'presetShare.export.save': 'Salva file…',
  'presetShare.export.copied': 'Copiato',
  'presetShare.export.saved': 'Salvato',
  'presetShare.export.failed': 'Non è andato a buon fine. Riprova.',

  'presetShare.forum.attached': 'Preset allegato',
  'presetShare.forum.remove': 'Rimuovi il preset',
  'presetShare.forum.template':
    'Pensato per: \nAscoltato su: \nProvalo con: \n\nCosa fa: ',

  'presetShare.card.by': 'Condiviso da @{author}',
  'presetShare.card.add': 'Aggiungi ai miei preset',
  'presetShare.card.added': 'In I tuoi · in riproduzione',
  'presetShare.card.try': 'Provalo',
  'presetShare.card.stopTrying': 'Smetti di provare',
  'presetShare.card.tryingNote':
    'Suona finché non lo fermi o lasci il post; poi torna il tuo suono.',

  'presetShare.import.button': 'Importa',
  'presetShare.import.title': 'Importa un preset',
  'presetShare.import.hint':
    'Incolla un post di un forum, un link di condivisione o un file di preset. Viene letto solo il preset contenuto.',
  'presetShare.import.paste': 'Incolla dagli appunti',
  'presetShare.import.placeholder': 'Incolla qui…',
  'presetShare.import.chooseFile': 'Scegli file…',
  'presetShare.import.found': 'Trovato un preset',
  'presetShare.import.missing':
    'Questo testo non contiene nessun preset FluidEQ. Incolla tutto il post o il link di condivisione.',
  'presetShare.import.newer':
    'Questo preset è stato creato con un FluidEQ più recente. Aggiorna FluidEQ per leggerlo.',
  'presetShare.import.damaged':
    'Il codice del preset è troncato o danneggiato. Copialo di nuovo dall’inizio alla fine.',
  'presetShare.import.clipboardFailed':
    'FluidEQ non è riuscito a leggere gli appunti. Incolla invece il testo nella casella.',

  'presetShare.link.title': 'Aggiungere questo preset?',
  'presetShare.link.hint':
    'Da un link che hai aperto. Niente suona né viene salvato finché non premi.',
  'presetShare.link.notNow': 'Non ora',
} as const;
