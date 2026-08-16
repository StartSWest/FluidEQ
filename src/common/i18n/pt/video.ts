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
  'video.sites': 'Sites de vídeo',
  'video.back': 'Voltar',
  'video.forward': 'Avançar',
  'video.reload': 'Recarregar',
  'video.stop': 'Parar',
  'video.searchAria': 'Buscar no site atual',
  'video.searchOn': 'Pesquisar no {site}',
  'video.searchGo': 'Pesquisar',
  'video.searchClear': 'Limpar a pesquisa',
  'video.searchRecent': 'Pesquisas recentes',
  'video.searchForget': 'Esquecer “{term}”',
  'video.searchForgetAll': 'Limpar as pesquisas recentes',
  'video.adBlock': 'Bloquear anúncios',
  'video.adBlockHint':
    'Pula os anúncios em vídeo e esconde os espaços de anúncio no YouTube.',
  'video.signOut': 'Sair de todos os sites',
  'video.signOutBusy': 'Saindo…',
  'video.signOutHint':
    'Apaga todos os cookies, logins e páginas em cache que o player guarda.',
  'video.signOutDone': 'Sessões encerradas',
  'video.signOutFailed': 'Não foi possível sair',
  'video.blockedTitle': 'Esse link leva para fora do player',
  'video.openInBrowser': 'Abrir no navegador',
  'video.downloadChoosing': 'Escolha onde salvar este arquivo',
  'video.downloadSaving': 'Salvando {file}',
  'video.downloadComplete': 'Salvo no computador',
  'video.downloadFailed': 'Não foi possível salvar o download',
  'video.downloadProgress': 'Progresso do download',
  'video.downloadCopyPath': 'Copiar caminho',
  'video.downloadCopied': 'Caminho copiado',
  'video.downloadShowFolder': 'Mostrar na pasta',
  'video.resize': 'Arraste para redimensionar o player',
};

export default video;
