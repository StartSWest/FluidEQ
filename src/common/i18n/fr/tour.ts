/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Merci de contribuer',
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
    'Un interrupteur dans la barre de titre replie tout FluidEQ en un lecteur. C’est l’ampli classique, avec son horloge LED, ses voyants et l’égaliseur complet ; en mode {backdrop}, sur un visualiseur Plus, il devient de verre. Le même interrupteur vous ramène à la page que vous aviez quittée.',
  'tour.player.point1':
    'Tout l’égaliseur est du voyage : préréglages, dispositions de bandes, Mode EQ, Égalisation auto, Graves, Médiums et Aigus.',
  'tour.player.point2':
    'Repliez-le sur une ligne, gardez-le au-dessus des autres fenêtres, ou double-cliquez sur le visualiseur pour passer en plein écran.',
  'tour.player.point3':
    'Son propre thème, et les morceaux déposés sur À suivre rejoignent la Bibliothèque et la file de lecture.',
  'tour.player.how':
    'Appuyez sur l’interrupteur Lecteur compact dans la barre de titre, à côté d’Aide. Sur le lecteur, le même interrupteur ramène l’application complète.',
  'tour.player.open': 'Essayer le Lecteur compact',
  'tour.player.imageAlt':
    'Le coin de la barre de titre avec l’interrupteur {player} entouré, et les deux lecteurs qu’il ouvre : l’ampli classique avec son horloge LED, ses voyants, son égaliseur et sa file d’attente, et le lecteur de verre, plus large, sur une aurore en mode {backdrop}.',
  'tour.player.classic': 'Ampli classique',
  'tour.player.glass': 'Verre, en mode {backdrop}',
  'tour.look.kicker': 'UNE NOUVELLE APPARENCE',
  'tour.look.title': 'Une nouvelle fenêtre, de nouvelles couleurs',
  'tour.look.subtitle':
    'Un seul curseur de thème, et un visualiseur derrière tout',
  'tour.look.lead':
    'Les panneaux reposent sur un seul plan ouvert, aux couleurs de la nouvelle icône, et un seul curseur, {brightness}, fait passer toute la fenêtre du presque noir à un bleu océan clair. Avec un visualiseur Plus sur le graphique, la fenêtre peut prendre ses couleurs, ou le laisser jouer derrière tout.',
  'tour.look.point1':
    '{brightness} se trouve dans le menu derrière l’icône d’impulsion, et à côté de {transparency} dans {windowColours}.',
  'tour.look.point2':
    '{windowColours} propose {original}, {colours}, {ambient} et {backdrop}, chacun avec une ligne sur ce qu’il fait à la fenêtre.',
  'tour.look.point3':
    'Les boîtes de dialogue et les menus partagent une même matière, et le {rainbow} parcourt les couleurs de l’icône, ou celles d’un visualiseur.',
  'tour.look.how':
    'Déplacez {brightness} dans le menu des actions derrière l’icône d’impulsion en haut à droite. Avec un visualiseur Plus sur le graphique, ouvrez {windowColours} depuis la barre du graphique et choisissez {backdrop}.',
  'tour.look.open': 'Ouvrir l’Égaliseur',
  'tour.look.imageAlt':
    'FluidEQ dans ses propres couleurs sur la page Égaliseur, l’Analyseur dessinant un morceau sous les courbes, et le menu derrière l’icône d’impulsion ouvert au-dessus de son coin, avec la Luminosité à moitié et le Mode arc-en-ciel activé.',
  'tour.gpu.kicker': 'UN NOUVEAU MOTEUR DE VISUALISEURS',
  'tour.gpu.title': 'Tous les visualiseurs sur votre carte graphique',
  'tour.gpu.subtitle':
    'Quarante styles au rythme de votre écran, et des mondes 3D',
  'tour.gpu.lead':
    'Les quarante styles du graphique s’affichent désormais avec le moteur des scènes Plus : sur votre carte graphique, à la fréquence de rafraîchissement de votre écran, si bien que barres, particules et crêtes glissent là où elles sautaient. Et un visualiseur Plus peut désormais être un vrai monde 3D.',
  'tour.gpu.point1':
    'Dix-huit nouveaux styles dans {scenes}, dont {synthwave}, {horizon}, {towers} et {ledwall} ; un style sans couleurs propres prend celles de la fenêtre.',
  'tour.gpu.point2':
    'Les mondes 3D marchent sur la grosse caisse, ondulent avec la caisse claire, bondissent au drop et passent de la nuit au jour avec {brightness} ; faites-en glisser un pour le voir sous un autre angle.',
  'tour.gpu.point3':
    'Changer de style fond l’un dans l’autre, et un monde 3D rend sa mémoire graphique tant que la fenêtre est couverte.',
  'tour.gpu.how':
    'Cliquez sur le nom du style sur le graphique et choisissez-en un dans {scenes}.',
  'tour.gpu.open': 'Ouvrir l’Égaliseur',
  'tour.gpu.imageAlt':
    'Un visualiseur Plus qui est une ville 3D de nuit, et quatre nouveaux styles photographiés sur le graphique — {synthwave}, {horizon}, {towers} et {ledwall} — avec le sélecteur de styles entouré sur le premier.',
  'tour.gpu.world': 'Monde 3D',
  'tour.sparks.kicker': 'ÉTINCELLES DU POINTEUR',
  'tour.sparks.title': 'Des visualiseurs qui répondent à votre souris',
  'tour.sparks.subtitle': 'Étincelles, pétales ou neige au bout du pointeur',
  'tour.sparks.lead':
    'Passez la souris sur un visualiseur Plus et il lance ce dont il est fait — étincelles, pétales, neige, braises — en traînée derrière le pointeur, et éclate là où vous cliquez. En modes {ambient} et {backdrop}, ses oiseaux, pétales et lumières flottent aussi sur toute la fenêtre.',
  'tour.sparks.point1':
    'Chaque visualiseur lance les siens : de la neige pour une scène d’hiver, des braises pour un feu de camp, des pétales pour un jardin.',
  'tour.sparks.point2':
    'La scène du Studio les montre toujours, pour que le créateur d’une scène façonne ce qu’elle lance.',
  'tour.sparks.point3':
    'Un seul interrupteur pour tous les visualiseurs : {sparks}, dans {windowColours} sous {rainbow}.',
  'tour.sparks.how':
    'Avec un visualiseur Plus sur le graphique, passez la souris dessus et cliquez. {sparks} se trouve dans {windowColours}, sous {rainbow}.',
  'tour.sparks.open': 'Ouvrir l’Égaliseur',
  'tour.sparks.imageAlt':
    'Un visualiseur d’aurore avec une traînée d’étincelles lumineuses derrière le pointeur et une gerbe là où il a cliqué, et {windowColours} avec son interrupteur {sparks} entouré.',
  'tour.sound.kicker': 'LE MOTEUR FLUIDEQ',
  'tour.sound.title': 'Le son exactement tel que vous l’avez dessiné',
  'tour.sound.subtitle':
    'Aigus fidèles, changements sans clic, niveau en un pas',
  'tour.sound.lead':
    'Sur le moteur FluidEQ, votre courbe joue désormais exactement comme dessinée jusqu’à 20 kHz, chaque changement se fond au lieu de cliquer, et {autoNormalize} trouve le niveau d’une nouvelle courbe en un seul pas. La façon de construire les aigus, c’est vous qui la choisissez : {precise} ou {classic}.',
  'tour.sound.point1':
    '{precise} construit chaque bande comme dessinée ; sur une sortie à 48 kHz, les aigus arrivaient 3,8 dB trop bas à 20 kHz. {classic} les construit comme Equalizer APO, et comme AutoEQ règle une correction.',
  'tour.sound.point2':
    'Les préréglages se fondent en changeant : 534 changements sur 636 crépitaient, et désormais aucun ne dépasse −80 dBFS.',
  'tour.sound.point3':
    'Chaque réglage s’entend au moment même où vous le faites, puis {autoNormalize} rejoint son niveau en un seul pas, calculé sur les dix dernières secondes de musique.',
  'tour.sound.how':
    'Ouvrez l’Égaliseur et appuyez sur {eqMode}. Sous {treble}, choisissez {precise} ou {classic}, séparément pour votre EQ et pour les corrections.',
  'tour.sound.open': 'Ouvrir l’Égaliseur',
  'tour.sound.imageAlt':
    'Le menu {eqMode} ouvert sous son bouton avec {treble} sur {precise} ; une courbe d’aigus que {precise} joue comme dessinée et {classic} 3,8 dB trop bas à 20 kHz sur une sortie à 48 kHz ; et le son au-dessus de 5 kHz pendant un changement de préréglage : un clic à −26 dBFS avant la 2.0, rien au-dessus de −80 dBFS désormais.',
  'tour.sound.trebleChart': 'Aigus, de 1 à 20 kHz',
  'tour.sound.switchChart': 'Au-dessus de 5 kHz, pendant un changement',
  'tour.sound.before': 'Avant la 2.0',
  'tour.sound.now': '2.0',
  'tour.graph.kicker': 'VUES DE STUDIO',
  'tour.graph.title': 'Un graphique qui lit le son comme un studio',
  'tour.graph.subtitle': 'Douze vues, un analyseur sur 80 dB',
  'tour.graph.lead':
    'Le graphique mesure ce qui joue comme les analyseurs de studio : douze vues, du spectrogramme et de la cascade à la stéréo, au volume perçu et à la phase, sur des échelles qui restent immobiles pendant que la musique bouge.',
  'tour.graph.point1':
    '{analyzer}, {spectrogram}, {rta}, {waterfall}, {scope} et sept autres, sous {analysis} dans le sélecteur de styles.',
  'tour.graph.point2':
    'Le son en direct est tracé sur 80 dB de profondeur et jusqu’à 10 Hz, un douzième d’octave par point, pour qu’un son pur se lise à son vrai niveau.',
  'tour.graph.point3':
    'Votre égaliseur garde ses ±20 dB, avec de la marge aux bords pour une courbe qui va plus loin, et les fréquences sont notées 10, 20, 50, 100, comme les impriment les analyseurs.',
  'tour.graph.how':
    'Sur le graphique, cliquez sur le nom du style et choisissez une vue sous {analysis}. Double-cliquez sur le graphique pour remplir l’écran ; Ctrl+G affiche ou masque la grille.',
  'tour.graph.open': 'Ouvrir l’Égaliseur',
  'tour.graph.imageAlt':
    'L’Analyseur du graphique sur un morceau en cours : le spectre en direct sur 80 dB avec ses crêtes au-dessus, les courbes de l’égaliseur par-dessus, et dans le coin la liste des vues sous Analyse.',

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
    'Trois moments sur le bureau : un jeu au premier plan avec la carte de FluidEQ annonçant que son son est chargé, le même jeu réduit avec son son toujours actif, et le jeu fermé avec la carte annonçant le retour du son d’avant.',
  'tour.games.stepFront': 'Au premier plan : son son se charge',
  'tour.games.stepAway': 'Réduit ou quitté par Alt+Tab : son son reste',
  'tour.games.stepClosed': 'Fermé : votre son revient',
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
  'tour.studio.subtitle': 'Gratuit pour tous les comptes',
  'tour.studio.lead':
    'Le Studio transforme une idée en une scène qui bouge avec votre musique. Il est gratuit pour tous les comptes : créez, exportez et publiez autant de scènes que vous voulez.',
  'tour.studio.point1':
    'Chaque scène est relue avant d’arriver dans la galerie, et une fois approuvée elle joue partout pour vous, gratuitement.',
  'tour.studio.point2':
    'Les scènes peuvent être de vrais mondes en 3D qui marchent sur la grosse caisse et bondissent au drop.',
  'tour.studio.point3':
    'Copiez le prompt pour l’IA, et votre assistant IA peut voir votre scène et entendre comment le morceau évolue.',
  'tour.studio.how': 'Ouvrez Plus et choisissez Studio dans sa barre latérale.',
  'tour.studio.open': 'Ouvrir Plus',
  'tour.studio.imageAlt':
    'Le Studio avec Alpine sur sa scène, un lac sous des sommets enneigés et une aurore, les trois étapes pour créer une scène avec votre IA en dessous, et deux notes : gratuit pour tous les comptes, et une scène publiée joue gratuitement pour son créateur.',
  'tour.studio.earned': 'Publiée : joue gratuitement pour vous',
  'tour.help.kicker': 'AIDE',
  'tour.help.title': 'Interrogez le guide avec vos propres mots',
  'tour.help.subtitle': 'Fautes de frappe, pluriels et dix langues',
  'tour.help.lead':
    'Cherchez dans le guide comme vous demanderiez à un ami — « pas de son », « limiteur », « fond d’écran » — dans l’une des dix langues. Le meilleur chapitre arrive en tête, et le guide vous mène à la commande, entourée sur la capture.',
  'tour.help.point1':
    'Il pardonne les fautes de frappe et les pluriels, et connaît les mots de tous les jours.',
  'tour.help.point2':
    'Chaque commande d’une capture est numérotée, comme dans un manuel imprimé.',
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
  'tour.plus.title': 'Des scènes à vous pour de bon',
  'tour.plus.subtitle': 'Visualiseurs, Studio, éclairage et plus encore',
  'tour.plus.lead':
    'Un onglet entier d’extras qui fait grandir FluidEQ : des scènes dessinées sur votre carte graphique, un Studio pour créer les vôtres, des fonds de Bureau et l’Éclairage dynamique. Une scène coûte un crédit et vous reste, et l’égaliseur, le rack et les lecteurs restent gratuits, comme toujours.',
  'tour.plus.point1':
    'Connectez-vous depuis Compte dans le menu des actions : un compte confirmé reçoit des crédits gratuits pour commencer.',
  'tour.plus.point2':
    'Les packs de crédits se paient une seule fois, avec des conditions en mots simples avant de payer. Rien ne se renouvelle, et l’application ne voit jamais votre carte.',
  'tour.plus.point3':
    'Chaque scène peut être regardée d’abord, et celles que vous obtenez jouent sur chaque ordinateur où vous vous connectez.',
  'tour.plus.how':
    'Ouvrez l’onglet Plus : Visualiseurs, Studio et Éclairage dynamique se trouvent sur sa gauche.',
  'tour.plus.open': 'Ouvrir Plus',
  'tour.plus.imageAlt':
    'L’onglet Plus : Visualiseurs, Studio et Éclairage dynamique sur le côté, et la galerie Visualiseurs avec Chrome, Floraison, Aurore, Alpin et Ville néon.',
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

  'tour.share.kicker': 'CHAQUE PC, DANS LES DEUX SENS',
  'tour.share.title': 'Partagez l’audio entre vos ordinateurs',
  'tour.share.subtitle':
    'Entendez les deux ordinateurs, où que vous soyez assis',
  'tour.share.lead':
    'Votre PC de jeu et votre portable jouent l’un dans l’autre : quel que soit celui devant lequel vous êtes, vous entendez les deux — sur votre propre réseau, sans perte, chiffré, et à travers l’EQ que vous avez réglé sur cet ordinateur.',
  'tour.share.pairLabel': 'DANS LES DEUX SENS',
  'tour.share.pairName': 'Chaque ordinateur joue le son de l’autre',
  'tour.share.wireLabel': 'Sans perte · Chiffré · LAN privé',
  'tour.share.stepsTitle': 'Configurez-le en trois étapes',
  'tour.share.step1Title': 'Sur un ordinateur, copiez son code',
  'tour.share.step1':
    'Ouvrez l’onglet Partager l’audio et appuyez sur « Copier le code ». Le code reste le même à chaque fois.',
  'tour.share.step2Title': 'Sur l’autre, collez-le et reliez',
  'tour.share.step2':
    'Ouvrez Partager l’audio sur l’autre ordinateur, collez le code sous « Code de l’autre ordinateur » et appuyez sur « Relier ». Les deux se jouent aussitôt l’un l’autre, intacts : chacun applique son propre EQ à ce qu’il entend.',
  'tour.share.step3Title': 'Choisissez ce qui va où',
  'tour.share.step3':
    'Chaque ordinateur relié a deux interrupteurs, « Le jouer ici » et « Envoyer mon son » : coupez-en un pour un seul sens. La barre affiche le morceau de l’autre ordinateur et le pilote à distance. Un curseur à côté de « Le jouer ici » règle son volume, et « Pause » arrête les deux sens jusqu’à « Reprendre ».',
  'tour.share.fact1Title': 'Sans perte',
  'tour.share.fact1':
    'PCM Float32 de bout en bout. Aucun codec, aucune perte de génération.',
  'tour.share.fact2Title': 'Chiffré',
  'tour.share.fact2':
    'AES-256-GCM sur chaque paquet. Le code est la clé ; sans lui, personne ne peut écouter.',
  'tour.share.fact3Title': 'Reste relié',
  'tour.share.fact3':
    'La liaison survit à la fermeture de l’app et aux redémarrages, d’un côté comme de l’autre. Seul « Délier » y met fin.',
  'tour.share.tip':
    'Commencez doucement : deux ordinateurs qui jouent en même temps s’additionnent. Baissez le volume avant la première liaison.',
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
    'Choisissez un de ses profils enregistrés sous l’appareil, ou appuyez sur {editSound} à côté pour modifier son son sans changer de sortie principale. La sortie principale garde ses réglages.',
  'tour.output.point3':
    'Un seul lecteur : lancer quelque chose dans FluidEQ met le reste de la machine en pause, et inversement.',
  'tour.output.point4':
    'Chaque sortie suit le rythme toute seule : environ 30 ms de retard au départ, un peu plus seulement après une coupure, et son retard affiché en millisecondes — y compris le son d’un autre ordinateur quand Partager l’audio le joue ici.',
  'tour.output.how':
    'Ouvrez l’onglet Égaliseur puis Deuxième sortie à droite. Activez un appareil, choisissez son profil sous son nom et réglez le volume ; son retard s’affiche en dessous.',
  'tour.output.open': 'Ouvrir l’Égaliseur',
  'tour.output.imageAlt':
    'Le panneau Deuxième sortie avec un BlackShark V2 Pro activé, son sélecteur de profil, son volume et son retard.',

  'tour.outputs.kicker': 'CHAQUE SORTIE SE SOUVIENT',
  'tour.outputs.title': 'Chaque sortie garde son propre son',
  'tour.outputs.subtitle': 'Casque et enceintes, chacun réglé à sa façon',
  'tour.outputs.lead':
    'Passez du casque aux enceintes et chaque sortie ramène son son avec elle : l’égaliseur, le préréglage, la Tonalité, les filtres, le rack DSP, la Salle et le nivellement sont gardés avec chaque sortie.',
  'tour.outputs.point1':
    'Choisissez une sortie et tout ce que vous avez réglé pour elle revient aussitôt. Casque et enceintes ne partagent plus un même préréglage ni une même courbe.',
  'tour.outputs.point2':
    'Une deuxième sortie joue directement depuis le moteur FluidEQ avec un son à elle, et la sortie principale ne l’attend jamais. {editSound}, juste à côté, modifie ce son sans changer de sortie principale.',
  'tour.outputs.point3':
    'Les casques Bluetooth affichent leur batterie à côté de la sortie, et une deuxième sortie indique en millisecondes de combien elle joue en retard.',
  'tour.outputs.how':
    'Ouvrez l’Égaliseur et choisissez une sortie sous {output}, à droite : tout ce que vous réglez ensuite reste avec elle. Pour une deuxième, activez-la sous {secondOutput} et appuyez sur {editSound}.',
  'tour.outputs.open': 'Ouvrir l’Égaliseur',
  'tour.outputs.imageAlt':
    'La carte Sortie avec un casque et des enceintes, chacun avec son préréglage, sa courbe et ses étages DSP, qui jouent à tour de rôle, et à côté une deuxième sortie qui joue en même temps avec son propre son, sa batterie et Modifier le son.',

  'tour.bands.kicker': 'L’ÉGALISEUR EN CHIFFRES',
  'tour.bands.title': 'Les valeurs de chaque bande, sur le graphique',
  'tour.bands.subtitle': 'Des étiquettes sur la courbe, le Mode EQ à côté',
  'tour.bands.lead':
    'Chaque bande peut afficher sa fréquence, son Q et son gain au-dessus de son point, sans que les étiquettes se chevauchent. Le Mode EQ se tient désormais à côté du graphique : les courbes restent visibles pendant que vous changez leur façon de jouer.',
  'tour.bands.point1':
    'Une étiquette se place juste au-dessus ou au-dessous de son point, jamais sur une autre, ne bouge pas quand vous faites glisser sa bande et retrouve sa position dès que la place se libère.',
  'tour.bands.point2':
    '{eqMode} est la première carte du panneau latéral, avec un onglet pour {yourEq} et un pour {corrections}. Son bouton au-dessus du graphique fait apparaître la carte.',
  'tour.bands.point3':
    'Chaque poignée, curseur et bouton se manie au clavier, et déplacer un curseur redessine la courbe dans la même image.',
  'tour.bands.how':
    'Ouvrez l’Égaliseur, choisissez {view} → {everything} au-dessus du graphique (ou appuyez sur {shortcut}) et déplacez une bande : ses valeurs la suivent. {eqMode} vous attend en haut du panneau de droite.',
  'tour.bands.open': 'Ouvrir l’Égaliseur',
  'tour.bands.imageAlt':
    'Le graphique de l’égaliseur avec la fréquence, le Q et le gain de chaque bande au-dessus de son point, une bande qui bouge aux flèches du clavier, et en dessous la carte Mode EQ avec Votre EQ et Corrections.',
  'tour.bands.shortcut': 'Ctrl+W',

  'tour.ears.kicker': 'UNE BANDE, DEUX OREILLES',
  'tour.ears.title': 'Réglez chaque oreille à part',
  'tour.ears.subtitle': 'Gauche + droite dans le menu de la bande',
  'tour.ears.lead':
    'Faites un clic droit sur une bande et choisissez {split} : elle devient une bande pour chaque oreille, sur la même fréquence, et vous déplacez chacune seule. La courbe de l’oreille gauche est pleine, celle de la droite en pointillés.',
  'tour.ears.point1':
    '{both} les réunit en leur milieu, à mi-chemin en fréquence et en gain. {reset} et {clear} les réunissent aussi.',
  'tour.ears.point2':
    '{delete} se trouve dans le même menu, dans l’égaliseur principal et dans le rack DSP, et demande une seconde pression avant de supprimer.',
  'tour.ears.point3':
    'Une courbe Squiglink peut s’importer dans une seule oreille : {importInto} remplit seulement la gauche ou la droite et laisse l’autre comme elle était.',
  'tour.ears.how':
    'Ouvrez l’égaliseur, faites un clic droit sur une bande du graphique et choisissez {split}. L’égaliseur du rack DSP a le même menu tant qu’il s’applique à la stéréo.',
  'tour.ears.open': 'Ouvrir l’Égaliseur',
  'tour.ears.imageAlt':
    'Le graphique de l’égaliseur avec une bande partagée en une bande pour l’oreille gauche et une pour la droite, qui s’écartent puis se rejoignent en leur milieu, la courbe gauche pleine et la droite en pointillés, à côté du menu de la bande avec Les deux oreilles et Gauche + droite.',
  // Film voice: generated from .claude/video-kit/films/narration/lines.cjs — edit there.
  'tour.film.eachEar.intro':
    'Chaque bande de FluidEQ peut désormais sonner différemment dans chaque oreille.',
  'tour.film.eachEar.menu':
    'Faites un clic droit sur une bande pour ouvrir son menu.',
  'tour.film.eachEar.split':
    'Choisissez Gauche + droite. La bande se divise en deux, une moitié pour chaque oreille.',
  'tour.film.eachEar.lines':
    'Faites glisser chaque moitié séparément. La ligne pleine est votre oreille gauche, la ligne pointillée votre oreille droite.',
  'tour.film.eachEar.sliders':
    'Chaque oreille a aussi son propre curseur, marqué L ou R.',
  'tour.film.eachEar.join':
    'Pour les réunir, choisissez Les deux oreilles. Les deux moitiés se rejoignent au milieu.',
  'tour.film.sound.intro':
    'Chaque changement que vous faites dans FluidEQ s’entend aussitôt, et en douceur.',
  'tour.film.sound.glide':
    'Déplacez une bande pendant la musique. Chaque changement arrive en glissant, sans aucun clic.',
  'tour.film.sound.precise':
    'Dans le menu Mode EQ, Aigus est réglé sur Précis. Chaque bande sonne exactement comme dessinée, jusqu’à vingt kilohertz.',
  'tour.film.sound.classic':
    'Choisissez Classique pour construire les bandes comme le fait Equalizer APO.',
  'tour.film.games.intro':
    'FluidEQ peut donner à chacun de vos jeux un son bien à lui.',
  'tour.film.games.add':
    'Appuyez sur Ajouter un jeu, puis choisissez-le parmi les jeux installés par vos lanceurs.',
  'tour.film.games.sound': 'Choisissez ensuite le son qu’il doit avoir.',
  'tour.film.games.front':
    'Quand le jeu passe au premier plan, son son se charge tout seul.',
  'tour.film.games.closed': 'Fermez le jeu, et votre propre son revient.',
  'tour.film.compact.intro':
    'Quand vous n’avez besoin que des commandes, FluidEQ se replie en un petit lecteur.',
  'tour.film.compact.go':
    'Appuyez sur le bouton du lecteur en haut, et la fenêtre devient le Lecteur compact.',
  'tour.film.compact.eq':
    'Votre EQ vous suit. Tournez un bouton, et vous l’entendez aussitôt.',
  'tour.film.compact.back': 'Un seul clic vous ramène à la fenêtre complète.',
  'tour.film.deleteImport.intro':
    'Deux petits changements qui protègent votre EQ.',
  'tour.film.deleteImport.asks':
    'Supprimer la bande demande d’abord confirmation. Appuyez de nouveau pour vraiment la supprimer.',
  'tour.film.deleteImport.oneEar':
    'Une importation peut aussi ne remplir qu’une oreille. Choisissez Importer dans, puis Oreille gauche.',
  'tour.film.deleteImport.otherEar':
    'Seule l’oreille gauche est remplacée. La droite reste exactement comme avant.',
  'tour.film.outputs.intro':
    'Chaque sortie de votre ordinateur garde son propre son.',
  'tour.film.outputs.each':
    'Passez des enceintes au casque, et l’EQ devient celui du casque.',
  'tour.film.outputs.back':
    'Revenez en arrière, et les enceintes sonnent exactement comme vous les avez laissées.',
  'tour.film.outputs.second':
    'Vous pouvez aussi jouer en même temps sur une Deuxième sortie, avec son propre son.',
  'tour.film.outputs.edit':
    'Appuyez sur Modifier le son pour la régler ici même, pendant que la sortie principale continue de jouer.',
  'tour.film.dsp.intro':
    'Le rack DSP façonne tout ce que vous entendez, après votre EQ.',
  'tour.film.dsp.preset':
    'Choisissez un préréglage, et il règle tout le rack d’un coup.',
  'tour.film.dsp.stages':
    'Chaque étage a sa propre page, avec toutes les commandes en vue.',
  'tour.film.dsp.meters':
    'Ses indicateurs bougent avec la musique, pour voir ce qu’il fait.',
  'tour.film.deesser.intro':
    'Le rack DSP a maintenant un Dé-esseur, pour les voix aux S trop durs.',
  'tour.film.deesser.cuts':
    'Choisissez un préréglage comme Podcast et parole. Chaque S dur est atténué et affiché en ambre, les cymbales restent intactes.',
  'tour.film.deesser.isolate':
    'Appuyez sur Isoler pour n’entendre que ce qu’il retire.',
  'tour.film.headphones.intro':
    'FluidEQ peut corriger votre casque grâce aux mesures d’autres personnes.',
  'tour.film.headphones.search':
    'Ouvrez Préréglages EQ et cherchez votre casque dans la bibliothèque OPRA.',
  'tour.film.headphones.measure':
    'Choisissez une mesure. Chacune indique qui l’a faite.',
  'tour.film.headphones.applied':
    'Appuyez sur Appliquer l’égalisation du modèle. La correction va sur sa propre couche, et vos bandes restent telles quelles.',
  'tour.film.headphones.paste':
    'Vous pouvez aussi coller un export de Squiglink.',
  'tour.film.headphones.ears':
    'Appliquez-le comme votre EQ, aux deux oreilles ou à une seule.',
  'tour.film.headphones.curve': 'Ou appliquez-le comme une courbe à part.',
  'tour.film.karaoke.intro':
    'Karaoké transforme FluidEQ en scène pour vos propres chansons.',
  'tour.film.karaoke.open':
    'Appuyez sur Ouvrir une chanson, et choisissez la chanson avec son fichier de paroles.',
  'tour.film.karaoke.words':
    'Appuyez sur Lecture. Chaque mot s’allume au moment où il est chanté.',
  'tour.film.karaoke.pitch':
    'En dessous, le guide de hauteur montre chaque note à chanter. Activez votre micro pour y voir votre propre voix.',
  'tour.film.maker.intro':
    'Le Créateur de karaoké transforme une chanson en fichier karaoké.',
  'tour.film.maker.timeline':
    'Chargez une chanson et appuyez sur Créer. Chaque mot et chaque note se placent sur une ligne du temps.',
  'tour.film.maker.play':
    'Lancez la lecture, et la tête de lecture passe sur chaque mot et chaque note. Faites-en glisser un pour corriger son timing ou sa hauteur.',
  'tour.film.maker.use':
    'Le Créateur peut aussi préparer une chanson tout seul, à partir de la voix du chanteur. Quand c’est juste, appuyez sur Utiliser dans le lecteur.',
  'tour.film.looks.intro':
    'Le spectre sous votre EQ peut être dessiné exactement comme vous le voulez.',
  'tour.film.looks.open':
    'Appuyez sur Nouveau style dans la barre d’outils du graphique.',
  'tour.film.looks.forms':
    'Parcourez les formes avec la flèche : barres LED, barres néon, silhouettes de villes, tours de verre et bien d’autres.',
  'tour.film.looks.shape':
    'Puis façonnez-la. Éléments règle le nombre de barres, et les couleurs, les espaces et le mouvement sont aussi à vous.',
  'tour.film.looks.save':
    'Appuyez sur Enregistrer pour le garder comme votre propre style, ou partagez-le sous forme de fichier.',
  'tour.film.engine.intro':
    'FluidEQ a son propre moteur audio. Il applique votre EQ et le rack DSP à tout ce que joue l’ordinateur.',
  'tour.film.engine.choose':
    'Ouvrez le menu des actions en haut à droite et appuyez sur la carte du moteur. Le moteur FluidEQ est celui à choisir.',
  'tour.film.engine.rack':
    'Ouvrez ensuite le DSP et choisissez un préréglage. Jeux, navigateurs et applications de musique passent tous par lui.',
  'tour.film.library.intro':
    'La Bibliothèque joue la musique que vous possédez, à travers votre EQ.',
  'tour.film.library.albums':
    'Vos albums apparaissent sous forme de pochettes. Feuilletez-les avec les flèches.',
  'tour.film.library.album':
    'Cliquez sur un album pour l’ouvrir, avec toutes ses chansons.',
  'tour.film.library.play':
    'Appuyez sur Lecture, et elle passe par le même EQ et le même rack DSP que tout le reste.',
  // End of film voice.
  'tour.film.soundOn': 'Activer le son',
  'tour.film.soundOff': 'Couper le son',
  'tour.film.watch': 'Regarder la vidéo',
  'tour.film.close': 'Fermer la vidéo',

  'tour.myCurves.kicker': 'VOS PROPRES COURBES',
  'tour.myCurves.title':
    'Votre propre liste de courbes, à côté de celle d’OPRA',
  'tour.myCurves.subtitle': 'Gardez, nommez et réutilisez vos courbes',
  'tour.myCurves.lead':
    '{eqPresets} a maintenant {myCurves} à côté de la bibliothèque OPRA : chaque courbe à laquelle vous voulez revenir, avec le nom que vous lui donnez et un dessin de sa forme. Ajoutez-en une depuis un export Squiglink, un fichier .txt, votre EQ tel qu’il est ou un choix OPRA.',
  'tour.myCurves.point1':
    '{applyCurve} joue une courbe comme correction du casque, avec sa propre intensité et son interrupteur ; {applyEq} met plutôt ses bandes dans votre EQ.',
  'tour.myCurves.point2':
    '{squiglink} a son propre onglet, et {save} garde ce que vous apportez en un seul clic.',
  'tour.myCurves.point3':
    '{exportList} écrit toute la liste dans un fichier, pour la sauvegarder ou l’emporter sur un autre ordinateur ; {importList} la relit et indique ce qui est laissé de côté.',
  'tour.myCurves.how':
    'Ouvrez {eqPresets} sous EQ, choisissez {myCurves} et appuyez sur {add}.',
  'tour.myCurves.open': 'Ouvrir les Préréglages EQ',
  'tour.myCurves.imageAlt':
    'La page Préréglages EQ sur Mes courbes : une liste de quatre courbes de casque, chacune avec son nom, sa provenance, le jour de son ajout et un dessin de sa forme. Une courbe tout juste enregistrée depuis Squiglink arrive en haut et joue comme correction du casque.',

  'tour.songs.kicker': 'UN SON POUR CHAQUE CHANSON',
  'tour.songs.title': 'Des chansons qui se souviennent de vos goûts',
  'tour.songs.subtitle':
    'Réglez une chanson une fois, entendez-la ainsi à chaque fois',
  'tour.songs.lead':
    'Activez {songSound} : le préréglage, la Tonalité et l’égaliseur avec lesquels une chanson se termine reviennent la prochaine fois qu’elle joue, sur la sortie où vous l’avez réglée.',
  'tour.songs.point1':
    'Changez le préréglage, la Tonalité ou une bande pendant qu’une chanson joue, et c’est ce qu’elle garde. Une chanson que vous ne touchez pas ne garde rien.',
  'tour.songs.point2':
    'Son réglage revient avec un avis qui nomme la chanson et ce qu’il ramène, avec {undo} et {forget} juste à côté.',
  'tour.songs.point3':
    'Quand la chanson se termine, le son d’avant revient, et chaque sortie garde le sien : une même chanson peut sonner d’une façon au casque et d’une autre sur les enceintes.',
  'tour.songs.how':
    'Ouvrez l’Égaliseur et activez {songSound} dans {output}, à droite. Lancez une chanson, choisissez un préréglage ou tournez la Tonalité, puis laissez-la finir ou passez-la.',
  'tour.songs.open': 'Ouvrir l’Égaliseur',
  'tour.songs.imageAlt':
    'Une file de quatre chansons jouées à tour de rôle, trois avec le préréglage et la courbe qu’on leur a laissés et une jamais réglée, et au-dessus l’avis qu’affiche une chanson mémorisée, avec Annuler et Oublier cette chanson.',

  'tour.deesser.kicker': 'UN S PLUS DOUX',
  'tour.deesser.title': 'Un dé-esseur dans le rack DSP',
  'tour.deesser.subtitle': 'Les S aigus baissés, les cymbales intactes',
  'tour.deesser.lead':
    '{deEsser} baisse les S, T et CH aigus d’une voix seulement quand ils sonnent, et laisse les cymbales, les charlestons et le reste des aigus tels qu’ils étaient.',
  'tour.deesser.point1':
    'Il repère chaque S par rapport au niveau du morceau lui-même : un titre calme et un titre fort sont traités pareil, et vous voyez chaque S repéré et ce qu’il a retiré.',
  'tour.deesser.point2':
    'Il baisse seulement les fréquences dont le S est fait, tout ce qui est au-dessus ou la voix entière, et {isolate} ne fait entendre que ce qu’il retire.',
  'tour.deesser.point3':
    '{speech}, {podcast} et {audiobook} l’activent. Chaque filtre du rack peut désormais enregistrer vos propres profils.',
  'tour.deesser.how':
    'Ouvrez le DSP et choisissez {deEsser} dans la liste à gauche, ou le préréglage {podcast}. Partez d’un profil, puis montez {sensitivity} jusqu’à ce que chaque S soit repéré.',
  'tour.deesser.open': 'Ouvrir le DSP',
  'tour.deesser.imageAlt':
    'La bande du dé-esseur qui défile : chaque S d’une voix au-dessus de la ligne où l’étage commence, avec sa réduction suspendue dessous en ambre, et les charlestons en gris, intacts ; au-dessus l’étage avec Spectral choisi, et dessous Voix, Podcast et Livre audio.',

  'tour.chat.kicker': 'UNE SCÈNE SUR DEMANDE',
  'tour.chat.title': 'Demandez un changement, voyez-le sur la scène',
  'tour.chat.subtitle': 'Une discussion à côté de la scène du Studio',
  'tour.chat.lead':
    'Le {studio} a maintenant une discussion à côté de sa scène. Dites ce qui doit changer – allure, mouvement avec la musique, couleurs ou lumière – et votre propre IA modifie la scène et joue chaque version sur la scène.',
  'tour.chat.point1':
    'Chaque réponse garde la version qu’elle a faite, et {bringBack} remet une version précédente. Chaque scène garde ses discussions passées.',
  'tour.chat.point2':
    '{attach} envoie une image de la scène, sur laquelle vous pouvez dessiner. Ce que vous envoyez pendant qu’elle travaille attend dans une file et part ensemble.',
  'tour.chat.point3':
    'Elle fonctionne avec Claude Code sur cet ordinateur, avec votre propre abonnement, et montre ce qu’il reste de vos limites. Avec ChatGPT, elle peint des images pour la scène, en demandant avant chacune.',
  'tour.chat.how':
    'Ouvrez {plus}, choisissez {studio} dans son rail, choisissez une scène ou commencez-en une, et écrivez dans la zone à côté de la scène.',
  'tour.chat.open': 'Ouvrir Plus',
  'tour.chat.imageAlt':
    'La scène du Studio à côté de sa discussion : une demande pour que les lumières de la scène flashent sur la caisse claire, les étapes de la réponse cochées une à une, la version 2 gardée avec Rétablir, et les lumières de la scène qui se mettent à flasher quand la version 2 joue.',
  'tour.chat.ask':
    'Fais flasher les lumières de la scène sur la caisse claire.',
  'tour.chat.reply':
    'C’est fait : les deux projecteurs flashent en blanc sur chaque caisse claire et reviennent au rose.',

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
    'La lueur fonctionne dans tous les modes, et les styles s’exportent en fichier et s’importent depuis un fichier.',
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
  'tour.studio.free': 'Gratuit pour tous les comptes',
};

export default tour;
