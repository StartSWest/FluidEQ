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

/** The Remote Media tab. */
import { Dictionary } from '../en';

const video: Partial<Dictionary> = {
  'video.sites': 'Sites vidéo',
  'video.back': 'Précédent',
  'video.forward': 'Suivant',
  'video.reload': 'Actualiser',
  'video.stop': 'Arrêter',
  'video.searchAria': 'Rechercher sur le site actuel',
  'video.searchOn': 'Rechercher sur {site}',
  'video.searchGo': 'Rechercher',
  'video.searchClear': 'Effacer la recherche',
  'video.searchRecent': 'Recherches récentes',
  'video.searchForget': 'Oublier « {term} »',
  'video.searchForgetAll': 'Effacer les recherches récentes',
  'video.adBlock': 'Bloquer les pubs',
  'video.adBlockHint':
    'Passe les pubs vidéo et masque les encarts publicitaires sur YouTube.',
  'video.signOut': 'Se déconnecter de tous les sites',
  'video.signOutBusy': 'Déconnexion…',
  'video.signOutHint':
    'Efface tous les cookies, connexions et pages en cache conservés par le lecteur.',
  'video.signOutDone': 'Déconnexion effectuée',
  'video.signOutFailed': 'Impossible de se déconnecter',
  'video.blockedTitle': 'Ce lien mène hors du lecteur',
  'video.openInBrowser': 'Ouvrir dans le navigateur',
  'video.downloadChoosing': 'Choisissez où enregistrer ce fichier',
  'video.downloadSaving': 'Enregistrement de {file}',
  'video.downloadComplete': 'Enregistré sur votre ordinateur',
  'video.downloadFailed': 'Le téléchargement n’a pas pu être enregistré',
  'video.downloadProgress': 'Progression du téléchargement',
  'video.downloadCopyPath': 'Copier le chemin',
  'video.downloadCopied': 'Chemin copié',
  'video.downloadShowFolder': 'Afficher dans le dossier',
  'video.resize': 'Faites glisser pour redimensionner le lecteur',
};

export default video;
