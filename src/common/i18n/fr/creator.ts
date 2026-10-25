/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const creator: Partial<Dictionary> = {
  'creator.title': 'Paiements aux créateurs',
  'creator.badge.active': 'Actif',
  'creator.badge.checking': 'Vérification',
  'creator.invite':
    'Publiez des scènes dans la galerie et soyez payé quand des membres les achètent : {share} % de chaque vente, versés sur votre compte bancaire par Stripe.',
  'creator.unfinished':
    "Votre inscription chez Stripe n'est pas terminée. Reprenez là où vous en étiez.",
  'creator.newTerms':
    'Les conditions pour les créateurs ont changé. Lisez-les et acceptez-les pour continuer à être payé.',
  'creator.checking':
    'Stripe vérifie vos informations. Cela prend en général quelques minutes, parfois quelques jours.',
  'creator.paidLine': '{sales} de vos scènes jusqu’ici.',
  'creator.sales.one': '{count} vente',
  'creator.sales.few': '{count} ventes',
  'creator.sales.many': '{count} ventes',
  'creator.sales.other': '{count} ventes',
  'creator.ready': 'Prêt à verser',
  'creator.held': 'En attente',
  'creator.paid': 'Versé jusqu’ici',
  'creator.paidHint':
    'Chaque vente est retenue {days} jours en cas de remboursement. Les créateurs sont payés tous les {every} jours, dès que {amount} sont prêts.',
  'creator.opened':
    'La page de Stripe est ouverte dans votre navigateur. Terminez là-bas ; cette carte se met à jour à votre retour.',
  'creator.setUp': 'Configurer les paiements',
  'creator.finish': 'Terminer la configuration',
  'creator.readTerms': 'Lire les nouvelles conditions',
  'creator.checkAgain': 'Vérifier à nouveau',
  'creator.dashboard': 'Tableau de bord Stripe',
  'creator.dialog.title': 'Soyez payé pour vos scènes',
  'creator.dialog.lead':
    'Stripe vous paie et conserve vos informations d’identité, bancaires et fiscales. FluidEQ ne les voit jamais.',
  'creator.dialog.step1':
    'Choisissez votre pays et acceptez les conditions ici.',
  'creator.dialog.step2':
    'Inscrivez-vous sur la page de Stripe dans votre navigateur.',
  'creator.dialog.step3': 'Revenez dans FluidEQ : vos gains s’affichent ici.',
  'creator.dialog.country': 'Pays où vous vivez',
  'creator.dialog.search': 'Rechercher un pays',
  'creator.dialog.choose': 'Choisissez un pays',
  'creator.dialog.countryHint':
    'Stripe peut payer les créateurs aux États-Unis, au Royaume-Uni, au Canada, en Suisse et dans l’Espace économique européen, et ce choix ne peut pas être modifié ensuite. Votre pays n’y est pas ? Les membres peuvent quand même acheter vos scènes, et deux ventes vous rapportent un crédit à la place.',
  'creator.dialog.cancel': 'Annuler',
  'creator.dialog.go': 'Accepter et continuer vers Stripe',
  'creator.dialog.opening': 'Ouverture de Stripe…',
  'creator.terms.title': 'Conditions pour les créateurs',
  'creator.terms.share':
    'Vous recevez {share} % de ce que rapporte chaque vente de vos scènes après les frais de Stripe. FluidEQ garde le reste.',
  'creator.terms.paidCredits':
    'Seules les scènes achetées avec des crédits payés rapportent de l’argent. Les crédits gratuits, et les scènes de FluidEQ, ne rapportent rien.',
  'creator.terms.hold':
    'Chaque gain est retenu {days} jours, pour qu’un remboursement ou une contestation puisse encore l’annuler. Un gain annulé après versement est déduit de votre prochain paiement.',
  'creator.terms.minimum':
    'FluidEQ paie les créateurs tous les {every} jours, dès que {amount} ou plus sont prêts. Stripe les envoie ensuite sur votre compte selon votre propre calendrier.',
  'creator.terms.stripe':
    'Stripe vous demande vos informations d’identité, bancaires et fiscales et vous présente ses propres conditions. Les paiements s’arrêtent si Stripe ne peut plus vous payer.',
  'creator.terms.rights':
    'Tout ce qui figure dans vos scènes doit vous appartenir pour pouvoir le vendre. Les scènes sont toujours examinées, et celle qui enfreint les conditions peut être retirée.',
  'creator.terms.taxes':
    'Il vous revient de déclarer les impôts sur vos gains là où vous vivez.',
  'creator.terms.changes':
    'Ces conditions peuvent changer. Vous en êtes informé dans l’app, et invité à accepter les nouvelles avant d’être payé à nouveau.',
  'creator.error.signedOut': 'Reconnectez-vous pour gérer vos paiements.',
  'creator.error.unconfirmed':
    'Confirmez d’abord votre adresse e-mail. Le code est dans votre boîte de réception.',
  'creator.error.offline':
    'Impossible de joindre FluidEQ. Vérifiez votre connexion et réessayez.',
  'creator.error.unavailable':
    'Les paiements aux créateurs ne sont pas encore ouverts. Réessayez plus tard.',
  'creator.error.agreementOutdated':
    'Les conditions pour les créateurs ont changé. Relisez-les et acceptez-les.',
  'creator.error.country':
    'Stripe ne peut pas encore payer les créateurs dans ce pays.',
  'creator.error.banned': 'Ce compte ne peut pas être payé pour des scènes.',
  'creator.error.server':
    'Un problème est survenu de notre côté. Rien n’a changé ; réessayez dans un instant.',
  'creator.admin.tab': 'Paiements',
  'creator.admin.plan': 'Créateurs payés via Stripe',
  'creator.admin.loading': 'Lecture de ce qui est dû aux créateurs',
  'creator.admin.creators': 'Créateurs : {count}',
  'creator.admin.available': 'Disponible chez Stripe',
  'creator.admin.availableNote': 'la source des virements',
  'creator.admin.short':
    'Le solde disponible de FluidEQ chez Stripe est inférieur à ce qui est dû. Les virements au-delà échouent et sont renvoyés au paiement suivant.',
  'creator.admin.list': 'Qui est payé',
  'creator.admin.none':
    'Personne n’est encore dû. Les créateurs apparaissent ici quand Stripe peut les payer et qu’assez de leurs gains ont passé la période de retenue.',
  'creator.admin.rules':
    'Les paiements partent seuls le 1er et le 16 : d’abord aux créateurs, puis votre part vers votre banque. Chaque paiement est envoyé une fois : une exécution interrompue est terminée par la suivante, jamais renvoyée.',
  'creator.admin.lastPaid': 'Dernier paiement : {date}',
  'creator.admin.neverPaid': 'Aucun paiement pour l’instant',
  'creator.admin.nextDue': 'prochain paiement automatique : {date}',
  'creator.notice.title': 'Paiement des créateurs le {date}',
  'creator.notice.body':
    '{amount} partiront automatiquement. Créateurs à payer : {count}.',
  'creator.notice.later': 'Plus tard',
  'creator.notice.open': 'Ouvrir Paiements',
  'creator.notice.shortTitle':
    'Solde Stripe insuffisant pour le paiement du {date}',
  'creator.notice.shortBody':
    'Dû : {amount}. Créateurs à payer : {count}. Stripe détient {available} ; les virements au-delà échoueront et attendront le prochain paiement.',
  'creator.admin.owed': 'Dû aux créateurs',
  'creator.admin.owedNote': 'retenu {held} · prêt {ready}',
  'creator.admin.sending': 'en cours d’envoi {amount}',
  'creator.admin.onItsWay': '+ {amount} en route',
  'creator.admin.yours': 'À vous',
  'creator.admin.yoursNote':
    'part seul vers votre banque après chaque paiement ; {reserve} restent pour les remboursements',
  'creator.admin.lastToYou':
    'dernier envoi vers votre banque : {amount}, {date}',
  'creator.admin.yoursShort':
    'il est dû aux créateurs {amount} de plus que ce que détient Stripe',
  'creator.admin.next': 'Prochain paiement',
  'creator.admin.manual':
    'Stripe envoie encore tout votre solde vers votre banque de lui-même, argent des créateurs compris, donc FluidEQ retient votre part. Dans Stripe, Settings → Payouts, réglez une fois le calendrier sur Manual : FluidEQ n’enverra alors que votre part, de lui-même, après chaque paiement.',
  'creator.admin.pendingLine':
    'Paiements laissés inachevés par une exécution précédente : {count}. La prochaine exécution les termine d’abord.',
};

export default creator;
