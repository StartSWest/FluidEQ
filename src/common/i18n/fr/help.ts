/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Aide',
  'help.title': 'Guide utilisateur',
  'help.subtitle': 'Trouvez votre son. Prenez vos marques.',
  'help.intro':
    'Un guide pratique de FluidEQ illustré de captures réelles. Commencez par une première écoute, puis explorez chaque partie de l’application à votre rythme.',
  'help.offline': 'Disponible hors ligne',
  'help.search': 'Rechercher dans le guide',
  'help.searchHint': 'Essayez moteur, basses, visualiseur…',
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
    'Captures réelles de la fenêtre de FluidEQ. Les couleurs, libellés et positions des commandes peuvent varier selon votre version. Les réglages illustrent les fonctions ; ce ne sont pas des préréglages recommandés.',
  'help.steps': 'À essayer',
  'help.tip': 'Bon à savoir',
  'help.back': 'Revenir en haut',

  'help.group.start': 'Premiers pas',
  'help.group.sound': 'Façonnez votre son',
  'help.group.visuals': 'Voyez votre musique',
  'help.group.plus': 'Visualiseurs et votre compte',
  'help.group.listen': 'Écoutez, chantez et partagez',
  'help.group.help': 'Quand vous avez besoin d’aide',

  'help.start.title': 'Vos cinq premières minutes',
  'help.start.intro':
    'Commencez avec un morceau familier à un volume confortable. La colonne de gauche active FluidEQ et contient le préampli ; le centre est votre espace de travail ; la colonne de droite suit votre sortie et ses profils. La barre en bas de la fenêtre contrôle tout ce qui est en lecture.',
  'help.start.steps':
    'Installez FluidEQ et gardez le moteur FluidEQ sélectionné quand l’installation demande comment traiter votre son. Windows demande une autorisation une seule fois, sans redémarrage.\nChoisissez votre appareil d’écoute sous Périphérique de sortie. Activez l’Égaliseur système et laissez la Normalisation auto activée.\nLancez un morceau, ouvrez Égaliseur → Bandes, faites une petite modification et comparez en désactivant puis en réactivant l’Égaliseur système.',
  'help.start.tip':
    'L’EQ système nécessite Windows et un moteur audio : le moteur FluidEQ ou Equalizer APO. Sous macOS et Linux, l’application affiche des sorties de démonstration : un graphique animé n’y prouve donc aucun traitement.',
  'help.start.keywords':
    "premiers pas, prise en main, démarrage rapide, bien démarrer, mise en route, premier lancement, débutant, débuter, tutoriel, mode d'emploi, comment utiliser, comment ça marche, installer, setup",
  'help.start.videoTitle': 'Premiers pas avec FluidEQ',
  'help.start.videoNote':
    'Environ quatre minutes, commentées en anglais. Elle est lue depuis fluideq.com quand vous appuyez sur lecture.',
  'help.video.play': 'Lire la vidéo : {title}',
  'help.video.loading': 'Chargement depuis fluideq.com…',
  'help.video.failed':
    'La vidéo n’a pas pu être chargée. Elle est lue depuis fluideq.com et demande donc une connexion à internet.',
  'help.video.retry': 'Réessayer',
  'help.video.open': 'Ouvrir sur fluideq.com',

  'help.window.title': 'Se repérer dans la fenêtre',
  'help.window.intro':
    'L’en-tête vous fait passer d’une page de FluidEQ à l’autre et montre le son en direct. La colonne de gauche contient l’interrupteur général de l’EQ, le préampli et l’indicateur de niveau ; la colonne de droite suit votre sortie et ses profils.',
  'help.window.steps':
    'Appuyez sur une page dans l’en-tête : Médias en ligne, Partager l’audio et Égaliseur avant le signal ; DSP, Bibliothèque, Karaoké et Visualiseurs après.\nActivez l’Égaliseur système dans la colonne de gauche et laissez la Normalisation auto activée, pour qu’aucune amplification ne sature.\nAppuyez sur l’indicateur de niveau pour changer la façon dont il est dessiné, et sur Coloré, sur le signal, pour afficher les bandes, le titre et les commandes allumées dans une palette plutôt qu’une seule couleur.',
  'help.window.tip':
    'Le menu Aide mène à ce guide, à Nouveautés, au dépannage audio et à Signaler un problème. Le bouton de menu à trois traits, juste à côté, contient la carte du moteur, votre compte, l’importation de réglages d’égalisation ou d’une réponse impulsionnelle, le redémarrage de l’audio de Windows, Processus, qui montre ce que chaque partie de FluidEQ utilise, et Réinitialiser tous les réglages ; tout en bas se trouvent Luminosité, Teinte, Mode coloré, Teinter l’icône (désactivé au départ ; met l’icône de la barre des tâches, celle de la zone de notification et celle de son menu aux couleurs de la fenêtre), les curseurs de l’EQ, les animations, Démarrer avec Windows (FluidEQ démarre alors dans la zone de notification et façonne votre son sans ouvrir de fenêtre) et la langue. Juste après ces deux boutons, un interrupteur transforme la fenêtre en Lecteur compact.',
  'help.window.keywords':
    'onglets, navigation, naviguer, interface, entête, barre de titre, barre d’outils, barre latérale, panneau latéral, barre du bas, barre de lecture, vu-mètre, mode coloré, arc-en-ciel, icônes, faire un don, donation, thème, mode sombre, mode clair, thème sombre, thème clair, mode nuit, langue, changer de langue, démarrer avec windows, démarrage automatique, lancer au démarrage, démarrage, compte',
  'help.window.headerLeftCaption': 'L’en-tête, jusqu’au signal',
  'help.window.headerRightCaption': 'L’en-tête, après le signal',
  'help.window.railCaption': 'La colonne de gauche',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch et Suno, lus dans FluidEQ à travers votre EQ.',
  'help.window.share':
    'Envoie le son de cet ordinateur vers un autre, ou lit ici celui d’un autre.',
  'help.window.eq':
    'Vos bandes, vos préréglages, la correction du casque, les préréglages de jeu et la config du moteur.',
  'help.window.waveName': 'Signal audio',
  'help.window.wave':
    'Ce qui est en lecture, en direct, avec son niveau de crête. Coloré, en haut, active ou désactive le Mode coloré ; le menu Affichage du graphique permet de le masquer.',
  'help.window.dsp':
    'Le rack d’effets : les préréglages, la Salle et chaque étage de la chaîne.',
  'help.window.library':
    'Vos fichiers musicaux, vos albums et votre file de lecture.',
  'help.window.karaoke':
    'Chantez en suivant les paroles, et transformez vos propres chansons en karaoké.',
  'help.window.plus':
    'Les visualiseurs, la galerie, le Studio et l’Éclairage dynamique.',
  'help.window.support': 'Des façons de soutenir le travail sur FluidEQ.',
  'help.window.help':
    'Ce guide, Nouveautés, le dépannage audio et Signaler un problème.',
  'help.window.actions':
    'Le moteur, votre compte, l’importation de réglages d’égalisation, le redémarrage de l’audio de Windows, Processus et Réinitialiser tous les réglages ; Luminosité, Teinte, Mode coloré et Teinter l’icône, les curseurs de l’EQ, les animations, Démarrer avec Windows et la langue.',
  'help.window.systemEq':
    'Active ou désactive le traitement de FluidEQ pour tout ce que joue le PC.',
  'help.window.preamp':
    'Baisse le niveau avant l’EQ pour que les amplifications aient de la marge. La Normalisation auto le règle pour vous.',
  'help.window.autoNormalize':
    'Garde le préampli juste assez bas pour que rien de ce que vous amplifiez ne sature.',
  'help.window.responseGraph': 'Affiche ou masque la courbe de réponse.',
  'help.window.meterName': 'Indicateur de niveau',
  'help.window.meter':
    'Le niveau de sortie des canaux gauche et droit, en décibels réels. Appuyez dessus pour changer son style.',
  'help.player.title': 'Le Lecteur compact',
  'help.player.intro':
    'Un seul interrupteur transforme la fenêtre de FluidEQ en Lecteur compact, une seule colonne étroite : en haut, un visualiseur avec le morceau par-dessus et les commandes de lecture en dessous ; puis Son, votre égaliseur ; puis À suivre et vos playlists. Ce qui est en lecture continue de jouer, et le même interrupteur ramène l’application complète sur la page que vous aviez quittée.',
  'help.player.steps':
    'Appuyez sur l’interrupteur Lecteur compact dans la barre de titre, à côté d’Aide. Sur le lecteur, le même interrupteur ramène l’application complète.\nRepliez Son, ou À suivre et Playlists, sur leur en-tête : le visualiseur prend la place, et un clic sur l’en-tête les rouvre. Faites glisser le bord haut ou bas du lecteur pour le rendre plus haut ou plus bas.\nDouble-cliquez sur le visualiseur pour qu’il remplisse l’écran ; Échap le remet en place. Cliquez sur le nom du style, à côté de l’aléatoire et de la répétition, pour choisir parmi tous les styles et toutes les scènes.\nChoisissez Replier sur une ligne dans le menu du logo FluidEQ pour que le lecteur tienne sur une seule ligne ; le logo le déplie.\nDans ce même menu, réglez la Luminosité propre au lecteur, la Transparence sur une scène ou la Teinte de la fenêtre sur un style standard, et la Lumière du jour d’une scène. Toujours au premier plan, là ou dans l’en-tête, le garde au-dessus des autres fenêtres.\nDéposez des fichiers musicaux n’importe où sur le lecteur : ils rejoignent la Bibliothèque et la fin d’À suivre ou, sur la liste, l’endroit où vous les lâchez.',
  'help.player.tip':
    'Le volume du lecteur est celui de votre ordinateur, le même que dans Windows : il règle donc le niveau de tout ce que joue l’ordinateur. Si le lecteur se retrouve hors de l’écran, faites un clic droit sur FluidEQ dans la zone de notification de la barre des tâches et choisissez Récupérer la fenêtre.',
  'help.player.keywords':
    'mini lecteur, mini-lecteur, petit lecteur, lecteur compact, mode compact, mode lecteur, mini player, winamp, ampli, toujours au premier plan, au-dessus des autres fenêtres, always on top, épingler, replier, sur une ligne, file de lecture, file d’attente, à suivre, déposer des fichiers, glisser-déposer, thème, thème clair, thème sombre, mode sombre, mode clair, petite fenêtre, lecteur flottant, fenêtre flottante, volume',
  'help.player.topCaption': 'Le haut : le morceau et sa lecture',
  'help.player.eqCaption': 'Son, votre égaliseur',
  'help.player.queueCaption': 'À suivre',
  'help.player.menuCaption': 'Le menu du lecteur',
  'help.player.foldedCaption': 'Replié sur une ligne',
  'help.player.menu':
    'Revenir à l’application complète ou à l’une de ses pages ; la Luminosité propre au lecteur, la Transparence ou la Teinte, la Lumière du jour d’une scène, le Mode coloré, Teinter l’icône et les curseurs de l’EQ ; Toujours au premier plan et Replier sur une ligne.',
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
    'Le style ou la scène que dessine le visualiseur. Cliquez dessus pour choisir parmi tous.',
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
    'La Luminosité propre au lecteur, indépendante de celle de l’application complète ; la Transparence sur une scène, ou la Teinte de la fenêtre sur un style standard ; la Lumière du jour d’une scène ; le Mode coloré ; et Teinter l’icône, désactivé au départ, pour l’icône de la barre des tâches, celle de la zone de notification et celle de son menu aux couleurs de la fenêtre.',
  'help.player.fold': 'Replie le lecteur sur une ligne.',
  'help.player.unfold': 'Déplie le lecteur. La flèche à l’autre bout aussi.',
  'help.player.foldedPlaying': 'Lecture ou pause.',
  'help.player.fullScreen':
    'Remplit l’écran avec le visualiseur. Un double-clic sur l’image fait de même, et Échap rend l’écran.',
  'help.player.sourceName': 'Source',
  'help.player.source':
    'D’où vient le morceau : la Bibliothèque, Médias en ligne, Karaoké, un autre ordinateur ou un autre programme de ce PC. Un clic ouvre cette page dans l’application complète.',
  'help.player.heart':
    'Ajoute un morceau de la Bibliothèque à vos Favoris, ou l’en retire.',
  'help.player.soundFold':
    'Replie les réglages du son sur cette ligne, qui garde à portée le préréglage, l’égalisation auto et l’interrupteur, et les rouvre.',
  'help.player.mode':
    'Ouvre le Mode EQ : la force avec laquelle votre EQ et les courbes s’appliquent, leur Q de bande, leur phase et leurs aigus.',
  'help.player.save': 'Garde À suivre comme une playlist à part entière.',
  'help.player.queueFold':
    'Replie À suivre et Playlists sur leurs onglets, et le visualiseur prend la place.',
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
    'Vérifiez votre Windows : Windows 10 version 1803 ou ultérieure, ou Windows 11, en 64 bits, 4 Go de mémoire et environ 600 Mo de disque. Traiter tout ce que joue le PC demande le moteur FluidEQ ou Equalizer APO, et Windows demande l’autorisation une fois pendant l’installation.\nOuvrez un visualiseur : n’importe quelle carte graphique ou graphique intégré à partir de 2013. En 1080p, le graphique intégré suffit ; pour la 4K, ou un fond d’écran sur plusieurs écrans à la fois, une carte dédiée vaut mieux. Quand la carte est chargée, FluidEQ dessine la scène plus petite et libère celles que vous ne voyez pas.\nEssayez le karaoké par IA : séparer la voix télécharge un modèle de 713 Mo la première fois, celui de la justesse ajoute environ 360 Mo et la suppression du bruit 11 Mo. Avec une carte graphique DirectX 12, un morceau de quatre minutes se sépare en une demi-minute environ ; avec le processeur seul, il faut environ quatre minutes. Gardez 2 Go de mémoire libres pendant ce travail.\nVisez ceci si vous le pouvez : Windows 11, 8 Go de mémoire, une carte graphique à partir de 2018 et 3 Go de disque libres si vous utilisez les fonctions par IA.',
  'help.requirements.tip':
    'Tout sauf les modèles d’IA se trouve dans l’installateur ; ceux-ci ne se téléchargent qu’à la première utilisation de la fonction. Processus, dans le menu d’actions, montre ce que chaque partie de FluidEQ utilise sur votre machine en ce moment.',
  'help.requirements.keywords':
    'configuration requise, configuration minimale, configuration recommandée, prérequis, spécifications, matériel, mémoire vive, espace disque, stockage, disque dur, PC portable, vieux PC, performances, lent, ralentissements, consommation, ressources, compatibilité, compatible, GPU, CPU, RAM, lag, macOS, Linux',

  'help.engine.title': 'Le moteur FluidEQ',
  'help.engine.intro':
    'FluidEQ traite votre son avec son propre moteur ou avec Equalizer APO. Le moteur FluidEQ tourne dans le service audio de Windows, après les effets de votre carte son, applique votre EQ et le rack DSP à tout ce que joue le PC, et s’efface dès que FluidEQ se ferme.',
  'help.engine.steps':
    'Ouvrez le menu des actions — le bouton d’impulsion en haut à droite — puis cliquez sur la carte du moteur, tout en haut.\nChoisissez Moteur FluidEQ et appuyez sur Appliquer. Windows demande une autorisation, et le son se coupe quelques secondes, le temps que l’audio redémarre.\nSi une sortie affiche DÉSACT., appuyez sur Activer dans son avis. Si un avis indique que le moteur ne tourne pas, appuyez sur Redémarrer l’audio de Windows.',
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

  'help.eq.title': 'Façonnez votre son avec l’Égaliseur',
  'help.eq.intro':
    'Fréquence détermine où agit une bande ; Gain, son amplification ou atténuation ; Q, sa largeur : un Q élevé est plus étroit. Sans bande sélectionnée, les boutons de Tonalité — Graves, Médiums et Aigus, avec Coupe-bas et Coupe-haut de part et d’autre — façonnent le son comme une courbe à part et laissent vos bandes telles quelles. Commencez par de petites corrections larges et comparez souvent.',
  'help.eq.steps':
    'Ouvrez Égaliseur → Bandes. Sans bande sélectionnée, tournez Graves, Médiums ou Aigus pour changer rapidement la tonalité, et Coupe-bas ou Coupe-haut pour rogner les extrêmes. Ils tracent leur propre ligne Tonalité sur le graphique.\nCliquez sur la fréquence d’une bande, ou sur son point dans le graphique, pour la sélectionner. Tournez ses boutons Fréquence, Gain et Facteur Q, choisissez un Filtre, ou désactivez-la avec Active. La courbe suit un curseur pendant que vous le déplacez.\nTout fonctionne aussi au clavier : Tab mène à un curseur, un bouton ou un point du graphique, et les touches fléchées le font avancer pas à pas ; Page précédente et Page suivante font de plus grands pas.\nPour voir la fréquence, le Q et le gain de chaque bande sur le graphique, ouvrez Affichage au-dessus et appuyez sur Afficher étiquettes de l’EQ, ou appuyez sur Ctrl+W jusqu’à ce qu’il montre Tout. Une étiquette se place au-dessus ou au-dessous de son point, jamais à côté, et revient à sa place dès qu’il y a de la place.\nFaites un clic droit sur une bande pour la réinitialiser, la désactiver ou ajouter une bande à côté. Appuyez sur Vider l’égaliseur pour mettre chaque gain, ainsi que Graves, Médiums et Aigus, à 0 dB tout en gardant vos bandes. Une confirmation est d’abord demandée.\nLe même menu propose Supprimer la bande, qui demande une seconde pression avant de supprimer. Gauche + droite fait d’une bande une bande pour chaque oreille, sur la même fréquence, pour que vous déplaciez chacune seule : la courbe de l’oreille gauche est pleine, celle de la droite en pointillés. Les deux oreilles les réunit en leur milieu, tout comme Réinitialiser la bande et Vider l’égaliseur.',
  'help.eq.tip':
    'Courbes montre ce qui façonne cette sortie en plus de vos bandes, chacune avec sa propre intensité et son ×. Mode jeu réduit la latence qu’ajoute FluidEQ, pour les jeux et les appels ; les préréglages Jeux l’activent. Tant que l’égaliseur est désactivé, ses bandes sont estompées et ne peuvent pas être modifiées par mégarde ; les boutons de Tonalité fonctionnent toujours.',
  'help.eq.keywords':
    'égalisation automatique, EQ intelligent, EQ paramétrique, basses, booster les basses, renforcer les basses, creuser, plateau, bande passante, correcteur, brillance, régler le son, ajuster le son, à plat, remise à zéro, faible latence, equalizer, equaliseur, bass boost, notch, flat, reset, presets, étiquettes, étiquettes de bandes, étiquettes de l’eq, libellés, valeurs, clavier, touches fléchées, flèches, accessibilité, lecteur d’écran, oreille gauche, oreille droite, chaque oreille, par oreille, gauche et droite, égaliseur stéréo, supprimer la bande, retirer une bande',
  'help.eq.bandsCaption': 'La page Bandes, sans sélection',
  'help.eq.bandCaption': 'Une bande sélectionnée',
  'help.eq.gameMode':
    'Réduit la latence qu’ajoute FluidEQ, pour les jeux et les appels. Les préréglages Jeux l’activent.',
  'help.eq.layers':
    'Les autres couches qui façonnent cette sortie — une correction du casque, l’Égalisation auto, une convolution — chacune avec son intensité, son interrupteur et son ×.',
  'help.eq.bandName': 'Une bande',
  'help.eq.band':
    'Faites glisser son point pour amplifier ou atténuer, ou avancez-le pas à pas avec les touches fléchées. Cliquez sur sa fréquence pour la sélectionner.',
  'help.eq.labelName': 'Étiquette de bande',
  'help.eq.label':
    'Sa fréquence, son Q et son gain, au-dessus ou au-dessous de son point. Affichage → Afficher étiquettes de l’EQ, ou Ctrl+W.',
  'help.eq.bass': 'Relève ou abaisse les graves de toute la courbe.',
  'help.eq.mid': 'Relève ou abaisse les médiums, là où se placent les voix.',
  'help.eq.treble': 'Relève ou abaisse les aigus, l’air et le détail.',
  'help.eq.selected':
    'La bande en cours de modification. Cliquez en maintenant Ctrl ou Maj pour en sélectionner plusieurs.',
  'help.eq.filter':
    'Sa forme : Cloche, Shelf grave, Shelf aigu, Coupe-bande, Passe-bas, Passe-haut ou Passe-bande.',
  'help.eq.voicing':
    'Une chaîne toute prête pour le son, comme Musique ou un genre. Aucun ne laisse que vos bandes.',
  'help.eq.smart':
    'Écoute ce qui joue et le corrige : Détail, Équilibre ou Cible.',
  'help.eq.clear':
    'Met chaque gain à 0 dB et garde vos bandes. Demande d’abord confirmation.',
  'help.eq.mode':
    'Fait apparaître la carte Mode EQ : l’intensité de votre EQ et de vos courbes, le Q des bandes, la phase et les aigus.',
  'help.eq.add':
    'Ajoute une bande à côté de celle sélectionnée, au Q des bandes déjà présentes.',
  'help.eq.layouts':
    'Les nombres de bandes, chacun démarrant toutes les bandes au même Q, et les dispositions de bandes que vous avez enregistrées.',
  'help.eq.frequency': 'Où agit la bande sélectionnée, de 1 Hz à 20 kHz.',
  'help.eq.gain':
    'De combien elle amplifie ou atténue. Ctrl+clic la ramène à 0 dB.',
  'help.eq.q': 'Sa largeur : plus le Q est élevé, plus la bande est étroite.',
  'help.eq.delete':
    'Appuyez deux fois pour supprimer la bande ; Garder annule la suppression.',
  'help.eq.menuCaption': 'Le menu contextuel d’une bande',
  'help.eq.reset': 'Remet le gain à 0 dB et le Q à 2.',
  'help.eq.disable': 'Retire la bande du son et conserve ses réglages.',
  'help.eq.addLeft': 'Ajoute une bande à mi-chemin de sa voisine plus grave.',
  'help.eq.addRight': 'Ajoute une bande à mi-chemin de sa voisine plus aiguë.',

  'help.eqmode.title': 'Mode EQ et dispositions de bandes',
  'help.eqmode.intro':
    'Mode EQ change la façon dont votre son est façonné, sans rien modifier. Ses réglages forment la première carte du panneau latéral de la page Égaliseur, à côté des courbes qu’ils changent, en deux onglets : Votre EQ regroupe vos bandes, la Tonalité, les préréglages, le Type de transducteur et l’Égalisation auto ; Corrections regroupe les corrections du casque et les courbes importées ou personnalisées. Les dispositions de bandes conservent les fréquences et le Q d’un agencement qui vous plaît, prêtes pour n’importe quelle sortie.',
  'help.eqmode.steps':
    'Appuyez sur Mode EQ au-dessus du graphique. La carte apparaît, et le panneau latéral s’ouvre s’il était fermé.\nChoisissez l’onglet Votre EQ ou Corrections, puis essayez un choix d’Intensité ou de Q des bandes pendant que la musique joue. Avec le moteur FluidEQ, choisissez la phase Minimale ou Linéaire, et Précis ou Classique pour les aigus, pour chaque onglet.\nDans Corrections, Lissage des courbes peut adoucir les courbes échantillonnées à 1/12 ou 1/3 d’octave ; il reste sur Désactivé tant que vous ne choisissez rien. Réinitialiser ramène tout à Normal, et le lissage à Désactivé.\nVous préférez un menu ? Appuyez sur l’épingle de la carte : Mode EQ s’ouvre alors en menu par-dessus le graphique, et l’épingle de ce menu ramène la carte.\nCliquez sur le bouton des dispositions, à côté d’Ajouter une bande. Choisissez 6, 10, 15, 20 ou 31 bandes, ou appuyez sur Enregistrer… pour nommer la disposition actuelle.',
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
  'help.eqmode.smoothing':
    'Adoucit les courbes de correction échantillonnées à 1/12 ou 1/3 d’octave. Désactivé tant que vous ne choisissez rien.',
  'help.eqmode.phase':
    'Minimale ou Linéaire, pour chaque onglet. Avec le moteur FluidEQ uniquement.',
  'help.eqmode.treble':
    'Précis sonne comme tracé, Classique comme dans Equalizer APO. Avec le moteur FluidEQ uniquement.',
  'help.eqmode.reset':
    'Tout revient à Normal, et Lissage des courbes à Désactivé.',
  'help.eqmode.designsCaption': 'Dispositions de bandes',
  'help.eqmode.builtIn': 'Dispositions standard de 6, 10, 15, 20 ou 31 bandes.',
  'help.eqmode.save':
    'Donne un nom aux fréquences et au Q actuels pour en faire une disposition, listée sous Mes dispositions.',

  'help.games.title': 'Préréglages de jeu',
  'help.games.intro':
    'Donnez à chaque jeu un son bien à lui. Quand le jeu passe au premier plan, FluidEQ bascule sur ce son et le garde jusqu’à ce que vous fermiez le jeu, même si vous passez à autre chose entre-temps avec Alt+Tab. Puis il remet ce que vous aviez.',
  'help.games.steps':
    'Ouvrez Égaliseur → Préréglages de jeu et appuyez sur Ajouter un jeu. Prenez-en un dans vos lanceurs ou parmi les programmes ouverts en ce moment, ou choisissez vous-même son programme.\nDans le sélecteur de sa ligne, choisissez le son qu’il doit recevoir : un préréglage Jeux, ou n’importe quel autre.\nLancez le jeu. Une carte sur le Bureau indique sur quoi FluidEQ a basculé, et une autre, ce qui est revenu quand vous le fermez.',
  'help.games.tip':
    'Tant qu’un jeu a la main sur le son, la barre en bas de la fenêtre affiche son nom. Choisissez un autre son en cours de partie et il reste : FluidEQ ne défait que ce qu’il a fait lui-même. Les préréglages Jeux activent aussi le Mode jeu.',
  'help.games.keywords':
    'jeux vidéo, profil de jeu, par application, changement automatique, jeu de tir, bruits de pas, pas des ennemis, compétitif, gaming, gamer, launcher, Epic Games, FPS, shooter, esport, presets',
  'help.games.tab': 'Vos jeux et le son que reçoit chacun.',
  'help.games.add':
    'Ajoute un jeu de Steam, Epic, EA, GOG, Ubisoft, Battle.net ou Xbox, ou n’importe quel programme ouvert en ce moment.',
  'help.games.gameName': 'Un jeu',
  'help.games.game': 'Le jeu, et le dossier grâce auquel FluidEQ le reconnaît.',
  'help.games.soundName': 'Le son du jeu',
  'help.games.sound':
    'Le son sur lequel FluidEQ bascule quand ce jeu passe au premier plan, ou Ne rien changer.',
  'help.games.removeName': 'Retirer',
  'help.games.remove': 'Oublie le jeu. Le préréglage qu’il utilisait reste.',

  'help.headphones.title': 'Correction du casque et importation',
  'help.headphones.intro':
    'Une correction du casque compense un modèle mesuré et se combine avec vos bandes et vos préréglages. Vérifiez le modèle exact et l’auteur de la mesure.',
  'help.headphones.steps':
    'Ouvrez Égaliseur → Préréglages EQ et cherchez votre modèle de casque. Examinez les mesures disponibles et choisissez l’entrée correspondante.\nPour du texte EQ venant d’un autre outil, utilisez Importer des réglages d’égalisation dans le menu des actions. Vérifiez les bandes et la courbe analysées avant d’appliquer.\nPour Squiglink, ouvrez Mes courbes et choisissez Importer depuis Squiglink. Collez l’export et vérifiez l’aperçu de la courbe. Enregistrer dans Mes courbes la garde pour plus tard ; Enregistrer et appliquer l’utilise aussi comme correction du casque. Appliquer plutôt à l’EQ modifiable remplace vos bandes après confirmation.\nMes courbes est votre propre liste à côté de la Bibliothèque OPRA : Ajouter une courbe prend un export Squiglink, un fichier .txt, votre EQ tel qu’il est ou un choix OPRA. Chaque courbe a Appliquer comme courbe et Appliquer comme EQ, et son menu la renomme, modifie ses bandes, la duplique, la copie en texte ou la supprime. Exporter la liste et Importer une liste emportent toute la liste sur un autre ordinateur.\nImporter dans, à côté d’Appliquer comme EQ, choisit Les deux oreilles, Oreille gauche ou Oreille droite : une seule oreille remplace seulement les bandes de cette oreille et laisse l’autre comme elle était.',
  'help.headphones.tip':
    'Un aperçu marqué Non appliqué ne change pas le son. Évitez de cumuler accidentellement deux corrections complètes du même casque.',
  'help.headphones.keywords':
    'écouteurs, intra-auriculaires, profil de casque, courbe cible, compensation, calibrage, calibration, réponse en fréquence, AutoEq, Harman, target, IEM, Crinacle, oratory1990, presets, oreille gauche, oreille droite, une oreille, mes courbes, courbes enregistrées, liste de courbes, exporter la liste, importer une liste',

  'help.convolution.title': 'Utilisez une réponse impulsionnelle',
  'help.convolution.intro':
    'Convolution applique une impulsion WAV comme couche séparée. Cherchez dans le catalogue AutoEq ou importez votre WAV ; les bandes paramétriques restent indépendantes.',
  'help.convolution.steps':
    'Ouvrez Égaliseur → Convolution. Recherchez par modèle ou par auteur de la mesure.\nVérifiez la source, puis utilisez Télécharger et appliquer ; le téléchargement correspond à la fréquence d’échantillonnage de votre sortie. Utilisez Importer un WAV pour un fichier que vous avez déjà.\nÉcoutez avec la couche de convolution activée puis désactivée dans Courbes.',
  'help.convolution.tip':
    'Le moteur FluidEQ convertit lui-même la fréquence de n’importe quelle impulsion. Equalizer APO a besoin d’un WAV importé à la fréquence de la sortie. Les téléchargements du catalogue nécessitent une connexion ; le guide, non.',
  'help.convolution.keywords':
    'correction acoustique, correction de pièce, fichier de correction, filtre FIR, convolueur, IR, REW',

  'help.profiles.title': 'Appareils, profils et deuxième sortie',
  'help.profiles.intro':
    'Chaque sortie garde son propre son : l’égaliseur, le préréglage, la Tonalité, les filtres, le rack DSP, la Salle et le nivellement sont enregistrés avec elle et reviennent dès que vous passez dessus. Les profils gardent d’autres sons pour la même sortie. Deuxième sortie joue en même temps sur un autre appareil, avec un son et un niveau bien à lui.',
  'help.profiles.steps':
    'Vérifiez la sortie en haut de la carte Sortie avant toute modification ; un casque Bluetooth affiche sa batterie à côté. Utilisez Nouveau profil pour un son à garder ; Mettre à jour enregistre les changements dans ce profil, et Restaurer rétablit ses réglages enregistrés.\nActivez Mémoriser le son de chaque chanson, et le préréglage, la Tonalité et l’EQ réglés pendant une chanson reviennent chaque fois qu’elle joue ici. Une notification le signale, avec Annuler et Oublier cette chanson.\nOuvrez Deuxième sortie, activez un appareil et réglez son niveau. Choisissez son profil juste en dessous, ou appuyez sur Modifier le son pour changer son son dans la page Égaliseur sans changer de sortie principale ; Terminé ou Modifier la sortie principale vous ramène.\nChaque deuxième sortie suit le rythme toute seule et affiche son retard en millisecondes ; avec Partager l’audio, le son d’un autre ordinateur affiche le sien, réseau compris.',
  'help.profiles.tip':
    'Avec le moteur FluidEQ, une deuxième sortie joue directement depuis le moteur, et la sortie principale ne l’attend jamais. Mémoriser le son de chaque chanson est désactivé au départ, et mémorise par sortie. Dans la page Égaliseur, le panneau commence par la carte Mode EQ ; repliez-la pour atteindre vos sorties plus vite.',
  'help.profiles.keywords':
    'enceintes, haut-parleurs, sortie audio, périphérique par défaut, plusieurs sorties, sorties multiples, miroir, simultanément, décalage, désynchronisation, délai, sauvegarder mes réglages, par appareil, Bluetooth, DAC, buffer, deuxième sortie, profil, par sortie, chaque sortie, son propre, batterie, niveau de batterie, modifier le son, modifier la sortie principale, chanson, morceau, par chanson, mémoriser la chanson, son de la chanson, oublier cette chanson',
  'help.profiles.list':
    'Les sons que vous avez enregistrés. ACT marque celui qu’utilise cette sortie ; appuyez sur un autre pour changer.',
  'help.profiles.update':
    'Enregistre vos modifications dans le profil en cours. Restaurer, juste à côté, ramène le profil tel que vous l’avez enregistré la dernière fois.',
  'help.profiles.new':
    'Crée un nouveau profil à partir de l’égalisation actuelle.',
  'help.profiles.eqMode':
    'Les réglages de Mode EQ, en tête de la page Égaliseur. Repliez la carte pour qu’elle ne gêne pas.',
  'help.profiles.songSound':
    'Ramène le préréglage, la Tonalité et l’EQ d’une chanson chaque fois qu’elle joue ici. Désactivé tant que vous ne l’activez pas.',
  'help.profiles.editSound':
    'Modifie le son de cette sortie dans la page Égaliseur sans changer de sortie principale.',
  'help.profiles.output':
    'La sortie sur laquelle vous écoutez, avec sa batterie pour un casque Bluetooth. DÉSACT. signifie que votre EQ ne l’atteint pas ; ACTIF, que Windows joue le son à travers elle.',
  'help.profiles.onePlayer':
    'Lancer quelque chose dans FluidEQ met en pause ce qui joue ailleurs sur le PC, et inversement.',
  'help.profiles.outputs':
    'Vos autres sorties. Activez-en une pour y jouer aussi, avec son propre son, son niveau et son retard en millisecondes.',
  'help.profiles.driver':
    'Un point de départ doux, selon ce avec quoi vous écoutez — casque, écouteurs, taille ou matériau du transducteur. Laissez-le sur Sans compensation si le son vous convient déjà.',

  'help.config.title': 'Inspectez et sauvegardez une chaîne',
  'help.config.intro':
    'Égaliseur → Config montre ce que le moteur audio a réellement sur le disque. Les cartes de sortie et l’arbre d’inclusions vous aident à voir quels appareils et quelles couches sont concernés. Exportez une chaîne avant une grande expérience ou pour déplacer une configuration.',
  'help.config.steps':
    'Ouvrez Égaliseur → Config, choisissez la sortie et vérifiez état et couches.\nUtilisez Exporter la chaîne pour sauvegarder un fichier .fluideq.\nPour le récupérer, choisissez d’abord la bonne sortie, importez la chaîne et vérifiez le résultat.',
  'help.config.tip':
    'Les fichiers de couches générés sont réécrits quand leurs réglages changent ; placez vos lignes manuelles durables dans le fichier personnalisé de chaque sortie. Le moteur FluidEQ en lit les lignes Filter, Preamp, GraphicEQ et Convolution ; les autres commandes APO et les plugins nécessitent Equalizer APO.',
  'help.config.keywords':
    'restaurer, fichier texte, avancé, transférer, backup, config.txt, include',

  'help.dsp.title': 'Explorez le rack DSP',
  'help.dsp.intro':
    'Le rack DSP est une chaîne d’étages de studio. Avec le moteur FluidEQ, il traite tout ce que joue le PC ; avec Equalizer APO, il traite les pistes audio de la Bibliothèque. Il est coupé tant que FluidEQ est désactivé.',
  'help.dsp.steps':
    'Ouvrez l’onglet DSP. Choisissez une chaîne sous Préréglages, ou sélectionnez un étage dans la colonne latérale et activez-le.\nChangez un réglage à la fois et comparez avec l’étage contourné, à volume similaire. Isoler vous fait entendre uniquement ce qu’un étage ajoute.\nEnregistrez un rack qui vous plaît, et utilisez Exporter et Importer pour le partager.\nLe dé-esseur baisse les S, T et CH aigus d’une voix seulement quand ils sonnent, et laisse les cymbales intactes ; Voix, Podcast et Livre audio l’activent. Chaque étage peut garder vos propres profils : réglez-le, puis appuyez sur Enregistrer.',
  'help.dsp.tip':
    'Plus fort paraît souvent meilleur simplement parce que c’est plus fort : comparez donc à niveaux égaux. Faites Ctrl+clic sur un bouton rotatif pour le ramener à sa valeur par défaut.',
  'help.dsp.keywords':
    'effets audio, limiteur, normalisation du volume, volume constant, élargisseur, largeur stéréo, renforcement des basses, infrabasses, transitoires, écrêtage, FX, plugins, loudness, LUFS, sub-bass, mastering, crossfade, gapless, bypass, presets, dé-esseur, de-esser, sifflantes, sibilance, s aigus, voix, podcast, profils, enregistrer un profil',
  'help.dsp.normalizer':
    'Uniformise la sonie. Sur l’audio en direct, il la nivelle morceau par morceau.',
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
    'Des chaînes pour tout le rack : genres, appareils et corrections.',

  'help.room.title': 'La Salle : le surround au casque',
  'help.room.intro':
    'La Salle fait d’un casque une salle d’écoute. Chaque canal du son devient une enceinte autour de votre tête, rendue à travers une tête mesurée et les réflexions d’une salle que vous façonnez vous-même : un film se tient devant vous et un jeu vous entoure. Elle demande le moteur FluidEQ et un casque ; sur des enceintes elle ne sert à rien.',
  'help.room.steps':
    'Ouvrez DSP, choisissez Salle dans le rail et activez-la. La stéréo devient deux enceintes devant vous ; un film 5.1, cinq et le sub ; un jeu 7.1, tout l’anneau. La puce à côté de l’interrupteur dit lequel.\nChoisissez une salle en haut — studio, salon, cinéma, salle de concert et plus — ou tournez Taille, Murs et Distance vous-même et faites glisser une enceinte sur l’anneau. Les enceintes que le flux en lecture n’atteint pas sont dessinées endormies.\nAppuyez sur Lancer le test d’écoute et répondez à cinq courtes paires d’écoute : la salle prend la tête qui place les sons devant vous. Petite, Moyenne et Grande se choisissent aussi à la main.\nEnregistrez une salle qui vous plaît sous un nom ; une salle enregistrée revient d’une pression et ne change jamais votre tête.',
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
  'help.room.dialsName': 'Espace, Ambiance, Distance',
  'help.room.dials':
    'Ce que vous entendez des murs, la traîne douce qui suit, et la distance des enceintes. Taille, Murs, ainsi que la longueur et la couleur de la traîne sont dans Caractère de la salle, en dessous.',
  'help.room.fit':
    'Cinq paires d’écoute qui choisissent la tête pour vos oreilles.',
  'help.room.head':
    'La tête mesurée à travers laquelle la salle est rendue : petite, moyenne ou grande.',
  'help.room.saved':
    'Nommez la salle telle qu’elle est ; elle revient d’une pression.',
  'help.room.liveName': 'Ce que fait la salle',
  'help.room.live':
    'Lu depuis le moteur : quelles enceintes le flux en lecture atteint, ou pourquoi la salle est au repos.',

  'help.denoise.title': 'Débruitage et analyse',
  'help.denoise.intro':
    'Débruitage réduit le souffle, le ronflement secteur et les craquements. Avec le moteur FluidEQ, il agit en direct sur tout ce que joue le PC ; le nettoyeur de voix neuronal et le plancher de bruit analysé sont réservés aux pistes de la Bibliothèque. Une réduction plus forte n’est pas forcément meilleure.',
  'help.denoise.steps':
    'Lancez quelque chose qui contient le bruit à réduire et sélectionnez Débruitage dans DSP.\nActivez Souffle, Ronflement ou Craquements avec un réglage léger, et écoutez les passages calmes et les détails musicaux.\nAugmentez la réduction progressivement, puis contournez l’étage pour vérifier que l’amélioration vaut la perte de détail éventuelle.',
  'help.denoise.tip':
    'Guettez les détails adoucis, les textures aqueuses ou le pompage. Ce n’est pas un nettoyage du micro. Si vous n’entendez aucun changement, vérifiez que le rack et l’étage sont tous deux activés.',
  'help.denoise.keywords':
    'suppression du bruit, enlever le bruit, bruit de fond, grésillements, bourdonnement, sifflement, parasites, friture, restauration, vinyle, cassette, denoise',

  'help.graph.title': 'Le graphique et ses commandes',
  'help.graph.intro':
    'La courbe de réponse trace vos courbes d’EQ sur le son en direct. La barre au-dessus choisit ce qui est dessiné et comment, et elle change selon le style choisi : style standard ou scène.',
  'help.graph.steps':
    'Cliquez sur le nom du style pour choisir un style ou une scène. Les flèches à côté, Espace et Ctrl+Espace les font défiler.\nOuvrez Affichage pour la taille du graphique, ce qu’il montre, et la hauteur et la position de l’onde. Afficher étiquettes de l’EQ écrit la fréquence, le Q et le gain de chaque bande au-dessus de son point. Comment c’est dessiné règle la cadence — toutes les images que votre écran propose, ou 60 ou 30, et 60 sur batterie — ainsi que la résolution et le lissage ; les styles standard gardent leurs propres choix, séparément des scènes.\nUne scène ajoute ses propres réglages à Affichage — ce que son auteur vous a laissé régler — et Utiliser son onde d’origine ramène l’onde à la hauteur et à la position choisies par cet auteur.\nDouble-cliquez sur le tracé pour passer en plein écran, ou Ctrl+double-clic pour l’agrandir dans la fenêtre ; un nouveau double-clic le ramène. Un simple clic masque ou affiche la barre.\nTouches : Ctrl+F plein écran, Ctrl+S vue agrandie, Échap retour à la vue normale, Ctrl+G la grille, Ctrl+W ce que montre le graphique, étiquettes des bandes comprises, Ctrl+I le sens de l’onde, Ctrl+A toutes les bandes. Sur le point d’une bande, faites-le glisser pour la déplacer, utilisez les touches fléchées pour l’avancer pas à pas, et un clic droit ouvre son menu ; Ctrl+molette change le Q d’un point sélectionné.',
  'help.graph.tip': 'Tout ceci ne change que le dessin, jamais votre son.',
  'help.graph.keywords':
    "analyseur de spectre, forme d'onde, quadrillage, taux de rafraîchissement, fluidité, saccadé, réactivité, FPS, framerate, fullscreen, raccourcis, raccourcis clavier, double-clic, vue agrandie, agrandir, étiquettes, étiquettes de bandes, étiquettes de l’eq, libellés, clavier, touches fléchées, graphismes, réglages graphiques, résolution, lissage, cadence",
  'help.graph.stripCaption': 'Avec un style standard',
  'help.graph.live': 'Affiche ou masque l’onde en direct.',
  'help.graph.previous': 'Revient au style précédent.',
  'help.graph.picker': 'Ouvre tous les styles et visualiseurs.',
  'help.graph.next': 'Passe au style suivant.',
  'help.graph.autoName': 'Auto',
  'help.graph.auto': 'Change de style toutes les 10 secondes à 2 minutes.',
  'help.graph.colouring':
    'Colore le style : Auto, Uniforme, Fréquence, Niveau ou Chaleur.',
  'help.graph.newLook': 'Crée un style à vous à partir de celui-ci.',
  'help.graph.bandsName': 'Bandes d’écoute',
  'help.graph.bands': 'Ombre les bandes que vous entendez le plus.',
  'help.graph.bandsMenu':
    'Le même ombrage ; grisé sur une scène, qui ne le dessine jamais.',
  'help.graph.gridName': 'Grille',
  'help.graph.grid': 'Affiche ou masque la grille et les échelles.',
  'help.graph.viewName': 'Affichage',
  'help.graph.view': 'Taille, ce qui est dessiné, et l’onde.',
  'help.graph.plusCaption': 'Avec une scène',
  'help.graph.tintName': 'Couleurs de la fenêtre',
  'help.graph.tint':
    'Le thème de l’application, les couleurs du visualiseur, ses couleurs avec sa lumière (Ambiance), ou le visualiseur derrière toute la fenêtre (Toile de fond).',
  'help.graph.likeName': 'J’aime',
  'help.graph.like':
    'Aime la scène en cours, ce qui rapporte des points à son auteur. Sur une scène à vous, il montre combien de j’aime elle a.',
  'help.graph.lighting': 'Éclaire vos appareils RVB avec cette scène.',
  'help.graph.desktop': 'Place ce visualiseur derrière les icônes du Bureau.',
  'help.graph.viewCaption': 'Le menu Affichage',
  'help.graph.expand': 'Le graphique s’agrandit par-dessus l’éditeur.',
  'help.graph.fullscreen': 'Le graphique remplit l’écran.',
  'help.graph.showingName': 'Affichage',
  'help.graph.showing':
    'Fait défiler ce que montre le graphique, étiquettes des bandes comprises.',
  'help.graph.labels':
    'La fréquence, le Q et le gain de chaque bande au-dessus de son point.',
  'help.graph.waveName': 'L’onde',
  'help.graph.wave': 'Le tracé du spectre en direct.',
  'help.graph.topWaveName': 'Onde supérieure',
  'help.graph.topWave': 'La petite onde dans la barre de titre.',
  'help.graph.meterName': 'Indicateur de niveau',
  'help.graph.meter': 'L’indicateur de sortie dans la colonne de gauche.',
  'help.graph.drawing':
    'Cadence, résolution et lissage, gardés à part pour les styles standard et les scènes.',
  'help.graph.waveHeight': 'La hauteur à laquelle l’onde est dessinée.',
  'help.graph.wavePosition': 'Du bord inférieur jusqu’au milieu.',
  'help.looks.title': 'Styles et scènes',
  'help.looks.intro':
    'Les styles standard sont des dessins gratuits du son en direct, que vous pouvez colorer et concevoir vous-même : Ligne et Aire pour un tracé net, Blocs LED et Pics pour du punch, Treillis, Horizon et Flammes dansantes pour des scènes entières. Les scènes sont des images vivantes dessinées par la carte graphique, comme Alpin, Aurore, Floraison et Ville néon, où les basses, le rythme et les aigus font chacun bouger quelque chose de différent.',
  'help.looks.steps':
    'Sur le graphique, cliquez sur le nom du style. Recherchez, ou filtrez les styles par Lignes, Remplissages, Barres, Points ou Scènes.\nChoisissez une scène à droite. Si elle n’est pas encore à vous, elle est verrouillée, et la choisir explique comment l’obtenir.\nSur un style standard, appuyez sur Nouveau style pour changer ses couleurs, son mouvement et ses crêtes, puis enregistrez-le ; il apparaît sous Les vôtres.',
  'help.looks.tip':
    'Une scène apporte ses propres couleurs : réglez son attaque et son relâchement dans Affichage. Les styles standard ont leurs propres réglages graphiques dans Affichage, séparément des scènes : pleine résolution et mise à l’échelle simple au départ. Si une scène ne peut pas tourner sur cet ordinateur, le graphique dessine un style gratuit au lieu d’un tracé vide.',
  'help.looks.keywords':
    'thème, apparence, visualisation, animations, personnaliser, personnalisation, effets visuels, skin, look, visualizer, graphismes, réglages graphiques, résolution, qualité',
  'help.looks.searchName': 'Recherche',
  'help.looks.search':
    'Trouve les styles et visualiseurs par nom, créateur ou catégorie.',
  'help.looks.styles':
    'Les styles gratuits dessinés par FluidEQ, et les styles que vous avez enregistrés.',
  'help.looks.familiesName': 'Filtres de style',
  'help.looks.families':
    'Analyse et Scènes, et Les vôtres dès que vous avez enregistré un style.',
  'help.looks.plus':
    'Des scènes de FluidEQ et des membres, et les vôtres sous Créés par vous.',
  'help.looks.categoriesName': 'Catégories',
  'help.looks.categories': 'Nature, Villes, Abstrait et plus encore.',

  'help.plus.title': 'Votre compte, les crédits et l’onglet Visualiseurs',
  'help.plus.intro':
    'Le compte est facultatif : tout ce qui était gratuit fonctionne sur cet ordinateur sans compte. Une fois connecté, l’onglet Visualiseurs réunit la Galerie, le Studio, l’Éclairage dynamique et le visualiseur de Bureau. Une scène de la Galerie coûte un crédit et vous appartient pour de bon ; un compte confirmé reçoit quelques crédits gratuits, et les packs de crédits se paient une seule fois.',
  'help.plus.steps':
    'Ouvrez Compte dans le menu des actions. Connectez-vous, ou créez un compte et saisissez le code à six chiffres envoyé à votre adresse e-mail.\nOuvrez l’onglet Visualiseurs et choisissez Galerie. Ouvrez une scène, regardez-la, et appuyez sur Obtenir pour y dépenser un crédit.\nPour plus de crédits, ouvrez Compte et choisissez un pack. Il se paie une seule fois sur Stripe, dans votre navigateur.',
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

  'help.gallery.title': 'La galerie Visualiseurs',
  'help.gallery.intro':
    'Visualiseurs réunit les scènes de FluidEQ et celles que publient les membres. Tout compte peut les parcourir et regarder n’importe quelle scène pendant dix secondes ; une scène obtenue avec un crédit joue sur votre musique et reste dans vos styles, pour de bon.',
  'help.gallery.steps':
    'Ouvrez Visualiseurs → Galerie. Recherchez, triez par Les plus aimées, Cette semaine ou Les plus récentes, ou choisissez une catégorie.\nOuvrez une scène et appuyez sur Obtenir pour la garder avec un crédit, puis sur Lancer sur le graphique. Les flèches, ou ← et →, passent d’une scène à l’autre.\nAimez avec le cœur les scènes que vous avez, et signalez celle qui ne devrait pas être là.',
  'help.gallery.tip':
    'Les scènes de vos styles se mettent à jour d’elles-mêmes, et la page d’une scène indique ce qui a changé à chaque version. Une scène que vous publiez apparaît une fois que le créateur de FluidEQ l’a approuvée. Ouvrir dans le Studio montre comment sont faites les scènes de FluidEQ.',
  'help.gallery.keywords':
    'télécharger, découvrir, populaires, tendances, modération, inapproprié, like, visualizers',
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
    'Le Studio transforme une description en visualiseur. Votre propre assistant IA écrit la scène dans un dossier de projet, et FluidEQ lance chaque version sur votre musique dès qu’elle est enregistrée. Le Studio est gratuit pour tous les comptes.',
  'help.studio.steps':
    'Ouvrez Visualiseurs → Studio et appuyez sur Nouveau projet… Donnez-lui un nom ; FluidEQ crée son dossier avec une scène qui bouge déjà.\nDécrivez votre idée, ouvrez le dossier dans votre assistant IA et collez le prompt copié avec Copier le prompt IA.\nOu écrivez ce qui doit changer dans la discussion à côté de la scène : Claude Code sur cet ordinateur, connecté avec votre propre abonnement, modifie la scène et joue chaque version. Chaque réponse garde sa version, avec Rétablir.\nRegardez l’aperçu à chaque enregistrement de fichier et essayez les signaux de test. Puis Ajouter à mes styles, Publier… ou Exporter…',
  'help.studio.tip':
    'Double-cliquez sur l’aperçu pour le plein écran. Explorer une scène FluidEQ… ouvre l’une des scènes de FluidEQ pour apprendre en l’étudiant ; elle ne peut pas être publiée. Les scènes qui clignotent trop fort ou sont trop lourdes sont retenues. Une scène que vous publiez est d’abord lue par le créateur de FluidEQ, et une fois approuvée, elle joue gratuitement pour vous partout.',
  'help.studio.keywords':
    'intelligence artificielle, éditeur de scènes, shader, GLSL, ChatGPT, Claude, discussion, chat, demander un changement, claude code, rétablir, versions',
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

  'help.desktop.title': 'Le visualiseur du Bureau',
  'help.desktop.intro':
    'Le visualiseur du Bureau place une scène derrière les icônes du Bureau, sur un écran ou sur chacun d’eux, tant que FluidEQ tourne.',
  'help.desktop.steps':
    'Mettez une scène sur le graphique et appuyez sur le bouton en forme d’écran à côté de son nom, ou choisissez Affichage → Définir comme arrière-plan du Bureau.\nAppuyez sur les écrans de la carte, choisissez Avec la musique ou Calme, et appuyez sur Définir l’arrière-plan.\nPour le modifier ou l’arrêter, ouvrez Visualiseurs → Galerie et utilisez Gérer ou Arrêter en haut.',
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
    'Ouvrez Visualiseurs → Éclairage dynamique et activez-le, ou appuyez sur le bouton d’éclairage à côté d’une scène sur le graphique.\nChoisissez le style lumineux de cette scène — Scène, Vague de couleur, Spectre ou Onde rythmique — et réglez sa luminosité et ce à quoi il réagit.\nCliquez sur un appareil sous Vos appareils pour le régler seul ; Tous les appareils revient au réglage de l’ensemble.',
  'help.lighting.tip':
    'Si Windows réserve un appareil à une autre application, la page indique le paramètre à changer et l’ouvre pour vous. Les appareils Razer ont besoin de Razer Synapse en cours d’exécution, avec Chroma Apps autorisé.',
  'help.lighting.keywords':
    'rétroéclairage, lumières, éclairage ambiant, effets lumineux, RGB, RVB, LED',
  'help.lighting.switch': 'Éclaire vos appareils pendant qu’une scène joue.',
  'help.lighting.browse': 'Ouvre la galerie pour choisir un visualiseur.',
  'help.lighting.previewName': 'Aperçu du bureau en direct',
  'help.lighting.preview':
    'Votre propre bureau, éclairé avec les couleurs qui lui sont envoyées.',
  'help.lighting.devices':
    'Tous les appareils trouvés. Cliquez sur l’un d’eux pour le régler seul ; le bouton Tous les appareils, au-dessus de la liste, les règle de nouveau tous à la fois.',
  'help.lighting.style':
    'Scène, Vague de couleur, Spectre ou Onde rythmique, mémorisé pour chaque visualiseur.',

  'help.online.title': 'Écoutez avec Médias en ligne',
  'help.online.intro':
    'Médias en ligne place les sites compatibles à côté de votre EQ. La lecture et l’identification sur ces sites dépendent toujours du fournisseur et de votre connexion. La barre en bas de FluidEQ suit le lecteur actif, et son volume est celui de votre ordinateur.',
  'help.online.steps':
    'Ouvrez Médias en ligne, choisissez un site et lancez quelque chose sur la page.\nPassez à l’Égaliseur pour régler en écoutant, puis revenez aux commandes propres à la page.\nActivez Un seul lecteur pour éviter les lectures superposées.',
  'help.online.tip':
    'Avec le moteur FluidEQ, Médias en ligne passe par votre EQ et le rack DSP comme toute autre application. Avec Equalizer APO, le rack reste réservé aux pistes de la Bibliothèque.',
  'help.online.keywords':
    'musique en ligne, vidéos YouTube, internet, navigateur intégré, YouTube, YouTube Music, Bandcamp, Twitch, Suno, streaming, web',

  'help.library.title': 'Constituez votre bibliothèque locale',
  'help.library.intro':
    'Bibliothèque rassemble la musique et les vidéos de vos disques. Parcourez-les par albums, artistes, genres, chansons, dossiers, par arborescence de dossiers ou dans vos playlists. Les pochettes et les informations viennent de vos fichiers : une même collection peut donc sembler différente selon ses tags.',
  'help.library.steps':
    'Ouvrez la Bibliothèque et ajoutez le dossier contenant vos médias. Laissez l’analyse se terminer avant de juger ce qui manque.\nChoisissez un artiste ou un album, ou recherchez une chanson. Lancez une piste depuis les résultats.\nUtilisez la barre en bas de la fenêtre pour mettre en pause, vous déplacer dans le morceau et passer au suivant. Son volume est celui de votre ordinateur, le même que dans Windows.',
  'help.library.tip':
    'Survolez le bouton de FluidEQ dans la barre des tâches de Windows pour Précédent, Lire et Suivant, même quand FluidEQ est réduit. Bibliothèque a besoin des fichiers d’origine : rebranchez un disque ou ajoutez de nouveau un dossier déplacé.',
  'help.library.keywords':
    'lecteur audio, médiathèque, formats audio, jaquette, métadonnées, scanner, importer ma musique, MP3, FLAC, WAV, AAC, ID3, cover',

  'help.queue.title': 'Albums et file de lecture',
  'help.queue.intro':
    'La file définit l’ordre d’écoute. Ouvrir un autre album permet de parcourir sans remplacer le morceau courant. Le morceau actif et À suivre vous situent.',
  'help.queue.steps':
    'Ouvrez un album pour voir ses pistes. Lancez le morceau voulu.\nFaites un clic droit sur une chanson pour Ajouter à la file, Ajouter aux Favoris ou Ajouter à une playlist.\nOuvrez À suivre pour voir ce qui vient ensuite, et activez Continuer la lecture pour poursuivre avec d’autres titres du même genre.',
  'help.queue.tip':
    'Lancer la lecture dans la Bibliothèque prend le relais des autres lecteurs de FluidEQ. Fiez-vous au morceau affiché dans la barre pour savoir quelle source a la main sur la lecture.',
  'help.queue.keywords':
    "file d'attente, aléatoire, mélanger, répéter, en boucle, suivant, prochain morceau, lecture automatique, préférés, liste de lecture, queue, shuffle, repeat, autoplay",

  'help.karaoke.title': 'Chantez avec Karaoké',
  'help.karaoke.intro':
    'Karaoké associe audio et paroles locales. Les paroles synchronisées suivent la lecture ; les cibles de hauteur exigent des notes. Un micro configuré ajoute votre hauteur en direct.',
  'help.karaoke.steps':
    'Ouvrez Karaoké et ajoutez fichiers ou dossier contenant audio et paroles correspondantes.\nChoisissez un morceau, lancez-le et vérifiez l’association.\nConfigurez le micro, ajustez la taille des paroles et utilisez le plein écran de la scène.',
  'help.karaoke.tip':
    'Un fichier contenant seulement des paroles n’a pas de notes cibles. Karaoké joue au volume de votre ordinateur ; les niveaux de la mélodie, de l’instrumental et de la voix témoin se trouvent dans Réglages du mixage.',
  'help.karaoke.keywords':
    'chansons, microphone, justesse, chanter juste, fausses notes, lyrics, pitch, score, LRC, UltraStar',

  'help.maker.title': 'Créez dans le Créateur de karaoké',
  'help.maker.intro':
    'Le Créateur transforme l’audio en projet modifiable avec paroles et notes sur la timeline. Vérifiez toujours les mots et les temps générés automatiquement.',
  'help.maker.steps':
    'Ouvrez Créer depuis Karaoké et chargez l’audio. Choisissez les outils de séparation ou transcription nécessaires.\nSuivez la progression ; la première utilisation de l’IA peut télécharger des modèles. Vérifiez paroles et notes.\nÉcoutez de courts passages, corrigez texte et temps, sauvegardez le projet puis exportez les fichiers.',

  'help.maker.lyricsCaption':
    'Les paroles, et le moment où chaque mot est chanté',
  'help.maker.referenceName': 'Paroles de référence',
  'help.maker.reference':
    'La chanson entière en texte, une ligne par rangée. Collez-la ou chargez un fichier ; FluidEQ en tire le calage.',
  'help.maker.timingName': 'Calage du mot',
  'help.maker.timing':
    'Tous les mots dans l’ordre, avec le nombre déjà calé. Appuyez sur l’un d’eux pour le travailler.',
  'help.maker.wordName': 'Mot sélectionné',
  'help.maker.word':
    'Où commence le mot choisi et combien de temps il dure. Déplacer son bord donne ou prend du temps au mot voisin ; la ligne garde sa durée.',
  'help.maker.toolsCaption': 'Les outils d’IA et les modèles qu’ils demandent',
  'help.maker.separate':
    'Sépare l’enregistrement en voix et musique, pour que le karaoké joue sans le chanteur.',
  'help.maker.loadVocals':
    'Utilisez un fichier de voix seule que vous avez déjà, au lieu d’en séparer un ici.',
  'help.maker.redetectTiming':
    'Réécoute la voix et recalcule le calage des mots déjà présents.',
  'help.maker.redetectNotes':
    'Réécoute la mélodie et réécrit les notes sous les mots.',
  'help.maker.modelsName': 'Mémoire des modèles IA',
  'help.maker.models':
    'Ce dont chaque modèle a besoin et s’il est sur cet ordinateur. Ils sont téléchargés à la première utilisation.',
  'help.maker.idleName': 'Lorsqu’il est inactif',
  'help.maker.idle':
    'Si un modèle reste en mémoire entre deux usages, et combien de temps. Le libérer rend de la mémoire ; le garder fait démarrer la fois suivante aussitôt.',

  'help.makerBar.caption': 'Les outils en haut du créateur',
  'help.makerBar.import':
    'Ouvre un fichier karaoké ou un projet enregistré, en gardant l’audio déjà chargé.',
  'help.makerBar.lyrics': 'Les mots et leur calage, dans une seule fenêtre.',
  'help.makerBar.timing':
    'Déplace les mots et les notes ensemble, pour une chanson en avance ou en retard dès la première seconde.',
  'help.makerBar.pan':
    'Faites glisser la timeline pour parcourir la chanson sans rien modifier.',
  'help.makerBar.language':
    'La langue des paroles, et une seconde à côté pour la chanter dans l’une ou l’autre.',
  'help.makerBar.record':
    'Lancez la chanson et appuyez sur une touche au début et à la fin de chaque ligne. Le calage vient de vos appuis.',
  'help.makerBar.select':
    'Tracez un cadre autour des notes pour les déplacer ou les supprimer ensemble.',
  'help.makerBar.paint':
    'Dessinez la mélodie directement sur la grille des hauteurs.',
  'help.makerBar.split':
    'Coupe un mot en syllabes, pour qu’un mot long porte une note sur chacune.',
  'help.makerBar.repair':
    'Les outils qui écoutent à votre place, et les modèles dont ils ont besoin.',
  'help.makerBar.export':
    'Écrit le karaoké terminé en projet FluidEQ, UltraStar TXT, LRC ou LRC enrichi.',
  'help.maker.tip':
    'Les modèles nécessitent connexion et espace disque. La durée dépend du matériel et du morceau. Utilisez de l’audio autorisé et vérifiez avant de partager.',
  'help.maker.keywords':
    'enlever la voix, isoler la voix, extraire la voix, instrumental, a cappella, acapella, synchroniser les paroles, transcrire, reconnaissance vocale, stems, timing',

  'help.share.title': 'Partagez l’audio entre ordinateurs',
  'help.share.intro':
    'Partager l’audio relie les ordinateurs d’un même réseau privé en un groupe, et chacun joue le son des autres : où que vous soyez assis, vous entendez le reste. Chaque ordinateur envoie son propre son directement aux autres, intact, et ne renvoie jamais ce qu’il reçoit, donc pas d’écho ; l’ordinateur sur lequel vous écoutez applique son propre EQ, ses courbes et son DSP. C’est distinct de la recopie vers un second appareil sur un même ordinateur.',
  'help.share.steps':
    'Sur un ordinateur, ouvrez Partager l’audio, appuyez sur Ajouter un ordinateur puis sur Copier le code. Commencez à faible volume.\nSur l’autre ordinateur, appuyez sur Ajouter un ordinateur, collez le code sous Code de l’autre ordinateur et appuyez sur Relier. Les deux ordinateurs se jouent aussitôt l’un l’autre. Reliez d’autres ordinateurs de la même façon : chacun rejoint tout le groupe, et ceux qui arrivent par un autre apparaissent avec Recevoir coupé jusqu’à ce que vous l’activiez.\nDans Tout le groupe, chaque ordinateur a deux interrupteurs, Recevoir et Envoyer ; Partager coupe le son de cet ordinateur pour tous. Votre mixage règle le volume de Ce PC et un niveau par ordinateur.\nPause, Reprendre et Délier se trouvent dans le menu de chaque ordinateur. Un ordinateur absent reste dans la liste comme Hors ligne, et le groupe se retrouve tout seul après un redémarrage, une mise en veille, une coupure réseau ou un changement de moteur.',
  'help.share.tip':
    'Le code de connexion autorise la liaison : gardez-le privé. Avec le moteur FluidEQ, cet ordinateur garde son DSP pendant qu’il partage, et l’ordinateur qui joue son son applique le sien. Jouer et envoyer à la fois demande Windows sur cet ordinateur ; ailleurs, une liaison fonctionne dans un seul sens.',
  'help.share.keywords':
    'réseau local, diffuser, transmettre, autre PC, deuxième PC, jumelage, LAN, wifi, Ethernet, deux sens, bidirectionnel, relier, délier, pause, reprendre, volume, groupe, ajouter un ordinateur, recevoir, envoyer, partager, mixage, hors ligne, plusieurs ordinateurs',

  'help.trouble.title': 'Quand le son ne va pas',
  'help.trouble.intro':
    'Commencez par la source et la sortie, puis isolez la couche en cause. Un graphique, un préréglage enregistré ou un interrupteur activé ne suffit pas à prouver que le son atteint l’appareil voulu. Le menu Aide mène aussi au dépannage audio, au signalement de problèmes et au Forum.',
  'help.trouble.steps':
    "Aucun son : vérifiez que la lecture est en cours, que la bonne sortie est sélectionnée, que le volume est monté et que l’appareil est connecté. Vérifiez si Un seul lecteur a mis une autre source en pause.\nAucun effet de l’EQ : vérifiez que l’Égaliseur système est activé et que la sortie n’affiche pas le badge DÉSACT. ; si c’est le cas, appuyez sur Activer. Si un avis indique que le moteur ne tourne pas, appuyez sur Redémarrer l’audio de Windows.\nTout semble correct et l'EQ ne fait toujours rien : Windows joue peut-être la musique en dehors du moteur. L'avis le dit et propose de le déplacer d'une pression là où Windows l'utilisera ; cela coûte une autorisation et une seconde de silence.\nDistorsion ou basses excessives : laissez la Normalisation auto activée, réduisez les amplifications et contournez les couches une à une. Si cela persiste, utilisez Signaler un problème et relisez le rapport avant de l’envoyer.",
  'help.trouble.tip':
    'F1 ouvre ce guide. Échap ferme d’abord la capture agrandie, puis le guide. Si l’interface est trop grande, Ctrl + 0 réinitialise le zoom. Processus, dans le menu des actions, montre ce que fait chaque partie de FluidEQ.',
  'help.trouble.keywords':
    'ne marche pas, ne fonctionne pas, panne, souci, silencieux, crépitements, grésillements, coupures, distordu, saturation, écrêtage, trop fort, trop faible, résoudre, solution, dépanner, assistance, support technique, raccourcis clavier, texte trop petit, plantage, bug, clipping, crash, pas de son, aucun son, plus de son',

  'help.forum.title': 'Posez vos questions sur le Forum',
  'help.forum.intro':
    'Le Forum intègre les GitHub Discussions de FluidEQ à l’application : annonces, idées, questions et réglages dont les gens sont fiers. Tout le monde peut lire ; pour publier, vous utilisez votre compte GitHub, pas un compte FluidEQ.',
  'help.forum.steps':
    'Ouvrez Aide → Forum et choisissez une catégorie : Annonces, Général, Idées, Sondages, Q&A ou Vitrine. Nouveau pour vous rassemble ce qui est arrivé depuis votre dernière visite, et Tickets liste les problèmes signalés sur GitHub.\nRecherchez dans le forum, ou ouvrez un sujet pour lire les réponses.\nAppuyez sur Se connecter avec GitHub, terminez dans votre navigateur, puis publiez un Nouveau sujet ou une réponse.',
  'help.forum.tip':
    'Tout ce qui est publié est public sur GitHub, sous votre nom GitHub. Dans Q&A, marquez la réponse qui a marché pour que la personne suivante la trouve.',
  'help.forum.keywords':
    'communauté, entraide, suggestions, demande de fonctionnalité, contacter, feedback, support, FAQ',
};

export default help;
