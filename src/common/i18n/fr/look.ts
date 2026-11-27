/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Look Designer, the support panel, the creature and its game. */
import { Dictionary } from '../en';

const look: Partial<Dictionary> = {
  'look.textureStyle': 'Texture',
  'look.texture.none': 'Uni',
  'look.texture.hatch': 'Hachures',
  'look.texture.crosshatch': 'Hachures croisées',
  'look.texture.rules': 'Lignes',
  'look.texture.pinstripe': 'Rayures fines',
  'look.texture.dots': 'Points',
  'look.texture.grid': 'Grille',
  'look.texture.weave': 'Tissage',
  'look.texture.scales': 'Écailles',
  'look.texture.chevron': 'Chevrons',
  'look.texture.static': 'Grain',
  'look.texture.image': 'Image',
  'look.texture.replace': 'Changer l’image',
  'look.texture.fit': 'Ajustement',
  'look.texture.fit.cover': 'Image entière',
  'look.texture.fit.tile': 'En mosaïque',
  'look.texture.tileSize': 'Taille des tuiles',
  'look.texture.tooBig':
    'Cette image est trop lourde pour être conservée. Essayez-en une plus petite.',
  'look.texture.unreadable': 'Ce fichier n’a pas pu être lu comme une image.',
  'look.channels': 'Canaux',
  'look.channels.joined': 'Joints',
  'look.channels.split': 'Gauche & droite',
  'look.edit': 'Modifier le style',
  'look.create': 'Créer un style',
  'look.new': 'Nouveau style',
  'look.close': 'Fermer l’éditeur de style',
  'look.closeHint': 'Fermer sans enregistrer (Échap)',
  'look.pickForm':
    'Choisissez la forme avec le sélecteur ci-dessus ou appuyez sur Espace.',
  'look.colourBy': 'Colorer par',
  'look.palette.cycle': 'Coloration',
  'look.palette.needsSecond':
    'Choisissez une deuxième couleur sous Teinte dans le menu pour colorer le look par fréquence, niveau ou chaleur',
  'look.palette.flat': 'Uniforme',
  'look.palette.flatHint': 'Une couleur pour toute la forme',
  'look.palette.frequency': 'Fréquence',
  'look.palette.frequencyHint':
    'La couleur parcourt l’axe et indique la position de chaque barre.',
  'look.palette.level': 'Niveau',
  'look.palette.levelHint':
    'La couleur monte sur l’axe et indique l’intensité de chaque barre.',
  'look.palette.heat': 'Chaleur',
  'look.palette.heatHint':
    'La couleur suit le volume, de la première couleur à la dernière.',
  'look.palette.auto': 'Auto',
  'look.palette.autoHint':
    'Chaque forme dans sa propre couleur : une route éclairée par le volume, des barres par leur position.',
  'look.colours': 'Couleurs',
  'look.coloursFollowWindow':
    "Suit les couleurs de la fenêtre. Changez-en une pour qu'elles appartiennent à ce style.",
  'look.colourValue': 'Couleur {number} : {colour}',
  'look.removeColour': 'Supprimer la couleur {number}',
  'look.custom': 'Personnalisée',
  'look.customColour': 'Toute autre couleur',
  'look.gradients': 'Dégradés',
  'look.windowColours': 'Couleurs de la fenêtre',
  'look.gradientHint':
    'Cliquez sur la barre pour ajouter une couleur. Faites-en glisser une pour la déplacer.',
  'look.gradientFull': "Un dégradé contient jusqu'à {count} couleurs.",
  'look.axis.bass': 'Graves',
  'look.axis.treble': 'Aigus',
  'look.axis.quiet': 'Doux',
  'look.axis.loud': 'Fort',
  'look.pieces': 'Éléments',
  'look.gap': 'Écart',
  'look.continuous': 'Cette forme est dessinée d’un seul tenant',
  'look.attack': 'Attaque',
  'look.release': 'Relâchement',
  'look.releaseHint': 'Durée pendant laquelle un pic reste avant de retomber',
  'look.drawnAs': 'Dessin',
  'look.filled': 'Rempli',
  'look.stroked': 'Contour',
  'look.fill': 'Remplissage',
  'look.weight': 'Épaisseur',
  'look.glow': 'Lueur',
  'look.off': 'Désactivée',
  'look.glowHint': 'Intensité du gonflement et de la lueur sur le rythme.',
  'look.glowNotForForm': "Cette forme n'a pas de halo.",
  'look.rainbowBorder': 'Bordure colorée',
  'look.rainbowBorderHint':
    'Entoure le graphique d’une couleur qui parcourt les couleurs de la fenêtre.',
  'look.borderWeight': 'Épaisseur de bordure',
  'look.litPeaks': 'Pics lumineux',
  'look.name': 'Nom',
  'look.resetAll': 'Réinitialiser tous les réglages',
  'look.resetAllHint': 'Rétablir les réglages d’origine de cette forme',
  'look.export': 'Exporter ce style dans un fichier',
  'look.exportHint': 'Enregistrer ce style dans un fichier à partager',
  'look.import': 'Importer un style depuis un fichier',
  'look.delete': 'Supprimer ce style',
  'look.save': 'Enregistrer',
  'look.saveHint': 'Enregistrer et sélectionner ce style',
  'look.full':
    'La liste est pleine — supprimez un style pour libérer une place',
  'look.error.emptyFile': 'Aucun style n’a été trouvé dans ce fichier.',
  'look.error.readFile': 'FluidEQ n’a pas pu lire ce fichier de style.',
  'look.meter.bar': 'Barre',
  'look.meter.segments': 'Segments',
  'look.meter.leds': 'LED',
  'look.meter.fluid': 'Fluide',
  'look.meter.mercury': 'Mercure',
  'look.meter.needle': 'Aiguille',
  'look.meter.pulse': 'Pulsation',
  'look.meter.stack': 'Pile',
  'look.meter.flow': 'Flux',
  'look.meter.center': 'Centre',
  'look.meter.off': 'Désactivé',
  'support.eyebrow': 'ENTIÈREMENT FACULTATIF',
  'support.petHint': 'Appuyez sur espace pour le faire sauter',
  'support.game.hint': 'Appuyez en rythme quand le pic atteint la ligne',
  'support.game.howTo':
    'Lancez de la musique, puis touchez la mascotte ou appuyez sur Espace quand un pic atteint la ligne centrale.',
  'support.game.thanks':
    'Si tout cela vous a fait sourire, vos idées et votre soutien sont ce qui fait avancer le projet.',
  'support.game.noAudio': 'Lancez un morceau et le rythme apparaîtra ici',
  'support.game.listening': 'Recherche du rythme…',
  'support.game.share': 'Partager',
  'support.game.shareEuphoria': 'Partager le score',
  'support.game.shareTitle': 'Partagez votre score',
  'support.game.shareNote':
    "Enregistrez la carte puis joignez-la à votre publication : aucun de ces réseaux ne peut extraire une image d'un lien.",
  'support.game.shareSave': 'Enregistrer la carte',
  'support.game.shareCopyCard': 'Copier la carte',
  'support.game.cardScore': 'Score du jeu de rythme',
  'support.game.cardStreak': 'série',
  'support.game.cardTagline': 'Égaliseur gratuit pour Windows, macOS et Linux',
  'support.game.postX':
    '{name} est un égaliseur pour tout le système, gratuit et open source, pour Windows, macOS et Linux. Réglez une sortie une fois et toutes ses applis suivent. {run}',
  'support.game.postLinkedIn':
    '{name} est un égaliseur pour tout le système, gratuit et open source, pour Windows, macOS et Linux. Chaque réglage appartient à la sortie où il a été fait, donc le bon réglage suit le bon appareil sans rien changer à la main : une mesure publiée de votre casque exact, des courbes de son choisies et un Auto EQ qui retient le son que vous avez donné à chaque morceau, le tout dessiné sur la réponse en direct. {run}',
  'support.game.postFacebook':
    'Si votre casque sonne mal dans la moitié de vos applis, ceci règle le problème une fois pour toutes. {name} est un égaliseur pour tout le système, gratuit et open source, pour Windows, macOS et Linux. Réglez chaque sortie une fois, avec une correction pour votre modèle exact de casque, des courbes de son et un Auto EQ qui retient le son de chaque morceau, et il suit cet appareil tout seul. {run}',
  'support.game.postCopy':
    '{name} est un égaliseur pour tout le système, gratuit et open source, pour Windows, macOS et Linux. Réglez chaque sortie une fois, avec la correction du casque, des courbes de son et un Auto EQ qui retient le son de chaque morceau, et le bon réglage suit le bon appareil tout seul. {run}',
  'support.game.postRun':
    'Il cache aussi un jeu de rythme, où je viens de faire {points} points à ×{peak}.',
  'support.game.postRunColour':
    'Il cache aussi un jeu de rythme : j’ai poussé la série à ×{top} pour {points} points et toute l’interface s’est illuminée en couleur.',
  'support.game.postRunShort':
    'Il cache un jeu de rythme : {points} points à ×{peak}.',
  'support.game.postRunShortColour':
    'Il cache un jeu de rythme : ×{top}, {points} points, et l’interface s’illumine en couleur.',
  'support.game.shareCardCopied': 'Copiée — collez-la',
  'support.game.shareCopy': 'Copier le texte',
  'support.game.shareCopied': 'Copié',
  'support.game.shareLinkOnly':
    'Partage seulement le lien : collez le texte vous-même',
  'support.game.perfect': 'Parfait',
  'support.game.great': 'Excellent',
  'support.game.good': 'Bien',
  'support.game.miss': 'Raté',
  'support.title': 'Soutenir le projet',
  'support.close': 'Fermer',
  'support.pitch':
    'FluidEQ est libre et open source, et le restera : le code est public, vous pouvez toujours le compiler vous-même gratuitement, et rien n’est jamais pisté. Chaque version est signée, prête à l’emploi et gratuite pour tous : rien de FluidEQ lui-même n’est vendu. S’il a gagné sa place dans votre installation, une contribution finance le temps qui le maintient et les prochaines idées sorties du même atelier.',
  'support.craft':
    'C’est le travail d’une seule personne, fait avec beaucoup d’amour et un souci du détail déraisonnable. Chaque panneau a été dessiné à la main et discuté : comment la courbe se lit d’un coup d’œil, la façon dont un menu se déplie, ce que fait un bouton rotatif quand on le tourne lentement, quels mots vont sur un bouton. Rien ici n’est un composant tout fait avec un thème par-dessus.',
  'support.card': 'Carte ou portefeuille',
  'support.card.hint':
    'Paiement sécurisé hébergé par Stripe. S’ouvre dans votre navigateur : l’application ne voit jamais vos données bancaires.',
  'support.coffee': 'Offrez-moi un café',
  'support.github': 'Sponsoriser sur GitHub',
  'support.coffee.hint':
    'Un pourboire ponctuel, sans compte. Cliquez pour l’ouvrir dans le navigateur, ou scannez le code avec votre téléphone.',
  'support.verify': 'Vérifiez l’adresse avant d’envoyer.',
  'support.copy': 'Copier l’adresse',
  'support.copied': 'Copiée',
  'support.openWallet': 'Ouvrir dans le portefeuille',
  'support.contributed': 'J’ai contribué',
  'support.thanks': 'Merci — votre mascotte a son étoile et sa danse.',
  'support.footerBefore':
    'Vous préférez donner du temps ? Les tickets et les pull requests sont tout aussi bienvenus sur',
  'support.pet.title': 'Soutenir le travail',
  'support.pet.thanks': 'Merci de soutenir FluidEQ',
  'support.qr.coffee': 'Code QR de la page Buy me a coffee',
  'support.qr.address': 'Code QR de l’adresse {asset}',
};

export default look;
