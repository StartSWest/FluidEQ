/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/** French. Narrow no-break spaces before the doubled punctuation, as is right. */
const fr: Partial<Dictionary> = {
  'app.tagline': 'Votre son. Sur chaque appareil. Automatiquement.',
  'app.actions': 'Actions FluidEQ',
  'app.actions.title': 'Actions audio',
  'app.status.ready': 'Connecté à Equalizer APO',
  'app.status.checking': 'Vérification d’Equalizer APO…',
  'app.status.error': 'Equalizer APO ne répond pas',
  'app.menu.importEq': 'Importer des réglages d’égalisation…',
  'app.menu.importConvolution': 'Importer une réponse impulsionnelle…',
  'app.menu.restartAudio': 'Redémarrer l’audio de Windows',
  'app.menu.reconfigure': 'Reconfigurer Equalizer APO',
  'app.menu.apoSettings': 'Réglages d’Equalizer APO',
  'app.menu.support': 'Soutenir le projet',
  'whatsNew.eyebrow': 'NOTES DE VERSION',
  'whatsNew.title': 'Nouveautés de FluidEQ',
  'whatsNew.loading': 'Chargement des notes de version…',
  'whatsNew.missing':
    'Les notes de version sont introuvables dans cette build. Elles sont aussi sur GitHub.',
  'app.menu.whatsNew': 'Nouveautés',
  'app.menu.language': 'Langue',
  'app.window.minimize': 'Réduire',
  'app.window.maximize': 'Agrandir',
  'app.window.restore': 'Restaurer',
  'app.window.close': 'Fermer',
  'app.window.minimizeApp': 'Réduire FluidEQ',
  'app.window.maximizeApp': 'Agrandir FluidEQ',
  'app.window.restoreApp': 'Restaurer FluidEQ',
  'app.window.closeApp': 'Fermer FluidEQ',
  'app.dismiss': 'Fermer',

  'tabs.aria': 'Espace de travail sonore',
  'tabs.eq': 'Égaliseur et type de casque',
  'tabs.voicing': 'Caractère',
  'tabs.convolution': 'Convolution',

  'notice.apoReconfigured':
    'Equalizer APO vient d’être installé ou reconfiguré. En cas de silence, relancez le service audio de Windows plutôt que de redémarrer le PC.',
  'notice.restartNow': 'Redémarrer l’audio maintenant',
  'notice.importComplete': 'Importation terminée',
  'notice.restartConfirm':
    'Le son va s’interrompre quelques secondes et Windows demandera une autorisation d’administrateur. Continuer ?',
  'update.title': 'Mise à jour de FluidEQ',
  'update.available':
    'La version {version} est disponible. Téléchargement en cours.',
  'update.downloading': 'Téléchargement de la mise à jour… {percent} %',
  'update.ready':
    'La version {version} est prête. Redémarrez FluidEQ pour terminer.',
  'update.restart': 'Redémarrer maintenant',
  'update.restarting': 'Redémarrage…',
  'notice.restartDone':
    'L’audio de Windows a redémarré. Rouvrez les applications encore muettes.',

  'sidebar.engine': 'MOTEUR',
  'sidebar.systemEq': 'Égaliseur système',
  'sidebar.preamp': 'Préampli',
  'sidebar.preampAria': 'Gain de préamplification (dB)',
  'sidebar.preampAuto':
    'Réglé pour vous. Désactivez la normalisation auto pour y toucher.',
  'sidebar.headroom': 'MARGE APO',
  'sidebar.autoPreamp': 'Normalisation auto',
  'sidebar.visualizer': 'VISUALISEUR',
  'sidebar.graphView': 'Courbe de réponse',

  'output.eyebrow': 'SUIT VOTRE SORTIE',
  'output.title': 'Profil automatique',
  'output.device': 'Périphérique de sortie',
  'output.active': 'ACTIF',
  'output.none': 'Aucune sortie active trouvée',
  'output.mapping': 'Association automatique',
  'output.mapping.neutral': 'Sortie neutre',
  'output.mapping.live': 'Réglage en direct associé',
  'output.mapping.hint':
    'Touchez n’importe quel réglage de l’égaliseur pour l’enregistrer et l’associer automatiquement à cette sortie.',
  'output.hint':
    'FluidEQ retient l’identifiant stable du périphérique : ce son le suit chaque fois que Windows le sélectionne.',

  'driver.eyebrow': 'CE AVEC QUOI VOUS ÉCOUTEZ',
  'driver.title': 'Type de transducteur',
  'driver.none': 'Sans compensation',
  'driver.none.hint': 'Vos bandes et le caractère seulement',
  'driver.strength': 'Intensité',
  'driver.range': '±1,5 dB',

  'profiles.eyebrow': 'VOTRE SON',
  'profiles.title': 'Profils enregistrés',
  'profiles.name': 'Nom du profil',
  'profiles.nameAria': 'Nom du profil',
  'profiles.new': 'Nouveau profil',
  'profiles.newAria': 'Créer un profil à partir de l’égalisation actuelle',
  'profiles.untitled': 'Profil sans titre',
  'profiles.save': 'Enregistrer comme nouveau',
  'profiles.update': 'Mettre à jour',
  'profiles.saveAria': 'Enregistrer les réglages dans le profil',
  'profiles.restore': 'Restaurer',
  'profiles.restoring': 'Restauration…',
  'profiles.restoreAria':
    'Restaurer la dernière version enregistrée à la main pour ce profil',
  'profiles.attached': 'ACT',
  'profiles.attachedTitle': 'En cours sur cette sortie',
  'profiles.detecting': 'Détection de votre sortie…',
  'profiles.empty': 'Aucun profil pour l’instant. Créez votre premier son.',
  'profiles.error.empty': 'Le nom du profil ne peut pas être vide.',
  'profiles.error.restricted': 'Nom invalide, choisissez-en un autre.',
  'profiles.error.duplicate': 'Ce nom existe déjà, choisissez-en un autre.',
  'profiles.edit': 'Modifier le nom du profil',

  'autoeq.eyebrow': 'PARTIR D’UNE RÉFÉRENCE',
  'autoeq.title': 'Bibliothèque AutoEQ',
  'autoeq.selectSource': 'Choisissez une source',
  'autoeq.applied': 'Appliqué : {name}',
  'autoeq.notApplied': 'Aucune référence appliquée',
  'autoeq.source': 'Source de mesure',
  'autoeq.model': 'Modèle de casque',
  'autoeq.target': 'Mesure / cible',
  'autoeq.apply': 'Appliquer l’égalisation du modèle',
  'autoeq.applying': 'Application…',
  'autoeq.applyAria': 'Appliquer l’égalisation du modèle sélectionné',
  'autoeq.checking': 'Vérification de la base officielle…',
  'autoeq.updateAvailable': 'Mise à jour disponible ({count} modèles)',
  'autoeq.upToDate': 'Base officielle à jour — {count} modèles',
  'autoeq.updateUnknown': 'Vérification impossible',
  'autoeq.update': 'Mettre à jour la base',
  'autoeq.updating': 'Mise à jour…',
  'autoeq.updateAria': 'Mettre à jour la base AutoEq',
  'autoeq.allDatabases': 'Toutes les bases',
  'autoeq.allDatabases.hint':
    'Cherche dans AutoEq officiel et GadgetryTech à la fois.',
  'autoeq.pickDevice': 'Choisissez d’abord un modèle 🎧',
  'autoeq.noResponses': 'Aucune mesure compatible 😞',
  'autoeq.pickResponse': 'Choisissez une mesure ! 🔊',
  'autoeq.selectSourcePlaceholder': 'Choisissez une source…',
  'autoeq.searchSources': 'Rechercher une source…',
  'autoeq.noModel': 'Aucun modèle mesuré ne correspond à votre recherche.',
  'autoeq.searchModels': 'Rechercher par marque ou modèle…',
  'voicing.quickAria': 'Caractère : {name}',
  'voicing.quickNone': 'Caractère : aucun',
  'voicing.quickTitle': 'Aucun caractère appliqué',
  'voicing.quickLabel': 'Caractère',
  'voicing.quickNoneHint': 'Vos bandes d’égalisation seules',

  'eq.eyebrow': 'RÉGLAGE FIN',
  'eq.title': 'Égaliseur paramétrique',
  'eq.smart': 'Égalisation auto',
  'eq.smart.cancel': 'Annuler',
  'eq.smart.aria': 'Égalisation automatique à partir de la sortie en direct',
  'eq.smart.cancelAria': 'Annuler la mesure d’égalisation automatique',
  'eq.smart.fromFlat': 'Depuis plat',
  'eq.layers': 'Également appliqué',
  'eq.layers.aria': 'Autres traitements appliqués à cette sortie',
  'eq.layers.convolution': 'Convolution',
  'eq.layers.voicing': 'Caractère',
  'eq.layers.driver': 'Transducteur',
  'eq.layers.headset': 'Casque',
  'eq.layers.smart': 'Égalisation auto',
  'eq.layers.smart.fullRange': 'Mesuré · toute la bande',
  'eq.layers.smart.range': 'Mesuré · de {low} à {high}',
  'eq.layers.remove': 'Retirer la couche {layer}',
  'eq.layers.clearReference':
    'Effacer le modèle de référence et les bandes qu’il a produites',
  'eq.layers.clearSmart':
    'Retirer la correction mesurée. Vos bandes et la référence restent en place.',
  'eq.fromFlat': 'Depuis plat',
  'eq.fromFlat.hint':
    'Écarte la correction automatique précédente avant d’écouter. À utiliser quand une atténuation existante masque justement la zone qu’elle touche : la mesure ne voit pas à travers sa propre correction. Vos bandes ne sont jamais touchées.',
  'eq.clear': 'Vider l’égaliseur',
  'eq.addBand': 'Ajouter une bande',
  'eq.addBandAria': 'Ajouter une bande d’égalisation',
  'eq.quickLayouts': 'Dispositions rapides',
  'eq.bandCount': '{count} bandes',
  'eq.selected': 'Bande sélectionnée',
  'eq.filter': 'Filtre',
  'eq.frequency': 'Fréquence',
  'eq.gain': 'Gain',
  'eq.gainDisabled': 'Gain · s.o.',
  'eq.quality': 'Facteur Q',
  'eq.delete': 'Supprimer la bande',
  'eq.deleteAria': 'Supprimer la bande d’égalisation sélectionnée',

  'convolution.eyebrow': 'RÉPONSES IMPULSIONNELLES APO',
  'convolution.title': 'Bibliothèque de convolution',
  'convolution.intro':
    'Téléchargez une réponse impulsionnelle à phase minimale vérifiée pour votre casque et appliquez-la avant l’égaliseur paramétrique. La courbe ci-dessous affiche les deux.',
  'convolution.import': 'Importer un WAV…',
  'convolution.importing': 'Importation…',
  'convolution.applied': 'Appliqué à cette sortie',
  'convolution.clear': 'Retirer',
  'convolution.search': 'Rechercher un modèle de casque',
  'convolution.searchPlaceholder':
    'Essayez « Kraken », « HD 650 » ou le nom d’un laboratoire',
  'convolution.notice':
    'Le catalogue téléchargeable est fourni par AutoEq. Les fichiers sont importés en WAV 48 kHz : Equalizer APO exige que la réponse impulsionnelle corresponde à la fréquence d’échantillonnage de la sortie active.',
  'convolution.loading': 'Chargement du catalogue officiel…',
  'convolution.empty':
    'Aucune réponse impulsionnelle ne correspond. Essayez un nom plus court.',
  'convolution.source': 'Source',
  'convolution.apply': 'Télécharger et appliquer',
  'convolution.downloading': 'Téléchargement…',
  'convolution.isApplied': 'Appliqué',
  'convolution.none':
    'Aucune convolution chargée. L’onglet égaliseur reste entièrement indépendant.',

  'voicing.eyebrow': 'COURBES CIBLES',
  'voicing.title': 'Caractère',
  'voicing.intro':
    'Une cible réglée pour ce que vous êtes en train de faire. Chacune s’écrit comme sa propre couche après vos bandes, votre réglage n’est donc jamais touché et revenir à Aucun le restitue exactement.',
  'voicing.none': 'Aucun',
  'voicing.none.hint': 'Vos bandes d’égalisation seules, rien par-dessus',
  'voicing.strength': 'Intensité',
  'voicing.off': 'Rien',
  'voicing.full': 'Max',
  'voicing.inert': 'À 0 % d’intensité, ce caractère ne fait rien.',
  'voicing.headroom':
    'Ajoute jusqu’à +{peak} dB. La normalisation auto réserve la marge ; laissez-la active sauf si vous réglez le préampli à la main.',

  'support.eyebrow': 'ENTIÈREMENT FACULTATIF',

  'support.petHint': 'Appuyez sur espace pour le faire sauter',

  'support.game.hint': 'Appuyez en rythme quand le pic atteint la ligne',

  'support.game.howTo':
    'Touchez la créature ou appuyez sur espace à chaque temps. Continuez et quelque chose arrive à ×10.',

  'support.game.thanks':
    'Si tout cela vous a fait sourire, vos idées et votre soutien sont ce qui fait avancer le projet.',

  'support.game.noAudio': 'Lancez un morceau et le rythme apparaîtra ici',

  'support.game.listening': 'Recherche du rythme…',

  'support.game.best': 'Record',

  'support.game.perfect': 'Parfait',

  'support.game.great': 'Excellent',

  'support.game.good': 'Bien',

  'support.game.miss': 'Raté',
  'support.title': 'Soutenir le projet',
  'support.close': 'Fermer',
  'support.pitch':
    'FluidEQ est libre et open source, et le restera : rien ici n’est derrière un paywall et rien n’est jamais pisté. S’il a gagné sa place dans votre installation, une contribution finance le temps qui le maintient et les prochaines idées sorties du même atelier.',
  'support.craft':
    'C’est le travail d’une seule personne, fait avec beaucoup d’amour et un souci du détail déraisonnable. Chaque panneau a été dessiné à la main et discuté : comment la courbe se lit d’un coup d’œil, la façon dont un menu se déplie, ce que fait un bouton rotatif quand on le tourne lentement, quels mots vont sur un bouton. Rien ici n’est un composant tout fait avec un thème par-dessus.',
  'support.card': 'Carte ou portefeuille',
  'support.card.hint':
    'Paiement sécurisé hébergé par Stripe. S’ouvre dans votre navigateur : l’application ne voit jamais vos données bancaires.',
  'support.coffee': 'Offrez-moi un café',
  'support.coffee.hint':
    'Un pourboire ponctuel, sans compte. Cliquez pour l’ouvrir dans le navigateur, ou scannez le code avec votre téléphone.',
  'support.verify': 'Vérifiez l’adresse avant d’envoyer.',
  'support.copy': 'Copier l’adresse',
  'support.copied': 'Copiée',
  'support.openWallet': 'Ouvrir dans le portefeuille',
  'support.contributed': 'J’ai contribué — débloquer l’étoile et la danse',
  'support.thanks':
    'Merci — votre compagnon a son étoile, et il danse maintenant.',
  'support.releaseNotes': 'Voir les nouveautés de cette version',
  'support.footerBefore':
    'Vous préférez donner du temps ? Les tickets et les pull requests sont tout aussi bienvenus sur',

  'language.title': 'Langue',
  'language.aria': 'Langue de l’interface',
};

export default fr;
