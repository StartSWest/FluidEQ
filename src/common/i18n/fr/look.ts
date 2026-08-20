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
  'look.edit': 'Modifier le style',
  'look.create': 'Créer un style',
  'look.new': 'Nouveau style',
  'look.close': 'Fermer l’éditeur de style',
  'look.closeHint': 'Fermer sans enregistrer (Échap)',
  'look.pickForm':
    'Choisissez la forme avec le sélecteur ci-dessus ou appuyez sur Espace.',
  'look.colourBy': 'Colorer par',
  'look.palette.cycle': 'Coloration',
  'look.palette.flat': 'Uniforme',
  'look.palette.flatHint': 'Une couleur pour toute la forme',
  'look.palette.frequency': 'Fréquence',
  'look.palette.frequencyHint':
    'La couleur parcourt l’axe et indique la position de chaque barre.',
  'look.palette.level': 'Niveau',
  'look.palette.levelHint':
    'La couleur monte sur l’axe et indique l’intensité de chaque barre.',
  'look.palette.heat': 'Chaleur',
  'look.palette.heatHint': 'La couleur suit le volume, du froid au rouge.',
  'look.colours': 'Couleurs',
  'look.colourValue': 'Couleur {number} : {colour}',
  'look.removeColour': 'Supprimer la couleur {number}',
  'look.custom': 'Personnalisée',
  'look.customColour': 'Toute autre couleur',
  'look.reset': 'Réinitialiser',
  'look.addColour': 'Ajouter une couleur',
  'look.addColourHint': 'Ajouter une couleur à la fin du dégradé',
  'look.pieces': 'Éléments',
  'look.continuous': 'Cette forme est dessinée d’un seul tenant',
  'look.attack': 'Attaque',
  'look.release': 'Relâchement',
  'look.releaseHint': 'Durée pendant laquelle un pic reste avant de retomber',
  'look.drawnAs': 'Dessin',
  'look.filled': 'Rempli',
  'look.stroked': 'Contour',
  'look.fill': 'Remplissage',
  'look.weight': 'Épaisseur',
  'look.rainbow': 'Arc-en-ciel',
  'look.glow': 'Lueur',
  'look.off': 'Désactivée',
  'look.glowHint': 'Intensité du gonflement et de la lueur sur le rythme.',
  'look.glowNeedsRainbow':
    'Nécessite le mode Arc-en-ciel. Sans lui, la lueur ne change pas le dessin.',
  'look.needsRainbow': 'Nécessite le mode Arc-en-ciel.',
  'look.rainbowBorder': 'Bordure arc-en-ciel',
  'look.rainbowBorderHint':
    'Entoure le graphique d’une couleur qui parcourt tout le spectre.',
  'look.borderWeight': 'Épaisseur de bordure',
  'look.litPeaks': 'Pics lumineux',
  'look.litPeakWeight': 'Épaisseur du pic',
  'look.noLitPeaks': 'Cette forme n’a pas de pointes lumineuses',
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
  'support.eyebrow': 'ENTIÈREMENT FACULTATIF',
  'support.petHint': 'Appuyez sur espace pour le faire sauter',
  'support.game.hint': 'Appuyez en rythme quand le pic atteint la ligne',
  'support.game.howTo':
    'Touchez la créature ou appuyez sur espace à chaque temps. Continuez et quelque chose arrive à ×10.',
  'support.game.thanks':
    'Si tout cela vous a fait sourire, vos idées et votre soutien sont ce qui fait avancer le projet.',
  'support.game.noAudio': 'Lancez un morceau et le rythme apparaîtra ici',
  'support.game.listening': 'Recherche du rythme…',
  'support.game.share': 'Partager',
  'support.game.shareEuphoria': "Partager l'arc-en-ciel",
  'support.game.shareTitle': 'Partagez votre score',
  'support.game.shareUnlock':
    'Atteignez ×10 et cette carte passe en mode arc-en-ciel, spectre compris.',
  'support.game.shareNote':
    "Enregistrez la carte puis joignez-la à votre publication : aucun de ces réseaux ne peut extraire une image d'un lien.",
  'support.game.shareSave': 'Enregistrer la carte',
  'support.game.shareCopyCard': 'Copier la carte',
  'support.game.shareCardCopied': 'Copiée — collez-la',
  'support.game.shareCopy': 'Copier le texte',
  'support.game.shareCopied': 'Copié',
  'support.game.shareLinkOnly':
    'Partage seulement le lien : collez le texte vous-même',
  'support.game.euphoria': 'Mode arc-en-ciel',
  'support.game.euphoriaToggle': 'Activer ou désactiver le mode arc-en-ciel',
  'support.game.perfect': 'Parfait',
  'support.game.great': 'Excellent',
  'support.game.good': 'Bien',
  'support.game.miss': 'Raté',
  'support.title': 'Soutenir le projet',
  'support.close': 'Fermer',
  'support.pitch':
    'FluidEQ est libre et open source, et le restera : le code est public, vous pouvez toujours le compiler vous-même gratuitement, et rien n’est jamais pisté. Ce qui est vendu, c’est la version signée, prête à l’emploi. S’il a gagné sa place dans votre installation, une contribution finance le temps qui le maintient et les prochaines idées sorties du même atelier.',
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
};

export default look;
