/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Aide',
  'help.title': 'Guide utilisateur',
  'help.subtitle': 'Trouvez votre son. Prenez vos marques.',
  'help.intro':
    'Un guide pratique de FluidEQ, illustré par les propres commandes de l’app et de vraies captures de fenêtre. Commencez par votre première écoute, puis explorez à votre rythme.',
  'help.offline': 'Disponible hors ligne',
  'help.search': 'Rechercher dans le guide',
  'help.searchHint': 'Essayez moteur, basses, scène…',
  'help.contents': 'Dans ce guide',
  'help.results': '{count} chapitres',
  'help.resultsOne': '{count} chapitre',
  'help.empty':
    'Aucun chapitre trouvé. Essayez une expression plus courte ou effacez la recherche.',
  'help.clear': 'Effacer la recherche',
  'help.close': 'Fermer le guide',
  'help.enlarge': 'Agrandir la capture : {title}',
  'help.closeImage': 'Fermer la capture',
  'help.controlsOf': 'Ce que fait chaque commande : {title}',
  'help.captureNote':
    'Les illustrations en direct suivent votre langue et les couleurs de votre fenêtre. Les anciennes captures peuvent montrer d’autres libellés ou positions. Les réglages d’exemple expliquent les commandes ; ce ne sont pas des préréglages recommandés.',
  'help.steps': 'À essayer',
  'help.tip': 'Bon à savoir',
  'help.back': 'Revenir en haut',

  'help.group.start': 'Premiers pas',
  'help.group.sound': 'Façonnez votre son',
  'help.group.visuals': 'Voyez votre musique',
  'help.group.plus': 'Scènes et votre compte',
  'help.group.listen': 'Écoutez, chantez et partagez',
  'help.group.help': 'Quand vous avez besoin d’aide',

  'help.start.title': 'Vos cinq premières minutes',
  'help.start.intro':
    'Commencez avec un morceau familier à un volume confortable. La colonne de gauche contient le bouton marche/arrêt de FluidEQ et le préampli ; au centre se trouve votre espace de travail, le graphique au-dessus de vos bandes ; le panneau du son, à droite, suit votre sortie et ses profils. La barre en bas de la fenêtre commande ce qui joue. La visite ci-dessous n’est diffusée que lorsque vous appuyez sur Lecture. Pour la page des jeux, voyez Labo gaming.',
  'help.start.steps':
    'Installez FluidEQ et gardez le Moteur FluidEQ sélectionné quand l’installation demande comment traiter votre son. Windows demande l’autorisation une fois, sans redémarrage.\nChoisissez votre appareil d’écoute dans la carte Sortie du panneau du son. Appuyez sur le bouton marche/arrêt en haut de la colonne de gauche et laissez la Normalisation auto activée.\nLancez un morceau, ouvrez Égaliseur → Bandes, déplacez un peu le curseur d’une bande et comparez, bouton marche/arrêt éteint puis allumé.',
  'help.start.tip':
    'L’EQ système nécessite Windows et un moteur audio : le moteur FluidEQ ou Equalizer APO. Sous macOS et Linux, l’application affiche des sorties de démonstration : un graphique animé n’y prouve donc aucun traitement.',
  'help.start.keywords':
    "premiers pas, prise en main, démarrage rapide, bien démarrer, mise en route, premier lancement, débutant, débuter, tutoriel, mode d'emploi, comment utiliser, comment ça marche, installer, setup, bouton marche, graphique, onglets, bandes",
  'help.start.pagesName': 'Les pages de l’égaliseur',
  'help.start.pages':
    'Bandes, Corrections de casque, Convolution et Config : ce qui façonne le son, une page chacun.',
  'help.start.engineName': 'Le moteur',
  'help.start.engine':
    'Quel moteur joue votre égaliseur : le Moteur FluidEQ ou Equalizer APO. Un point rouge signifie qu’il n’atteint pas la sortie que vous écoutez.',
  'help.start.delay':
    'Le retard avec lequel le moteur joue le son sur cette sortie. Appuyez dessus pour voir ce qu’ajoute chaque étage.',
  'help.start.graphName': 'Le graphique',
  'help.start.graph':
    'La courbe de votre égaliseur et un point sur chaque bande, avec ce que vous entendez qui bouge derrière. Faites glisser un point pour façonner le son ; le reste est dans le chapitre du graphique.',
  'help.start.tabsName': 'Votre égaliseur, Préréglage, Tonalité',
  'help.start.tabs':
    'Trois onglets sous le graphique : vos propres bandes, un préréglage tout prêt en dessous, et les coupes et boutons de la Tonalité. Les outils de chaque onglet sont au bout de la rangée.',
  'help.start.bandsName': 'Vos bandes',
  'help.start.bands':
    'Un curseur par bande, sa fréquence en haut et son gain en bas. Le chapitre de l’égaliseur montre chaque partie.',
  'help.video.play': 'Lire la vidéo : {title}',
  'help.video.loading': 'Chargement depuis fluideq.com…',
  'help.video.failed':
    'La vidéo n’a pas pu être chargée. Elle est lue depuis fluideq.com et demande donc une connexion à internet.',
  'help.video.retry': 'Réessayer',

  'help.window.title': 'Se repérer dans la fenêtre',
  'help.window.intro':
    'L’en-tête vous fait passer d’une page de FluidEQ à l’autre et montre le son en direct. La colonne de gauche contient le bouton marche/arrêt de FluidEQ, le préampli et l’indicateur de niveau ; le panneau du son, à droite, suit votre sortie et ses profils.',
  'help.window.steps':
    'Ouvrez une page depuis l’en-tête : Scènes, Partager l’audio, Micro, Labo gaming, Égaliseur, DSP, Bibliothèque, Karaoké, Médias en ligne.\nAppuyez sur le bouton marche/arrêt en haut de la colonne de gauche pour allumer FluidEQ, et laissez la Normalisation auto activée, pour qu’aucune amplification ne sature.\nAppuyez sur l’indicateur de niveau pour passer à son style suivant ; avec Ctrl, vous revenez au précédent.\nDans le menu ≡, réglez la Luminosité où vous voulez, du tout sombre au tout blanc, et donnez à la Teinte une deuxième couleur pour dessiner les bandes, le titre et les commandes allumées en dégradé entre les deux.\nPour commuter depuis une autre app, ouvrez ≡ → Touche marche/arrêt et choisissez une combinaison. Aucune n’est attribuée au départ ; la notification au-dessus des fenêtres confirme l’état de FluidEQ.\nUn clic droit dans un champ de texte propose Couper, Copier, Coller et Tout sélectionner. La recherche ignore la casse, les accents, les espaces et la ponctuation : kpop trouve K-pop.',
  'help.window.tip':
    'Le menu Aide mène à ce guide, à Nouveautés, au dépannage audio et à Signaler un problème. Le menu ≡, juste à côté, a deux colonnes. À gauche : la carte du moteur, Résoudre les problèmes audio, Redémarrer l’audio de Windows, la Touche marche/arrêt, l’importation de réglages d’égalisation ou d’une réponse impulsionnelle, Processus, qui montre ce que chaque partie de FluidEQ utilise, Réinitialiser tous les réglages, les animations, Démarrer avec Windows (FluidEQ démarre alors dans la zone de notification et façonne votre son sans ouvrir de fenêtre) et la langue. À droite, l’apparence de la fenêtre : Luminosité, Teinte (ses deux pastilles sont la couleur de la fenêtre et une deuxième couleur pour un dégradé), Teinter l’icône (désactivé au départ ; met les icônes de la barre des tâches, de la zone de notification et de son menu aux couleurs de la fenêtre), les curseurs de l’EQ et Définir comme arrière-plan du Bureau. Les notifications s’empilent en bas à droite de la fenêtre. Juste après les menus, un interrupteur transforme la fenêtre en Lecteur compact.',
  'help.window.keywords':
    'onglets, navigation, naviguer, interface, entête, barre de titre, barre d’outils, barre latérale, panneau latéral, barre du bas, barre de lecture, vu-mètre, teinte, couleur, deuxième couleur, dégradé, tint, colour, color, second colour, gradient, icônes, faire un don, donation, thème, mode sombre, mode clair, thème sombre, thème clair, mode nuit, langue, changer de langue, démarrer avec windows, démarrage automatique, lancer au démarrage, démarrage, recherche, chercher, casse, accents, espaces, ponctuation, search, accents, spaces, punctuation, case insensitive, marche arrêt, bouton marche, luminosité, fenêtre blanche, clic droit, menu contextuel, couper, copier, coller, notifications, micro',
  'help.window.headerLeftCaption': 'L’en-tête, jusqu’au signal',
  'help.window.headerRightCaption': 'L’en-tête, après le signal',
  'help.window.railCaption': 'La colonne de gauche',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch et Suno, lus dans FluidEQ à travers votre EQ.',
  'help.window.share':
    'Envoie le son de cet ordinateur vers un autre, ou lit ici celui d’un autre.',
  'help.window.mic':
    'Vos micros, chacun avec son propre son de voix, entendu par toutes les applications.',
  'help.window.gaming':
    'Vos jeux, chacun avec un son à lui, ajusté pour ce jeu.',
  'help.window.eq':
    'Vos bandes, vos préréglages, la correction du casque et la config du moteur.',
  'help.window.waveName': 'Signal audio',
  'help.window.wave':
    'Ce qui est en lecture, en direct, avec son niveau de crête ; le menu Affichage du graphique permet de le masquer.',
  'help.window.dsp':
    'Le rack d’effets : les préréglages, la Salle et chaque étage de la chaîne.',
  'help.window.library':
    'Vos fichiers musicaux, vos albums et votre file de lecture.',
  'help.window.karaoke':
    'Chantez en suivant les paroles, et transformez vos propres chansons en karaoké.',
  'help.window.plus':
    'Scènes : la galerie, le Studio et l’Éclairage dynamique.',
  'help.window.support': 'Des façons de soutenir le travail sur FluidEQ.',
  'help.window.help':
    'Ce guide, Nouveautés, Notes de version complètes, Forum, le dépannage audio, Signaler un problème et À propos de FluidEQ. Les notes complètes s’ouvrent directement. À propos propose des liens vers ses sections et, si le lien de soutien est disponible, une carte Buy Me a Coffee avec code QR.',
  'help.window.actions':
    'Deux colonnes. Commandes et comportement : le moteur, Résoudre les problèmes audio, Redémarrer l’audio de Windows, la Touche marche/arrêt (un raccourci qui coupe et rallume tout le traitement de FluidEQ pendant qu’une autre app est au premier plan ; aucun au départ, et une carte au-dessus de vos autres fenêtres confirme chaque bascule), l’importation de réglages d’égalisation ou d’une réponse impulsionnelle, Processus, Réinitialiser tous les réglages, les animations, Démarrer avec Windows et la langue. Apparence : Luminosité, Teinte et sa deuxième couleur, Teinter l’icône, les curseurs de l’EQ et Définir comme arrière-plan du Bureau.',
  'help.window.systemEq':
    'Le bouton marche/arrêt de FluidEQ : active ou coupe son traitement pour tout ce que le PC joue. La ligne en dessous nomme le moteur ; elle passe au rouge quand le moteur n’atteint pas la sortie que vous écoutez, et un appui pose alors la question du moteur.',
  'help.window.preamp':
    'Baisse le niveau avant l’EQ pour laisser de la marge aux amplifications. Tant que la Normalisation auto le tient, il indique AUTO ; quand elle est coupée, tournez le bouton ou appuyez sur sa valeur pour saisir un niveau. Ctrl+clic le remet à 0 dB.',
  'help.window.autoNormalize':
    'Garde le préampli juste assez bas pour que rien de ce que vous amplifiez ne sature.',
  'help.window.responseGraph': 'Affiche ou masque la courbe de réponse.',
  'help.window.meterName': 'Indicateur de niveau',
  'help.window.meter':
    'Le niveau de sortie, gauche et droite, en vrais décibels, avec la crête du canal le plus fort au-dessus. Appuyez dessus pour passer au style suivant ; avec Ctrl, vous revenez au précédent.',
  'help.player.title': 'Le Lecteur compact',
  'help.player.intro':
    'Un seul interrupteur transforme la fenêtre de FluidEQ en Lecteur compact, une seule colonne étroite : en haut, une scène ou un style avec le morceau par-dessus et les commandes de lecture en dessous ; puis Son, votre égaliseur ; puis À suivre et vos playlists. Ce qui est en lecture continue de jouer, et le même interrupteur ramène l’application complète sur la page que vous aviez quittée.',
  'help.player.steps':
    'Appuyez sur l’interrupteur Lecteur compact dans la barre de titre, à côté d’Aide. Sur le lecteur, le même interrupteur ramène l’application complète.\nRepliez Son, ou À suivre et Playlists, sur leur en-tête : l’image prend la place, et un clic sur l’en-tête les rouvre. Faites glisser le bord haut ou bas du lecteur pour le rendre plus haut ou plus bas.\nDouble-cliquez sur l’image pour qu’elle remplisse l’écran ; Échap le remet en place. Cliquez sur le nom du style, à côté de l’aléatoire et de la répétition, pour choisir parmi tous les styles et toutes les scènes.\nChoisissez Replier sur une ligne dans le menu du logo FluidEQ pour que le lecteur tienne sur une seule ligne ; le logo le déplie.\nDans ce même menu, réglez la Luminosité propre au lecteur, la Transparence sur une scène ou la Teinte de la fenêtre sur un style standard, et la Lumière du jour d’une scène. Toujours au premier plan, là ou dans l’en-tête, le garde au-dessus des autres fenêtres.\nDéposez des fichiers musicaux n’importe où sur le lecteur : ils rejoignent la Bibliothèque et la fin d’À suivre ou, sur la liste, l’endroit où vous les lâchez.\nDans Son, Tone règle graves, médiums et aigus ; Bandes ouvre l’EQ complet. Le préréglage et le mode EQ agissent sur la même sortie que l’app complète. Explorer les scènes ouvre la galerie ; le changement automatique fonctionne aussi dans le lecteur compact.',
  'help.player.tip':
    'Le volume du lecteur est celui de votre ordinateur, le même que dans Windows : il règle donc le niveau de tout ce que joue l’ordinateur. Si le lecteur se retrouve hors de l’écran, faites un clic droit sur FluidEQ dans la zone de notification de la barre des tâches et choisissez Récupérer la fenêtre. Quand le son d’un jeu est actif, son bouton n’affiche que son nom pour tenir dans le lecteur compact.',
  'help.player.keywords':
    'mini lecteur, mini-lecteur, petit lecteur, lecteur compact, mode compact, mode lecteur, mini player, winamp, ampli, toujours au premier plan, au-dessus des autres fenêtres, always on top, épingler, replier, sur une ligne, file de lecture, file d’attente, à suivre, déposer des fichiers, glisser-déposer, thème, thème clair, thème sombre, mode sombre, mode clair, petite fenêtre, lecteur flottant, fenêtre flottante, volume',
  'help.player.topCaption': 'Le haut : le morceau et sa lecture',
  'help.player.eqCaption': 'Son, votre égaliseur',
  'help.player.queueCaption': 'À suivre',
  'help.player.menuCaption': 'Le menu du lecteur',
  'help.player.foldedCaption': 'Replié sur une ligne',
  'help.player.menu':
    'Revenir à l’application complète ou à l’une de ses pages ; la Luminosité propre au lecteur, la Transparence ou la Teinte, la Lumière du jour d’une scène, Teinter l’icône et les curseurs de l’EQ ; Toujours au premier plan et Replier sur une ligne.',
  'help.player.pin':
    'Garde le lecteur au-dessus de toutes les autres fenêtres.',
  'help.player.switch':
    'Vous ramène à l’application complète, sur la page que vous aviez quittée.',
  'help.player.clock': 'Le temps écoulé. Cliquez dessus pour le temps restant.',
  'help.player.level': 'Le niveau du son qui sort de FluidEQ, en décibels.',
  'help.player.volume':
    'Le volume de votre ordinateur, le même que dans Windows : il règle le niveau de tout ce que joue l’ordinateur.',
  'help.player.seek':
    'Où en est le morceau. Faites glisser pour vous y déplacer.',
  'help.player.playingName': 'Commandes de lecture',
  'help.player.playing':
    'Précédent, recul de cinq secondes, lecture ou pause, avance de cinq secondes, suivant et arrêt.',
  'help.player.orderName': 'Aléatoire et répétition',
  'help.player.order':
    'Mélange la file À suivre, et répète : rien, tout ou cette chanson.',
  'help.player.lookName': 'Style',
  'help.player.look':
    'Le style ou la scène du lecteur. Cliquez dessus pour choisir parmi tous.',
  'help.player.bands':
    'Faites glisser une bande vers le haut ou le bas pour l’amplifier ou l’atténuer. Sa fréquence est écrite en dessous.',
  'help.player.tone':
    'Tonalité affiche les boutons Graves, Médiums et Aigus ; l’onglet d’à côté, toutes les bandes.',
  'help.player.upNext':
    'À suivre et Playlists, chacun avec son nombre, et le temps qu’il reste dans la file.',
  'help.player.songsName': 'Les morceaux',
  'help.player.songs':
    'Ce qui joue ensuite. Cliquez sur un morceau pour le lire, faites-le glisser pour le déplacer, ou déposez ici des fichiers musicaux pour les ajouter à l’endroit où vous les lâchez.',
  'help.player.openIn': 'Ouvre l’application complète sur l’une de ses pages.',
  'help.player.theme':
    'La Luminosité propre au lecteur, indépendante de celle de l’application complète ; la Transparence sur une scène, ou la Teinte de la fenêtre sur un style standard ; la Lumière du jour d’une scène ; et Teinter l’icône, désactivé au départ, pour l’icône de la barre des tâches, celle de la zone de notification et celle de son menu aux couleurs de la fenêtre.',
  'help.player.fold': 'Replie le lecteur sur une ligne.',
  'help.player.unfold': 'Déplie le lecteur. La flèche à l’autre bout aussi.',
  'help.player.foldedPlaying': 'Lecture ou pause.',
  'help.player.fullScreen':
    'Remplit l’écran avec la scène ou le style. Un double-clic sur l’image fait de même, et Échap rend l’écran.',
  'help.player.sourceName': 'Source',
  'help.player.source':
    'D’où vient le morceau : la Bibliothèque, Médias en ligne, Karaoké, un autre ordinateur ou un autre programme de ce PC. Un clic ouvre cette page dans l’application complète.',
  'help.player.heart':
    'Ajoute un morceau de la Bibliothèque à vos Favoris, ou l’en retire.',
  'help.player.soundFold':
    'Replie les réglages du son sur cette ligne, qui garde à portée le préréglage, la correction intelligente et l’interrupteur, et les rouvre.',
  'help.player.mode':
    'Ouvre le Mode EQ : la force avec laquelle votre EQ et les courbes s’appliquent, leur Q de bande, leur phase et leurs aigus.',
  'help.player.save': 'Garde À suivre comme une playlist à part entière.',
  'help.player.queueFold':
    'Replie À suivre et Playlists sur leurs onglets, et l’image prend la place.',
  'help.player.remove':
    'Retire d’À suivre un morceau qui n’a pas encore été joué.',
  'help.player.output':
    'Où va le son : la sortie que Windows utilise pour jouer.',
  'help.player.engineName': 'Moteur',
  'help.player.engine':
    'Le moteur qui façonne le son, allumé tant que FluidEQ est activé.',
  'help.player.sliders':
    'Des poignées rondes ou des capuchons rectangulaires sur les curseurs de l’EQ, ici et sur la page EQ.',

  'help.requirements.title': 'Ce qu’il faut à votre PC',
  'help.requirements.intro':
    'FluidEQ fonctionne sur n’importe quel PC Windows des dix dernières années. Deux parties demandent davantage : les scènes dessinent sur la carte graphique, et le karaoké par IA télécharge ses modèles à la première utilisation.',
  'help.requirements.steps':
    'Vérifiez votre Windows : Windows 10 version 1803 ou ultérieure, ou Windows 11, en 64 bits, 4 Go de mémoire et environ 600 Mo de disque. Traiter tout ce que joue le PC demande le moteur FluidEQ ou Equalizer APO, et Windows demande l’autorisation une fois pendant l’installation.\nPour lire les scènes : n’importe quelle carte graphique ou graphique intégré à partir de 2013. En 1080p, le graphique intégré suffit ; pour la 4K, ou un fond d’écran sur plusieurs écrans à la fois, une carte dédiée vaut mieux. Quand la carte est chargée, FluidEQ dessine la scène plus petite et libère celles que vous ne voyez pas.\nEssayez le karaoké par IA : séparer la voix télécharge un modèle de 713 Mo la première fois, celui de la justesse ajoute environ 360 Mo et la suppression du bruit 11 Mo. Avec une carte graphique DirectX 12, un morceau de quatre minutes se sépare en une demi-minute environ ; avec le processeur seul, il faut environ quatre minutes. Gardez 2 Go de mémoire libres pendant ce travail.\nVisez ceci si vous le pouvez : Windows 11, 8 Go de mémoire, une carte graphique à partir de 2018 et 3 Go de disque libres si vous utilisez les fonctions par IA.',
  'help.requirements.tip':
    'Tout sauf les modèles d’IA se trouve dans l’installateur ; ceux-ci ne se téléchargent qu’à la première utilisation de la fonction. Processus, dans le menu d’actions, montre ce que chaque partie de FluidEQ utilise sur votre machine en ce moment.',
  'help.requirements.keywords':
    'configuration requise, configuration minimale, configuration recommandée, prérequis, spécifications, matériel, mémoire vive, espace disque, stockage, disque dur, PC portable, vieux PC, performances, lent, ralentissements, consommation, ressources, compatibilité, compatible, GPU, CPU, RAM, lag, macOS, Linux',

  'help.engine.title': 'Le moteur FluidEQ',
  'help.engine.intro':
    'FluidEQ traite votre son avec son propre moteur ou avec Equalizer APO. Le moteur FluidEQ tourne dans le service audio de Windows, après les effets de votre carte son, applique votre EQ et le rack DSP à tout ce que joue le PC, et s’efface dès que FluidEQ se ferme.',
  'help.engine.steps':
    'Ouvrez le menu d’actions (≡) et choisissez la carte du moteur en haut.\nChoisissez Moteur FluidEQ et appuyez sur Appliquer. Windows demande une autorisation, et le son se coupe quelques secondes, le temps que l’audio redémarre.\nSi une sortie affiche DÉSACT., appuyez sur Activer dans son avis. Si un avis indique que le moteur ne tourne pas, appuyez sur Redémarrer l’audio de Windows.',
  'help.engine.tip':
    'Equalizer APO reste disponible pour les commandes APO personnalisées, Peace et les plugins VST. Quand une mise à jour apporte un moteur plus récent, un avis propose Mettre à jour le moteur. Quitter FluidEQ depuis la zone de notification désactive l’EQ sur toutes les sorties.',
  'help.engine.keywords':
    'pilote, égaliseur global, partout, navigateur, administrateur, droits administrateur, permission, traitement audio, driver, FluidEQ Engine, Spotify, Deezer, Discord',
  'help.engine.fluid':
    'Recommandé. Les effets de votre carte son continuent de fonctionner, et l’EQ et le rack DSP atteignent toutes les applications.',
  'help.engine.apo':
    'Exécute les commandes APO personnalisées, Peace et les plugins VST. Le rack DSP reste limité à la lecture de la Bibliothèque.',
  'help.engine.apply':
    'Change de moteur. Windows demande une autorisation une fois, et l’audio redémarre en quelques secondes.',
  'help.engine.nowName': 'Le moteur actuel',
  'help.engine.now':
    'Quel moteur joue votre son maintenant ; Appliquer reste inactif tant que vous ne choisissez pas l’autre.',

  'help.eq.title': 'Façonnez votre son avec l’Égaliseur',
  'help.eq.intro':
    'Votre égaliseur, ce sont les bandes que vous façonnez vous-même. La fréquence choisit où agit une bande, le gain règle l’amplification ou l’atténuation, et Q sa largeur : plus Q est élevé, plus elle est étroite. Sous le graphique, trois onglets se partagent la page : Votre égaliseur, Préréglage et Tonalité, chacun une couche à part. Commencez par de petits changements larges et comparez souvent.',
  'help.eq.steps':
    'Ouvrez Égaliseur → Bandes. Votre égaliseur contient vos bandes ; Préréglage place un son tout prêt dessous, et Nouveau préréglage en crée un à vous ; Tonalité réunit Coupe-bas, Coupe-haut, Graves, Médiums et Aigus, dessinés en une ligne à part.\nFaites glisser le curseur d’une bande, ou son point sur le graphique, pour amplifier ou atténuer ; la courbe suit le mouvement. Cliquez sur la fréquence d’une bande, ou sur son point, pour la sélectionner. Ctrl+molette sur une bande change son Q.\nMaintenez Maj avec une bande sélectionnée pour faire apparaître sa fenêtre à côté : son filtre, les boutons Fréquence, Gain et Q, Active et la corbeille. Maj+Tab et Maj+← → passent à la bande précédente ou suivante ; Échap ou × la referme.\nTout fonctionne aussi au clavier : Tab mène à un curseur, un bouton ou un point du graphique, et les flèches le déplacent ; Page préc. et Page suiv. font de plus grands pas.\nUn clic droit sur une bande la réinitialise, la désactive, la supprime (après un second appui), ajoute une bande à côté ou choisit Gauche + droite : une bande par oreille à la même fréquence, la courbe de l’oreille gauche en trait plein et celle de la droite en pointillé. Les deux oreilles les réunit.\nSélectionnez plusieurs bandes avec Ctrl ou Maj, ou tracez un cadre autour, pour les déplacer ensemble ; Ctrl+A sur le graphique les sélectionne toutes.\nEnregistrer l’EQ garde ce qui joue comme un EQ enregistré que vous pouvez remettre, mettre à jour ou gérer. Vider remet chaque gain à 0 dB et garde vos bandes ; il demande d’abord.\nUn préréglage à vous (Préréglage → Nouveau préréglage) part d’un préréglage ou d’une courbe plate ; vous la façonnez sur le graphique, et son rack sur la page DSP. Le menu de sa vignette l’exporte dans un fichier, et Importer, dans l’onglet Préréglage, en relit un.',
  'help.eq.tip':
    'Courbes liste ce qui façonne cette sortie en plus de vos bandes, chacun avec son intensité et son ×. Le mode jeu, à côté du nom du moteur au-dessus du graphique, réduit le délai qu’ajoute FluidEQ, pour les jeux et les appels ; les préréglages gaming l’activent. Tant que l’égaliseur est coupé depuis sa puce, ses bandes sont estompées et ne peuvent pas être changées par mégarde ; l’onglet Tonalité fonctionne toujours.',
  'help.eq.keywords':
    'égalisation automatique, EQ intelligent, EQ paramétrique, basses, booster les basses, renforcer les basses, creuser, plateau, bande passante, correcteur, brillance, régler le son, ajuster le son, à plat, remise à zéro, faible latence, equalizer, equaliseur, bass boost, notch, flat, reset, presets, étiquettes, étiquettes de bandes, étiquettes de l’eq, libellés, valeurs, clavier, touches fléchées, flèches, accessibilité, lecteur d’écran, oreille gauche, oreille droite, chaque oreille, par oreille, gauche et droite, égaliseur stéréo, supprimer la bande, retirer une bande, fenêtre, maj, enregistrer l’eq, eq enregistrés, votre égaliseur, onglet préréglage, tonalité, nouveau préréglage, exporter, importer',
  'help.eq.rowCaption': 'Les onglets sous le graphique, sur Votre égaliseur',
  'help.eq.tabBands': 'Vos propres bandes, et leur nombre.',
  'help.eq.tabPreset':
    'Le préréglage sous vos bandes, et les préréglages au choix : par genre, par usage et les vôtres.',
  'help.eq.tabTone':
    'Coupe-bas, Coupe-haut, Graves, Médiums et Aigus : une tonalité rapide qui laisse vos bandes telles quelles. Il indique Désactivée tant qu’aucun n’est utilisé.',
  'help.eq.bandsCaption': 'Vos bandes',
  'help.eq.bandCaption': 'La fenêtre d’une bande, tant que Maj est maintenue',
  'help.eq.gameMode':
    'Réduit la latence qu’ajoute FluidEQ, pour les jeux et les appels. Les préréglages Jeux l’activent.',
  'help.eq.layers':
    'Ce qui façonne encore cette sortie — un préréglage, une correction de casque, la correction intelligente, une convolution —, chacun avec son intensité, son interrupteur et son ×.',
  'help.eq.bandName': 'Une bande',
  'help.eq.band':
    'Faites glisser son curseur pour amplifier ou atténuer, ou déplacez-le avec les flèches. Ctrl+molette dessus change son Q.',
  'help.eq.caption':
    'Cliquez dessus pour sélectionner la bande. Ctrl+clic ou double-clic la remet sur la fréquence de la disposition.',
  'help.eq.gainCaption': 'Le gain de la bande, en dB.',
  'help.eq.scaleName': 'Échelle en dB',
  'help.eq.scale':
    'De +20 à −20 dB à côté des curseurs, 0 dB marqué, comme une console l’imprime à côté de ses faders.',
  'help.eq.stepName': 'Bande précédente et suivante',
  'help.eq.step':
    '‹ et › déplacent la fenêtre vers la bande du dessous ou du dessus, comme Maj+Tab et Tab à l’intérieur.',
  'help.eq.close':
    'Referme la fenêtre et garde la bande sélectionnée. Relâcher Maj fait de même.',
  'help.eq.filter':
    'Sa forme : une cloche, un plateau, une encoche ou un filtre passe.',
  'help.eq.voicing':
    'Une chaîne toute prête pour le son, comme Musique ou un genre. Aucun ne laisse que vos bandes.',
  'help.eq.smart':
    'Égalisation auto : le son enregistré de chaque chanson, le son de son album depuis la Bibliothèque, et la Correction intelligente par-dessus — Détail, Équilibre ou Cible.',
  'help.eq.clear':
    'Remet chaque gain, et la Tonalité, à 0 dB et garde vos bandes. Demande d’abord.',
  'help.eq.saveEq':
    'Garde ce qui joue comme un EQ enregistré, met à jour celui qui est en place, en remet un autre ou les ouvre tous pour les gérer.',
  'help.eq.mode':
    'La force avec laquelle votre égaliseur et les courbes s’appliquent, le Q des bandes, la phase, les aigus et le lissage ; il indique Normal tant que rien n’est changé. Avec la carte Mode EQ épinglée, il l’amène à l’écran.',
  'help.eq.add':
    'Ajoute une bande à côté de celle sélectionnée, au Q des bandes déjà présentes.',
  'help.eq.layouts':
    'Combien de bandes : des nombres de bandes qui démarrent toutes au même Q, les dispositions que vous avez enregistrées et la réinitialisation de la disposition.',
  'help.eq.frequency': 'Où agit la bande, de 1 Hz à 20 kHz.',
  'help.eq.gain':
    'De combien elle amplifie ou atténue. Ctrl+clic la remet à 0 dB.',
  'help.eq.q':
    'Sa largeur : plus haut, plus étroit. Ctrl+clic le remet au Q de la disposition.',
  'help.eq.delete':
    'Un appui l’arme, un second supprime la bande ; le × à côté annule.',
  'help.eq.menuDelete':
    'Passe au rouge et demande un second appui avant de supprimer la bande.',
  'help.eq.ears':
    'Une bande par oreille à la même fréquence, à régler séparément ; Les deux oreilles les réunit.',
  'help.eq.menuCaption': 'Le menu contextuel d’une bande',
  'help.eq.reset': 'Remet le gain à 0 dB et le Q à 2.',
  'help.eq.disable': 'Retire la bande du son et garde ses réglages.',
  'help.eq.addLeft': 'Ajoute une bande à mi-chemin de sa voisine plus grave.',
  'help.eq.addRight': 'Ajoute une bande à mi-chemin de sa voisine plus aiguë.',

  'help.eqmode.title': 'Mode EQ et dispositions de bandes',
  'help.eqmode.intro':
    'Le mode EQ change la façon dont votre son est façonné, sans rien modifier. C’est un bouton parmi les outils de Votre égaliseur sous le graphique, et épinglé, c’est la première carte du panneau du son, à côté des courbes qu’il change. Il a deux onglets : Votre égaliseur couvre vos bandes, la Tonalité, les préréglages, le type de transducteur et la correction intelligente ; Corrections couvre les corrections de casque et les courbes importées ou personnelles. Les dispositions de bandes gardent les fréquences et le Q d’une disposition qui vous plaît, prêtes pour n’importe quelle sortie.',
  'help.eqmode.steps':
    'Appuyez sur Mode EQ parmi les outils de Votre égaliseur sous le graphique. Épinglée, la carte apparaît dans le panneau du son ; sinon il s’ouvre en menu au-dessus du graphique.\nChoisissez l’onglet Votre égaliseur ou Corrections, puis essayez une Intensité ou un Q de bande pendant la musique. Avec le Moteur FluidEQ, choisissez des aigus précis ou classiques pour chaque onglet, et une phase minimale ou linéaire là où un onglet la propose.\nSur Corrections, le lissage des courbes peut adoucir les courbes échantillonnées au 1/12 ou au 1/3 d’octave ; il est désactivé tant que vous ne choisissez pas. Réinitialiser remet tout en Normal et le lissage sur désactivé.\nVous préférez un menu ? Appuyez sur l’épingle de la carte : le mode EQ s’ouvre alors en menu au-dessus du graphique, et l’épingle de ce menu fait revenir la carte.\nOuvrez le bouton du nombre de bandes parmi les outils de Votre égaliseur. Choisissez 6, 10, 15, 20 ou 31 bandes, ou appuyez sur Enregistrer la disposition… pour nommer la disposition actuelle.',
  'help.eqmode.tip':
    'Une nouvelle disposition démarre toutes les bandes au même Q, et une bande ajoutée prend le Q des autres. Une disposition ne stocke que les fréquences et le Q : en charger une remet chaque bande à 0 dB. La phase linéaire ajoute du retard et peut résonner avant les attaques franches. Choisir une disposition intégrée la fait repartir de zéro : ses propres fréquences et Q, chaque bande à 0 dB et sur les deux oreilles.',
  'help.eqmode.keywords':
    "nombre de bandes, égaliseur graphique, bandes fixes, tiers d'octave, pré-écho, aigus, précis, classique, disposition, intensité, phase linéaire, phase minimale, lissage, q constant, q proportionnel, épingle, épingler, désépingler, carte, panneau latéral, menu, onglets, votre eq, corrections, 1/12 d’octave",
  'help.eqmode.modeCaption': 'La carte Mode EQ',
  'help.eqmode.tabsName': 'Votre EQ et Corrections',
  'help.eqmode.tabs': 'Deux onglets, chacun avec ses propres réglages.',
  'help.eqmode.pin':
    'Remet ces réglages dans un menu par-dessus le graphique. L’épingle du menu ramène la carte.',
  'help.eqmode.strength':
    'Normal, Studio ×1.5 ou ×2. Chaque onglet garde le sien.',
  'help.eqmode.q':
    'Constant garde chaque Q ; Proportionnel et Asymétrique resserrent les bandes à mesure qu’elles se renforcent. Dans Votre EQ, il ne façonne que vos propres bandes, jamais un préréglage ni une correction.',
  'help.eqmode.treble':
    'Précis sonne comme tracé, Classique comme dans Equalizer APO. Avec le moteur FluidEQ uniquement.',
  'help.eqmode.reset':
    'Tout revient à Normal, et Lissage des courbes à Désactivé.',
  'help.eqmode.designsCaption': 'Dispositions de bandes',
  'help.eqmode.builtIn': 'Dispositions standard de 6, 10, 15, 20 ou 31 bandes.',
  'help.eqmode.resetBands':
    'Remet chaque bande sur la fréquence et le Q de sa disposition ; les gains ne bougent pas.',
  'help.eqmode.saved':
    'Une disposition enregistrée : appuyez dessus pour charger ses fréquences et son Q, chaque bande à 0 dB. La corbeille à côté la supprime, après confirmation.',
  'help.eqmode.sampleDesign': 'Moniteurs de studio',
  'help.eqmode.save':
    'Nomme les fréquences et le Q actuels comme une disposition, rangée sous Mes dispositions.',

  'help.games.title': 'Labo gaming',
  'help.games.intro':
    'Donnez à chaque jeu son propre son. Un jeu part d’un profil gaming fait pour lui et reçoit sa propre copie : vous ajustez la copie dans le Labo gaming, et le profil ne change jamais. Quand le jeu passe au premier plan, FluidEQ active son son et le garde jusqu’à ce que vous fermiez le jeu, quoi que vous ouvriez entre-temps avec Alt+Tab. Votre son musique revient ensuite.',
  'help.games.steps':
    'Ouvrez le Labo gaming dans la barre de titre et cliquez sur Ajouter un jeu. Choisissez-en un dans vos lanceurs, un programme ouvert en ce moment, ou parcourez pour trouver son programme. Il part du profil gaming suggéré pour lui ; choisissez-en un autre dans sa liste de profils gaming à tout moment. La liste propose 32 profils pour des titres précis, dont Counter-Strike 2, Valorant et Fortnite, ainsi que 9 types de jeu.\nCliquez sur Essayer maintenant pour activer le son du jeu. Choisissez une partie à gauche — le Filtre Jeu, l’EQ, la Courbe ou n’importe quelle étape DSP — et ajustez-la sur place. Chaque changement reste dans la copie de ce jeu.\nEnregistrer comme profil garde la copie comme l’un de vos propres profils gaming pour d’autres jeux, met à jour le vôtre, ramène la copie à son profil, la renomme ou la supprime.\nLancez le jeu. Une carte sur le bureau indique que son son est actif, et une autre que votre son musique est de retour quand vous le fermez. La notification affiche le nom du profil chargé et celui du profil musical lorsqu’il est rétabli.',
  'help.games.tip':
    'Tant que le son d’un jeu est actif, la page DSP montre votre rack musique en pause avec un bouton pour ajuster le jeu, et la liste des profils se met en repos : rien de ce que vous y faites ne peut écraser votre profil musique avec le son du jeu. Le Filtre Jeu fait ressortir les pas et les rechargements discrets au moment où ils se produisent et fait passer les voix devant.',
  'help.games.list':
    'Vos jeux sont à gauche et défilent indépendamment. Faites glisser le bord du panneau pour régler sa largeur. L’épingle le replie sur les icônes des jeux, qui l’ouvrent par-dessus la page tant que le pointeur est dessus ; appuyez de nouveau sur l’épingle pour le garder ouvert. Sa largeur et son état replié sont mémorisés.',
  'help.games.keywords':
    'jeux vidéo, profil de jeu, par application, changement automatique, jeu de tir, bruits de pas, pas des ennemis, compétitif, gaming, gamer, launcher, Epic Games, FPS, shooter, esport, presets, game filter, dialogue, voices, ambience, environment, hooves, labo gaming, gaming lab, profil gaming, copie',
  'help.games.switch':
    'Laisse un jeu au premier plan activer son propre son. Désactivé, vos jeux gardent votre son musique.',
  'help.games.add':
    'Ajoute un jeu de Steam, Epic, EA, GOG, Ubisoft, Battle.net ou Xbox, ou n’importe quel programme ouvert en ce moment. FluidEQ, l’Explorateur Windows, les processus système et de lanceurs connus, ainsi que les programmes d’installation de composants partagés, sont exclus.',
  'help.games.gameName': 'Un jeu',
  'help.games.game':
    'Un jeu. Celui qui est ouvert est marqué, et un point au bout signifie qu’il est au premier plan maintenant. Son info-bulle indique le profil dont son son est parti et si vous l’avez ajusté.',
  'help.games.profile':
    'Le profil gaming dont part la copie de ce jeu. En choisir un autre donne au jeu une nouvelle copie de celui-ci.',
  'help.games.save':
    'Enregistre la copie comme nouveau profil ou met à jour l’un des vôtres, la ramène à son profil, la renomme ou la supprime. Le profil lui-même ne change jamais.',
  'help.games.try':
    'Active maintenant le son du jeu, pour que vous entendiez ce que vous ajustez. Tant qu’il est actif, Décharger se trouve ici et ramène votre son musique.',
  'help.games.statusName': 'Ce qui a été ajusté',
  'help.games.status':
    'Les parties de cette copie qui diffèrent de son profil.',
  'help.games.railName': 'Ses parties',
  'help.games.rail':
    'Chaque partie du son du jeu, chacune ajustée dans son propre éditeur à côté de la liste. Ajusté marque ce qui s’est éloigné du profil.',

  'help.headphones.title': 'Correction du casque et importation',
  'help.headphones.intro':
    'Une correction du casque compense un modèle mesuré et se combine avec vos bandes et vos préréglages. Vérifiez le modèle exact et l’auteur de la mesure.',
  'help.headphones.steps':
    'Ouvrez Égaliseur → Corrections de casque. La page s’ouvre sur Mes courbes, votre propre liste ; l’onglet Bibliothèque OPRA à côté contient des corrections mesurées pour des milliers de modèles de casques. Cherchez votre modèle exact et choisissez l’entrée qui correspond.\nPour un texte d’égalisation venant d’un autre outil, utilisez Importer des réglages d’égalisation dans le menu des actions. Vérifiez les bandes et la courbe lues avant d’appliquer.\nPour Squiglink, appuyez sur Importer depuis Squiglink dans Mes courbes, collez son export et vérifiez l’aperçu en direct de la courbe ; utilisez-le ensuite comme courbe ou comme égalisation modifiable.\nAjouter une courbe accepte un export Squiglink, un fichier .txt, votre égalisation telle quelle ou un choix OPRA, et demande pour quelles oreilles elle est : les deux, la gauche ou la droite. Chaque courbe a Appliquer comme courbe et Appliquer comme EQ ; Appliquer comme EQ ne remplace que les bandes de ces oreilles, après confirmation.\nLe menu d’une courbe (≡) la renomme, modifie ses bandes, la duplique, la copie en texte ou la supprime. Exporter la liste et Importer une liste emportent toute la liste sur un autre ordinateur.',
  'help.headphones.tip':
    'Un aperçu marqué Non appliqué ne change pas le son. Évitez de cumuler accidentellement deux corrections complètes du même casque.',
  'help.headphones.keywords':
    'écouteurs, intra-auriculaires, profil de casque, courbe cible, compensation, calibrage, calibration, réponse en fréquence, AutoEq, Harman, target, IEM, Crinacle, oratory1990, presets, oreille gauche, oreille droite, une oreille, mes courbes, courbes enregistrées, liste de courbes, exporter la liste, importer une liste',
  'help.headphones.tabsName': 'Mes courbes et OPRA',
  'help.headphones.tabs':
    'Vos propres courbes, avec leur nombre, et la bibliothèque OPRA de corrections de casques mesurées.',
  'help.headphones.libraryName': 'Mises à jour OPRA',
  'help.headphones.library':
    'Si la bibliothèque OPRA est à jour, avec son nombre de modèles ; quand une plus récente existe, Mettre à jour la base la récupère.',
  'help.headphones.add':
    'Un export Squiglink, un fichier .txt, votre égalisation telle quelle ou un choix OPRA, pour les deux oreilles ou une seule. Importer depuis Squiglink, à côté, colle directement depuis Squiglink ; Importer une liste et Exporter la liste emportent toute la liste.',
  'help.headphones.searchName': 'Recherche et tri',
  'help.headphones.search':
    'Trouve une courbe par son nom ; Récentes et A–Z, à côté, trient la liste.',
  'help.headphones.applyEq':
    'Appliquer comme courbe la joue comme couche de correction et garde vos bandes ; Appliquer comme EQ la met plutôt dans vos bandes (seulement pour les oreilles prévues), après confirmation.',
  'help.headphones.moreName': 'Menu d’une courbe',
  'help.headphones.more':
    'Renommer, modifier ses bandes, dupliquer, copier en texte ou supprimer.',

  'help.convolution.title': 'Utilisez une réponse impulsionnelle',
  'help.convolution.intro':
    'Convolution applique une impulsion WAV comme couche séparée. Cherchez dans le catalogue AutoEq ou importez votre WAV ; les bandes paramétriques restent indépendantes.',
  'help.convolution.steps':
    'Ouvrez Égaliseur → Convolution. Recherchez par modèle ou par auteur de la mesure.\nVérifiez la source, puis utilisez Télécharger et appliquer ; le téléchargement correspond à la fréquence d’échantillonnage de votre sortie. Utilisez Importer un WAV pour un fichier que vous avez déjà.\nÉcoutez avec la couche de convolution activée puis désactivée dans Courbes.',
  'help.convolution.tip':
    'Le moteur FluidEQ convertit lui-même la fréquence de n’importe quelle impulsion. Equalizer APO a besoin d’un WAV importé à la fréquence de la sortie. Les téléchargements du catalogue nécessitent une connexion ; le guide, non.',
  'help.convolution.keywords':
    'correction acoustique, correction de pièce, fichier de correction, filtre FIR, convolueur, IR, REW',
  'help.convolution.import':
    'Applique un WAV que vous avez déjà, à n’importe quelle fréquence avec le Moteur FluidEQ.',
  'help.convolution.applied':
    'L’impulsion que joue maintenant cette sortie. Retirer l’enlève.',
  'help.convolution.search':
    'Cherche dans le catalogue AutoEq par modèle ou auteur de la mesure.',
  'help.convolution.resultName': 'Un résultat',
  'help.convolution.result':
    'Le modèle, qui l’a mesuré, la phase et la fréquence de l’impulsion. Source ouvre l’endroit où elle a été publiée.',
  'help.convolution.apply':
    'Télécharge l’impulsion à la fréquence de votre sortie et l’applique. Appliqué marque celle qui joue.',

  'help.profiles.title': 'Appareils, profils et deuxième sortie',
  'help.profiles.intro':
    'Chaque sortie garde son propre son : l’égaliseur, le préréglage, la Tonalité, les filtres, le rack DSP, la Salle et le nivellement sont enregistrés avec elle et reviennent dès que vous passez dessus. Les profils gardent d’autres sons pour la même sortie. Deuxième sortie joue en même temps sur un autre appareil, avec un son et un niveau bien à lui.',
  'help.profiles.steps':
    'Vérifiez la sortie en haut de la carte Sortie avant toute modification ; un casque Bluetooth affiche sa batterie à côté. Utilisez Nouveau profil pour un son à garder ; Mettre à jour enregistre les changements dans ce profil, et Restaurer rétablit ses réglages enregistrés.\nLe son propre de chaque chanson est maintenant dans l’Égalisation auto de la page Égaliseur : une chanson garde son préréglage, sa Tonalité et son EQ sur chaque sortie, et la Bibliothèque en définit un pour un album.\nOuvrez Deuxième sortie, activez un appareil et réglez son niveau. Choisissez son profil juste en dessous, ou appuyez sur Modifier le son pour changer son son dans la page Égaliseur sans changer de sortie principale ; Terminé ou Modifier la sortie principale vous ramène.\nChaque deuxième sortie suit le rythme toute seule et affiche son retard en millisecondes ; avec Partager l’audio, le son d’un autre ordinateur affiche le sien, réseau compris.',
  'help.profiles.tip':
    'Avec le moteur FluidEQ, une deuxième sortie joue directement depuis le moteur, et la sortie principale ne l’attend jamais. L’Égalisation auto est désactivée au départ. Dans la page Égaliseur, le panneau commence par la carte Mode EQ ; repliez-la pour atteindre vos sorties plus vite.',
  'help.profiles.keywords':
    'enceintes, haut-parleurs, sortie audio, périphérique par défaut, plusieurs sorties, sorties multiples, miroir, simultanément, décalage, désynchronisation, délai, sauvegarder mes réglages, par appareil, Bluetooth, DAC, buffer, deuxième sortie, profil, par sortie, chaque sortie, son propre, batterie, niveau de batterie, modifier le son, modifier la sortie principale',
  'help.profiles.list':
    'Les sons que vous avez enregistrés. Le badge marque celui qu’utilise cette sortie ; appuyez sur un autre pour changer. Le crayon d’un profil le renomme et sa corbeille le supprime, après confirmation.',
  'help.profiles.update':
    'Enregistre vos modifications dans le profil en cours. Restaurer, juste à côté, ramène le profil tel que vous l’avez enregistré la dernière fois.',
  'help.profiles.new':
    'Crée un nouveau profil à partir de l’égalisation actuelle.',
  'help.profiles.output':
    'La sortie sur laquelle vous écoutez, avec sa batterie pour un casque Bluetooth. DÉSACT. signifie que votre EQ ne l’atteint pas ; ACTIF, que Windows joue le son à travers elle.',
  'help.profiles.onePlayer':
    'Lancer quelque chose dans FluidEQ met en pause ce qui joue ailleurs sur le PC, et inversement.',
  'help.profiles.outputs':
    'Vos autres sorties. Activez-en une pour y jouer aussi, avec son propre son, son niveau et son retard en millisecondes. Modifier le son change son son dans la page Égaliseur sans changer de sortie principale.',
  'help.profiles.driver':
    'Un point de départ doux, selon ce avec quoi vous écoutez — casque, écouteurs, taille ou matériau du transducteur. Laissez-le sur Sans compensation si le son vous convient déjà.',
  'help.profiles.sampleHeadset': 'Casque (audio USB)',
  'help.profiles.sampleSpeakers': 'Haut-parleurs (Realtek Audio)',
  'help.profiles.sampleMusic': 'Musique',
  'help.profiles.sampleMovies': 'Films',
  'help.profiles.sampleNight': 'Tard le soir',

  'help.config.title': 'Inspectez et sauvegardez une chaîne',
  'help.config.intro':
    'Égaliseur → Config montre ce que le moteur audio a réellement sur le disque. Les cartes de sortie et l’arbre d’inclusions vous aident à voir quels appareils et quelles couches sont concernés. Exportez une chaîne avant une grande expérience ou pour déplacer une configuration.',
  'help.config.steps':
    'Ouvrez Égaliseur → Config, choisissez la sortie et vérifiez état et couches.\nUtilisez Exporter la chaîne pour sauvegarder un fichier .fluideq.\nPour le récupérer, choisissez d’abord la bonne sortie, importez la chaîne et vérifiez le résultat.',
  'help.config.tip':
    'Les fichiers de couches générés sont réécrits quand leurs réglages changent ; placez vos lignes manuelles durables dans le fichier personnalisé de chaque sortie. Le moteur FluidEQ en lit les lignes Filter, Preamp, GraphicEQ et Convolution ; les autres commandes APO et les plugins nécessitent Equalizer APO.',
  'help.config.keywords':
    'restaurer, fichier texte, avancé, transférer, backup, config.txt, include',
  'help.config.statusName': 'Si elle est appliquée',
  'help.config.status':
    'Si le moteur lit cette configuration, dit avant tout le reste.',
  'help.config.outputsName': 'Sorties',
  'help.config.outputs':
    'Chaque sortie de la configuration, avec son profil et son nombre de filtres ; En lecture marque celle que vous entendez. Appuyez sur une sortie pour voir sa chaîne.',
  'help.config.transferName': 'Exporter et importer',
  'help.config.transfer':
    'Exporter la chaîne enregistre la chaîne de cette sortie en fichier .fluideq ; Importer une chaîne en ramène une sur la sortie que vous écoutez.',
  'help.config.treeName': 'Les fichiers de la chaîne',
  'help.config.tree':
    'Le fichier de la sortie et celui de chaque couche en dessous, dans l’ordre où le moteur les lit, avec leur contenu.',
  'help.config.customName': 'Votre propre fichier',
  'help.config.custom':
    'Le seul fichier que FluidEQ ne réécrit jamais : mettez-y vos propres lignes durables avec Modifier.',
  'help.config.reload': 'Relit la configuration sur le disque.',

  'help.dsp.title': 'Explorez le rack DSP',
  'help.dsp.intro':
    'Le rack DSP est une chaîne d’étages de studio. Avec le moteur FluidEQ, il traite tout ce que joue le PC ; avec Equalizer APO, il traite les pistes audio de la Bibliothèque. Il est coupé tant que FluidEQ est désactivé.',
  'help.dsp.steps':
    'Ouvrez DSP et choisissez une chaîne sous Chaîne entière, en haut : elle règle tous les étages d’un coup. À propos ouvre les notes d’une chaîne de genre, avec des exemples à écouter sur YouTube.\nCliquez sur un étage dans le rail pour l’ouvrir, et activez-le avec son propre interrupteur. Son sélecteur de préréglages ne règle que cet étage, et Enregistrer à côté ne garde que cet étage.\nLe Normalizer est à part des chaînes : choisir une chaîne ne le change jamais.\nComparez avec l’étage coupé à un volume semblable. Isoler, là où un étage le propose, ne joue que ce que cet étage change. Ctrl+clic sur un bouton le remet à sa valeur.\nEnregistrer garde tout le rack comme une chaîne à vous ; Exporter et Importer l’emportent sur un autre ordinateur, et Réinitialiser remet la chaîne comme elle était.\nTous les canaux applique le rack à chaque canal d’une sortie surround ; l’interrupteur à côté allume ou coupe tout le rack.\nDynamics, De-esser, Denoise, la Salle et Crossfade ont leurs propres chapitres. Le filtre de jeu est dans le Gaming Lab ; tant que le son propre d’un jeu est actif, cette page se repose pour que rien ici ne l’écrase.',
  'help.dsp.tip':
    'Plus fort paraît souvent meilleur simplement parce que c’est plus fort : comparez donc à niveaux égaux. Faites Ctrl+clic sur un bouton rotatif pour le ramener à sa valeur par défaut.',
  'help.dsp.keywords':
    'effets audio, limiteur, normalisation du volume, volume constant, élargisseur, largeur stéréo, renforcement des basses, infrabasses, transitoires, écrêtage, FX, plugins, loudness, LUFS, sub-bass, mastering, crossfade, gapless, bypass, presets, dé-esseur, de-esser, sifflantes, sibilance, s aigus, voix, podcast, profils, enregistrer un profil, bruits de pas, pas, entendre les pas, footsteps, jeux, son de jeu, rechargement, égalisation du volume, game, game filter, dialogue, voice clarity, voices forward, ambience, environment, rain, wind, hooves, horses, headset',
  'help.dsp.normalizer':
    'Égalise le niveau de la source avant tout effet : Sonie, True Peak ou coupé. Choisir une chaîne ne le change jamais.',
  'help.dsp.denoise':
    'Répare le souffle, le ronflement et les craquements. Le nettoyeur de voix neuronal agit sur les pistes de la Bibliothèque.',
  'help.dsp.exciter': 'Ajoute des harmoniques pour le corps et l’air.',
  'help.dsp.bassForge':
    'Ajoute une vraie octave sous la basse, ou ses harmoniques pour les petits haut-parleurs.',
  'help.dsp.equaliser':
    'Quinze bandes paramétriques, en phase minimale ou linéaire.',
  'help.dsp.bassPunch':
    'Façonne l’attaque, le maintien et l’éclosion de la basse.',
  'help.dsp.dimension': 'Élargit l’image stéréo sans changer la somme mono.',
  'help.dsp.room':
    'Le surround au casque : chaque canal devient une enceinte dans une salle autour de vous.',
  'help.dsp.maximizer':
    'Augmente le niveau sans laisser les crêtes dépasser le plafond.',
  'help.dsp.master': 'Niveau final, cible de sonie et protection des crêtes.',
  'help.dsp.crossfade':
    'Enchaîne une piste de la Bibliothèque sur la suivante.',
  'help.dsp.presets':
    'Des chaînes prêtes pour la musique, les genres, les appareils et les réparations. En choisir une règle tous les étages d’un coup.',
  'help.dsp.chainActionsName': 'Actions de la chaîne',
  'help.dsp.chainActions':
    'Réinitialiser remet la chaîne ; Enregistrer garde le rack comme une chaîne à vous ; Exporter et Importer l’emportent sur un autre ordinateur.',
  'help.dsp.switchesName': 'Interrupteurs du rack',
  'help.dsp.switches':
    'Tous les canaux applique le rack à chaque canal d’une sortie surround, ou à la seule paire avant ; Activé allume tout le rack.',
  'help.dsp.stagePresetName': 'Préréglage de l’étage',
  'help.dsp.stagePreset':
    'Les préréglages propres à l’étage ouvert, avec ses flèches, Réinitialiser et Enregistrer, qui ne concernent que cet étage.',

  'help.room.title': 'La Salle : le surround au casque',
  'help.room.intro':
    'La Salle fait d’un casque une salle d’écoute. Chaque canal du son devient une enceinte autour de votre tête, rendue à travers une tête mesurée et les réflexions d’une salle que vous façonnez vous-même : un film se tient devant vous et un jeu vous entoure. Elle demande le moteur FluidEQ et un casque ; sur des enceintes elle ne sert à rien.',
  'help.room.steps':
    'Ouvrez DSP, choisissez Salle dans le rail et activez-la. La stéréo devient deux enceintes devant vous ; un film 5.1, cinq et le caisson ; un jeu 7.1, tout l’anneau. La ligne sous les préréglages dit lequel.\nChoisissez une salle sous Salle prédéfinie — d’abord les salles mises en avant, puis les classiques et les vôtres — ou réglez vous-même Espace, Ambiance et Distance et faites glisser une enceinte autour de l’anneau. Les enceintes que le flux joué n’atteint pas sont dessinées endormies.\nCliquez sur une enceinte : le panneau à côté du dessin devient le sien, avec son angle, sa distance, son niveau, et Muet ou Solo.\nSous Votre tête, cliquez sur Lancer le test d’écoute et répondez à cinq courtes paires : la salle prend la tête qui place les sons devant vous. Petite, Moyenne et Grande se choisissent aussi à la main.\nEnregistrez sous un nom une salle qui vous plaît ; une salle enregistrée revient d’un clic et ne change jamais votre tête.',
  'help.room.tip':
    'Les jeux et les films n’envoient leurs canaux surround qu’à une sortie que Windows croit dotée d’autant d’enceintes : quand le pilote l’accepte, le panneau de sortie propose de passer en 7.1 d’une pression.',
  'help.room.keywords':
    'surround virtuel, enceintes virtuelles, virtualisation, son spatial, spatialisation, son 3D, home cinéma, immersif, enveloppant, réverbération, binaural, HRTF, soundstage, crossfeed, subwoofer, presets',
  'help.room.picker':
    'Les salles de départ, groupées comme les profils de chaque autre étage ; Personnalisé dès que vous en façonnez une.',
  'help.room.picture':
    'La salle vue de dessus : des murs qui s’effacent en absorbant, les enceintes sur leur anneau, la tête au milieu. Tout est dessiné à une seule échelle : une enceinte plus éloignée que la salle n’est large se dessine donc hors de ses murs. Faites-en glisser une et sa jumelle suit ; maintenez Maj pour la déplacer seule.',
  'help.room.speaker':
    'Appuyez sur une enceinte de la salle et ce volet devient le sien : son angle en degrés, sa propre distance, son niveau, et Muet ou Solo pour l’écouter seule.',
  'help.room.speakerName': 'L’enceinte choisie',
  'help.room.dials':
    'Ce que vous entendez des murs, la traîne douce qui suit, et la distance des enceintes. Taille, Murs, ainsi que la longueur et la couleur de la traîne sont dans Caractère de la salle, en dessous.',
  'help.room.head':
    'La tête mesurée par laquelle la salle est rendue — petite, moyenne ou grande — et le test d’écoute qui la choisit pour vos oreilles.',
  'help.room.bass':
    'Envoie les basses des enceintes au caisson ou les garde en pleine bande, à la coupure de votre choix, et règle les niveaux du centre et du caisson.',
  'help.room.stereo':
    'Pour une source stéréo uniquement : la garder en scène avant, ou remplir la salle autour de vous selon la quantité choisie.',
  'help.room.saved':
    'Nommez la salle telle qu’elle est ; elle revient d’une pression.',
  'help.room.liveName': 'Ce que fait la salle',
  'help.room.live':
    'Lu depuis le moteur : quelles enceintes le flux en lecture atteint, ou pourquoi la salle est au repos.',

  'help.denoise.title': 'Débruitage et analyse',
  'help.denoise.intro':
    'Débruitage réduit le souffle, le ronflement secteur et les craquements. Avec le moteur FluidEQ, il agit en direct sur tout ce que joue le PC ; le nettoyeur de voix neuronal et le plancher de bruit analysé sont réservés aux pistes de la Bibliothèque. Une réduction plus forte n’est pas forcément meilleure.',
  'help.denoise.steps':
    'Lancez quelque chose qui contient le bruit à réduire et sélectionnez Débruitage dans DSP.\nActivez Souffle, Ronflement ou Craquements avec un réglage léger, et écoutez les passages calmes et les détails musicaux.\nAugmentez la réduction progressivement, puis contournez l’étage pour vérifier que l’amélioration vaut la perte de détail éventuelle.\nPour un fichier de Bibliothèque, attendez l’analyse avant de comparer le bruit mesuré ou le nettoyage neuronal de voix. Le son système accepte la réduction du souffle, ronflement et clics ; le nettoyage neuronal est réservé à Bibliothèque.',
  'help.denoise.tip':
    'Guettez les détails adoucis, les textures aqueuses ou le pompage. Ce n’est pas un nettoyage du micro. Si vous n’entendez aucun changement, vérifiez que le rack et l’étage sont tous deux activés.',
  'help.denoise.keywords':
    'suppression du bruit, enlever le bruit, bruit de fond, grésillements, bourdonnement, sifflement, parasites, friture, restauration, vinyle, cassette, denoise',
  'help.denoise.preset':
    'Des points de départ pour un nettoyage léger ou poussé, le souffle, le ronflement, les clics, le vinyle, la bande ou un podcast. Enregistrer garde les vôtres.',
  'help.denoise.isolate':
    'Ne joue que ce que Denoise retire, pour vérifier qu’il n’enlève rien que vous voulez garder.',
  'help.denoise.graphName': 'Image du bruit',
  'help.denoise.graph':
    'Le son face à son plancher de bruit, avec la réduction du souffle, le ronflement et les clics réparés dessinés au fil de l’eau.',
  'help.denoise.analysis':
    'Sur un titre de la Bibliothèque : le plancher de bruit, le ronflement et les clics par minute, mesurés sur le fichier lui-même. Réanalyser mesure à nouveau.',
  'help.denoise.hiss':
    'Baisse le souffle constant sous la musique. La limite de réduction en laisse un peu, pour que le reste ne gargouille pas.',
  'help.denoise.hum':
    'Retire le ronflement du secteur et ses harmoniques. Auto prend 50 ou 60 Hz d’après l’analyse.',
  'help.denoise.clicks':
    'Trouve et comble les clics et craquements courts ; ce qui est plus long est laissé, pour épargner la batterie.',
  'help.denoise.voice':
    'Le nettoyeur de voix neuronal, pour la lecture de la Bibliothèque. Son modèle se télécharge à la première utilisation.',
  'help.denoise.liveName': 'Ce qu’il fait',
  'help.denoise.live':
    'Combien il réduit en ce moment, les clics réparés, et chaque instant où le nettoyeur de voix a pris du retard.',

  'help.graph.title': 'Le graphique et ses commandes',
  'help.graph.intro':
    'Le graphique de réponse dessine vos courbes d’égalisation sur le son en direct. Ses options se reposent hors de vue et reviennent sous le pointeur : la légende dans un coin, Affichage et plein écran dans l’autre, et en bas la galerie des looks, celui du graphique au milieu avec ses interrupteurs, le précédent et le suivant aux extrémités. Ce que propose la galerie change avec le look : un style standard ou une scène.',
  'help.graph.steps':
    'Cliquez sur le nom du rendu pour choisir un style ou une scène. Les flèches à côté, Espace et Ctrl+Espace les font défiler.\nOuvrez Affichage pour ce que dessine le graphique — chaque tracé a son interrupteur, chaque courbe le sien —, la plage de fréquences, la hauteur et la position de l’onde, et Comment c’est dessiné : la fréquence d’images (toutes celles de votre écran, ou 60 ou 30, maintenue à 60 sur batterie), la résolution et le lissage. Les styles standard gardent leurs propres choix, à part des scènes.\nUne scène ajoute ses propres réglages à Affichage — ce que son auteur vous a laissé régler — et Utiliser son onde d’origine remet l’onde à la hauteur et à la position choisies par cet auteur.\nDouble-cliquez sur le graphique pour qu’il remplisse l’écran, et à nouveau pour revenir. En plein écran, le bord supérieur de la fenêtre fait venir l’en-tête et le bord inférieur les commandes de lecture ; un clic les range.\nTouches : Ctrl+F plein écran, Échap retour, Ctrl+G la grille, Ctrl+W et Ctrl+S passent par Onde uniquement, Onde et courbes et Courbes uniquement, Ctrl+I le sens de l’onde, Ctrl+A toutes les bandes. Sur le point d’une bande, faites-le glisser pour le déplacer, utilisez les flèches pour l’ajuster et le clic droit pour son menu ; Ctrl+molette change le Q d’un point sélectionné.\nCliquez sur le nom d’une courbe dans la légende du graphique pour masquer ou afficher son tracé. Le son ne change pas. Retirez ou modifiez la couche sous Courbes quand vous voulez changer ce que vous entendez.',
  'help.graph.tip': 'Tout ceci ne change que le dessin, jamais votre son.',
  'help.graph.keywords':
    "analyseur de spectre, forme d'onde, quadrillage, taux de rafraîchissement, fluidité, saccadé, réactivité, FPS, framerate, fullscreen, raccourcis, raccourcis clavier, double-clic, vue agrandie, agrandir, étiquettes, étiquettes de bandes, étiquettes de l’eq, libellés, clavier, touches fléchées, graphismes, réglages graphiques, résolution, lissage, cadence, galerie, légende, plage de fréquences, pente de l’analyseur",
  'help.graph.stripCaption': 'Avec un style standard',
  'help.graph.legend':
    'Le nom de chaque courbe dessinée, et Sortie en direct pour l’onde. Appuyez sur un nom pour masquer ou afficher son tracé ; le son ne change pas.',
  'help.graph.previous': 'Revient au style précédent.',
  'help.graph.picker': 'Ouvre tous les styles et scènes.',
  'help.graph.placeName': 'Place dans le défilement',
  'help.graph.place':
    'Où se trouve ce look parmi ceux que parcourent les flèches.',
  'help.graph.next': 'Passe au style suivant.',
  'help.graph.auto': 'Change de style toutes les 10 secondes à 2 minutes.',
  'help.graph.colouring':
    'Colore le style : Auto, Uniforme, Fréquence, Niveau ou Chaleur.',
  'help.graph.newLook': 'Crée un style à vous à partir de celui-ci.',
  'help.graph.gridName': 'Grille',
  'help.graph.grid': 'Affiche ou masque la grille et les échelles.',
  'help.graph.hintName': 'Modifier sur le graphique',
  'help.graph.hint':
    'Survolez-le pour les gestes : faire glisser un point, Ctrl ou Maj pour sélectionner, Ctrl+molette pour le Q, Ctrl+glisser déplace un groupe en cloche.',
  'help.graph.viewName': 'Affichage',
  'help.graph.view':
    'Ce que dessine le graphique et comment : chaque courbe, les étiquettes, la légende, l’onde, la grille, la plage de fréquences et l’indicateur.',
  'help.graph.plusCaption': 'Avec une scène',
  'help.graph.creditName': 'La scène et son auteur',
  'help.graph.credit':
    'Quelle scène joue et qui l’a faite. Appuyez dessus pour choisir un autre style ou une autre scène.',
  'help.graph.likeName': 'J’aime',
  'help.graph.like':
    'Aime la scène en cours, ce qui rapporte des points à son auteur. Sur une scène à vous, il montre combien de j’aime elle a.',
  'help.graph.lighting': 'Éclaire vos appareils RVB avec cette scène.',
  'help.graph.desktop': 'Place cette scène derrière les icônes du Bureau.',
  'help.graph.viewCaption': 'Le menu Affichage',
  'help.graph.fullscreen': 'Le graphique remplit l’écran.',
  'help.graph.curves':
    'Un interrupteur par courbe que dessine le graphique, dans l’ordre où elles s’appliquent. Ctrl+W passe par Onde seule, Onde avec courbes et Courbes seules ; Ctrl+S revient en arrière.',
  'help.graph.labels':
    'La fréquence, le Q et le gain de chaque bande au-dessus de son point.',
  'help.graph.wave':
    'L’onde en direct de ce que vous entendez, dessinée dans le look choisi.',
  'help.graph.range':
    'La part du spectre que couvre le graphique : 10 Hz–20 kHz au départ, 20 Hz–20 kHz, 10 Hz–30 kHz, ou 20 Hz–16 kHz, là où les enregistrements ont du son. Sans grille, il couvre 20 Hz–16 kHz.',
  'help.graph.slope':
    'Incline l’analyseur jusqu’à 6 dB par octave, pour que la musique, qui baisse vers les aigus, paraisse plus plate. Désactivé par défaut ; seulement sur les styles qui dessinent l’analyseur.',
  'help.graph.meter': 'L’indicateur de sortie dans la colonne de gauche.',
  'help.graph.drawing':
    'Cadence, résolution et lissage, gardés à part pour les styles standard et les scènes.',
  'help.graph.sampleScene': 'Aurore',
  'help.graph.sampleScenePrevious': 'Bloom',
  'help.graph.sampleSceneNext': 'Neon City',
  'help.graph.sampleMaker': 'Lumen Works',
  'help.looks.title': 'Styles et scènes',
  'help.looks.intro':
    'Les styles standard sont des dessins gratuits du son en direct, que vous pouvez colorer et concevoir vous-même : Ligne et Aire pour un tracé net, Blocs LED et Pics pour du punch, Treillis, Horizon et Flammes dansantes pour des scènes entières. Les scènes sont des images vivantes dessinées par la carte graphique, comme Alpin, Aurore, Floraison et Ville néon, où les basses, le rythme et les aigus font chacun bouger quelque chose de différent.',
  'help.looks.steps':
    'Sur le graphique, cliquez sur le nom du style. Choisissez une rubrique à gauche, ou cherchez dans tout à la fois.\nAvec « De », ne voyez que ceux de FluidEQ, les scènes des membres ou les vôtres. Si une scène n’est pas encore à vous, elle est verrouillée, et la choisir explique comment l’obtenir.\nSur un style standard, appuyez sur Nouveau style pour changer ses couleurs, son mouvement et ses crêtes, puis enregistrez-le ; il apparaît sous « De : Les vôtres ».',
  'help.looks.tip':
    'Une scène apporte ses propres couleurs : réglez son attaque et son relâchement dans Affichage. Les styles standard ont leurs propres réglages graphiques dans Affichage, séparément des scènes : pleine résolution et mise à l’échelle simple au départ. Si une scène ne peut pas tourner sur cet ordinateur, le graphique dessine un style gratuit au lieu d’un tracé vide.',
  'help.looks.keywords':
    'thème, apparence, scène, scènes, visualiseur, visualisation, animations, personnaliser, personnalisation, effets visuels, skin, look, visualizer, graphismes, réglages graphiques, résolution, qualité',
  'help.looks.searchName': 'Recherche',
  'help.looks.search':
    'Trouve les styles et scènes par nom, créateur ou catégorie.',
  'help.looks.placesName': 'Rubriques',
  'help.looks.places':
    'Tout, Nouveautés et mises à jour, les types de styles et chaque catégorie de scènes, chacun avec son nombre.',
  'help.looks.from': 'Qui l’a créé : FluidEQ, les membres ou vous.',
  'help.looks.viewName': 'Affichage et ordre',
  'help.looks.view':
    'Des images ou une liste détaillée, triées par nouveautés, mises à jour récentes, nom ou les plus utilisés.',
  'help.looks.plus':
    'Chaque style en image. Nouveau ou Mise à jour signale ce qui a changé, et En cours le style du graphique.',

  'help.plus.title': 'Votre compte, les crédits et l’onglet Scènes',
  'help.plus.intro':
    'Le compte est facultatif : tout ce qui était gratuit fonctionne sur cet ordinateur sans compte. Une fois connecté, l’onglet Scènes réunit la Galerie, le Studio, l’Éclairage dynamique et le fond du Bureau. Une scène de la Galerie coûte un crédit et vous appartient pour de bon ; un compte confirmé reçoit 1 crédit gratuit, et les packs de crédits se paient une seule fois.',
  'help.plus.steps':
    'Ouvrez l’onglet Scènes et appuyez sur Se connecter ou sur Créer votre compte gratuit, puis saisissez le code à six chiffres envoyé à votre adresse e-mail. Une fois la connexion faite, votre compte est la carte au bas de la colonne de gauche de l’onglet.\nChoisissez Galerie. Ouvrez une scène, regardez-la, et appuyez sur Obtenir pour y dépenser un crédit.\nPour plus de crédits, ouvrez votre compte depuis cette carte et choisissez un pack. Il se paie une seule fois sur Stripe, dans votre navigateur.',
  'help.plus.tip':
    'L’application ne voit jamais votre carte, et rien ne se renouvelle. Un compte reste connecté sur cinq ordinateurs au plus.',
  'help.plus.keywords':
    'compte, se connecter, connexion, s’inscrire, inscription, crédits, crédit, pack, acheter, prix, tarif, coût, paiement, payer, premium, payant, scène, abonnement, résilier, membre, code e-mail',
  'help.plus.visualizers':
    'Des scènes de FluidEQ et des membres, prêtes pour votre musique.',
  'help.plus.studio': 'Créez vos propres scènes avec votre IA.',
  'help.plus.lighting': 'Vos appareils RVB suivent la scène.',
  'help.plus.fold':
    'Replie la barre latérale sur ses images ; elle se rouvre au survol.',

  'help.gallery.title': 'La galerie de scènes',
  'help.gallery.intro':
    'La galerie réunit les scènes de FluidEQ et celles que publient les membres. Toute personne ayant un compte peut parcourir la galerie. Si une scène a un aperçu publié, son clip muet de dix secondes tourne en boucle jusqu’à ce que vous passiez à une autre scène. Les scènes sans clip affichent leur couverture. Une scène obtenue avec un crédit réagit à votre musique et reste dans vos styles.',
  'help.gallery.steps':
    'Ouvrez Scènes → Galerie. Recherchez, triez par Les plus aimées, Cette semaine ou Les plus récentes, ou choisissez une catégorie.\nOuvrez une scène et appuyez sur Obtenir pour la garder avec un crédit, puis sur Lancer sur le graphique. Les flèches, ou ← et →, passent d’une scène à l’autre.\nAimez avec le cœur les scènes que vous avez, et signalez celle qui ne devrait pas être là.',
  'help.gallery.tip':
    'Les scènes de vos styles se mettent à jour d’elles-mêmes, et la page d’une scène indique ce qui a changé à chaque version. Une scène que vous publiez apparaît une fois que le créateur de FluidEQ l’a approuvée. Ouvrir dans le Studio montre comment sont faites les scènes de FluidEQ. Une scène 3D l’indique sur sa carte et sa page, avec les touches qui déplacent sa caméra. Pendant qu’une scène joue, Affichage → Couleurs de la fenêtre choisit ce que porte la fenêtre : Original, Couleurs ou Ambiance.',
  'help.gallery.keywords':
    'télécharger, scènes, galerie de scènes, visualiseurs, découvrir, populaires, tendances, modération, inapproprié, like, visualizers',
  'help.gallery.search': 'Trouve des scènes et des créateurs.',
  'help.gallery.sortName': 'Trier',
  'help.gallery.sort':
    'Les plus aimées, les plus aimées cette semaine, ou les plus récentes.',
  'help.gallery.categoriesName': 'Catégories',
  'help.gallery.categories': 'Affiche un seul type de scène.',
  'help.gallery.mine': 'Les scènes que vous avez publiées, avec leurs j’aime.',
  'help.gallery.cardName': 'Une scène',
  'help.gallery.card':
    'Son image ouvre la scène. Obtenir la garde pour un crédit, et le cœur indique que vous l’aimez.',
  'help.gallery.manage':
    'Ce que chaque écran affiche en arrière-plan du Bureau.',
  'help.gallery.stop': 'Arrête tous les arrière-plans du Bureau.',
  'help.gallery.sceneCaption': 'La page d’une scène',
  'help.gallery.back': 'Retour à la galerie, là où vous l’aviez laissée.',
  'help.gallery.play':
    'Lance la scène sur le graphique. Une scène que vous n’avez pas encore propose Obtenir, pour un crédit.',
  'help.gallery.desktop': 'Place la scène derrière les icônes du Bureau.',
  'help.gallery.inspect':
    'Ouvre la scène de FluidEQ dans le Studio pour voir comment elle est faite.',

  'help.studio.title': 'Créez des scènes dans le Studio',
  'help.studio.intro':
    'Le Studio transforme une description en scène. Votre propre assistant IA écrit la scène dans un dossier de projet, et FluidEQ lance chaque version sur votre musique dès qu’elle est enregistrée. Le Studio est gratuit pour tous les comptes.',
  'help.studio.steps':
    'Ouvrez Scènes → Studio et appuyez sur Nouveau projet… Donnez-lui un nom ; FluidEQ crée son dossier avec une scène qui bouge déjà.\nDécrivez votre idée, ouvrez le dossier dans votre assistant IA et collez le prompt copié avec Copier le prompt IA.\nOu écrivez ce qui doit changer dans la discussion à côté de la scène : Claude Code sur cet ordinateur, connecté avec votre propre abonnement, modifie la scène et joue chaque version. Chaque réponse garde sa version, avec Rétablir.\nRegardez l’aperçu à chaque enregistrement de fichier et essayez les signaux de test. Puis Ajouter à mes styles, Publier… ou Exporter…\nDans Publier…, écrivez une ligne sur la scène ou cliquez sur Écrire avec l’IA, puis sur Envoyer pour examen : FluidEQ enregistre en l’envoyant l’aperçu muet de dix secondes destiné à la Galerie, sur le morceau de démonstration.',
  'help.studio.tip':
    'Double-cliquez sur l’aperçu pour le plein écran. Explorer une scène FluidEQ… ouvre l’une des scènes de FluidEQ pour apprendre en l’étudiant ; elle ne peut pas être publiée. Les scènes qui clignotent trop fort ou sont trop lourdes sont retenues. Une scène que vous publiez est d’abord lue par le créateur de FluidEQ, et une fois approuvée, elle joue gratuitement pour vous partout.',
  'help.studio.keywords':
    'intelligence artificielle, créer une scène, créer un visualiseur, éditeur de scènes, shader, GLSL, ChatGPT, Claude, discussion, chat, demander un changement, claude code, rétablir, versions',
  'help.studio.project': 'Vos projets, et des scènes FluidEQ à explorer.',
  'help.studio.stageName': 'Aperçu',
  'help.studio.stage':
    'La scène, en direct sur votre musique. Double-cliquez pour le plein écran.',
  'help.studio.hears':
    'Ce que reçoit la scène : niveau, temps, basses, médiums, aigus.',
  'help.studio.tabs':
    'Réglages essaie l’onde et les réglages propres à la scène, Code montre son code à chaque enregistrement de votre IA, Performance comment elle tourne ici, et Ce qu’elle entend maintenant est ouvert en dessous.',
  'help.studio.chat':
    'Demandez une modification à Claude avec vos propres mots. Chaque réponse qui a changé la scène peut faire revenir cette version.',
  'help.studio.signals': 'Des signaux de test qui n’animent que cet aperçu.',
  'help.studio.size': 'Essaie la scène en plein écran.',

  'help.desktop.title': 'Le fond du Bureau',
  'help.desktop.intro':
    'Le fond du Bureau place une scène derrière les icônes du Bureau, sur un écran ou sur chacun d’eux, tant que FluidEQ tourne.',
  'help.desktop.steps':
    'Mettez une scène sur le graphique et appuyez sur le bouton en forme d’écran à côté de son nom, ou choisissez Affichage → Définir comme arrière-plan du Bureau.\nAppuyez sur les écrans de la carte, choisissez Avec la musique ou Calme, et appuyez sur Définir l’arrière-plan.\nPour le modifier ou l’arrêter, ouvrez Scènes → Galerie et utilisez Gérer ou Arrêter en haut.',
  'help.desktop.tip':
    'Il se met en pause tant que des fenêtres couvrent l’écran, quand le PC est verrouillé et, si vous le choisissez, sur batterie ; il revient au démarrage de FluidEQ. Quitter FluidEQ l’arrête. Windows uniquement.',
  'help.desktop.keywords':
    "fond d'écran, fond d'écran animé, plusieurs écrans, multi-écran, double écran, second écran, moniteurs, wallpaper",
  'help.desktop.monitors':
    'Vos écrans tels que Windows les dispose. Appuyez sur ceux à utiliser.',
  'help.desktop.music': 'Bouge avec ce qui est en lecture.',
  'help.desktop.calm': 'Une animation lente et paisible qui ignore la musique.',
  'help.desktop.follow':
    'Change avec la scène du graphique, que vous la choisissiez ou que le défilement automatique le fasse.',
  'help.desktop.battery':
    'Économise l’énergie lorsque l’ordinateur est débranché.',
  'help.desktop.start': 'Le lance sur les écrans choisis.',

  'help.lighting.title': 'Éclairage dynamique (bêta)',
  'help.lighting.intro':
    'L’éclairage dynamique illumine votre clavier, votre souris, votre tapis de souris, votre casque et votre support avec la scène du graphique, via Windows Dynamic Lighting et Razer Chroma. Il est en bêta, alors dites-nous comment se comportent vos appareils.',
  'help.lighting.steps':
    'Ouvrez Scènes → Éclairage dynamique et activez-le, ou appuyez sur le bouton d’éclairage à côté d’une scène sur le graphique.\nChoisissez le style lumineux de cette scène — Scène, Vague de couleur, Spectre ou Onde rythmique — et réglez sa luminosité et ce à quoi il réagit.\nCliquez sur un appareil sous Vos appareils pour le régler seul ; Tous les appareils revient au réglage de l’ensemble.',
  'help.lighting.tip':
    'Si Windows réserve un appareil à une autre application, la page indique le paramètre à changer et l’ouvre pour vous. Les appareils Razer ont besoin de Razer Synapse en cours d’exécution, avec Chroma Apps autorisé.',
  'help.lighting.keywords':
    'rétroéclairage, lumières, éclairage ambiant, effets lumineux, RGB, RVB, LED',
  'help.lighting.switch': 'Éclaire vos appareils pendant qu’une scène joue.',
  'help.lighting.browse': 'Ouvre la galerie pour choisir une scène.',
  'help.lighting.previewName': 'Aperçu du bureau en direct',
  'help.lighting.preview':
    'Votre propre bureau, éclairé avec les couleurs qui lui sont envoyées.',
  'help.lighting.devices':
    'Tous les appareils trouvés. Cliquez sur l’un d’eux pour le régler seul ; le bouton Tous les appareils, au-dessus de la liste, les règle de nouveau tous à la fois.',
  'help.lighting.style':
    'Scène, Vague de couleur, Spectre ou Onde rythmique, mémorisé pour chaque scène.',

  'help.online.title': 'Écoutez avec Médias en ligne',
  'help.online.intro':
    'Médias en ligne lit YouTube, YouTube Music, Bandcamp, Twitch et Suno dans FluidEQ, disposé comme la Bibliothèque : les sites et vos recherches récentes dans le panneau latéral, la barre au-dessus de la page. Ce qui est lu passe par votre EQ comme toute autre application ; la lecture et la connexion dépendent de chaque site.',
  'help.online.steps':
    'Choisissez un site dans le panneau latéral. Cherchez depuis la barre, ou trouvez quelque chose sur sa page et lancez-le.\nAppuyez sur une recherche récente pour la relancer sur le site ouvert.\nPassez à un autre onglet pendant la lecture : la page continue de jouer et la barre en bas de la fenêtre la suit.\nActivez Un seul lecteur si FluidEQ et les autres lecteurs doivent se mettre en pause l’un l’autre plutôt que se superposer.',
  'help.online.tip':
    'Avec le moteur FluidEQ, Médias en ligne passe par votre EQ et le rack DSP comme toute autre application. Avec Equalizer APO, le rack reste réservé aux pistes de la Bibliothèque.',
  'help.online.keywords':
    'youtube, youtube music, bandcamp, twitch, suno, streaming, web, site, navigateur, en ligne, historique de recherche, recherches récentes, déconnexion, couleurs, page sombre',
  'help.online.sites':
    'Les sites. Un point à côté indique qu’il est en lecture. L’épingle au-dessus du panneau le replie sur leurs icônes.',
  'help.online.recent':
    'Ce que vous avez cherché. Appuyez sur une recherche pour la relancer sur le site ouvert ; son × l’oublie.',
  'help.online.colours':
    'Colore la page du site aux couleurs de FluidEQ, sur votre écran seulement. Les vidéos, images et logos ne changent jamais, et les sites aux pages claires gardent les leurs.',
  'help.online.signOut':
    'Efface toutes les connexions, cookies et pages en cache que garde le lecteur.',
  'help.online.navName': 'Précédent, suivant et actualiser',
  'help.online.nav':
    'Parcourez les pages ouvertes sur le site, ou rechargez la page.',
  'help.online.search':
    'Cherche sur le site ouvert et garde la recherche dans Recherches récentes.',

  'help.library.title': 'Parcourez et rangez votre Bibliothèque',
  'help.library.intro':
    'La Bibliothèque réunit la musique et les vidéos de vos disques sur une page : les rayons dans le panneau latéral, une barre pour trouver et disposer, et en dessous l’endroit où vous êtes. Pochettes et informations viennent des tags des fichiers, que l’éditeur de tags remet en ordre.',
  'help.library.steps':
    'Appuyez sur Ajouter un dossier au bas du panneau latéral et choisissez le dossier de votre musique. La ligne d’état sous la page indique quand la Bibliothèque est à jour.\nChoisissez un rayon : Albums, Artistes, Genres, Chansons, Dossiers (vos dossiers s’ouvrent en arborescence dessous), Vidéos ou une playlist. Une vidéo se lit dans la page, avec un onglet Sous-titres pour ses sous-titres.\nCherchez depuis la barre, affichez le rayon en Détails, Grille ou Cover Flow, et ordonnez-le avec Trier. Les flèches reviennent en arrière et en avant parmi les endroits visités.\nOuvrez un album, un artiste ou un dossier pour ses chansons. Le nom d’un artiste, où qu’il soit, ouvre sa page : ses albums et toutes les chansons où il apparaît.\nPour corriger des tags, faites un clic droit sur une chanson, plusieurs chansons ou un album et choisissez Modifier les tags (Ctrl+I) ou Corriger les tags automatiquement (Ctrl+Maj+I). Une chanson s’ouvre à côté de la page ; un album, un dossier ou une sélection s’ouvre comme la page.\nVérifiez les modifications et appuyez sur Enregistrer. Les fichiers sont écrits en arrière-plan, et la carte dans le coin propose Annuler, qui remet les anciens tags.',
  'help.library.tip':
    'Survolez le bouton de FluidEQ dans la barre des tâches de Windows pour Précédent, Lecture et Suivant, même fenêtre réduite. Déposez de la musique sur la Bibliothèque pour la lire. La Bibliothèque a besoin des fichiers là où elle les a trouvés : rebranchez le disque, ou ajoutez à nouveau un dossier déplacé.',
  'help.library.keywords':
    'lecteur audio, médiathèque, formats audio, jaquette, pochette, métadonnées, scanner, importer ma musique, arborescence, cover flow, grille, sous-titres, éditeur de tags, modifier les tags, renommer les fichiers, musicbrainz, annuler, MP3, FLAC, WAV, AAC, ID3, Playlists, Nouvelle playlist',
  'help.library.shelvesName': 'Rayons',
  'help.library.shelves':
    'Ce que contient la Bibliothèque, avec le nombre sur chaque rayon. Dossiers ouvre en dessous l’arborescence de vos dossiers.',
  'help.library.playlists':
    'Toutes vos playlists, où l’on en crée une nouvelle ; dessous, Favoris et les vôtres.',
  'help.library.addFolder':
    'Ajoute un dossier de musique ou de vidéos. Vos dossiers, dessous, les liste et en retire un.',
  'help.library.history':
    'Revient en arrière et en avant parmi les endroits ouverts.',
  'help.library.search':
    'Trouve chansons, artistes et albums dans toute la Bibliothèque.',
  'help.library.views': 'Détails, Grille ou Cover Flow, sur chaque rayon.',
  'help.library.sort':
    'Ordonne le rayon par titre, artiste, année, ajout récent, les plus écoutés et plus encore. La flèche inverse l’ordre.',
  'help.library.upNext':
    'Ouvre et replie le panneau de droite : le titre en cours, À suivre, Détails et Paroles.',
  'help.library.album':
    'Ouvre l’album. Un clic droit le lit, le met en file, le range dans une playlist ou en modifie les tags en entier.',
  'help.library.rescan':
    'Indique si la Bibliothèque est à jour. Analyser à nouveau relit vos dossiers pour les changements ; Forcer une nouvelle analyse, à côté, relit chaque fichier.',
  'help.library.tagsCaption':
    'Un album dans l’éditeur de tags, après la correction automatique',
  'help.library.fixAuto':
    'Complète ce qui manque à partir des noms de fichiers, du nom du dossier, d’un fichier .cue et de ce sur quoi la plupart des chansons s’accordent, avec l’image du dossier comme pochette. Rien n’est cherché en ligne.',
  'help.library.searchWeb':
    'Ouvre l’album sur MusicBrainz dans votre navigateur. FluidEQ ne télécharge rien.',
  'help.library.cover':
    'Une pochette pour toutes les chansons. Appuyez dessus pour choisir une image, en coller une ou en chercher une, ou déposez une image dessus.',
  'help.library.albumFields':
    'Valeurs saisies une fois pour toutes les chansons. Ce qui a changé est en couleur, la valeur remplacée barrée dessous ; la flèche remet l’ancienne.',
  'help.library.findReplace':
    'Trouve des mots dans tous les titres et les remplace d’un coup.',
  'help.library.fileNames':
    'Renomme les fichiers d’après leurs tags selon un modèle. Chaque nouveau nom apparaît sous sa chanson, l’ancien barré.',
  'help.library.sheet':
    'Le numéro, le titre et l’artiste de chaque chanson, modifiés comme dans un tableur. Faites glisser une ligne par sa poignée, puis appuyez sur Renuméroter dans l’ordre.',
  'help.library.save':
    'Écrit les modifications ; rien ne change sur le disque avant. Abandonner les supprime toutes.',
  'help.library.changesCaption': 'Modifications : ce qu’Enregistrer va écrire',
  'help.library.changes':
    'Tout ce qu’Enregistrer va écrire, compté. La liste prend la place d’À suivre tant que l’éditeur est ouvert.',
  'help.library.changesAlbum':
    'Ce qui change sur toutes les chansons. Une valeur ajoutée là où il n’y en avait pas est en vert ; une valeur remplacée montre l’ancienne barrée.',
  'help.library.changesSongs':
    'Les modifications propres à chaque chanson, puis les fichiers qui changent de nom.',

  'help.queue.title': 'Albums, À suivre et paroles',
  'help.queue.intro':
    'Un album s’ouvre sous sa pochette sans arrêter ce qui joue. À côté, le panneau de droite montre le titre en cours au-dessus de trois onglets : À suivre, les Détails du titre et ses Paroles.',
  'help.queue.steps':
    'Ouvrez un album et appuyez sur Lire, ou appuyez sur une chanson pour commencer par elle. Un second appui sur une chanson la reprend depuis le début.\nFaites un clic droit sur une chanson pour Ajouter à la file, Ajouter aux Favoris ou Ajouter à une playlist ; sélectionnez-en plusieurs avec Ctrl ou Maj.\nDans À suivre, appuyez sur une chanson pour la lire tout de suite, faites-la glisser pour changer l’ordre, ou survolez-la et appuyez sur × pour la retirer.\nActivez Continuer la lecture pour poursuivre avec le même genre quand la liste se termine. Surprenez-moi, au bas d’À suivre et dans la barre de lecture, lance une chanson au hasard de votre Bibliothèque et continue dans son style.\nParoles affiche les mots de la chanson depuis ses tags, ou depuis un fichier .lrc ou .txt du même nom à côté. Les lignes synchronisées suivent la chanson mot à mot.\nPas de paroles, ou les mauvaises ? Trouver d’autres paroles cherche la chanson en ligne dans votre navigateur. Importez le fichier téléchargé, collez le texte ou déposez le fichier sur l’onglet ; FluidEQ le garde avec la chanson.',
  'help.queue.tip':
    'Ouvrir dans Karaoké transforme les paroles d’une chanson en karaoké dans le Créateur de karaoké, où leur synchronisation se corrige. Sous Windows, déposez des fichiers ou dossiers de musique sur le Lecteur compact pour les ajouter à la Bibliothèque et à la file.',
  'help.queue.keywords':
    'file, à suivre, chanson suivante, aléatoire, répéter, favoris, playlist, continuer la lecture, lecture automatique, surprenez-moi, hasard, lecture en cours, paroles, lrc, paroles synchronisées, lrclib, genius, musixmatch, karaoké, ordre de lecture',
  'help.queue.recordCaption': 'Un album ouvert',
  'help.queue.place':
    'Où vous êtes : le rayon, puis l’album. Appuyez sur le rayon pour y revenir.',
  'help.queue.artist':
    'Ouvre la page de l’artiste : ses albums et toutes les chansons où il apparaît.',
  'help.queue.fix':
    'Ouvre l’album dans l’éditeur de tags, les propositions de la correction déjà saisies.',
  'help.queue.actionsName': 'Les boutons de l’album',
  'help.queue.actions':
    'Lire, Aléatoire, Ajouter à la file, Afficher dans l’Explorateur, et le menu de l’album : Favoris, playlists, Modifier les tags et plus.',
  'help.queue.albumSound':
    'Un son pour cet album, un EQ enregistré ou un préréglage, appliqué à chacune de ses chansons.',
  'help.queue.filter':
    'Restreint les chansons de cet album à mesure que vous tapez. La recherche de la barre couvre toute la Bibliothèque.',
  'help.queue.songsName': 'Les chansons',
  'help.queue.songs':
    'Appuyez sur une chanson pour la lire. Les barres marquent celle en cours, l’étoile vos Favoris ; un clic droit ouvre son menu.',
  'help.queue.paneCaption': 'Le panneau de droite, sur À suivre',
  'help.queue.now': 'La chanson en cours. Le nom de l’artiste ouvre sa page.',
  'help.queue.tabs':
    'À suivre, les Détails du titre (fichier, format et sonie) et ses Paroles. Pour une vidéo, le dernier onglet est Sous-titres.',
  'help.queue.keep':
    'Quand la liste se termine, continue avec le même genre, puis avec une surprise.',
  'help.queue.rowsName': 'Ce qui joue ensuite',
  'help.queue.rows':
    'La suite de ce que vous écoutiez, sous le nom de son album. Appuyez sur une chanson pour la lire tout de suite, faites-la glisser pour la déplacer, survolez-la pour son ×.',
  'help.queue.picks':
    'Les chansons que vous avez ajoutées, après la suite de l’album, dans l’ordre où vous les avez ajoutées.',
  'help.queue.surprise':
    'Une chanson au hasard de votre Bibliothèque tout de suite, puis d’autres dans son style.',
  'help.queue.lyricsCaption': 'Paroles, et Trouver d’autres paroles',
  'help.queue.lyricsLine':
    'La ligne chantée, éclairée mot à mot. Appuyez sur une ligne pour lire à partir d’elle.',
  'help.queue.sourceName': 'Leur provenance',
  'help.queue.source':
    'Les tags de la chanson, ou le fichier de paroles à côté, nommé. La corbeille supprime un fichier de paroles gardé avec la chanson ; les paroles à l’intérieur du fichier de la chanson ne sont jamais modifiées.',
  'help.queue.karaoke':
    'Crée un karaoké à partir de ces paroles dans le Créateur de karaoké, où leur synchronisation se corrige.',
  'help.queue.findOther':
    'Ouvre la recherche, à droite, pour apporter d’autres paroles.',
  'help.queue.sites':
    'Cherche la chanson sur LRCLIB (paroles gratuites et synchronisées), Genius ou Musixmatch, dans votre navigateur. FluidEQ ne récupère aucunes paroles lui-même.',
  'help.queue.import':
    'Garde les paroles avec la chanson : un fichier téléchargé, du texte collé ou un fichier déposé sur l’onglet (.lrc, .srt, .vtt, .ttml, .json, .yaml ou .txt).',

  'help.karaoke.title': 'Chantez avec Karaoké',
  'help.karaoke.intro':
    'Karaoké met vos propres morceaux sur une scène : les paroles au moment où elles sont chantées, les accords, et une bande de justesse qui dessine votre voix sur les notes du morceau et note chaque ligne. Vos morceaux sont dans une liste à côté, comme dans la Bibliothèque, et chacun passe par le lecteur de la Bibliothèque, avec vos réglages de son.',
  'help.karaoke.steps':
    "Ouvrez Karaoké et appuyez sur + à côté de Morceaux pour ajouter des fichiers ou un dossier entier : chaque morceau avec son fichier de paroles. Double-cliquez sur un morceau pour le chanter.\nUtilisez la rangée en haut de la scène : Justesse et Accords affichent ou masquent la bande de justesse et les accords, chacun de son côté ; Scène, Pochette, Vidéo ou Aucun choisit ce qui se tient derrière les paroles. Avec Scène, le choix de la scène apparaît à côté.\nActivez le micro dans le coin de la bande de justesse et chantez. Chaque note est une case et votre voix une ligne qui la traverse : verte juste, jaune proche, rouge à côté. Chaque note reçoit son verdict quand elle se termine.\nSous la bande, chaque ligne du morceau est une rangée de cases avec son score. Appuyez sur une ligne pour la rechanter depuis juste avant. À la fin du morceau, le résumé montre votre score sur 10 000, le plus difficile, un conseil et chaque ligne face à votre meilleur essai ; Voir les résultats le rouvre.\nOuvrez Réglages du mixage dans la barre du lecteur pour le volume, le ton mélodique, l'instrumental et, une fois le morceau séparé par le Créateur, la Voix témoin : la voix du chanteur sous la musique, aussi forte que vous le voulez.\nLe plein écran donne la fenêtre à la scène. La rangée et la barre du lecteur s'effacent après quelques secondes sans mouvement : amenez le pointeur au bord du haut pour l'en-tête ou au bord du bas pour la barre, ou épinglez-les avec les boutons à côté du plein écran.",
  'help.karaoke.tip':
    "Un fichier de paroles qui ne contient que les mots n'a pas de notes : la bande n'a alors rien à faire chanter ni à noter ; les fichiers UltraStar les apportent, et le Créateur de karaoké peut les ajouter. Les accords viennent des fichiers du morceau quand il en a, une grille d'accords à côté du morceau ou des accords dans son fichier de paroles, et sinon ils sont déduits de la musique. Le micro est analysé sur cet ordinateur pour son niveau et sa justesse ; FluidEQ ne l'enregistre jamais et ne le diffuse jamais sur vos haut-parleurs.",
  'help.karaoke.keywords':
    'chanter, paroles, micro, microphone, justesse, score, note, accords, voix témoin, plein écran, lrc, ultrastar, morceaux, lyrics, sing',
  'help.karaoke.stageCaption':
    'La scène : les paroles, les accords, votre justesse et votre score',
  'help.karaoke.guides':
    "Justesse affiche la bande de notes, Accords les accords. Chacun s'active seul ; les deux éteints, la scène ne montre que les paroles.",
  'help.karaoke.background':
    'Ce qui se tient derrière les paroles : la scène, la pochette du morceau, sa vidéo ou rien. Pochette et Vidéo sont là quand le morceau les apporte.',
  'help.karaoke.maker':
    'Ouvre ce morceau dans le Créateur de karaoké pour corriger son calage, ses paroles ou ses notes.',
  'help.karaoke.textSize':
    "Agrandit ou réduit les paroles selon la distance d'où vous chantez.",
  'help.karaoke.micSettings':
    "Le micro dans lequel chanter, à quel niveau il vous entend et son volume. Il s'allume tant que le micro est actif.",
  'help.karaoke.fullScreen':
    "Donne toute la fenêtre à la scène ; un double-clic sur la scène fait de même. En plein écran, deux boutons de plus ici gardent l'en-tête ou la barre du lecteur à l'écran.",
  'help.karaoke.chords':
    "L'accord qui vient de passer, celui qui sonne, en surbrillance, et les deux suivants.",
  'help.karaoke.pitch':
    "Les notes à chanter en cases, et votre voix en ligne qui les traverse : verte juste, jaune proche, rouge à côté. Faites-la glisser pour parcourir le morceau, et tirez la poignée au-dessus pour l'agrandir.",
  'help.karaoke.micToggle':
    "Active ou coupe le micro. Tant qu'il écoute, la note que vous chantez s'affiche à côté.",
  'help.karaoke.score':
    'Chaque ligne en rangée de cases, une par note, de la couleur de son verdict, avec votre score en cours et votre série. Appuyez sur une ligne pour la rechanter.',
  'help.karaoke.playlistCaption': 'Vos morceaux, à côté de la scène',
  'help.karaoke.search':
    'Trouve un morceau de la liste par son titre ou le nom de son fichier.',
  'help.karaoke.add':
    'Ajouter des fichiers ou un dossier, regrouper la liste par dossier, ou la vider.',
  'help.karaoke.fold':
    'Replie la liste pour laisser la place à la scène. Le bouton Liste de lecture au début de la rangée de la scène la fait revenir.',
  'help.karaoke.singingName': 'Le morceau sur scène',
  'help.karaoke.singing':
    "Il porte des barres animées pendant qu'il est chanté. Cliquez sur un morceau pour le choisir et double-cliquez pour le chanter ; survolez une ligne pour la monter, la descendre ou la retirer de la liste.",
  'help.karaoke.folderName': 'Un dossier',
  'help.karaoke.folder':
    'Quand la liste est regroupée par dossier, appuyez sur un dossier pour replier ses morceaux ou les rouvrir. Le nombre indique combien il en contient.',
  'help.karaoke.mixCaption':
    'Réglages du mixage, dans la barre du lecteur au pied de la fenêtre',
  'help.karaoke.volume':
    'Le volume de votre ordinateur, le même curseur que dans la barre de chaque onglet. Son icône coupe le son.',
  'help.karaoke.melody':
    "Un ton qui joue les notes du morceau, pour chanter avec. Son bouton l'active ou le coupe.",
  'help.karaoke.backing':
    'La musique : le morceau lui-même, ou son instrumental une fois que le Créateur de karaoké en a séparé la voix.',
  'help.karaoke.vocal':
    "La voix du chanteur, posée sous l'instrumental quand le morceau a été séparé. À zéro pour la musique seule.",
  'help.karaoke.scene':
    'Avec la scène derrière les paroles, combien elle transparaît et à quel point elle est floue. Karaoké garde les siens, à part de ceux du graphique.',
  'help.karaoke.micCaption': 'Réglages du microphone',
  'help.karaoke.micInput': 'Le micro dans lequel vous chantez.',
  'help.karaoke.micOn':
    "Lance ou arrête l'écoute. Son état s'affiche en haut à droite du panneau.",
  'help.karaoke.micLevel':
    'À quel niveau le micro vous entend en ce moment. Chantez et regardez-le bouger.',
  'help.karaoke.micVolume':
    'Monte un micro trop faible pour que votre justesse soit entendue, ou baisse un micro trop fort.',
  'help.karaoke.scoreCaption': "Le résumé à la fin d'un morceau",
  'help.karaoke.total':
    'Votre score sur 10 000, son appréciation et sa place face à votre meilleur essai sur ce morceau.',
  'help.karaoke.statsName': 'Justesse · En rythme · Notes',
  'help.karaoke.stats':
    'La part du temps chantée dans les notes, le nombre de notes attaquées à temps et le nombre réussies, avec chaque verdict compté en dessous.',
  'help.karaoke.hardest':
    'La ligne qui vous a donné le plus de mal et pourquoi, avec en dessous une chose à essayer la prochaine fois.',
  'help.karaoke.practise':
    'Vous ramène juste avant cette ligne pour la rechanter.',
  'help.karaoke.again': 'Tout le morceau à nouveau, depuis le début.',
  'help.karaoke.map':
    'Chaque ligne avec son appréciation et de combien de points elle a bougé depuis votre meilleur essai. Appuyez sur une ligne pour la travailler.',
  'help.karaoke.attempts':
    'Vos derniers essais sur ce morceau, dont celui-ci et le meilleur.',

  'help.maker.title': 'Créez dans le Créateur de karaoké',
  'help.maker.intro':
    "Le Créateur de karaoké fait d'un morceau un karaoké à chanter : ses paroles, le moment où chaque mot est chanté, et les notes de la mélodie. Il s'ouvre sur le morceau de la scène, dans un seul éditeur : les outils en haut, le son du morceau avec les paroles et les notes en dessous, et un aperçu en direct de ce que la scène affichera.",
  'help.maker.steps':
    "Sur la scène de Karaoké, appuyez sur Ouvrir dans le Créateur. Appuyez sur Paroles et collez les paroles du morceau ou chargez un fichier de paroles, une ligne par rangée, chaque reprise écrite en entier.\nAppuyez sur Détecter le calage et la mélodie pour que FluidEQ écoute quand chaque mot est chanté et quelles notes le portent, ou sur Accepter et enregistrer les temps pour marquer vous-même chaque ligne pendant la lecture. La première fois, les modèles d'IA nécessaires sont téléchargés.\nVérifiez le résultat dans la grille : les mots sont dans des couloirs au-dessus des notes, et les notes sont dessinées comme sur la scène. Faites glisser un mot ou une note pour le déplacer, ou son bord pour changer sa durée. Sélectionner des notes trace un cadre autour de plusieurs ; Dessiner des notes en dessine de nouvelles.\nParcourez le morceau avec la vue d'ensemble sous la grille, ou faites glisser avec le bouton du milieu de la souris n'importe où dans la grille pour vous déplacer à la fois dans le temps et en hauteur. La Plage de hauteur, contre le bord gauche de la grille, zoome et fait défiler les notes. Suivre les paroles garde la tête de lecture en vue et tourne la page quand elle atteint le bord.\nAppuyez sur Utiliser dans le lecteur pour le chanter sur la scène. Exporter l'enregistre en projet FluidEQ, UltraStar TXT, LRC ou LRC enrichi ; un morceau de votre Bibliothèque peut aussi y être réenregistré avec Enregistrer dans la bibliothèque.",
  'help.maker.editorCaption':
    "L'éditeur : le son du morceau, ses paroles et ses notes",
  'help.maker.gridName': 'La grille',
  'help.maker.grid':
    'En haut le son du morceau, dessous ses paroles sur trois couloirs et ses notes en cases sur la grille de hauteur, comme la scène les dessine. Faites glisser avec le bouton du milieu de la souris pour vous déplacer dans le temps et en hauteur.',
  'help.maker.pitchRange':
    "Où se trouve la grille en hauteur, sur toute la plage. Faites glisser ses bouts pour zoomer, son milieu pour défiler ; double-cliquez pour l'ajuster aux notes.",
  'help.maker.overview':
    'Tout le morceau, la partie affichée dans la grille encadrée. Faites glisser le cadre pour vous déplacer, ses bords pour zoomer.',
  'help.maker.follow':
    'Garde la tête de lecture en vue pendant la lecture et tourne la page quand elle atteint le bord.',
  'help.maker.preview':
    'Les paroles telles que la scène les affichera pendant la lecture. Son curseur A règle leur taille ; masquez-le pour plus de place.',
  'help.maker.checked':
    'Combien de mots vous avez ajustés à la main, et combien sont encore tels que détectés ou importés, avec à côté les notes, mots et vérifications du morceau.',

  'help.maker.lyricsCaption':
    'Les paroles, et le moment où chaque mot est chanté',
  'help.maker.reference':
    'La chanson entière en texte, une ligne par rangée. Collez-la ou chargez un fichier ; FluidEQ en tire le calage.',
  'help.maker.timing':
    'Tous les mots dans l’ordre, avec le nombre déjà calé. Appuyez sur l’un d’eux pour le travailler.',
  'help.maker.word':
    'Où commence le mot choisi et combien de temps il dure. Déplacer son bord donne ou prend du temps au mot voisin ; la ligne garde sa durée.',
  'help.maker.toolsCaption':
    "Outils de réparation, et les modèles d'IA qu'ils demandent",
  'help.maker.separate':
    "Sépare l'enregistrement en voix et musique. Le karaoké peut alors jouer sans le chanteur, le curseur Voix témoin peut remettre la voix dessous, et la détection entend mieux les paroles.",
  'help.maker.loadVocals':
    'Utilisez un fichier de voix seule que vous avez déjà, au lieu d’en séparer un ici.',
  'help.maker.redetectTiming':
    'Réécoute la voix séparée et recale les mots que vous avez déjà. Il attend que la voix soit séparée.',
  'help.maker.redetectNotes':
    'Réécoute la mélodie dans la voix séparée et réécrit les notes sous les paroles. Il attend que la voix soit séparée.',
  'help.maker.models':
    'Ce dont chaque modèle a besoin et s’il est sur cet ordinateur. Ils sont téléchargés à la première utilisation.',
  'help.maker.idle':
    'Si un modèle reste en mémoire entre deux usages, et combien de temps. Le libérer rend de la mémoire ; le garder fait démarrer la fois suivante aussitôt.',

  'help.makerBar.caption': 'Les outils en haut du Créateur',
  'help.makerBar.import':
    'Ouvre un fichier karaoké ou un projet enregistré, en gardant l’audio déjà chargé.',
  'help.makerBar.lyrics': 'Les mots et leur calage, dans une seule fenêtre.',
  'help.makerBar.timing':
    'Déplace les mots et les notes ensemble, pour une chanson en avance ou en retard dès la première seconde.',
  'help.makerBar.language':
    'La langue des paroles, et une seconde à côté pour la chanter dans l’une ou l’autre.',
  'help.makerBar.record':
    'Lancez la chanson et appuyez sur une touche au début et à la fin de chaque ligne. Le calage vient de vos appuis.',
  'help.makerBar.select':
    'Tracez un cadre autour des notes pour les déplacer ou les supprimer ensemble.',
  'help.makerBar.paint':
    'Dessinez la mélodie directement sur la grille des hauteurs.',
  'help.makerBar.repair':
    "Sépare la voix de la musique et réécoute les paroles ou la mélodie, avec les modèles d'IA nécessaires.",
  'help.makerBar.export':
    'Écrit le karaoké terminé en projet FluidEQ, UltraStar TXT, LRC ou LRC enrichi.',
  'help.makerBar.apply':
    'Confie le karaoké terminé à la scène et ferme le Créateur.',
  'help.maker.tip':
    "La détection est un point de départ : écoutez de courts passages et corrigez les mots et les notes d'après l'enregistrement. Séparer d'abord la voix de la musique permet à la détection d'entendre les paroles plus nettement, et donne au lecteur son curseur de Voix témoin. Les modèles demandent une connexion et de l'espace disque la première fois ; utilisez un son et des paroles que vous avez le droit de travailler.",
  'help.maker.keywords':
    'supprimer la voix, voix, vocal remover, instrumental, acapella, pistes, séparer la voix, isoler la voix, synchroniser les paroles, calage, mélodie, notes, justesse, ultrastar, lrc, créer un karaoké, transcrire, créateur',

  'help.share.title': 'Partagez l’audio entre ordinateurs',
  'help.share.intro':
    'Partager l’audio relie les ordinateurs d’un même réseau privé en un groupe, et chacun joue le son des autres : où que vous soyez assis, vous entendez le reste. Chaque ordinateur envoie son propre son directement aux autres, intact, et ne renvoie jamais ce qu’il reçoit, donc pas d’écho ; l’ordinateur sur lequel vous écoutez applique son propre EQ, ses courbes et son DSP. C’est distinct de la recopie vers un second appareil sur un même ordinateur.',
  'help.share.steps':
    'Sur un ordinateur, ouvrez Partager l’audio, appuyez sur Ajouter un ordinateur puis sur Copier le code. Commencez à faible volume.\nSur l’autre ordinateur, appuyez sur Ajouter un ordinateur, collez le code sous Code de l’autre ordinateur et appuyez sur Relier. Les deux ordinateurs se jouent aussitôt l’un l’autre. Reliez d’autres ordinateurs de la même façon : chacun rejoint tout le groupe, et ceux qui arrivent par un autre apparaissent avec Recevoir coupé jusqu’à ce que vous l’activiez.\nDans Tout le groupe, chaque ordinateur a deux interrupteurs, Recevoir et Envoyer ; Partager coupe le son de cet ordinateur pour tous. Votre mixage règle le volume de Ce PC et un niveau par ordinateur.\nPause, Reprendre et Délier se trouvent dans le menu de chaque ordinateur. Un ordinateur absent reste dans la liste comme Hors ligne, et le groupe se retrouve tout seul après un redémarrage, une mise en veille, une coupure réseau ou un changement de moteur.\nActivez Fluid près de Partager pour une connexion musicale irrégulière. Il ajoute un petit tampon ; désactivez-le si le faible retard est prioritaire.\nPour un ordinateur enregistré qui reste hors ligne, ouvrez ••• puis Reconnecter. Le code sauvegardé est réessayé sans oublier le lien ; si l’adresse a changé, collez son code actuel.',
  'help.share.tip':
    'Le code de connexion autorise la liaison : gardez-le privé. Avec le moteur FluidEQ, cet ordinateur garde son DSP pendant qu’il partage, et l’ordinateur qui joue son son applique le sien. Jouer et envoyer à la fois demande Windows sur cet ordinateur ; ailleurs, une liaison fonctionne dans un seul sens.',
  'help.share.keywords':
    'réseau local, diffuser, transmettre, autre PC, deuxième PC, jumelage, LAN, wifi, Ethernet, deux sens, bidirectionnel, relier, délier, pause, reprendre, volume, groupe, ajouter un ordinateur, recevoir, envoyer, partager, mixage, hors ligne, plusieurs ordinateurs',
  'help.share.mix':
    'Le volume de ce PC, et un niveau pour chaque ordinateur que vous entendez.',
  'help.share.outputName': 'Sortie',
  'help.share.output': 'Là où cet ordinateur joue le groupe.',
  'help.share.add':
    'Copiez le code de cet ordinateur, ou collez celui d’un autre et cliquez sur Relier.',
  'help.share.shareSwitch':
    'Partager envoie le son de cet ordinateur à tout le groupe ; Fluid à côté ajoute une petite réserve pour une connexion qui cale.',
  'help.share.switchesName': 'Recevoir et Envoyer',
  'help.share.switches':
    'Recevoir joue cet ordinateur ici ; Envoyer joue celui-ci là-bas. Son menu ••• le met en pause, le reprend, le reconnecte ou le délie.',
  'help.share.laneName': 'Ce qu’il joue',
  'help.share.lane':
    'Le morceau de cet ordinateur et son son tel qu’il arrive, avec le délai dans chaque sens.',

  'help.trouble.title': 'Quand le son ne va pas',
  'help.trouble.intro':
    'Commencez par la source et la sortie, puis isolez la couche en cause. Un graphique, un préréglage enregistré ou un interrupteur activé ne suffit pas à prouver que le son atteint l’appareil voulu. Le menu Aide mène aussi au dépannage audio, au signalement de problèmes et au Forum.',
  'help.trouble.steps':
    'Pas de son : vérifiez que la lecture tourne, que la sortie attendue est choisie, que le volume est monté et que l’appareil est branché. Voyez si Un seul lecteur a mis en pause une autre source.\nL’égalisation ne change rien : vérifiez que le bouton marche/arrêt en haut de la colonne de gauche est allumé et que la sortie n’affiche pas de badge DÉSACT. ; sinon appuyez sur Activer. Si la notification du moteur dit qu’il ne tourne pas, appuyez sur Redémarrer l’audio de Windows.\nTout semble correct et l’égalisation ne fait toujours rien : Windows joue peut-être la musique à côté du moteur. La notification le dit et propose, d’un appui, de déplacer le moteur là où Windows l’utilisera ; cela coûte une demande d’autorisation et une seconde de silence.\nDistorsion ou trop de basses : laissez la Normalisation auto activée, réduisez les amplifications et contournez les couches une à une. Si cela persiste, utilisez Signaler un problème et relisez le rapport avant de l’envoyer.',
  'help.trouble.tip':
    'F1 ouvre ce guide. Échap ferme d’abord la capture agrandie, puis le guide. Si l’interface est trop grande, Ctrl + 0 réinitialise le zoom. Processus, dans le menu des actions, montre ce que fait chaque partie de FluidEQ.',
  'help.trouble.keywords':
    'ne marche pas, ne fonctionne pas, panne, souci, silencieux, crépitements, grésillements, coupures, distordu, saturation, écrêtage, trop fort, trop faible, résoudre, solution, dépanner, assistance, support technique, raccourcis clavier, texte trop petit, plantage, bug, clipping, crash, pas de son, aucun son, plus de son',
  'help.trouble.noticeName': 'La notification du moteur',
  'help.trouble.notice':
    'Indique quelle sortie le moteur n’atteint pas et pourquoi, en bas à droite de la fenêtre, dès que du son y passe.',
  'help.trouble.useApo':
    'Passe plutôt à Equalizer APO, par la fenêtre du moteur.',
  'help.trouble.restart':
    'Redémarre l’audio de Windows, ce qui ramène généralement le moteur. Windows demande l’autorisation.',

  'help.forum.title': 'Posez vos questions sur le Forum',
  'help.forum.intro':
    'Le Forum intègre les GitHub Discussions de FluidEQ à l’application : annonces, idées, questions et réglages dont les gens sont fiers. Tout le monde peut lire ; pour publier, vous utilisez votre compte GitHub, pas un compte FluidEQ.',
  'help.forum.steps':
    'Ouvrez Aide → Forum et choisissez une catégorie : Annonces, Général, Idées, Sondages, Q&A, Vitrine, Trucs et astuces ou Soutenir FluidEQ. Nouveau pour vous rassemble ce qui est arrivé depuis votre dernière visite, et Tickets liste les problèmes signalés sur GitHub.\nRecherchez dans le forum, ou ouvrez un sujet pour lire les réponses.\nAppuyez sur Se connecter avec GitHub, terminez dans votre navigateur, puis publiez un Nouveau sujet ou une réponse.',
  'help.forum.tip':
    'Tout ce qui est publié est public sur GitHub, sous votre nom GitHub. Dans Q&A, marquez la réponse qui a marché pour que la personne suivante la trouve. Le nombre jaune de chaque rubrique indique les sujets dont vous n’avez pas vu l’activité ; Problèmes compte les problèmes ouverts. Vos sujets et réponses inachevés sont conservés quand vous partez. Appuyez sur l’image d’un message pour l’agrandir dans FluidEQ.',
  'help.forum.keywords':
    'communauté, entraide, suggestions, demande de fonctionnalité, contacter, feedback, support, FAQ',
  'help.forum.boardsName': 'Forums',
  'help.forum.boards':
    'Chaque forum avec son compte. Nouveau pour vous rassemble ce qui est arrivé depuis votre dernière visite, et Issues liste les problèmes signalés sur GitHub.',
  'help.forum.textSize': 'Agrandit ou réduit le texte du Forum et de ce guide.',
  'help.forum.meName': 'Votre compte GitHub',
  'help.forum.me':
    'Sous quel nom vous publiez. Se déconnecter laisse le Forum lisible et arrête la publication.',
  'help.forum.newTopic':
    'Nouveau sujet ouvre une discussion ; Tout marquer comme lu vide les compteurs, et la flèche récupère les nouveautés.',
  'help.forum.search':
    'Cherche dans les sujets et réponses de tous les forums.',
  'help.forum.topicsName': 'Sujets',
  'help.forum.topics':
    'L’activité la plus récente d’abord, chacun avec son forum, son état, ses réponses et ses votes. Ouvrez-en un pour le lire et répondre.',
  'help.games.profiles':
    'Ouvrez Profils de jeu pour rechercher un profil, un jeu, une courbe ou une chaîne. Les filtres restent sur une seule ligne et chaque genre de jeu a sa couleur. Vos profils enregistrés affichent aussi leur courbe, les niveaux du filtre Jeu et leur chaîne. Utiliser pour un jeu crée une nouvelle copie.',
  'help.mic.title': 'Le son de votre micro',
  'help.mic.intro':
    'L’onglet Micro donne à chaque micro son propre rack de voix. Le FluidEQ Engine l’exécute sur le micro lui-même : Discord, OBS, un jeu ou un appel entendent votre voix telle que vous l’avez façonnée. Il faut le FluidEQ Engine.',
  'help.mic.steps':
    'Ouvrez Micro dans l’en-tête et choisissez votre micro en haut. Si FluidEQ n’y est pas encore, cliquez sur Installer sur ce micro ; Windows demande l’autorisation une fois.\nChoisissez un Profil de micro par usage — Streaming, Podcast, Chat de jeu, Réunions —, par micro, pour le chant ou un effet de voix. Il règle chaque étage pour une voix ; un étage que vous changez marque le profil comme ajusté, et Réinitialiser le rétablit.\nCliquez sur un étage dans le rail pour l’ouvrir. Chacun a son interrupteur, un indicateur qui bouge avec votre voix et le délai qu’il ajoute ; un étage coupé disparaît complètement du son.\nParlez et regardez le dessin : le pâle est ce que capte le micro, le vif ce que les autres entendent, et le gris visible ce que les filtres ont retiré. Écouter le résultat final vous le fait entendre ; portez un casque, sinon ça siffle.\nEffets propres du micro montre ce que le fabricant du micro ajoute à votre voix avant FluidEQ. Les couper évite de nettoyer la voix deux fois ; Windows demande l’autorisation, et réactivés ils reviennent exactement comme avant.',
  'help.mic.tip':
    'Un étage coupé laisse la voix intacte et n’ajoute aucun délai : si Délai affiche une valeur élevée, coupez ce dont vous n’avez pas besoin. Sous Equalizer APO, l’onglet Micro n’a rien sur quoi tourner.',
  'help.mic.keywords':
    'microphone, micro, voix, streaming, obs, discord, podcast, appels, réunions, réduction de bruit, suppression du bruit, noise gate, gate, de-esser, compresseur, limiteur, réverbération, effets de voix, chant, micro usb, micro de casque, effets propres',
  'help.mic.own':
    'Ce que le fabricant du micro ajoute à votre voix avant FluidEQ. Son interrupteur demande l’autorisation à Windows dans les deux sens.',
  'help.mic.master': 'Allume ou coupe tout le rack de voix de ce micro.',
  'help.mic.stagesName': 'Les étages',
  'help.mic.stages':
    'Dans l’ordre où votre voix les traverse, chacun avec son interrupteur, un indicateur qui bouge avec votre voix et le délai qu’il ajoute. Cliquez sur l’un d’eux pour l’ouvrir.',
  'help.mic.pick':
    'Le micro que vous façonnez ; chacun garde son propre son. La ligne en dessous dit si le moteur travaille dessus en ce moment.',
  'help.mic.pictureName': 'Votre voix',
  'help.mic.picture':
    'Le pâle est ce que capte le micro, le vif ce que les autres entendent, et le gris visible ce que les filtres ont retiré.',
  'help.mic.profile':
    'Des sons de voix prêts par usage, par micro, pour le chant et en effets de voix. Un changement marque le profil comme ajusté ; Réinitialiser le rétablit.',
  'help.mic.delay':
    'De combien tout le rack retarde votre voix, tel que le moteur le mesure.',
};

export default help;
