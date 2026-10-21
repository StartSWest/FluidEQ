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
  'insights.chip.unpublished': 'Non publiée',
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
  'insights.server.tab': 'Serveur',
  'insights.server.loading': 'Mesure du serveur',
  'insights.server.plan': 'Formule gratuite Supabase',
  'insights.server.measured': 'Mesuré à {time}',
  'insights.server.database': 'Base de données',
  'insights.server.files': 'Fichiers',
  'insights.server.active': 'Comptes actifs, 30 jours',
  'insights.server.activeNote': '{accounts} comptes au total',
  'insights.server.of': 'sur {limit}',
  'insights.server.used': '{share} utilisé',
  'insights.server.requests': 'Requêtes, 7 derniers jours',
  'insights.server.unlimited': 'sans limite dans la formule gratuite',
  'insights.server.kind.rest': 'Base de données',
  'insights.server.kind.auth': 'Connexion',
  'insights.server.kind.storage': 'Fichiers',
  'insights.server.kind.realtime': 'En direct',
  'insights.server.noToken':
    'Le comptage des requêtes n’est pas activé sur ce serveur.',
  'insights.server.tokenRefused':
    'Le serveur n’a pas pu lire le nombre de requêtes.',
  'insights.server.tables': 'Plus grandes tables',
  'insights.server.buckets': 'Fichiers par dossier',
  'insights.server.bucketFiles': '{count} fichiers',
  'insights.server.noFiles': 'Aucun fichier enregistré pour l’instant.',
  'insights.server.egress': 'Données envoyées',
  'insights.server.egressBody':
    'La formule gratuite inclut {limit} par mois, et c’est en général la première limite atteinte : chaque scène et chaque image qu’un membre télécharge compte. Aucune API ne la donne ; Supabase l’affiche sur la page Usage du projet.',
  'insights.server.openSupabase': 'Ouvrir Supabase',
  'insights.server.limit.warn': 'Le serveur se remplit',
  'insights.server.limit.full': 'Le serveur est presque plein',
  'insights.server.limit.body':
    '{what} est à {share} de l’offre gratuite de Supabase. Passez le projet à une offre payante avant qu’il soit plein, sinon les fonctions en ligne de FluidEQ commenceront à échouer.',
  'insights.server.limit.database': 'La base de données',
  'insights.server.limit.files': 'Le stockage des fichiers',
  'insights.server.limit.accounts': 'Les comptes actifs',
  'insights.server.limit.later': 'Plus tard',
  'insights.server.limit.open': 'Ouvrir la page du serveur',
  'insights.server.limit.badge': '{share} de l’offre gratuite utilisés',
  'insights.server.rules':
    'La formule gratuite n’a pas de date de fin. Dépasser une limite entraîne un e-mail et un délai de grâce ; si cela continue, Supabase répond aux requêtes par « payment required » jusqu’au mois suivant ou à un changement de formule. Un projet sans aucune requête pendant {days} jours est mis en pause, ce que le trafic de FluidEQ lui-même empêche.',
} as const;

export default insights;
