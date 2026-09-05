/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
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
  'tour.rail.new': 'NOUVEAU DANS CETTE VERSION',
  'tour.rail.always': 'AUSSI DANS FLUIDEQ',
  'tour.newBadge': 'NOUVEAU',
  'tour.howTitle': 'Pour commencer',

  'tour.theme.kicker': 'UN NOUVEAU LOOK',
  'tour.theme.title': 'Voici le thème Noir',
  'tour.theme.subtitle': 'Noir pur, pour les nuits tardives et les écrans OLED',
  'tour.theme.lead':
    'FluidEQ a désormais un second visage. Noir efface toute trace du bleu ardoise d’origine : panneaux, menus et barres passent en monochrome, l’accent reste, et le spectre est la seule couleur de la pièce.',
  'tour.theme.point1':
    'Fonds noir absolu : sur un écran OLED, les pixels autour du graphe s’éteignent.',
  'tour.theme.point2':
    'Toutes les fenêtres suivent : menus, boîtes de dialogue, la scène karaoké et la Bibliothèque changent ensemble.',
  'tour.theme.point3':
    'Votre couleur d’accent et le mode arc-en-ciel sont conservés. Rien ne change dans votre son : seule la peinture.',
  'tour.theme.howTitle': 'Comment changer',
  'tour.theme.how':
    'Ouvrez le menu derrière l’icône d’impulsion en haut à droite, puis choisissez Thème → Noir. Océan reste à un clic si vous voulez revenir.',
  'tour.theme.tryBlack': 'Passer en Noir maintenant',
  'tour.theme.tryOcean': 'Revenir à Océan',
  'tour.theme.imageAlt':
    'FluidEQ en thème Noir : l’onglet EQ avec quinze bandes et le spectre en direct pendant la lecture d’un morceau.',

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
    'Ouvrez FluidEQ là-bas, allez dans Partager l’audio, choisissez « Envoyer le son de cet ordinateur », collez le code et appuyez sur « Connecter et envoyer ». Son audio système commence à circuler.',
  'tour.share.step3Title': 'Choisissez une priorité et écoutez',
  'tour.share.step3':
    'Musique garde un tampon plus large pour une écoute ininterrompue ; Jeu/Vidéo tourne avec le délai le plus court pour la synchronisation labiale. Chaque émetteur est mixé dans la sortie du récepteur et façonné par son EQ. La barre de lecture du récepteur affiche le morceau de chaque émetteur et ses boutons agissent à travers le réseau.',
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
    'Mémoire d’EQ par morceau : activez « Enregistrer pour ce morceau » pendant la lecture et la correction est retenue pour ce titre.',
  'tour.library.how':
    'Ouvrez l’onglet Bibliothèque, appuyez sur « Ajouter un dossier » ou déposez un dossier sur la page, puis attendez « Morceaux ajoutés ». Choisissez Albums, Artistes, Genres, Titres, Dossiers ou Arborescence, puis appuyez sur Lecture.',
  'tour.library.open': 'Ouvrir la Bibliothèque',

  'tour.dsp.kicker': 'UN RACK DE MASTERING',
  'tour.dsp.title': 'Le rack DSP',
  'tour.dsp.subtitle': 'Neuf étages, chacun avec son graphe',
  'tour.dsp.lead':
    'Tout ce que joue la Bibliothèque peut traverser un rack d’étages de studio, dans l’ordre : Normaliseur, Denoise, Exciter, Bass Forge, Égaliseur, Bass Punch, Dimension, Maximiseur et Master, plus un fondu enchaîné entre les pistes. Chaque étage est une carte avec un graphe en direct, des préréglages et un bouton Isoler pour n’entendre que ce qu’il fait.',
  'tour.dsp.point1':
    'Denoise répare l’enregistrement lui-même : souffle, ronflette, clics et un nettoyeur de voix neuronal, mesurés d’après une analyse de la piste.',
  'tour.dsp.point2':
    'Bass Forge ajoute une vraie octave sous la basse ; Bass Punch en façonne l’attaque, le sustain, le bloom et le duck.',
  'tour.dsp.point3':
    'Un Égaliseur paramétrique à quinze bandes, phase minimale ou linéaire, mid/side, suréchantillonnage et des dizaines de préréglages nommés.',
  'tour.dsp.point4':
    'Un Master avec cible de sonie LUFS et sécurité true-peak, des préréglages de livraison du Streaming au Vinyle, et un Gain match pour comparer le son, pas le volume.',
  'tour.dsp.how':
    'Lancez une piste depuis la Bibliothèque, ouvrez l’onglet DSP, choisissez une chaîne sous Préréglages, puis cliquez sur un étage dans les onglets latéraux et activez-le.',
  'tour.dsp.open': 'Ouvrir le DSP',

  'tour.output.kicker': 'JOUE À DEUX ENDROITS',
  'tour.output.title': 'Profils de la seconde sortie',
  'tour.output.subtitle':
    'Casque et enceintes en même temps, chacun avec son profil',
  'tour.output.lead':
    'Écoutez au casque et sur les enceintes avec des égalisations séparées. La seconde sortie reçoit le son avant l’égalisation de la sortie principale, puis applique son propre profil enregistré. Aucun pilote de routage nécessaire.',
  'tour.output.point1':
    'Activez un autre appareil dans Seconde sortie et réglez son volume.',
  'tour.output.point2':
    'Choisissez un profil enregistré avec le sélecteur de profil d’égalisation sous cet appareil. La sortie principale garde ses réglages.',
  'tour.output.point3':
    'Un lecteur à la fois : lancer quelque chose dans FluidEQ met le reste de la machine en pause, et inversement.',
  'tour.output.point4':
    'Jeu/Vidéo démarre avec environ 30 ms de réserve et se resynchronise après une interruption ; Musique démarre avec environ 100 ms pour une écoute plus fluide. Le tampon de l’appareil ajoute du retard.',
  'tour.output.how':
    'Ouvrez l’onglet EQ puis Seconde sortie à droite. Activez un appareil, choisissez son profil sous son nom, réglez le volume et sélectionnez Jeu/Vidéo ou Musique.',
  'tour.output.open': 'Ouvrir l’EQ',
  'tour.output.imageAlt':
    'Le panneau Seconde sortie avec un BlackShark V2 Pro activé, son sélecteur de profil, son volume et les modes Jeu/Vidéo et Musique.',

  'tour.looks.kicker': 'VOTRE PROPRE VISUALISEUR',
  'tour.looks.title': 'Des styles à vous pour le graphe',
  'tour.looks.subtitle': 'Cinquante-sept formes, vos couleurs, votre mouvement',
  'tour.looks.lead':
    'Le spectre sous l’EQ se dessine comme vous voulez. Choisissez une des cinquante-sept formes, des simples barres et lignes aux crêtes, à la soie, à la skyline et à la matrice de points ; colorez-la en aplat, par fréquence, par niveau ou par chaleur ; réglez la vitesse d’attaque et la durée de maintien d’un pic ; marquez les pics d’étincelles, de comètes, de halos ou de couronnes. Enregistrez-le comme style à vous, et partagez-le en fichier.',
  'tour.looks.point1':
    'Cinquante-sept formes, chacune avec ses réglages : pièces, espacement, remplissage, épaisseur, et pleine ou tracée.',
  'tour.looks.point2':
    'Couleur par fréquence, niveau ou chaleur avec une rampe de vos propres couleurs, ou une seule couleur en aplat.',
  'tour.looks.point3':
    'Attaque et relâchement fixent le mouvement ; les pics allumés et dix-huit marques de pic décident de l’allure d’un coup.',
  'tour.looks.point4':
    'Le mode arc-en-ciel ajoute une lueur sur le temps et un bord qui parcourt toute la roue des couleurs. Les styles s’exportent en fichier et s’importent depuis un fichier.',
  'tour.looks.how':
    'Dans l’onglet EQ, appuyez sur « Nouveau style » dans la barre du graphe. Choisissez une forme avec le sélecteur ou appuyez sur Espace pour les faire défiler, réglez couleurs et mouvement pendant que la musique joue, puis Enregistrer.',
  'tour.looks.open': 'Ouvrir l’EQ',

  'tour.karaoke.kicker': 'UNE SCÈNE À LA MAISON',
  'tour.karaoke.title': 'Le karaoké avec guide de justesse',
  'tour.karaoke.subtitle': 'Vos chansons, vos paroles, votre micro',
  'tour.karaoke.lead':
    'Déposez une chanson avec ou sans fichier de paroles : FluidEQ les associe dans une playlist, affiche les paroles synchronisées sur la pochette ou la vidéo, écoute votre micro et trace votre hauteur face à la mélodie. Tout reste sur cet ordinateur ; le micro n’est jamais enregistré ni rejoué.',
  'tour.karaoke.point1':
    'Un curseur Voix guide qui va de l’original à l’accompagnement seul, retirant la voix principale sans fichier séparé.',
  'tour.karaoke.point2':
    'Une piste de hauteur en vue Notes ou Courbe : les notes de la chanson en blocs, votre voix en ligne vivante, avec retour Haut, Juste et Bas.',
  'tour.karaoke.point3':
    'Un bilan de performance à la fin, avec les passages à travailler et un décompte pour recommencer.',
  'tour.karaoke.point4':
    'Lit LRC, LRC enrichi avec timing par mot et UltraStar avec syllabes et hauteur, sur MP3, FLAC, WAV, OGG, M4A et plus. Paroles traduites et accords de guitare estimés en prime.',
  'tour.karaoke.how':
    'Ouvrez l’onglet Karaoké, appuyez sur « Ouvrir une chanson » ou « Ajouter un dossier », choisissez une piste dans la playlist, activez le micro, affichez le guide de justesse et appuyez sur Lecture.',
  'tour.karaoke.open': 'Ouvrir le Karaoké',

  'tour.maker.kicker': 'CRÉEZ LE VÔTRE',
  'tour.maker.title': 'Le Créateur de karaoké',
  'tour.maker.subtitle': 'N’importe quelle chanson devient un fichier karaoké',
  'tour.maker.lead':
    'Un vrai studio d’édition dans l’onglet Karaoké. Il peut tout faire seul : séparer la voix de la musique, lire les mots et leur timing avec un modèle de parole local, et détecter les notes de la mélodie. Ou vous tapez, enregistrez et dessinez chaque timing à la main sur une timeline zoomable. Tout tourne sur cet ordinateur.',
  'tour.maker.point1':
    '« Configurer cette chanson automatiquement » : séparer la voix, puis lire les mots et le timing, avec l’option de continuer en arrière-plan.',
  'tour.maker.point2':
    'Gardez les pistes séparées : la voix et l’accompagnement, chacune enregistrable, y compris en MP3.',
  'tour.maker.point3':
    'Des outils manuels pour les détails : taper les mots, enregistrer les entrées de ligne, un inspecteur de mot avec début et durée, et couper un mot en syllabes.',
  'tour.maker.point4':
    'Peignez la mélodie sur une grille de hauteur, marquez les notes dorées, puis exportez en projet FluidEQ, UltraStar TXT, LRC, LRC enrichi ou accompagnement seul.',
  'tour.maker.how':
    'Dans Karaoké, chargez une chanson et appuyez sur « Créer ». Acceptez « Configurer automatiquement » dans l’assistant, corrigez les mots sur la timeline, puis « Utiliser dans le lecteur » et « Exporter ».',
  'tour.maker.open': 'Ouvrir le Karaoké',

  'tour.media.kicker': 'LE WEB, À TRAVERS VOTRE EQ',
  'tour.media.title': 'Médias en ligne',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch et Suno',
  'tour.media.lead':
    'Un lecteur intégré pour les sites de streaming, pour que ce que vous regardez et écoutez en ligne passe par votre EQ plutôt que par un autre navigateur. Cinq sites sont câblés, chacun avec sa recherche, et les liens qui mènent ailleurs sont retenus avec le choix « Ouvrir dans le navigateur ».',
  'tour.media.point1':
    'Un seul champ de recherche qui interroge le site ouvert, avec des recherches récentes que vous pouvez effacer.',
  'tour.media.point2':
    '« Bloquer les pubs » saute les publicités vidéo et masque les emplacements publicitaires sur YouTube.',
  'tour.media.point3':
    'Reprise : le lecteur retient la dernière page et l’endroit où vous en étiez, et vous y ramène.',
  'tour.media.point4':
    'Des téléchargements avec pastille de progression et « Afficher dans le dossier » à la fin, et un bouton « Se déconnecter de tous les sites » qui efface chaque cookie et connexion d’un coup.',
  'tour.media.how':
    'Ouvrez l’onglet Médias en ligne, choisissez un site dans la rangée du haut, tapez dans le champ de recherche et appuyez sur Rechercher. Précédent, Suivant et Recharger fonctionnent comme dans un navigateur.',
  'tour.media.open': 'Ouvrir Médias en ligne',
};

export default tour;
