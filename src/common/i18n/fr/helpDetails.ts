/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'Dynamique : passages faibles et forts',
  'help.dynamics.intro':
    'Dynamique est un compresseur trois bandes : il relève les passages faibles et retient les plus forts sans ajouter de retard. Il convient à la musique, aux films, à la parole et au son d’un jeu.',
  'help.dynamics.steps':
    'Ouvrez DSP → Dynamique, activez l’étage et choisissez un préréglage. Ceux pour les jeux se trouvent dans Gaming Lab.\nLes bandes couvrent le grave sous 150 Hz, le médium de 150 Hz à 4 kHz et l’aigu au-dessus de 4 kHz. Travaillez la bande du son concerné.\nDans Remonter, Sous définit quand relever les sons faibles, Rapport l’intensité et Jusqu’à le gain maximal. À 1:1, rien ne change.\nDans Retenir, Au-dessus de définit quand réduire les sons forts et Rapport avec quelle fermeté. Abaisser le seuil déclenche plus souvent la réduction.\nRéglez Attaque et Relâchement, puis Mélange pour mêler le son original et Compensation pour ajuster le niveau final. Comparez à volume similaire.\nLe graphique montre le son avant et après et le gain appliqué : une hausse relève, un creux retient. Un avis de mise à jour du moteur peut ne concerner que cet affichage en direct, alors que le son est déjà traité.',
  'help.dynamics.tip':
    'Une forte remontée révèle aussi le bruit de fond. Diminuez le mélange pour conserver davantage le mouvement original.',
  'help.dynamics.keywords':
    'dynamics, compressor, compression, upward compression, downward compression, lift, hold, attack, release, mix, makeup, quiet passages, loud passages',
  'help.deesser.title': 'Dé-esseur : adoucir les voix sifflantes',
  'help.deesser.intro':
    'Il réduit les S, T et SH agressifs lorsqu’ils surviennent. Ses quatre groupes définissent ce qu’il écoute, ce qu’il réduit, sa vitesse et la zone stéréo traitée.',
  'help.deesser.steps':
    'Ouvrez DSP → Dé-esseur, activez-le et essayez un préréglage sur une voix sifflante.\nDans Trouver, encadrez le son gênant avec les fréquences basse et haute. Montez Sensibilité sans faire réagir chaque note brillante.\nDans Réduire, Spectral suit les seules fréquences gênantes ; Aigus baisse la bande haute. Voix entière baisse tout le son et vise une voix isolée. Réglez la réduction maximale et la largeur disponible.\nDans Temporisation, réglez la capture du début et le retour des aigus. Dans Où, Centre vise la voix centrale ; Épargner les cymbales préserve les frappes brillantes.\nActivez Isoler pour entendre ce qui est retiré, puis désactivez-le pour juger le morceau entier. L’affichage suit le réglage manipulé.\nEnregistrez les réglages dans la barre de l’étage, et la chaîne entière pour garder leur combinaison : un autre préréglage de chaîne peut remplacer plusieurs étages.',
  'help.deesser.tip':
    'Si la voix zozote ou si la musique perd son air, réduisez la sensibilité ou la réduction maximale. Ce traitement agit sur la lecture, pas sur le microphone.',
  'help.deesser.keywords':
    'de-esser, deesser, de essing, sibilance, sharp voice, harsh voice, spectral, centre only, center only, cymbals, isolate',
  'help.normalizer.title': 'Normaliseur et contrôle de niveau en direct',
  'help.normalizer.intro':
    'Il ajuste le niveau de la source avant les étages créatifs. Les fichiers de Bibliothèque peuvent être analysés entièrement ; les autres sources sont apprises pendant la lecture.',
  'help.normalizer.steps':
    'Choisissez Désactivé, Crête vraie ou Sonie dans DSP → Normaliseur. Crête vraie réduit les crêtes sans amplifier. Sonie vise les passages de trois secondes les plus forts ; les extraits courts utilisent la sonie intégrée.\nAttendez la fin de l’analyse de la Bibliothèque, puis consultez la sonie des passages forts, le gain appliqué et la limite indiquée. La sonie intégrée reste une mesure distincte de toute la piste.\nLe mode Direct apprend pendant la lecture et peut ajuster le gain à l’arrivée d’un passage plus fort. Les passages doux gardent leur niveau relatif : la sonie moyenne peut donc varier. La marge de crête et le gain maximal peuvent empêcher d’atteindre la cible.',
  'help.normalizer.tip':
    'Il diffère de la normalisation automatique du panneau gauche, qui réserve la marge de l’EQ, et de Master, qui règle la sortie finale. Aucun ne répare une distorsion déjà enregistrée.',
  'help.normalizer.keywords':
    'normalizer, normalisation, normalization, lufs, loudness target, true peak, peak ceiling, applied gain, leveling, live level control, learning source, holding gain',
  'help.crossfade.title': 'Fondu enchaîné et courbes personnalisées',
  'help.crossfade.intro':
    'Il superpose les morceaux successifs de Bibliothèque. Ce réglage de lecture est indépendant des filtres et ne fait pas de fondu entre les autres apps ni dans Karaoke.',
  'help.crossfade.steps':
    'Placez au moins deux morceaux dans la file de Bibliothèque. Dans DSP, choisissez Fondu enchaîné sous les options de lecture et activez-le.\nRéglez la durée et choisissez puissance constante, doux ou linéaire. Laissez le premier morceau arriver à sa fin pour entendre le mélange.\nChoisissez Personnalisée et déplacez les points des courbes sortante et entrante. Le clavier et ses flèches permettent aussi de les ajuster.\nObservez les deux courbes et leur somme : les garder hautes ensemble peut augmenter le volume de transition.\nEnregistrer la courbe conserve une forme nommée dans la liste. Réinitialiser la forme rend sa forme initiale à la courbe modifiable.',
  'help.crossfade.tip':
    'Si les commandes sont indisponibles, démarrez un morceau audio de Bibliothèque. La courbe change la transition, pas l’EQ des morceaux.',
  'help.crossfade.keywords':
    'crossfade, fade, transition, overlap, dj, equal power, custom curve, save curve, outgoing, incoming',
  'help.gamefilter.title': 'Filtre Jeu : pas, environnement et voix',
  'help.gamefilter.intro':
    'Chaque jeu dispose de réglages pour ses indices discrets, son ambiance et ses dialogues. Partez de son profil et modifiez sa propre copie en écoutant.',
  'help.gamefilter.steps':
    'Dans Gaming Lab, sélectionnez un jeu et essayez son son s’il n’est pas chargé. Choisissez Jeu parmi ses éléments.\nRelevez les pas pour entendre les bruits faibles, rechargements et portes. Calm contient les événements forts ; comparez avant de pousser les deux.\nL’option sabots et pas lourds relève le poids grave des bottes, chevaux et véhicules. Désactivez-la si les indices deviennent trop lourds.\nEnvironnement baisse ou relève le fond. Il relâche son action lorsqu’un pas ou un son distinct en ressort, pour ne pas l’abaisser avec l’ambiance.\nDialogue rapproche une voix centrale. Faire de la place baisse un peu le reste pendant la parole.\nL’isolation révèle les changements ; revenez ensuite au jeu complet. Enregistrer comme profil conserve votre travail pour d’autres jeux ; réinitialiser restaure son profil de départ.',
  'help.gamefilter.tip':
    'Un jeu qui possède son propre son 3D peut garder Room désactivé pour éviter un double placement. Room est destiné au casque. Le son de votre musique revient lorsque celui du jeu est déchargé.',
  'help.gamefilter.keywords':
    'game filter, footsteps, lift, calm, environment, ambience, dialogue, voices, make room, hooves, heavy steps, isolate, hrtf, spatial audio',
  'help.songs.title': 'Mémoriser le son de chaque morceau',
  'help.songs.intro':
    'Un morceau peut retenir son préréglage, son Tone et son EQ pour chaque sortie. Les réglages du casque ne remplacent pas la mémoire des enceintes.',
  'help.songs.steps':
    'Sous les profils de sortie, activez Mémoriser le son de chaque chanson. Cette option est désactivée au départ.\nLisez un morceau identifiable et changez son préréglage, Tone ou EQ. Une notification annonce l’enregistrement ; refusez-le si ce n’était qu’un essai.\nÀ la prochaine lecture sur cette sortie, son réglage revient temporairement. Annuler l’ignore cette fois ; Oublier ce morceau efface aussi sa mémoire.\nÀ sa fin, le son précédent de la sortie revient. Choisir un autre profil vous rend explicitement la main.\nSmart EQ dispose de son propre bouton d’enregistrement pendant la mesure. Il conserve la correction mesurée, indépendamment des réglages manuels mémorisés.',
  'help.songs.tip':
    'L’identité vient du fichier ou des informations du lecteur. Un titre absent ou incorrect peut empêcher la reconnaissance. Le préampli n’est pas mémorisé ; le son chargé d’un jeu est prioritaire.',
  'help.songs.keywords':
    'per song, song sound, song memory, remember song, save song eq, smart eq, undo, forget this song, preset per song, tone per song',
  'help.mycurves.title': 'Mes courbes : importer, modifier et partager',
  'help.mycurves.intro':
    'Votre collection de courbes côtoie la bibliothèque de mesures. Vérifiez une réponse puis choisissez une couche de correction ou des bandes EQ modifiables.',
  'help.mycurves.steps':
    'Ouvrez EQ Presets → Mes courbes. Recherchez ou triez les courbes enregistrées.\nAjouter une courbe accepte l’EQ actuel, un fichier texte, une mesure ou du texte collé. L’import Squiglink accepte son export EQ. Vérifiez l’aperçu.\nAppliquer comme courbe ajoute une couche sans remplacer vos bandes. Appliquer comme EQ remplace celles de l’oreille choisie après confirmation : les deux, la gauche ou la droite.\nLe menu de la courbe permet de la renommer, modifier ses bandes, la dupliquer, copier son texte ou la supprimer, sans devoir la réimporter.\nExporter et importer la liste transfèrent la collection entre ordinateurs. Conservez le modèle et le nom de l’auteur lorsque vous partagez une mesure.',
  'help.mycurves.tip':
    'Une courbe décrit une réponse en fréquence ; un profil de sortie garde aussi le reste du son de ce périphérique. Vérifiez le modèle et la source avant correction.',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
