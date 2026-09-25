/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Merci de contribuer',
  'tour.rainbow.title': 'Bienvenue dans le mode arc-en-ciel',
  'tour.rainbow.subtitle': 'Activez-le en un clic',
  'tour.rainbow.lead':
    'Des couleurs arc-en-ciel, des accents lumineux et une bordure qui parcourt le spectre — et un mouvement plus fluide : le graphique, les vumètres et l’onde sont dessinés à la pleine fréquence de votre écran au lieu de trente images par seconde. Votre son ne change jamais.',
  'tour.rainbow.how':
    'Activez-le ici immédiatement, sans atteindre ×10. Votre choix est mémorisé et vous pouvez le désactiver à tout moment. Contribuer est facultatif.',
  'tour.rainbow.enable': 'Activer le mode arc-en-ciel',
  'tour.rainbow.disable': 'Désactiver le mode arc-en-ciel',
  'tour.rainbow.waveform': 'Aperçu de la forme d’onde du haut',
  'tour.rainbow.toggleHint':
    'Cliquez sur le bouton « RAINBOW MODE » au-dessus pour activer ou désactiver le mode.',
  'tour.eyebrow': 'NOUVEAU DANS CETTE VERSION',
  'tour.title': 'Nouveautés de FluidEQ',
  'tour.close': 'Fermer',
  'tour.rail': 'Nouvelles fonctions',
  'tour.stepOf': '{current} sur {total}',
  'tour.back': 'Retour',
  'tour.next': 'Suivant',
  'tour.done': 'Compris',
  'tour.dontShowAgain': 'Ne plus afficher pour cette version',
  'tour.releaseNotes': 'Notes de version complètes',
  'tour.rail.newIn': 'NOUVEAU DANS LA {version}',
  'tour.rail.always': 'AUSSI DANS FLUIDEQ',
  'tour.newBadge': 'NOUVEAU',
  'tour.howTitle': 'Pour commencer',
  'tour.beta': 'Bêta',
  'tour.player.kicker': 'LE LECTEUR COMPACT',
  'tour.player.title': 'FluidEQ, replié en un lecteur',
  'tour.player.subtitle':
    'Un seul interrupteur transforme la fenêtre en lecteur',
  'tour.player.lead':
    'Un seul interrupteur dans la barre de titre transforme la fenêtre en Lecteur compact : le morceau, votre égaliseur, un visualiseur et la file À suivre, dans une seule colonne étroite. Le même interrupteur vous ramène à la page que vous aviez quittée.',
  'tour.player.point1':
    'Tout l’égaliseur est du voyage : préréglages, dispositions de bandes, Mode EQ, Égalisation auto, Graves, Médiums et Aigus.',
  'tour.player.point2':
    'Repliez-le sur une ligne, gardez-le au-dessus des autres fenêtres, ou double-cliquez sur le visualiseur pour passer en plein écran.',
  'tour.player.point3':
    'Son propre thème, Clair ou Sombre, et les morceaux déposés sur À suivre rejoignent la Bibliothèque et la file de lecture.',
  'tour.player.how':
    'Appuyez sur l’interrupteur Lecteur compact dans la barre de titre, à côté d’Aide. Sur le lecteur, le même interrupteur ramène l’application complète.',
  'tour.player.open': 'Essayer le Lecteur compact',
  'tour.player.imageAlt':
    'Le Lecteur compact deux fois, dans son thème Sombre et dans son thème Clair : le morceau et son compteur en haut, l’égaliseur à quinze bandes, À suivre en dessous ; et le même lecteur replié sur une ligne.',
  'tour.games.kicker': 'PRÉRÉGLAGES DE JEU',
  'tour.games.title': 'À chaque jeu, un son bien à lui',
  'tour.games.subtitle': 'Appliqué dès que le jeu passe au premier plan',
  'tour.games.lead':
    'Choisissez une fois pour toutes un son pour chaque jeu. Quand le jeu passe au premier plan, FluidEQ bascule sur ce son et le garde jusqu’à la fermeture du jeu, malgré tous vos Alt+Tab, puis remet ce que vous aviez.',
  'tour.games.point1':
    'Les jeux Steam, Epic Games, EA, GOG, Ubisoft, Battle.net et Xbox, ou tout programme ouvert.',
  'tour.games.point2':
    'Les préréglages Jeux activent le Mode jeu, qui réduit le délai qu’ajoute FluidEQ, et la page affiche ce délai tel qu’il est mesuré.',
  'tour.games.point3':
    'Une carte sur votre Bureau indique sur quoi FluidEQ a basculé, et une autre ce qui est revenu à la fermeture du jeu.',
  'tour.games.how':
    'Dans l’Égaliseur, ouvrez Préréglages de jeu et appuyez sur Ajouter un jeu, puis donnez-lui un son sur sa ligne.',
  'tour.games.open': 'Ouvrir les Préréglages de jeu',
  'tour.games.imageAlt':
    'La page Préréglages de jeu avec quatre jeux, chacun avec un son bien à lui, et les cartes que FluidEQ affiche sur le Bureau quand un jeu passe au premier plan et quand il se ferme.',
  'tour.presets.kicker': 'NOUVEAUX PRÉRÉGLAGES',
  'tour.presets.title': 'Des préréglages qui sonnent comme la musique',
  'tour.presets.subtitle': 'Des chaînes complètes, toutes au même niveau',
  'tour.presets.lead':
    'Chaque préréglage a été mesuré de nouveau et nivelé : en changer modifie le caractère, pas le volume, et chacun s’entend désormais aussi nettement avec le moteur FluidEQ qu’avec Equalizer APO.',
  'tour.presets.point1':
    '{chains} chaînes, dont {styles} styles musicaux, plus des versions Salle de Musique, Cinéma et Jeux.',
  'tour.presets.point2':
    'La courbe d’un préréglage apparaît sur le graphique comme une couche à part, avec une intensité que vous pouvez baisser.',
  'tour.presets.point3':
    'Chaque style s’explique : pointez-en un et ses notes s’ouvrent à côté de la liste.',
  'tour.presets.how':
    'Ouvrez l’Égaliseur et appuyez sur Préréglages, ou choisissez une chaîne en haut du DSP.',
  'tour.presets.open': 'Ouvrir l’Égaliseur',
  'tour.presets.imageAlt':
    'Le sélecteur de préréglages avec Rock choisi et ses notes à côté de la liste : sa courbe aux points numérotés, le rôle de chaque point et le niveau auquel il joue.',
  'tour.tone.kicker': 'RÉGLAGES DE TONALITÉ',
  'tour.tone.title': 'Graves, Médiums et Aigus, comme sur un ampli',
  'tour.tone.subtitle': 'Trois boutons, une courbe à part',
  'tour.tone.lead':
    'Sans bande sélectionnée, Graves, Médiums et Aigus façonnent le son comme une courbe à part, avec un coupe-bas et un coupe-haut de part et d’autre : le moyen le plus rapide de réchauffer un morceau ou de le rendre plus brillant, et chaque bande reste telle que vous l’avez réglée.',
  'tour.tone.point1':
    'L’égaliseur s’ouvre sur toutes ses bandes, sans aucune sélection.',
  'tour.tone.point2':
    'Une nouvelle disposition à vingt bandes, et toutes les dispositions sur les fréquences standard.',
  'tour.tone.point3':
    'La largeur des bandes suit leur espacement : aucun trou entre elles, et jamais deux sur la même note.',
  'tour.tone.how':
    'Ouvrez l’Égaliseur sans sélectionner de bande et tournez Graves, Médiums ou Aigus. Un Ctrl+clic sur un bouton remet son tiers à plat.',
  'tour.tone.open': 'Ouvrir l’Égaliseur',
  'tour.tone.imageAlt':
    'La courbe de l’égaliseur en ses trois tiers (graves, médiums et aigus), les trois boutons qui les déplacent, et les dispositions rapides de six à trente et une bandes.',
  'tour.studio.kicker': 'FLUIDEQ PLUS',
  'tour.studio.title': 'Créez votre propre visualiseur',
  'tour.studio.subtitle': 'Gratuit pendant 15 jours, ou gagnez un mois',
  'tour.studio.lead':
    'Le Studio transforme une idée en une scène qui bouge avec votre musique. Il fait désormais partie de Plus, et un nouveau compte peut l’essayer gratuitement pendant quinze jours, sans carte et sans aucun prélèvement à la fin de l’essai.',
  'tour.studio.point1':
    'Publiez une scène et, une fois qu’elle est approuvée, votre prochain mois de Plus est offert.',
  'tour.studio.point2':
    'Chaque scène de membre est examinée avant d’arriver dans la galerie.',
  'tour.studio.point3':
    'Tout ce que vous aviez créé est conservé, dans le dossier qu’indique le Studio.',
  'tour.studio.how':
    'Ouvrez Plus et choisissez Studio dans sa barre latérale. Sans Plus, la page du Studio propose l’essai gratuit.',
  'tour.studio.open': 'Ouvrir Plus',
  'tour.studio.imageAlt':
    'Une aurore boréale au-dessus des montagnes, créée dans le Studio, l’idée dont elle est née, l’essai de quinze jours et le mois qu’une scène approuvée fait gagner.',
  'tour.studio.idea':
    'Une aurore boréale au-dessus d’un lac de montagne. Les basses font enfler l’aurore et les étoiles scintillent en rythme.',
  'tour.studio.earned': 'Approuvée : le mois prochain offert',
  'tour.help.kicker': 'AIDE',
  'tour.help.title': 'Interrogez le guide avec vos propres mots',
  'tour.help.subtitle': 'Fautes de frappe, pluriels et dix langues',
  'tour.help.lead':
    'Cherchez dans le guide comme vous demanderiez à un ami — « pas de son », « limiteur », « fond d’écran » — dans l’une des dix langues. Le meilleur chapitre arrive en tête, et le guide vous mène à la commande, entourée sur la capture.',
  'tour.help.point1':
    'Il pardonne les fautes de frappe et les pluriels, et connaît les mots de tous les jours.',
  'tour.help.point2':
    'Chaque commande d’une capture est numérotée comme dans un manuel imprimé, et les captures suivent votre thème.',
  'tour.help.point3':
    'F1 l’ouvre de n’importe où, et Entrée passe au résultat suivant.',
  'tour.help.how':
    'Appuyez sur F1, ou ouvrez le livre dans la barre de titre et choisissez Guide utilisateur, puis tapez ce que vous cherchez.',
  'tour.help.open': 'Ouvrir l’Aide',
  'tour.help.imageAlt':
    'Le guide utilisateur interrogé sur « pas de son » : ses chapitres classés, les mots surlignés, et une capture aux commandes numérotées.',
  'tour.help.query': 'pas de son',

  'tour.engine.kicker': 'NOTRE PROPRE MOTEUR AUDIO',
  'tour.engine.title': 'Voici le moteur FluidEQ',
  'tour.engine.subtitle': 'EQ et DSP pour tout ce que vous entendez',
  'tour.engine.lead':
    'FluidEQ a désormais son propre moteur audio. Il tourne dans le service audio de Windows, après les effets de votre carte son, et applique votre EQ et l’ensemble du rack DSP à tout ce que joue l’ordinateur : jeux, navigateurs, applications de streaming — pas seulement la Bibliothèque.',
  'tour.engine.point1':
    'Le rack DSP sur tout l’audio du système, sans rien lancer dans FluidEQ.',
  'tour.engine.point2':
    'Un nivellement en direct qui reconnaît chaque morceau, et le Débruitage, qui nettoie pendant la lecture.',
  'tour.engine.point3':
    'Quittez FluidEQ et votre son redevient normal aussitôt, même après un plantage.',
  'tour.engine.how':
    'Choisissez le moteur FluidEQ à l’installation, ou ouvrez le menu des actions derrière l’icône d’impulsion en haut à droite, appuyez sur la carte du moteur tout en haut, choisissez Moteur FluidEQ et appuyez sur Appliquer. Ouvrez ensuite le DSP et activez un étage pendant la lecture dans n’importe quelle application.',
  'tour.engine.open': 'Ouvrir le DSP',
  'tour.engine.flow.label':
    'Tout ce que joue l’ordinateur passe par le moteur FluidEQ — votre EQ, puis le rack DSP — avant d’arriver à votre casque et à vos enceintes.',
  'tour.engine.flow.games': 'Jeux',
  'tour.engine.flow.browser': 'Navigateurs',
  'tour.engine.flow.music': 'Apps de musique',
  'tour.engine.flow.video': 'Vidéos',
  'tour.engine.flow.inside': 'Dans l’audio de Windows',
  'tour.engine.flow.eq': 'Votre EQ',
  'tour.engine.flow.rack': 'Rack DSP',
  'tour.engine.flow.headphones': 'Casque',
  'tour.engine.flow.speakers': 'Enceintes',

  'tour.room.kicker': 'SURROUND AU CASQUE',
  'tour.room.title': 'Prenez place dans la Salle',
  'tour.room.subtitle': 'Vingt-quatre salles, toutes gratuites',
  'tour.room.lead':
    'La Salle fait de votre casque une salle d’écoute, où chaque canal devient une enceinte autour de vous. Treize nouvelles salles rejoignent les onze classiques, chacune distincte des autres, mesures à l’appui, et tout est gratuit.',
  'tour.room.point1':
    'La stéréo devient deux enceintes devant vous, ou remplit la salle si vous le demandez ; un film 5.1, cinq et le sub ; un jeu 7.1, tout l’anneau.',
  'tour.room.point2':
    'Choisissez une salle sous « À la une », « Salles classiques » ou « Les vôtres » ; tout ce qui compose une salle se trouve sur sa page.',
  'tour.room.point3':
    'Un test d’écoute choisit à l’oreille la tête qui place les sons devant vous, en cinq paires.',
  'tour.room.how':
    'Ouvrez DSP, choisissez Salle dans le rail et activez-la. Choisissez une salle, puis faites glisser une enceinte ou tournez un bouton ; sous Votre tête, appuyez sur Lancer le test d’écoute.',
  'tour.room.open': 'Ouvrir la Salle',
  'tour.room.imageAlt':
    'Une salle vue de dessus : sept enceintes et un sub autour d’une tête au centre, chacune avec son chemin vers les oreilles.',

  'tour.plus.kicker': 'FLUIDEQ PLUS',
  'tour.plus.title': 'Bienvenue dans FluidEQ Plus',
  'tour.plus.subtitle': 'Visualiseurs, Studio, éclairage et plus encore',
  'tour.plus.lead':
    'Un abonnement facultatif qui permet à FluidEQ de continuer à grandir, avec un tout nouvel onglet rien que pour lui : des scènes dessinées par votre carte graphique, un Studio pour créer les vôtres, le classement, des arrière-plans du Bureau et l’éclairage dynamique. L’égaliseur, le rack et les lecteurs restent gratuits, comme ils l’ont toujours été.',
  'tour.plus.point1':
    'Connectez-vous depuis Compte dans le menu des actions ; le paiement se fait dans votre navigateur, et Plus s’active tout seul.',
  'tour.plus.point2':
    'Mensuel ou annuel, avec des conditions en langage clair avant de payer. L’application ne voit jamais votre carte.',
  'tour.plus.point3':
    'Connexion sur cinq ordinateurs au maximum, et de nouveaux visualiseurs ajoutés au fil du temps.',
  'tour.plus.how':
    'Ouvrez l’onglet Plus : Classement, Visualiseurs, Studio et Éclairage dynamique se trouvent sur sa gauche.',
  'tour.plus.open': 'Ouvrir Plus',
  'tour.plus.imageAlt':
    'L’onglet Plus : Classement, Visualiseurs, Studio et Éclairage dynamique sur le côté, et la galerie Visualiseurs avec Chrome, Floraison, Aurore, Alpin et Ville néon.',
  'tour.scene.alpine': 'Alpin',
  'tour.scene.aurora': 'Aurore',
  'tour.scene.bloom': 'Floraison',
  'tour.scene.chrome': 'Chrome',
  'tour.scene.neonCity': 'Ville néon',

  'tour.visualizers.kicker': 'VISUALISEURS',
  'tour.visualizers.title': 'Des scènes qui bougent avec votre musique',
  'tour.visualizers.subtitle': 'Dessinées par votre carte graphique',
  'tour.visualizers.lead':
    'Les visualiseurs Plus sont des scènes vivantes — des montagnes sous les étoiles, des rideaux d’aurore boréale, une ville néon — dessinées par votre carte graphique sous vos courbes d’EQ. Les basses, le rythme et les aigus font chacun bouger quelque chose de différent, et la fenêtre autour d’elles peut prendre leurs couleurs.',
  'tour.visualizers.point1':
    'Un seul sélecteur pour tout : {styles} styles gratuits à façonner et à colorer, et les visualiseurs Plus par catégorie.',
  'tour.visualizers.point2':
    'Parcourez la galerie, essayez dix secondes les scènes d’exemple de FluidEQ et ajoutez celles qui vous plaisent.',
  'tour.visualizers.point3':
    'Changez de style automatiquement, passez en plein écran, et réglez l’attaque et le relâchement d’une scène dans Affichage.',
  'tour.visualizers.how':
    'Sur le graphique, cliquez sur le nom du style et choisissez une scène sous Visualiseurs Plus, ou parcourez-les toutes dans Plus → Visualiseurs.',
  'tour.visualizers.open': 'Ouvrir l’Égaliseur',
  'tour.visualizers.imageAlt':
    'Alpin, un visualiseur Plus montrant des montagnes au-dessus d’un lac de nuit, en lecture sur le graphique sous les courbes d’EQ, avec quatre autres scènes en dessous.',

  'tour.desktop.kicker': 'VISUALISEUR DU BUREAU',
  'tour.desktop.title': 'Votre musique derrière votre Bureau',
  'tour.desktop.subtitle': 'Une scène sur chaque écran',
  'tour.desktop.lead':
    'Placez un visualiseur Plus derrière les icônes du Bureau. Il bouge avec ce que vous écoutez, ou calmement de lui-même, et chaque écran peut afficher sa propre scène.',
  'tour.desktop.point1':
    'Choisissez les écrans sur une carte de votre bureau, chacun avec son propre visualiseur.',
  'tour.desktop.point2':
    'Il se met en pause tant que des fenêtres couvrent l’écran, quand le PC est verrouillé et sur batterie.',
  'tour.desktop.point3':
    'Il revient tout seul au prochain démarrage de FluidEQ.',
  'tour.desktop.how':
    'Avec un visualiseur Plus sur le graphique, appuyez sur le bouton en forme d’écran à côté de son nom, ou choisissez Affichage → Définir comme arrière-plan du Bureau.',
  'tour.desktop.open': 'Ouvrir l’Égaliseur',
  'tour.desktop.imageAlt':
    'Trois écrans, chacun avec un visualiseur Plus — Aurore, Alpin et Ville néon — derrière ses icônes du Bureau et sa barre des tâches.',

  'tour.lighting.kicker': 'ÉCLAIRAGE DYNAMIQUE',
  'tour.lighting.title': 'Votre bureau s’illumine avec la scène',
  'tour.lighting.subtitle': 'Bêta · vos appareils RVB suivent le visualiseur',
  'tour.lighting.lead':
    'Votre clavier, votre souris, votre tapis de souris, votre casque et votre support prennent les couleurs et le rythme du visualiseur Plus affiché sur le graphique, via Windows Dynamic Lighting et Razer Chroma.',
  'tour.lighting.point1':
    'Quatre styles pour chaque visualiseur : Scène, Vague de couleur, Spectre et Onde rythmique.',
  'tour.lighting.point2':
    'Réglez chaque appareil séparément, et choisissez ce qui se passe quand la musique s’arrête.',
  'tour.lighting.point3':
    'Un aperçu en direct dessine votre propre bureau pendant qu’il s’illumine. C’est une bêta : dites-nous comment se comportent vos appareils.',
  'tour.lighting.how':
    'Ouvrez Plus → Éclairage dynamique et activez-le, puis mettez un visualiseur Plus sur le graphique.',
  'tour.lighting.open': 'Ouvrir Plus',
  'tour.lighting.imageAlt':
    'Un clavier, une souris et un tapis de souris éclairés aux tons rose, violet et cyan de Ville néon.',

  'tour.theme.kicker': 'UN NOUVEAU LOOK',
  'tour.theme.title': 'Voici le thème Sombre',
  'tour.theme.subtitle':
    'Quasi noir, pour les nuits tardives et les écrans OLED',
  'tour.theme.lead':
    'FluidEQ a désormais un second visage. Sombre efface toute trace du bleu ardoise d’origine : panneaux, menus et barres passent en monochrome, l’accent reste, et le spectre est la seule couleur de la pièce.',
  'tour.theme.point1':
    'Fonds quasi noirs : sur un écran OLED, l’espace autour du graphique est presque éteint.',
  'tour.theme.point2':
    'Toutes les pages suivent : menus, boîtes de dialogue, la scène karaoké et la Bibliothèque changent ensemble. Le Lecteur compact garde son propre thème.',
  'tour.theme.point3':
    'Votre couleur d’accent et le mode arc-en-ciel sont conservés. Rien ne change dans votre son : seule la peinture.',
  'tour.theme.howTitle': 'Comment changer',
  'tour.theme.how':
    'Ouvrez le menu derrière l’icône d’impulsion en haut à droite et choisissez Sombre à côté de Thème, dans les réglages au bas du menu. Clair reste à un clic si vous voulez revenir.',
  'tour.theme.tryBlack': 'Passer en Sombre maintenant',
  'tour.theme.tryOcean': 'Revenir à Clair',
  'tour.theme.imageAlt':
    'FluidEQ en thème Sombre : l’onglet Égaliseur avec quinze bandes et le spectre en direct pendant la lecture d’un morceau.',

  'tour.share.kicker': 'ÉCOUTEZ TOUS VOS PC',
  'tour.share.title': 'Partagez l’audio entre vos ordinateurs',
  'tour.share.subtitle': 'Un casque, toutes les machines de votre bureau',
  'tour.share.lead':
    'Votre PC de jeu, votre portable de travail et votre boîtier multimédia jouent tous dans le casque que vous portez : sur votre propre réseau, sans perte, chiffré, et à travers l’EQ que vous avez déjà réglé.',
  'tour.share.receiverLabel': 'RÉCEPTEUR',
  'tour.share.receiverName': 'Le PC avec votre casque',
  'tour.share.senderLabel': 'ÉMETTEURS',
  'tour.share.senderName': 'Tous les autres ordinateurs',
  'tour.share.wireLabel': 'Sans perte · Chiffré · LAN privé',
  'tour.share.stepsTitle': 'Configurez-le en trois étapes',
  'tour.share.step1Title': 'Sur le PC du casque, créez un code',
  'tour.share.step1':
    'Ouvrez l’onglet Partager l’audio, choisissez « Lire le son sur cet ordinateur » et appuyez sur « Créer le code de connexion ». Copiez le code de votre réseau.',
  'tour.share.step2Title': 'Sur chaque autre PC, collez-le',
  'tour.share.step2':
    'Ouvrez FluidEQ là-bas, allez dans Partager l’audio, choisissez « Envoyer le son de cet ordinateur », collez le code et appuyez sur « Connecter et envoyer ». Son audio système commence à circuler, intact : les effets s’appliquent sur l’ordinateur où vous écoutez.',
  'tour.share.step3Title': 'Écoutez, puis réglez le niveau',
  'tour.share.step3':
    'Chaque émetteur joue avec un tampon court qui rattrape son retard tout seul après un accroc. Tous les émetteurs sont mixés dans la sortie du récepteur et façonnés par son EQ. La barre de lecture du récepteur affiche le morceau du dernier émetteur, et ses boutons agissent à travers le réseau.',
  'tour.share.fact1Title': 'Sans perte',
  'tour.share.fact1':
    'PCM Float32 de bout en bout. Aucun codec, aucune perte de génération.',
  'tour.share.fact2Title': 'Chiffré',
  'tour.share.fact2':
    'AES-256-GCM sur chaque paquet. Le code est la clé ; sans lui, personne ne peut écouter.',
  'tour.share.fact3Title': 'Appairage conservé',
  'tour.share.fact3':
    'L’appairage survit aux fermetures et aux redémarrages. Seule la création d’un nouveau code le déconnecte.',
  'tour.share.tip':
    'Commencez doucement : plusieurs ordinateurs s’additionnent vite. Baissez le volume du casque avant la première connexion.',
  'tour.share.open': 'Ouvrir Partager l’audio',

  'tour.library.kicker': 'VOTRE MUSIQUE, VOTRE LECTEUR',
  'tour.library.title': 'Une Bibliothèque pour la musique que vous possédez',
  'tour.library.subtitle': 'Des dossiers en entrée, des albums en sortie',
  'tour.library.lead':
    'Indiquez un dossier à FluidEQ : il lit chaque morceau et chaque vidéo qu’il contient, tags et pochettes compris, et en fait une collection à parcourir par album, artiste, genre, titre ou dossier. La lecture passe par le lecteur de FluidEQ, donc l’EQ et le rack DSP sont toujours sur le chemin.',
  'tour.library.point1':
    'Trois façons de voir la même étagère : liste, grille et cover flow, avec un saut à la lettre pour les grandes collections.',
  'tour.library.point2':
    'Une file « À suivre » avec « Continuer la lecture », qui enchaîne sur le même genre quand la liste est épuisée.',
  'tour.library.point3':
    'Des playlists et une liste Favoris permanente. Clic droit sur un morceau pour l’ajouter à l’une ou l’autre, ou à la file.',
  'tour.library.point4':
    'Mémoire de l’Égalisation auto par morceau : tant qu’elle continue de mesurer, activez « Enregistrer pour cette chanson » ; au bout de deux minutes, sa correction est retenue pour ce titre et revient quand il repasse.',
  'tour.library.how':
    'Ouvrez l’onglet Bibliothèque, appuyez sur « Ajouter un dossier » ou déposez un dossier sur la page, et laissez l’analyse se terminer. Choisissez Albums, Artistes, Genres, Chansons, Dossiers ou Arborescence, puis appuyez sur Lire.',
  'tour.library.open': 'Ouvrir la Bibliothèque',

  'tour.dsp.kicker': 'UN RACK DE MASTERING',
  'tour.dsp.title': 'Le rack DSP',
  'tour.dsp.subtitle': 'Dix étages, chacun sur sa propre page',
  'tour.dsp.lead':
    'Un rack d’étages de studio : Normaliseur, Débruitage, Exciteur, Forge de basses, Égaliseur, Punch des basses, Dimension, Salle, Maximiseur et Master, plus un fondu enchaîné entre les pistes de la Bibliothèque. Avec le moteur FluidEQ, il agit sur tout ce que joue l’ordinateur ; avec Equalizer APO, sur la Bibliothèque. Chaque étage a sa propre page avec une vue en direct, la plupart ont des préréglages, et cinq ont un interrupteur Isoler pour n’entendre que ce qu’ils font.',
  'tour.dsp.point1':
    'Débruitage répare le souffle, le ronflement et les craquements pendant la lecture, et un nettoyeur de voix neuronal agit sur les pistes de la Bibliothèque.',
  'tour.dsp.point2':
    'Forge de basses ajoute une vraie octave sous la basse ; Punch des basses en façonne l’attaque, le maintien et l’éclosion, avec un Mix jusqu’à 200 %.',
  'tour.dsp.point3':
    'Un Égaliseur paramétrique de 6 à 31 bandes, quinze au départ, phase minimale ou linéaire, mid/side, suréchantillonnage et plus d’une centaine de préréglages nommés.',
  'tour.dsp.point4':
    'Un Master avec cible de sonie LUFS et sécurité de crête vraie, des préréglages de livraison du Streaming au Vinyle, et une Compensation de gain pour comparer le son, pas le volume.',
  'tour.dsp.how':
    'Ouvrez l’onglet DSP, choisissez une chaîne sous Préréglages, puis cliquez sur un étage dans les onglets latéraux et activez-le. Avec Equalizer APO, lancez d’abord une piste depuis la Bibliothèque.',
  'tour.dsp.open': 'Ouvrir le DSP',

  'tour.output.kicker': 'JOUE À DEUX ENDROITS',
  'tour.output.title': 'Profils de la deuxième sortie',
  'tour.output.subtitle':
    'Casque et enceintes en même temps, chacun avec son profil',
  'tour.output.lead':
    'Écoutez au casque et sur les enceintes avec des égalisations séparées. La deuxième sortie reçoit le son avant l’égalisation de la sortie principale, puis applique son propre profil enregistré. Aucun pilote de routage nécessaire.',
  'tour.output.point1':
    'Activez un autre appareil dans Deuxième sortie et réglez son volume.',
  'tour.output.point2':
    'Choisissez un profil enregistré avec le sélecteur de profil d’égalisation sous cet appareil. La sortie principale garde ses réglages.',
  'tour.output.point3':
    'Un seul lecteur : lancer quelque chose dans FluidEQ met le reste de la machine en pause, et inversement.',
  'tour.output.point4':
    'Jeu/Vidéo démarre avec environ 30 ms de réserve et se resynchronise après une interruption ; Musique démarre avec environ 100 ms pour une écoute plus fluide. Le tampon de l’appareil ajoute du retard.',
  'tour.output.how':
    'Ouvrez l’onglet Égaliseur puis Deuxième sortie à droite. Activez un appareil, choisissez son profil sous son nom, réglez le volume et sélectionnez Jeu/Vidéo ou Musique.',
  'tour.output.open': 'Ouvrir l’Égaliseur',
  'tour.output.imageAlt':
    'Le panneau Deuxième sortie avec un BlackShark V2 Pro activé, son sélecteur de profil, son volume et les modes Jeu/Vidéo et Musique.',

  'tour.looks.kicker': 'VOTRE PROPRE VISUALISEUR',
  'tour.looks.title': 'Des styles à vous pour le graphique',
  'tour.looks.subtitle': 'Vos formes, vos couleurs, votre mouvement',
  'tour.looks.lead':
    'Le spectre sous l’EQ se dessine comme vous voulez. Choisissez une des {forms} formes, des barres LED et néon aux terrasses, aux silhouettes de villes et aux tours de verre ; colorez-la avec sa propre coloration Auto, par fréquence, par niveau ou par chaleur ; réglez la vitesse d’attaque et la durée de maintien d’un pic ; marquez les pics d’étincelles, de comètes ou d’ondes. Enregistrez-le comme style à vous, et partagez-le en fichier.',
  'tour.looks.point1':
    '{forms} formes, chacune avec ses réglages : éléments, écart, remplissage, épaisseur, et remplie ou en contour.',
  'tour.looks.point2':
    'Colorez chaque forme avec sa propre coloration Auto, par fréquence, niveau ou chaleur avec un dégradé de vos propres couleurs, ou d’une seule couleur uniforme.',
  'tour.looks.point3':
    'Attaque et relâchement fixent le mouvement ; les pics lumineux, les crêtes remplies et douze marques de pic décident de l’allure d’un coup.',
  'tour.looks.point4':
    'La lueur fonctionne dans tous les modes, et le mode arc-en-ciel ajoute une bordure qui parcourt toute la roue des couleurs. Les styles s’exportent en fichier et s’importent depuis un fichier.',
  'tour.looks.how':
    'Dans l’onglet Égaliseur, appuyez sur « Nouveau style » dans la barre du graphique. Choisissez une forme avec le sélecteur ou appuyez sur Espace pour les faire défiler, réglez couleurs et mouvement pendant que la musique joue, puis Enregistrer.',
  'tour.looks.open': 'Ouvrir l’Égaliseur',

  'tour.karaoke.kicker': 'UNE SCÈNE À LA MAISON',
  'tour.karaoke.title': 'Le karaoké avec guide de hauteur',
  'tour.karaoke.subtitle': 'Vos chansons, vos paroles, votre micro',
  'tour.karaoke.lead':
    'Déposez une chanson avec ou sans fichier de paroles : FluidEQ les associe dans une playlist, affiche les paroles synchronisées sur la pochette ou la vidéo, écoute votre micro et trace votre hauteur face à la mélodie. Tout reste sur cet ordinateur ; le micro n’est jamais enregistré ni rejoué.',
  'tour.karaoke.point1':
    'Un curseur Voix témoin, une fois que FluidEQ a séparé la voix du morceau dans le Créateur : il va de l’accompagnement seul à l’original complet, sans fichier instrumental.',
  'tour.karaoke.point2':
    'Un suivi de justesse : les notes de la chanson en blocs et votre voix en ligne vivante par-dessus, avec retour Trop haut, Juste et Trop bas.',
  'tour.karaoke.point3':
    'Un bilan de performance à la fin, avec les passages à travailler et un décompte pour recommencer.',
  'tour.karaoke.point4':
    'Lit LRC, LRC enrichi avec synchronisation par mot et UltraStar avec syllabes et hauteur, sur MP3, FLAC, WAV, OGG, M4A et plus. Paroles traduites et accords de guitare estimés en prime.',
  'tour.karaoke.how':
    'Ouvrez l’onglet Karaoké, appuyez sur « Ouvrir une chanson » ou « Ajouter un dossier », choisissez une piste dans la playlist, activez le micro, affichez le guide de hauteur et appuyez sur Lire.',
  'tour.karaoke.open': 'Ouvrir le Karaoké',

  'tour.maker.kicker': 'CRÉEZ LE VÔTRE',
  'tour.maker.title': 'Le Créateur de karaoké',
  'tour.maker.subtitle': 'N’importe quelle chanson devient un fichier karaoké',
  'tour.maker.lead':
    'Un vrai studio d’édition dans l’onglet Karaoké. Il peut tout faire seul : séparer la voix de la musique, lire les mots et leur calage avec un modèle de parole local, et détecter les notes de la mélodie. Ou vous tapez, enregistrez et dessinez chaque calage à la main sur une timeline zoomable. Tout tourne sur cet ordinateur.',
  'tour.maker.point1':
    '« Préparer ce morceau automatiquement » : séparer la voix, puis lire les mots et le calage, avec l’option de continuer en arrière-plan.',
  'tour.maker.point2':
    'Gardez les pistes séparées : la voix et l’accompagnement, chacune enregistrable, y compris en MP3.',
  'tour.maker.point3':
    'Des outils manuels pour les détails : caler les mots, enregistrer les débuts de lignes, un inspecteur de mot avec début et durée, et couper un mot en syllabes.',
  'tour.maker.point4':
    'Peignez la mélodie sur une grille de hauteur, marquez les notes dorées, puis exportez en projet FluidEQ, UltraStar TXT, LRC, LRC enrichi ou accompagnement seul.',
  'tour.maker.how':
    'Dans Karaoké, chargez une chanson et appuyez sur « Créer ». Acceptez « Préparer automatiquement » dans l’assistant, corrigez les mots sur la timeline, puis « Utiliser dans le lecteur » et « Exporter ».',
  'tour.maker.open': 'Ouvrir le Karaoké',

  'tour.media.kicker': 'LE WEB, À TRAVERS VOTRE EQ',
  'tour.media.title': 'Médias en ligne',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch et Suno',
  'tour.media.lead':
    'Un lecteur intégré pour les sites de streaming, pour que ce que vous regardez et écoutez en ligne passe par votre EQ plutôt que par un autre navigateur. Cinq sites sont câblés, chacun avec sa recherche, et les liens qui mènent ailleurs sont retenus avec le choix « Ouvrir dans le navigateur ».',
  'tour.media.point1':
    'Un seul champ de recherche qui interroge le site ouvert, avec des recherches récentes que vous pouvez effacer.',
  'tour.media.point2':
    'Connectez-vous une seule fois : le lecteur garde vos connexions d’une visite à l’autre, jusqu’à ce que vous vous déconnectiez.',
  'tour.media.point3':
    'Reprise : le lecteur retient la dernière page et l’endroit où vous en étiez, et vous y ramène.',
  'tour.media.point4':
    'Des téléchargements avec pastille de progression et « Afficher dans le dossier » à la fin, et un bouton de déconnexion — la porte au bout de la barre d’outils — qui efface chaque cookie et connexion d’un coup.',
  'tour.media.how':
    'Ouvrez l’onglet Médias en ligne, choisissez un site dans la rangée du haut, tapez dans le champ de recherche et appuyez sur Rechercher. Précédent, Suivant et Actualiser fonctionnent comme dans un navigateur.',
  'tour.media.open': 'Ouvrir Médias en ligne',
};

export default tour;
