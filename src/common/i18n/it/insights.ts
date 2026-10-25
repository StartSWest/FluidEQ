/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'Preferite',
  'insights.loading': 'Caricamento delle scene che ottengono i membri',
  'insights.period': 'Periodo',
  'insights.period.week': '7 giorni',
  'insights.period.month': '30 giorni',
  'insights.period.quarter': '90 giorni',
  'insights.period.all': 'Da sempre',
  'insights.favourites.hint':
    'Ogni scena aggiunta o con un mi piace nel periodo, ordinata per aggiunte, poi per mi piace. Le tue non sono incluse.',
  'insights.favourites.summary': '{scenes} scene aggiunte {adds} volte',
  'insights.favourites.empty':
    'In questo periodo nessuna scena è stata aggiunta o ha ricevuto un mi piace.',
  'insights.favourites.kinds': 'Aggiunte per tipo',
  'insights.favourites.noAdds': 'Ancora nulla di aggiunto in questo periodo.',
  'insights.favourites.advice':
    '{kind} raccoglie il {share} di tutte le aggiunte, su {count} scene. Altre scene di {kind} sono la scommessa più sicura.',
  'insights.col.rank': 'Posizione',
  'insights.col.scene': 'Scena',
  'insights.col.adds': 'Aggiunte',
  'insights.col.likes': 'Mi piace',
  'insights.account.title': 'Scene',
  'insights.account.empty': 'Ancora nessuna scena aggiunta o con un mi piace.',
  'insights.account.added': 'Aggiunte',
  'insights.account.liked': 'Con mi piace',
  'insights.account.kind': 'Tipo preferito',
  'insights.by': 'di {maker}',
  'insights.byFluidEQ': 'di FluidEQ',
  'insights.member': 'un membro',
  'insights.chip.added': 'Aggiunta il {date}',
  'insights.chip.liked': 'Mi piace',
  'insights.chip.unpublished': 'Non pubblicata',
  'insights.kind.other': 'Nessuna categoria',
  'insights.error.offline':
    'FluidEQ non è riuscito a raggiungere il suo server. Controlla la connessione e riprova.',
  'insights.error.signedOut': 'Accedi di nuovo per vederlo.',
  'insights.error.server': 'Non è stato possibile caricarlo. Riprova.',
  'insights.error.forbidden': 'Solo l’amministratore di FluidEQ può vederlo.',
  'insights.error.notDeployed':
    'Il server non lo ha ancora. Arriva con l’aggiornamento del server che accompagna questa versione di FluidEQ.',
  'insights.server.tab': 'Server',
  'insights.server.loading': 'Misurazione del server',
  'insights.server.plan': 'Piano gratuito Supabase',
  'insights.server.measured': 'Misurato alle {time}',
  'insights.server.database': 'Database',
  'insights.server.files': 'File',
  'insights.server.active': 'Account attivi, 30 giorni',
  'insights.server.activeNote': '{accounts} account in tutto',
  'insights.server.of': 'su {limit}',
  'insights.server.used': '{share} usato',
  'insights.server.requests': 'Richieste, ultimi 7 giorni',
  'insights.server.unlimited': 'senza limite nel piano gratuito',
  'insights.server.kind.rest': 'Database',
  'insights.server.kind.auth': 'Accesso',
  'insights.server.kind.storage': 'File',
  'insights.server.kind.realtime': 'Live',
  'insights.server.noToken':
    'Il conteggio delle richieste non è attivo su questo server.',
  'insights.server.tokenRefused':
    'Il server non è riuscito a leggere il conteggio delle richieste.',
  'insights.server.tables': 'Tabelle più grandi',
  'insights.server.buckets': 'File per cartella',
  'insights.server.bucketFiles': '{count} file',
  'insights.server.noFiles': 'Ancora nessun file salvato.',
  'insights.server.egress': 'Dati inviati',
  'insights.server.egressBody':
    'Il piano gratuito include {limit} al mese, e di solito è il primo limite che si raggiunge: conta ogni scena e immagine scaricata da un membro. Nessuna API lo riporta; Supabase lo mostra nella pagina Usage del progetto.',
  'insights.server.openSupabase': 'Apri Supabase',
  'insights.server.limit.warn': 'Il server si sta riempiendo',
  'insights.server.limit.full': 'Il server è quasi pieno',
  'insights.server.limit.body':
    '{what} è al {share} del piano gratuito di Supabase. Passa il progetto a un piano a pagamento prima che si riempia, o le funzioni online di FluidEQ smetteranno di funzionare.',
  'insights.server.limit.database': 'Il database',
  'insights.server.limit.files': 'Lo spazio per i file',
  'insights.server.limit.accounts': 'Gli account attivi',
  'insights.server.limit.later': 'Più tardi',
  'insights.server.limit.open': 'Apri la pagina del server',
  'insights.server.limit.badge': '{share} del piano gratuito usato',
  'insights.server.rules':
    'Il piano gratuito non ha una data di fine. Superare un limite porta un’email e un periodo di tolleranza; se continua, Supabase risponde alle richieste con “payment required” fino al mese successivo o a un upgrade. Un progetto senza richieste per {days} giorni viene messo in pausa, cosa che il traffico di FluidEQ stesso impedisce.',
} as const;

export default insights;
