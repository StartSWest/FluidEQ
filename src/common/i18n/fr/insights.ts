/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'Favorites',
  'insights.loading': 'Chargement des scènes que regardent les membres',
  'insights.period': 'Période',
  'insights.period.week': '7 jours',
  'insights.period.month': '30 jours',
  'insights.period.quarter': '90 jours',
  'insights.period.all': 'Depuis le début',
  'insights.favourites.hint':
    'Chaque scène jouée, ajoutée ou aimée sur la période, classée selon le nombre de personnes qui l’ont jouée, puis selon le temps à l’écran. Vos propres essais ne sont pas comptés.',
  'insights.favourites.summary': '{scenes} scènes jouées pendant {time}',
  'insights.favourites.empty':
    'Aucune scène n’a été jouée, ajoutée ou aimée sur cette période.',
  'insights.favourites.kinds': 'Temps à l’écran par genre',
  'insights.favourites.noPlays': 'Rien n’a encore été joué sur cette période.',
  'insights.favourites.advice':
    '{kind} représente {share} de tout le visionnage, sur {count} scènes. Davantage de scènes {kind} sont le pari le plus sûr.',
  'insights.col.rank': 'Rang',
  'insights.col.scene': 'Scène',
  'insights.col.people': 'Personnes',
  'insights.col.time': 'Temps',
  'insights.col.perPerson': 'Par personne',
  'insights.col.adds': 'Ajouts',
  'insights.col.likes': 'J’aime',
  'insights.account.title': 'Scènes',
  'insights.account.empty':
    'Aucune scène ajoutée, aimée ou jouée pour l’instant. Le temps de lecture est compté dès que le membre utilise cette version de FluidEQ et a vu les conditions mises à jour.',
  'insights.account.played': 'Scènes jouées',
  'insights.account.time': 'À l’écran',
  'insights.account.added': 'Ajoutées',
  'insights.account.liked': 'Aimées',
  'insights.account.kind': 'Genre préféré',
  'insights.account.notPlayed': 'Pas jouée',
  'insights.account.days': '{days} jours · dernière fois le {date}',
  'insights.by': 'par {maker}',
  'insights.byFluidEQ': 'par FluidEQ',
  'insights.member': 'un membre',
  'insights.chip.added': 'Ajoutée le {date}',
  'insights.chip.liked': 'Aimée',
  'insights.kind.other': 'Sans catégorie',
  'insights.time.hoursMinutes': '{hours} {minutes}',
  'insights.error.offline':
    'FluidEQ n’a pas pu joindre son serveur. Vérifiez votre connexion et réessayez.',
  'insights.error.signedOut': 'Reconnectez-vous pour voir ceci.',
  'insights.error.server': 'Impossible de charger ceci. Réessayez.',
  'insights.error.forbidden':
    'Seul l’administrateur de FluidEQ peut voir ceci.',
  'insights.error.notDeployed':
    'Le serveur n’a pas encore ceci. Cela arrive avec la mise à jour du serveur qui accompagne cette version de FluidEQ.',
} as const;

export default insights;
