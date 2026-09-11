const leaderboard = {
  'leaderboard.title': 'Classement',
  'leaderboard.card.title': 'Classement',
  'leaderboard.card.body':
    'Qui écoute le plus, parmi les membres Plus. Désactivé sauf si vous rejoignez. Si vous le faites, l’application envoie un seul nombre pour chaque jour — les minutes entières de musique jouée, plafonnées à seize heures — avec sa date, et le met à jour quand vous revenez à l’ordinateur ou ouvrez le classement. Jamais ce que vous avez écouté, ni d’où.',
  'leaderboard.card.today': 'Aujourd’hui jusqu’ici : {hours} h',
  'leaderboard.card.join': 'Rejoindre le classement',
  'leaderboard.card.leave': 'Quitter le classement',
  'leaderboard.card.remove': 'Supprimer toutes mes données',
  'leaderboard.card.removed':
    'Supprimées. Il ne reste rien de vous au classement.',
  'leaderboard.card.removeConfirmTitle':
    'Supprimer tout ce que vous avez envoyé ?',
  'leaderboard.card.removeConfirmBody':
    'Votre rang et chaque journée d’écoute au classement sont effacés pour de bon. Impossible de les récupérer ; en rejoignant à nouveau, vous repartez de zéro.',
  'leaderboard.card.removeKeep': 'Garder mes données',
  'leaderboard.card.removeConfirm': 'Tout supprimer',
  'leaderboard.card.plusOnly':
    'Seuls les membres Plus sont classés. Rejoindre ne fait rien avant.',
  'leaderboard.allTime': 'Depuis toujours',
  'leaderboard.thisMonth': 'Ce mois-ci',
  'leaderboard.hours': '{hours} h',
  'leaderboard.you': 'Vous',
  'leaderboard.players': '{count} auditeurs classés',
  'leaderboard.points': '{points} pts',
  'leaderboard.hero.title': 'Votre place',
  'leaderboard.hero.of': 'sur {count}',
  'leaderboard.hero.toPass': '{points} pts pour dépasser {name}',
  'leaderboard.hero.leading': 'Vous êtes en tête.',
  'leaderboard.part.hours': 'Écoute',
  'leaderboard.part.days': 'Jours actifs',
  'leaderboard.part.likes': 'J’aime sur les scènes',
  'leaderboard.guide.title': 'Comment gagner des points',
  'leaderboard.guide.lead':
    'Tout le monde gagne de la même façon, le créateur compris.',
  'leaderboard.guide.hours':
    'Chaque heure de musique jouée, jusqu’à {limit} heures par jour.',
  'leaderboard.guide.days':
    'Chaque jour où vous écoutez {limit} minutes ou plus.',
  'leaderboard.guide.likes':
    'Chaque J’aime qu’un autre membre donne à une scène que vous avez créée.',
  'leaderboard.guide.value': '+{points}',
  'leaderboard.guide.fairTitle': 'D’où viennent les chiffres',
  'leaderboard.guide.fair':
    'Votre ordinateur compte les minutes de musique et envoie un total par jour, seulement après que vous avez rejoint, jamais ce que vous écoutez. Les J’aime sont comptés sur le serveur. Chaque nombre y est vérifié, et la triche retire du classement.',
  'leaderboard.guide.terms': 'Tout ce que l’application envoie',
  'leaderboard.stat.hours': '{hours} heures d’écoute',
  'leaderboard.stat.days': '{count} jours actifs',
  'leaderboard.stat.likes': 'J’aime sur ses scènes : {count}',
  'leaderboard.scoring':
    'Points : {hours} par heure écoutée, {days} par jour actif, {likes} pour chaque J’aime sur une scène que vous avez créée. Le créateur les gagne de la même façon.',
  'leaderboard.rail.blurb': 'Qui écoute le plus',
  'leaderboard.role.admin': 'Créateur',

  // The name the board ranks, chosen once on the board itself.
  'leaderboard.name.title': 'Choisissez comment le classement vous affiche',
  'leaderboard.name.body':
    'Un pseudo et un nom. Le classement vous affiche sous ces noms, et la galerie Visualiseurs les indique comme auteur de vos scènes. Toute personne connectée les voit ; personne ne voit votre e-mail.',
  'leaderboard.name.handle': 'Pseudo',
  'leaderboard.name.handleHint': 'De 3 à 20 lettres, chiffres ou _',
  'leaderboard.name.name': 'Nom affiché',
  'leaderboard.name.previewName': 'Votre nom',
  'leaderboard.name.save': 'Enregistrer',
  'leaderboard.name.choose': 'Choisissez votre nom',
  'leaderboard.name.error.handleTaken':
    'Ce pseudo est déjà pris. Essayez-en un autre.',
  'leaderboard.name.error.signedOut':
    'Vous avez été déconnecté. Reconnectez-vous.',
  'leaderboard.name.error.network':
    'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
  'leaderboard.name.error.rejected':
    'Le serveur a refusé ce nom. Essayez-en un autre.',
  'leaderboard.empty': 'Personne n’est encore classé.',
  'leaderboard.notJoined':
    'Vous n’êtes pas au classement. Rejoignez-le depuis le panneau Compte.',
  'leaderboard.loading': 'Chargement…',
  'leaderboard.error.network':
    'Impossible de joindre le classement. Vérifiez votre connexion.',
  'leaderboard.error.plusRequired': 'Seuls les membres Plus sont classés.',
  'leaderboard.error.signedOut': 'Vous avez été déconnecté. Reconnectez-vous.',
  'leaderboard.error.rejected': 'Le service de classement a refusé.',
} as const;

export default leaderboard;
