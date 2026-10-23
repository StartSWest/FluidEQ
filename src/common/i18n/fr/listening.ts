const listening = {
  'listening.notice.title': 'FluidEQ compte combien de temps vous écoutez',
  'listening.notice.body':
    'Un nombre par jour : les minutes de musique jouées, sur les {days} derniers jours et jamais plus de {hours} heures par jour. Ni ce qui a joué, ni d’où. Seul l’administrateur de FluidEQ le voit, additionné à celui de tous les autres et jamais avec votre nom.',
  'listening.notice.keep': 'Laisser activé',
  'listening.notice.off': 'Désactiver',
  'listening.notice.change':
    'Vous pouvez le changer à tout moment dans votre compte.',
  'listening.card.title': 'Temps d’écoute',
  'listening.card.today': 'Aujourd’hui sur cet ordinateur',
  'listening.card.notCounted': 'Non compté',
  'listening.card.switch': 'Partager avec FluidEQ combien de temps j’écoute',
  'listening.card.what': 'Ce que FluidEQ voit',
  'listening.card.offNote':
    'Désactivé : rien n’est compté, et tous les jours que vous avez envoyés ont été supprimés.',
  'listening.card.unknownNote':
    'Connectez-vous à Internet pour voir ou modifier ce réglage.',
  'listening.error.offline':
    'Impossible de joindre FluidEQ. Vérifiez votre connexion et réessayez.',
  'listening.error.signedOut': 'Reconnectez-vous pour modifier ce réglage.',
  'listening.error.server': 'Cela n’a pas abouti. Réessayez.',
  'listening.admin.tab': 'Écoute',
  'listening.admin.plan': 'Combien de temps les gens écoutent',
  'listening.admin.loading': 'Chargement des chiffres d’écoute',
  'listening.admin.time': 'Temps d’écoute',
  'listening.admin.timeNote': '{time} par jour sur la période',
  'listening.admin.listeners': 'Auditeurs',
  'listening.admin.listenersNote': 'sur {accounts} comptes',
  'listening.admin.average': 'Une journée d’écoute',
  'listening.admin.averageNote': 'par auditeur, les jours où il a écouté',
  'listening.admin.sharing': 'Partagent',
  'listening.admin.sharingNote':
    '{declined} l’ont désactivé · {unasked} pas encore sollicités',
  'listening.admin.chart': 'Chaque jour',
  'listening.admin.chartKey.time': 'Temps d’écoute',
  'listening.admin.chartKey.listeners': 'Auditeurs',
  'listening.admin.day': '{date} : {time} de {listeners} auditeurs',
  'listening.admin.peak': 'Jour le plus chargé : {date}, {time}',
  'listening.admin.empty': 'Personne n’a encore écouté sur cette période.',
  'listening.admin.rules':
    'Compté uniquement pour les comptes informés qui l’ont laissé activé. Votre propre compte et les comptes bannis sont exclus. Un jour est le jour calendaire de chaque auditeur et compte au plus {hours} heures ; deux ordinateurs qui jouent en même temps comptent une fois.',
};

export default listening;
