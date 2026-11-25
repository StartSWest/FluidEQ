/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'Dynamique : passages faibles et forts',
  'help.dynamics.intro':
    'Dynamique est un compresseur trois bandes : il relève les passages faibles et retient les plus forts sans ajouter de retard. Il convient à la musique, aux films, à la parole et au son d’un jeu.',
  'help.dynamics.steps':
    'Ouvrez DSP → Dynamique, activez l’étage et choisissez un préréglage. Ceux pour les jeux se trouvent dans Gaming Lab.\nLes bandes couvrent le grave sous 150 Hz, le médium de 150 Hz à 4 kHz et l’aigu au-dessus de 4 kHz. Travaillez la bande du son concerné.\nDans Remonter, Sous définit quand relever les sons faibles, Rapport l’intensité et Jusqu’à le gain maximal. À 1:1, rien ne change.\nDans Retenir, Au-dessus de définit quand réduire les sons forts et Rapport avec quelle fermeté. Abaisser le seuil déclenche plus souvent la réduction.\nRéglez Attaque et Relâchement, puis Mélange pour mêler le son original et Compensation pour ajuster le niveau final. Comparez à volume similaire.\nChaque bande a sa propre courbe : le niveau d’entrée à l’horizontale, le niveau de sortie à la verticale. Faites glisser un point creux pour choisir où une remontée ou une retenue commence, et un point plein pour sa force, ou saisissez une valeur exacte dans le tableau dessous. Pendant la lecture, un point suit chaque courbe et montre ce que fait la bande à cet instant. Un avis de mise à jour du moteur peut ne concerner que cet affichage en direct, alors que le son est déjà traité.',
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
    'Le Normalizer change le niveau de la source avant les étages créatifs. Les fichiers de la Bibliothèque peuvent être mesurés en entier ; les autres sons du système sont appris pendant la lecture. Il est à part des chaînes : en choisir une ne le change jamais.',
  'help.normalizer.steps':
    'Ouvrez DSP → Normaliseur et choisissez Désactivé, True Peak ou Sonie. Pour le son externe, la même carte devient Contrôle du niveau en direct, avec Protection des crêtes et Nivellement en direct.\nEn True Peak, réglez le plafond des crêtes. Ce mode baisse une source si ses crêtes dépassent cette limite ; il n’amplifie pas les sources plus faibles.\nEn Sonie, réglez la sonie cible et le plafond des crêtes. La cible concerne les passages de trois secondes les plus forts ; les clips plus courts utilisent la sonie intégrée.\nDans la Bibliothèque, attendez la fin de l’analyse de la source. Consultez la sonie des passages forts, la sonie intégrée et le gain appliqué. La sonie intégrée mesure le morceau entier.\nEn direct, laissez jouer la source pendant son apprentissage et observez le maintien du gain. Un passage plus fort peut faire baisser le gain ; les passages calmes conservent leur niveau relatif.\nAvant d’augmenter la cible, vérifiez le gain appliqué et toute raison de limitation. La marge des crêtes et la limite d’amplification peuvent empêcher de l’atteindre. Comparez à un volume d’écoute similaire : une même cible pour les passages forts ne donne pas une sonie globale identique à tous les morceaux.',
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
  'help.songs.title': 'Égalisation auto : le son de chaque chanson',
  'help.songs.intro':
    'L’Égalisation auto, dans la page Égaliseur, décide du son de chaque chanson : le son enregistré pour la chanson, le son de son album depuis la Bibliothèque, ou le vôtre. La Correction intelligente ajoute par-dessus une correction mesurée. Le son d’une chanson la suit sur chaque sortie ; la correction du casque reste celle de la sortie.',
  'help.songs.steps':
    'Ouvrez l’Égalisation auto, le bouton plein des outils de Votre égaliseur, et activez Sons des chansons, Sons des albums et Correction intelligente comme vous le souhaitez. Chacun se désactive séparément.\nPendant qu’une chanson joue, appuyez sur Enregistrer pour cette chanson pour garder le son que vous entendez. Quand elle rejoue, son son revient ; et quand une chanson sans rien d’enregistré suit, votre propre son revient.\nChangez le préréglage, la tonalité ou une bande pendant qu’une chanson enregistrée joue et vous l’entendez aussitôt. Enregistrer les modifications le garde pour la chanson, et Revenir à l’enregistré remet le son enregistré ; le bouton Enregistrer à côté d’Égalisation auto fait de même sans l’ouvrir. Une modification que vous n’enregistrez pas n’est pas gardée : la prochaine fois, la chanson joue son son enregistré. Une modification sur une chanson sans rien d’enregistré devient votre son.\nDans la Bibliothèque, faites un clic droit sur une chanson, une sélection ou un album, ou utilisez le Son de l’album d’un album, pour choisir un préréglage ou garder ce qui joue maintenant. Le son propre d’une chanson l’emporte sur celui de son album ; les albums ne changent que dans la Bibliothèque.\nGérer liste chaque chanson et chaque album enregistrés, avec Oublier. Réinitialiser tous les réglages désactive l’Égalisation auto et les conserve.\nVos EQ enregistrés sont dans le menu Enregistrer l’EQ, parmi les outils de Votre égaliseur : gardez ce qui joue comme un EQ nommé, mettez à jour celui en place, remettez-en un autre ou ouvrez leur gestion. Un morceau enregistré pendant qu’un EQ enregistré est en place le suit : mettez cet EQ à jour, et le morceau joue la nouvelle version.',
  'help.songs.tip':
    'Les chansons de Spotify, YouTube ou du navigateur sont reconnues par le titre et l’artiste qu’annonce le lecteur, et gardent leurs sons à part de ceux de la Bibliothèque. Les films et les vidéos ne reçoivent jamais le son d’une chanson. L’Égalisation auto se met en retrait tant que le DSP est désactivé, qu’une chaîne Jeux est active ou qu’un jeu joue son propre son.',
  'help.songs.keywords':
    'auto eq, égalisation auto, par chanson, son de chanson, son d’album, mémoriser chanson, enregistrer pour cette chanson, correction intelligente, smart correction, smart eq, préréglage par chanson, préréglage par album, oublier, gérer, morceau, eq enregistré, enregistrer l’eq',
  'help.mycurves.title': 'Mes courbes : importer, modifier et partager',
  'help.mycurves.intro':
    'Votre collection de courbes côtoie la bibliothèque de mesures. Vérifiez une réponse puis choisissez une couche de correction ou des bandes EQ modifiables.',
  'help.mycurves.steps':
    'Ouvrez la page Corrections de casque ; elle s’ouvre sur Mes courbes. Cherchez ou triez la liste pour trouver une courbe enregistrée.\nUtilisez Ajouter une courbe pour votre égalisation actuelle, un fichier texte, un choix de la bibliothèque de mesures ou des données collées, et indiquez pour quelles oreilles elle est. Importer depuis Squiglink accepte son texte d’égalisation exporté. Vérifiez l’aperçu avant d’enregistrer.\nAppliquer comme courbe ajoute une couche de correction et laisse vos bandes modifiables en place. Appliquer comme EQ remplace, après confirmation, les bandes des oreilles pour lesquelles la courbe a été enregistrée.\nLe menu d’une courbe permet de la renommer, de modifier ses bandes, de la dupliquer, de la copier en texte ou de la supprimer. Modifier une courbe enregistrée ne demande pas de refaire l’import.\nExporter la liste et Importer une liste emportent toute la collection d’un ordinateur à l’autre. Précisez l’auteur de la mesure et le modèle quand vous partagez une correction.',
  'help.mycurves.tip':
    'Une courbe décrit une réponse en fréquence ; un profil de sortie garde aussi le reste du son de ce périphérique. Vérifiez le modèle et la source avant correction.',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
