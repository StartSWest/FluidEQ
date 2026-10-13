/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'Preferite',
  'insights.loading': 'Caricamento delle scene che guardano i membri',
  'insights.period': 'Periodo',
  'insights.period.week': '7 giorni',
  'insights.period.month': '30 giorni',
  'insights.period.quarter': '90 giorni',
  'insights.period.all': 'Da sempre',
  'insights.favourites.hint':
    'Ogni scena riprodotta, aggiunta o con un mi piace nel periodo, ordinata per quante persone l’hanno riprodotta, poi per tempo sullo schermo. Le tue prove non sono incluse.',
  'insights.favourites.summary': '{scenes} scene riprodotte per {time}',
  'insights.favourites.empty':
    'In questo periodo nessuna scena è stata riprodotta, aggiunta o ha ricevuto un mi piace.',
  'insights.favourites.kinds': 'Tempo sullo schermo per tipo',
  'insights.favourites.noPlays':
    'Ancora nulla di riprodotto in questo periodo.',
  'insights.favourites.advice':
    '{kind} raccoglie il {share} di tutta la visione, su {count} scene. Altre scene di {kind} sono la scommessa più sicura.',
  'insights.col.rank': 'Posizione',
  'insights.col.scene': 'Scena',
  'insights.col.people': 'Persone',
  'insights.col.time': 'Tempo',
  'insights.col.perPerson': 'A persona',
  'insights.col.adds': 'Aggiunte',
  'insights.col.likes': 'Mi piace',
  'insights.account.title': 'Scene',
  'insights.account.empty':
    'Ancora nessuna scena aggiunta, con un mi piace o riprodotta. Il tempo di riproduzione viene contato quando il membro usa questa versione di FluidEQ e ha visto le condizioni aggiornate.',
  'insights.account.played': 'Scene riprodotte',
  'insights.account.time': 'Sullo schermo',
  'insights.account.added': 'Aggiunte',
  'insights.account.liked': 'Con mi piace',
  'insights.account.kind': 'Tipo preferito',
  'insights.account.notPlayed': 'Non riprodotta',
  'insights.account.days': '{days} giorni · ultima volta il {date}',
  'insights.by': 'di {maker}',
  'insights.byFluidEQ': 'di FluidEQ',
  'insights.member': 'un membro',
  'insights.chip.added': 'Aggiunta il {date}',
  'insights.chip.liked': 'Mi piace',
  'insights.kind.other': 'Nessuna categoria',
  'insights.time.hoursMinutes': '{hours} {minutes}',
  'insights.error.offline':
    'FluidEQ non è riuscito a raggiungere il suo server. Controlla la connessione e riprova.',
  'insights.error.signedOut': 'Accedi di nuovo per vederlo.',
  'insights.error.server': 'Non è stato possibile caricarlo. Riprova.',
  'insights.error.forbidden': 'Solo l’amministratore di FluidEQ può vederlo.',
  'insights.error.notDeployed':
    'Il server non lo ha ancora. Arriva con l’aggiornamento del server che accompagna questa versione di FluidEQ.',
} as const;

export default insights;
