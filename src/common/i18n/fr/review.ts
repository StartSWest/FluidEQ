/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.tab': 'À approuver',
  'review.tabCount': 'En attente d’approbation : {count}',
  'review.badge': 'En attente de vous : {count}',
  'review.hint':
    'Chaque scène publiée par un membre, et chaque nouvelle version d’une scène, attend ici que vous l’approuviez. Personne d’autre ne la voit d’ici là.',
  'review.empty.title': 'Rien en attente',
  'review.empty.hint':
    'Les nouvelles scènes et les nouvelles versions apparaissent ici quand les membres les publient.',
  'review.kind.new': 'Nouvelle scène',
  'review.kind.update': 'Mise à jour · v{from} → v{to}',
  'review.sent': 'Envoyée le {date}',
  'review.open': 'Examiner',
  'review.back': 'Tout ce qui attend',
  'review.flag.takenDown': 'Retirée de la galerie',
  'review.flag.takenDownHint':
    'Retirée de la galerie : rétablissez-la depuis Signalées pour approuver une nouvelle version',
  'review.flag.reports':
    'Signalements ouverts sur la version publiée : {count}',
  'review.note.title': 'Ce que son auteur dit de nouveau',
  'review.note.none': 'Son auteur n’a rien écrit sur cette version.',
  'review.sceneFailed': 'Impossible d’ouvrir cette scène pour la regarder.',
  'review.changed':
    'La scène a changé pendant que vous regardiez : son auteur a envoyé une version plus récente ou l’a retirée. La liste montre ce qui attend maintenant.',
  'review.approve': 'Approuver et publier',
  'review.approving': 'Approbation…',
  'review.reject': 'Ne pas approuver',
  'review.reject.title': 'Pourquoi n’est-elle pas approuvée ?',
  'review.reject.lead':
    'Son auteur reçoit la raison, et votre mot si vous en écrivez un.',
  'review.reject.noteLabel': 'Un mot pour son auteur (facultatif)',
  'review.reject.notePlaceholder':
    'Par exemple : le flash blanc du drop est trop fort',
  'review.reject.cancel': 'Retour',
  'review.reject.send': 'Envoyer la réponse',
  'review.reject.sending': 'Envoi…',
  'review.reason.flashing': 'Flashs ou effet stroboscopique',
  'review.reason.rights': 'L’œuvre de quelqu’un d’autre',
  'review.reason.offensive': 'Choquante',
  'review.reason.broken': 'Cassée ou trop lourde',
  'review.reason.other': 'Autre chose',
  'review.done.approved': '{name} est dans la galerie.',
  'review.done.rejected':
    '{name} n’a pas été approuvée. Son auteur saura pourquoi.',
  'review.failed': 'La réponse n’est pas passée. Réessayez.',
  'review.versionRaised':
    'La galerie a déjà cette version ou une plus récente.',
  'review.takenDown':
    'Elle a été retirée entre-temps et n’accepte donc aucune nouvelle version. Rétablissez-la d’abord depuis Signalées.',
  'review.deleted':
    'Elle a été supprimée définitivement et n’accepte donc aucune nouvelle version.',
  'review.filesFailed':
    'Approuvée, mais ses fichiers ne sont pas arrivés dans la galerie. Appuyez à nouveau sur Approuver et publier pour terminer.',
  'review.forbidden':
    'Seul l’administrateur de FluidEQ peut approuver des scènes.',
  'review.fine.new':
    'L’approuver la met dans la galerie en version {version} : tout le monde connecté la voit, et les membres Plus peuvent l’ajouter.',
  'review.fine.update':
    'L’approuver remplace la version {version} pour tous ceux qui ont la scène. Ne pas l’approuver laisse la version {version} telle quelle.',
  'review.state.pending': 'En examen',
  'review.state.pendingUpdate': 'Version {version} en examen',
  'review.state.rejected': 'Non approuvée',
  'review.state.rejectedUpdate': 'Version {version} non approuvée',
  'review.withdraw': 'Retirer',
  'review.withdrawConfirm': 'La retirer de l’examen ?',
  'review.remove': 'Enlever',
  'review.removeConfirm': 'L’enlever de cette liste ?',
  'review.withdrawn': '{name} a été retirée.',
  'review.notice.waitingOne': 'Une scène attend votre approbation',
  'review.notice.waitingMany': '{count} scènes attendent votre approbation',
  'review.notice.waitingWho': '{name}, par {maker}',
  'review.notice.waitingNewest': 'La plus récente : {name}, par {maker}',
  'review.notice.later': 'Plus tard',
  'review.notice.review': 'Examiner maintenant',
  'review.notice.approved': '{name} est dans la galerie',
  'review.notice.approvedBody':
    'Elle a été approuvée. Les membres Plus peuvent l’ajouter dès maintenant.',
  'review.notice.approvedUpdate':
    'La version {version} de {name} est dans la galerie',
  'review.notice.approvedUpdateBody':
    'Elle a été approuvée. Tous ceux qui ont la scène reçoivent la nouvelle version.',
  'review.notice.rejected': '{name} n’a pas été approuvée',
  'review.notice.rejectedUpdate':
    'La version {version} de {name} n’a pas été approuvée',
  'review.notice.keepsLive': 'Ceux qui l’ont gardent la version {version}.',
  'review.notice.gotIt': 'Compris',
  'review.notice.openStudio': 'Ouvrir le Studio',
  'review.notice.openMine': 'Vos scènes',
} as const;

export default review;
