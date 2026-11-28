/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription: Partial<Dictionary> = {
  'subscription.name': 'Plus',
  'subscription.get': 'Passer à Plus',
  'subscription.getAgain': 'Reprendre Plus',
  'subscription.manage': 'Gérer Plus',
  'subscription.included': 'Incluse avec Plus',

  'subscription.plan.monthly': 'Mensuel',
  'subscription.plan.yearly': 'Annuel',
  'subscription.plan.perMonth': '{price} par mois',
  'subscription.plan.perYear': '{price} par an',
  'subscription.plan.both': '{monthly} par mois ou {yearly} par an',
  'subscription.plan.cancelAnytime': 'Résiliable à tout moment.',
  'subscription.plan.monthlyEquivalent': 'Soit {price} par mois.',
  'subscription.plan.save': '{percent} % d’économie',

  'subscription.status.grace':
    'FluidEQ n’a pas pu vérifier votre Plus auprès du serveur. Il continue de jouer jusqu’au {date}.',
  'subscription.status.waiting':
    'En attente de la confirmation de votre paiement par Stripe. Plus s’active ici tout seul.',

  'subscription.ways.title': 'Plus ou crédits ?',
  'subscription.ways.credits.each': 'Une scène à la fois, {credits} chacune',
  'subscription.ways.credits.keep': 'À vous pour toujours, même sans Plus',
  'subscription.ways.plus.every':
    'Toutes les scènes de Scènes, les nouvelles aussi',
  'subscription.ways.plus.while': 'Tant que vous êtes membre',

  'subscription.scene.twoWays': 'Deux façons de l’avoir',
  'subscription.scene.keep.title': 'Garder cette scène',
  'subscription.scene.keep.body':
    'À vous pour toujours, avec chaque mise à jour. {credits}.',
  'subscription.scene.plus.title': 'Toutes les scènes avec Plus',
  'subscription.scene.plus.body':
    'Celle-ci et toutes les autres, tant que vous êtes membre. {prices}.',
  'subscription.scene.member.note':
    'Elle joue sur votre graphique, votre bureau et vos lumières tant que vous avez Plus.',
  'subscription.scene.member.keep':
    'Vous la voulez même si Plus se termine ? Gardez-la avec un crédit, à vous pour toujours.',
  'subscription.scene.member.keepButton': 'Garder pour toujours · {credits}',

  'subscription.lapse.title': 'Votre abonnement Plus est terminé',
  'subscription.lapse.body':
    'Ces scènes jouaient avec Plus, et leurs téléchargements ont été supprimés de cet ordinateur. Obtenez-en une avec un crédit pour la garder pour toujours, ou reprenez Plus pour les avoir toutes.',
  'subscription.lapse.more': '+{count} autres',
  'subscription.lapse.find': 'La chercher',
  'subscription.lapse.notNow': 'Pas maintenant',

  'subscription.sheet.eyebrow': 'Scènes',
  'subscription.sheet.description':
    'Toutes les scènes de Scènes, celles de FluidEQ et celles de la communauté.',
  'subscription.sheet.heading': 'Toutes les scènes, tant que vous avez Plus',
  'subscription.sheet.lead':
    'Elles jouent sur votre graphique, votre bureau et vos lumières, ici et dans FluidWallpapers, sur chaque ordinateur où vous vous connectez.',
  'subscription.sheet.choose': 'Mode de paiement',
  'subscription.sheet.renews':
    'Plus se renouvelle jusqu’à ce que vous le résiliiez. Résiliez à tout moment sur la page de Stripe.',
  'subscription.sheet.ends':
    'Quand Plus se termine, les scènes qu’il faisait jouer s’arrêtent et leurs téléchargements sont supprimés de cet ordinateur.',
  'subscription.sheet.pay': 'Continuer vers le paiement · {price}',
  'subscription.sheet.again': 'Rouvrir la page de Stripe',
  'subscription.sheet.waiting':
    'Terminez sur la page de Stripe dans votre navigateur. Plus s’active ici tout seul.',
  'subscription.sheet.fine':
    'Continuer enregistre votre acceptation des conditions. Vous payez sur la page de Stripe ; FluidEQ ne voit jamais votre carte.',
  'subscription.sheet.notNow': 'Pas maintenant',
  'subscription.sheet.done.title': 'Plus est actif',
  'subscription.sheet.done.body':
    'Toutes les scènes de Scènes jouent désormais pour vous.',
  'subscription.sheet.done.see': 'Voir les scènes',

  'subscription.error.termsChanged':
    'Les conditions ont été mises à jour. Lisez-les, puis continuez.',
  'subscription.error.needsEmail':
    'Confirmez d’abord votre adresse e-mail, puis réessayez.',
  'subscription.error.needsUpdate': 'Mettez FluidEQ à jour pour passer à Plus.',
  'subscription.error.alreadySubscribed': 'Ce compte a déjà Plus.',
  'subscription.error.notOnSale': 'Plus n’est pas en vente pour le moment.',
  'subscription.error.banned':
    'Ce compte ne peut pas avoir Plus pour le moment.',
  'subscription.error.signedOut': 'Reconnectez-vous pour passer à Plus.',
  'subscription.error.failed':
    'Impossible d’ouvrir la page de Stripe. Vérifiez votre connexion et réessayez.',

  'subscription.manage.opened':
    'La page de Stripe s’est ouverte dans votre navigateur.',
  'subscription.manage.none': 'Ce compte n’a pas d’abonnement Plus à gérer.',
  'subscription.manage.signedOut': 'Reconnectez-vous pour gérer Plus.',
  'subscription.manage.failed':
    'Impossible d’ouvrir la page de Stripe. Vérifiez votre connexion et réessayez.',

  'subscription.cardGet': 'Obtenir',
  'subscription.makeScenes': 'Créez vos propres scènes dans FluidWallpapers',
  'subscription.banner.title': 'Plus : toutes les scènes de la galerie',
  'subscription.banner.body':
    'Lancez-les et ajoutez-les toutes, les nouvelles aussi. Un seul abonnement pour FluidEQ et FluidWallpapers.',
  'subscription.banner.credit':
    'Vous voulez une scène même sans Plus ? Obtenez-la avec un crédit, elle reste à vous pour toujours.',
  'subscription.banner.or': 'ou {price}',
  'subscription.line.renews':
    'Toutes les scènes sont à vous · renouvelé le {date} · aussi dans FluidWallpapers',
  'subscription.line.ends':
    'Toutes les scènes sont à vous jusqu’au {date} · aussi dans FluidWallpapers',
  'subscription.line.plain':
    'Toutes les scènes sont à vous · aussi dans FluidWallpapers',
  'subscription.sheet.both':
    'Un seul abonnement pour FluidEQ et FluidWallpapers : prenez-le dans l’une ou l’autre, il compte dans les deux.',
  'subscription.sheet.keepOne':
    'Ou gardez seulement {name} pour toujours, même sans Plus :',

  'subscription.account.yours': 'Toutes les scènes de la galerie sont à vous',
  'subscription.account.renews':
    'Renouvelé le {date} · aussi dans FluidWallpapers',
  'subscription.account.ends':
    'Se termine le {date} · aussi dans FluidWallpapers',
  'subscription.welcome.title': 'Ou toutes les scènes, avec Plus',
  'subscription.welcome.body':
    'Toutes les scènes de la galerie, les nouvelles aussi, tant que vous êtes membre. Un seul abonnement pour FluidEQ et FluidWallpapers.',
  'subscription.welcome.signIn': 'Connectez-vous pour passer à Plus',
  'subscription.dev.notOnSale':
    'Développement : Plus n’est pas en vente pour ce compte. Tant que Stripe est en mode test, seuls l’administrateur et les comptes de la liste des testeurs du serveur reçoivent ses prix : ajoutez ce compte à cette liste.',
  'subscription.renew': 'Renouveler Plus',
  'subscription.pass.member': 'Membre',
  'subscription.pass.ending': 'Résilié · toujours à vous jusque-là',
  'subscription.chip.until': 'Plus jusqu’au {date}',
};

export default subscription;
