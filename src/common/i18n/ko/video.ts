/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const video = {
  'video.sites': '비디오 사이트',
  'video.back': '뒤로',
  'video.forward': '앞으로',
  'video.reload': '새로고침',
  'video.stop': '정지',
  'video.searchAria': '현재 사이트 검색',
  'video.searchOn': '{site} 검색',
  'video.searchGo': '검색',
  'video.searchClear': '검색 지우기',
  'video.searchRecent': '최근 검색어',
  'video.searchForget': '"{term}" 지우기',
  'video.searchForgetAll': '최근 검색 지우기',
  'video.adBlock': '광고 차단',
  'video.adBlockHint':
    'YouTube에서 동영상 광고를 건너뛰고 광고 슬롯을 숨깁니다.',
  'video.matchColours': 'FluidEQ의 색상과 일치',
  'video.matchColoursHint':
    '화면에서만 FluidEQ와 일치하도록 이 사이트의 페이지 색상을 지정하세요. 비디오, 사진, 광고 및 로고는 절대 변경되지 않습니다.',
  'video.matchColoursUnavailable':
    '이 사이트는 고유한 색상을 유지합니다. 페이지는 밝고 아티스트는 자신만의 색상을 디자인합니다.',
  'video.signOut': '모든 사이트에서 로그아웃',
  'video.signOutBusy': '로그아웃 중…',
  'video.signOutHint':
    '플레이어가 보유하고 있는 모든 쿠키, 로그인 및 캐시된 페이지를 지웁니다.',
  'video.signOutDone': '로그아웃됨',
  'video.signOutFailed': '로그아웃할 수 없습니다.',
  'video.blockedTitle': '해당 링크는 플레이어 외부로 연결됩니다.',
  'video.openInBrowser': '브라우저에서 열기',
  'video.downloadChoosing': '이 파일을 저장할 위치를 선택하세요',
  'video.downloadSaving': '{file} 저장 중',
  'video.downloadComplete': '컴퓨터에 저장됨',
  'video.downloadFailed': '다운로드를 저장할 수 없습니다.',
  'video.downloadProgress': '다운로드 진행 상황',
  'video.downloadCopyPath': '경로 복사',
  'video.downloadCopied': '경로가 복사되었습니다.',
  'video.downloadShowFolder': '폴더에 표시',
} satisfies Partial<Dictionary>;

export default video;
