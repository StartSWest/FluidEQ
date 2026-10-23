/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const store: Partial<Dictionary> = {
  'store.credit.one': '{count} crédit',
  'store.credit.few': '{count} crédits',
  'store.credit.many': '{count} crédits',
  'store.credit.other': '{count} crédits',
  'store.credits.unit.one': 'crédit',
  'store.credits.unit.few': 'crédits',
  'store.credits.unit.many': 'crédits',
  'store.credits.unit.other': 'crédits',
  'store.credits.title': 'Crédits',
  'store.credits.buyTitle': 'Obtenir des crédits',
  'store.credits.lead':
    'Un crédit garde une scène pour toujours. Vous payez une fois, rien ne se renouvelle.',
  'store.credits.owned': 'Vos scènes : {count}',
  'store.credits.what':
    'Chaque crédit garde pour toujours une scène de la galerie : sur le graphique, votre Bureau et vos lumières.',
  'store.credits.buy': 'Obtenir des crédits',
  'store.credits.getFree': 'Recevoir des crédits gratuits',
  'store.error.offline':
    'Impossible de joindre FluidEQ. Vérifiez votre connexion et réessayez.',
  'store.error.signedOut': 'Reconnectez-vous pour utiliser vos crédits.',
  'store.error.unavailable':
    'La boutique de scènes n’est pas encore ouverte. Réessayez plus tard.',
  'store.error.server':
    'Un problème est survenu de notre côté. Rien n’a été dépensé ; réessayez dans un instant.',
  'store.error.unconfirmed':
    'Confirmez d’abord votre adresse e-mail. Le code est dans votre boîte de réception.',
  'store.error.notOnSale':
    'Ce pack n’est pas en vente pour l’instant. Choisissez-en un autre.',
  'store.error.noCredits': 'Vous n’avez plus de crédits.',
  'store.error.alreadyOwned': 'Cette scène est déjà à vous.',
  'store.error.gone': 'Cette scène n’est plus dans la galerie.',
  'store.error.negative':
    'Un remboursement a fait passer votre solde sous zéro. Un pack le rétablit.',
  'store.error.banned': 'Ce compte ne peut pas obtenir de scènes.',
  'store.pack.each': '{price} la scène',
  'store.pack.best': 'Meilleur prix',
  'store.buy.title': 'Garder {name} pour toujours ?',
  'store.buy.lead':
    'Elle devient la vôtre : sur le graphique, votre Bureau et vos lumières, sur chaque ordinateur où vous vous connectez.',
  'store.buy.keep':
    'À vous pour toujours, avec chaque mise à jour que publie son auteur.',
  'store.buy.balance': 'Vous avez {credits}. Ensuite : {after}.',
  'store.buy.final':
    'Impossible d’annuler. Le crédit est dépensé dès que vous confirmez.',
  'store.buy.buying': 'Obtention…',
  'store.buy.use': 'Utiliser {credits}',
  'store.loading': 'Lecture de vos crédits…',
  'store.packs.title': 'Il vous faut un crédit',
  'store.packs.lead':
    'Chaque crédit garde une scène pour toujours. Prenez un pack et {name} est à un clic.',
  'store.packs.negative':
    'Un remboursement a repris des crédits déjà utilisés : votre solde est de {credits}. Un pack le ramène au-dessus de zéro.',
  'store.packs.choose': 'Choisissez un pack',
  'store.packs.waiting':
    'Terminez le paiement dans votre navigateur. Vos crédits apparaissent ici dès que le paiement est validé.',
  'store.packs.fine':
    'Paiement sécurisé par Stripe. Un seul paiement ; rien ne se renouvelle. Les crédits n’ont aucune valeur monétaire. Payer vaut acceptation des conditions de FluidEQ.',
  'store.packs.arrived': '{credits} sur votre compte. Merci !',
  'store.packs.again': 'Rouvrir la page de paiement',
  'store.packs.pay': 'Payer {price}',
  'store.packs.none':
    'Aucun pack n’est en vente pour l’instant. Réessayez plus tard.',
  'store.cancel': 'Annuler',
  'store.done': 'Terminé',
  'store.starter.title': '{credits} offerts pour commencer',
  'store.starter.body':
    'Une fois par compte, pour une adresse e-mail confirmée.',
  'store.starter.claim': 'Recevoir {credits}',
  'store.get': 'Obtenir · {credits}',
  'store.scene.tasted':
    'C’était un aperçu de {seconds} secondes. Obtenez-la pour continuer à la regarder, pour toujours.',
  'store.scene.locked': 'Obtenez-la pour la voir jouer ici sur votre musique.',
  'store.scene.yours': 'À vous pour toujours',
  'store.scene.keep': 'Gardez-la pour toujours',
  'store.scene.fine':
    'Une scène que vous obtenez est à vous pour toujours, sur votre compte. Personne ne peut la revendre.',
  'store.official.fine':
    'Fait partie de la collection FluidEQ : à vous pour toujours dès que vous l’obtenez.',
  'store.like.ownersOnly': '{count} j’aime. Obtenez la scène pour l’aimer.',
  'store.scene.free': 'Gratuite pour tous',
  'store.admin.freeTitle': 'Gratuite pour tous',
  'store.admin.freeOn':
    'Chaque compte connecté la lance sans dépenser de crédit.',
  'store.admin.freeOff':
    'Un crédit, comme les autres scènes. Activez-le pour l’offrir à tous.',
  'store.error.termsOutdated':
    'Les conditions ont changé. Mettez FluidEQ à jour pour lire la nouvelle version avant d’acheter des crédits.',
};

export default store;
