/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const karaoke = {
  'karaoke.eyebrow': '내 파일로 즐기는 노래방',
  'karaoke.title': '내 음악으로 꾸미는 무대',
  'karaoke.intro':
    '노래, 시간에 맞춘 가사, 마이크 모니터링, 음정 피드백을 한곳에서 사용할 수 있습니다. 모든 작업은 이 PC에서 이루어집니다.',
  'karaoke.fullscreen.enter': '전체 화면으로 전환',
  'karaoke.fullscreen.exit': '전체 화면 종료',
  'karaoke.fullscreen.hideHeader': 'FluidEQ 헤더 숨기기',
  'karaoke.fullscreen.showHeader': 'FluidEQ 헤더 표시',
  'karaoke.actions': '노래방 작업',
  'karaoke.empty.title': '무대가 준비되었습니다',
  'karaoke.empty.body':
    '오디오 파일을 열거나 폴더 전체를 추가하세요. 가사 파일도 함께 넣을 수 있습니다. FluidEQ가 이름이 같은 파일을 연결하여 재생목록을 만듭니다.',
  'karaoke.import.open': '노래 열기',
  'karaoke.import.addFiles': '파일 추가',
  'karaoke.import.folder': '폴더 추가',
  'karaoke.import.clear': '지우기',
  'karaoke.import.loading': '노래 준비 중…',
  'karaoke.import.formats':
    '오디오: MP3, WAV, OGG, Opus, FLAC, M4A 또는 AAC · 가사: LRC, eLRC 또는 UltraStar TXT · 표지 아트 및 비디오도 추가',
  'karaoke.import.drop': '여기에 노래, 가사 또는 폴더를 드롭하세요.',
  'karaoke.error.missingAudio':
    '해당 가사 파일과 함께 오디오 파일을 추가하세요.',
  'karaoke.error.ambiguous':
    '두 곡 이상의 노래 페어링이 가능합니다. 하나의 오디오 파일을 선택하고 선택적으로 하나의 가사 파일을 선택합니다.',
  'karaoke.error.unsupported':
    '해당 파일 중 아직 지원되는 노래방 오디오 또는 가사 파일은 없습니다. 커버 아트와 영상 옆에는 노래가 필요합니다.',
  'karaoke.error.read': 'FluidEQ가 선택한 로컬 파일을 읽을 수 없습니다.',
  'karaoke.error.playback':
    '이 Chromium 빌드에서는 해당 오디오 파일이나 코덱을 재생할 수 없습니다.',
  'karaoke.warning.lyrics': '구문 분석할 수 없습니다.',
  'karaoke.warning.lyricsEmpty': '비어 있습니다.',
  'karaoke.warning.lyricsMissingTiming':
    'FluidEQ가 읽을 수 있는 타이밍이 없습니다.',
  'karaoke.warning.lyricsMissingBpm':
    'UltraStar 파일에 필요한 BPM을 선언하지 않습니다.',
  'karaoke.warning.lyricsInvalidBpm': '사용할 수 없는 BPM을 선언합니다.',
  'karaoke.warning.lyricsMalformedNote':
    'FluidEQ가 읽을 수 없는 메모 행이 있습니다.',
  'karaoke.warning.lyricsUnsupportedVariant':
    '노래방 변형을 사용합니다. FluidEQ는 듀엣과 같이 아직 노래를 부를 수 없습니다.',
  'karaoke.warning.lyricsAtLine': '라인 {line}.',
  'karaoke.warning.lyricsAudioIntact':
    '시간이 지정된 가사 없이도 오디오를 계속 사용할 수 있습니다.',
  'karaoke.warning.setAside':
    'FluidEQ에는 아직 이 파일에 대한 노래방 리더가 없으므로 따로 보관되었습니다: {formats}.',
  'karaoke.warning.unpairedLyrics':
    '이 가사 파일과 일치하는 오디오 파일이 없으므로 사용되지 않았습니다: {files}.',
  'karaoke.warning.ambiguousLyrics':
    '두 개의 가사 파일이 동일한 노래와 일치하므로 둘 다 사용되지 않았습니다: {files}.',
  'karaoke.warning.andMore': '그리고 {count} 더보기',
  'karaoke.countdown.sing': '노래하다',
  'karaoke.song.unknownArtist': '지역 노래',
  'karaoke.stage.videoUnsupported':
    '{format} 비디오는 여기에서 재생할 수 없습니다',
  'karaoke.stage.videoFailed': '{format} 비디오는 여기서 디코딩할 수 없습니다.',
  'karaoke.stage.hideArt': '표지 아트 숨기기',
  'karaoke.stage.showGraph': '현재 비주얼라이저를 배경으로 사용',
  'karaoke.stage.hideGraph': '비주얼라이저 배경 끄기',
  'karaoke.stage.showArt': '표지 아트 표시',
  'karaoke.stage.noArt': '이 노래에는 커버 아트가 없습니다.',
  'karaoke.playlist.title': '재생목록',
  'karaoke.playlist.groupFolders': '폴더별로 그룹화',
  'karaoke.playlist.looseFiles': '느슨한 파일',
  'karaoke.playlist.resize': '재생목록 및 스테이지 크기 조정',
  'karaoke.playlist.collapse': '재생목록 접기',
  'karaoke.playlist.expand': '재생목록 펼치기',
  'karaoke.playlist.select': '{title} 선택',
  'karaoke.playlist.moveUp': '{title}를 위로 이동',
  'karaoke.playlist.moveDown': '{title}를 아래로 이동',
  'karaoke.playlist.remove': '{title} 제거',
  'karaoke.source.audioOnly': '오디오만',
  'karaoke.source.lrc': 'LRC · 회선 타이밍',
  'karaoke.source.elrc': 'eLRC · 단어 타이밍',
  'karaoke.source.ultrastar': 'UltraStar · 음절 + 음높이',
  'karaoke.lyrics.none':
    '시간 제한 가사가 선택되지 않았습니다. 재생 및 라이브 튜너는 여전히 작동합니다.',
  'karaoke.lyrics.line': '가사 라인 {number}',
  'karaoke.lyrics.follow': '가사 팔로우',
  'karaoke.lyrics.textSize': '가사 텍스트 크기',
  'karaoke.transport.title': '노래방 재생 컨트롤',
  'karaoke.transport.play': '재생',
  'karaoke.transport.pause': '일시 정지',
  'karaoke.transport.spaceShortcut': '{action} · 우주',
  'karaoke.transport.seek': '노래 위치',
  'karaoke.transport.vocalLevel': '가이드 보컬',
  'karaoke.transport.vocalOff': '백업만',
  'karaoke.transport.vocalFull': '원본',
  'karaoke.transport.mixSettings': '믹스 설정',
  'karaoke.mic.title': '마이크',
  'karaoke.mic.settings': '마이크 설정',
  'karaoke.mic.off': '끔',
  'karaoke.mic.hint':
    '입력을 선택하세요. FluidEQ는 전원을 켤 때만 마이크 액세스를 요청합니다.',
  'karaoke.mic.select': '마이크 입력',
  'karaoke.mic.default': '시스템 기본값',
  'karaoke.mic.unnamed': '마이크 {number}',
  'karaoke.mic.turnOn': '마이크 켜기',
  'karaoke.mic.turnOff': '마이크 끄기',
  'karaoke.mic.requesting': '연결 중…',
  'karaoke.mic.live': '라이브',
  'karaoke.mic.denied': '허가가 거부되었습니다',
  'karaoke.mic.unavailable': '마이크 없음',
  'karaoke.mic.disconnected': '연결이 끊김',
  'karaoke.mic.error': '시작할 수 없습니다.',
  'karaoke.mic.level': '마이크 입력 레벨',
  'karaoke.mic.levelValue': '마이크 입력 레벨: {percent}%',
  'karaoke.mic.privacy':
    '로컬 레벨 및 피치 분석만 가능합니다. FluidEQ는 스피커를 통해 마이크를 녹음하거나 재생하지 않습니다.',
  'karaoke.mic.volume': '마이크 볼륨',
  'karaoke.mic.volumeValue': '마이크 볼륨: {percent}%',
  'karaoke.pitch.title': '피치레인',
  'karaoke.pitch.resize': '피치 차선 크기 조정',
  'karaoke.pitch.show': '피치 가이드 표시',
  'karaoke.pitch.hide': '피치 가이드 숨기기',
  'karaoke.pitch.guide': '멜로디 가이드',
  'karaoke.pitch.toneVolume': '멜로디 톤 볼륨',
  'karaoke.pitch.scrubHint':
    '노래를 이동하려면 왼쪽이나 오른쪽으로 드래그하세요. 일시중지 상태를 유지하려면 버튼을 놓으세요.',
  'karaoke.pitch.waveCanvas': '노래 음표에 대한 실시간 가수 피치 곡선',
  'karaoke.pitch.waveFooter':
    '파란색 블록은 노래 노트입니다. 얇은 라이브 곡선은 마이크에서 나오는 피치입니다.',
  'karaoke.pitch.review': '성과 검토',
  'karaoke.pitch.reviewCount': '{count} 부품 실습',
  'karaoke.pitch.issueHigh': '{time}의 높은 피치. 이 부분을 연습해보세요.',
  'karaoke.pitch.issueLow': '{time}의 낮은 피치. 이 부분을 연습해보세요.',
  'karaoke.pitch.issueMissed':
    '{time}에 메모가 없습니다. 이 부분을 연습해보세요.',
  'karaoke.practice.go': '시작',
  'karaoke.practice.ready': '다시 노래할 준비를 하세요',
  'karaoke.countIn.ready': '준비하세요 - 노래는 GO 이후에 시작됩니다',
  'karaoke.pitch.canvas': '라이브 마이크 피치 및 타겟 노트 레인',
  'karaoke.pitch.micOff': '마이크를 켜서 피치를 확인하세요.',
  'karaoke.pitch.loading': '피치 분석 시작 중…',
  'karaoke.pitch.unavailable':
    '피치 분석을 사용할 수 없습니다. 마이크 수준은 여전히 작동합니다.',
  'karaoke.pitch.noSignal': '마이크에 대고 노래하여 피치를 추적하세요.',
  'karaoke.pitch.empty':
    '대상 음표는 가져온 노래가 실제로 해당 음표를 제공하는 경우에만 나타납니다.',
  'karaoke.pitch.high': '높음',
  'karaoke.pitch.tuned': '조화롭게',
  'karaoke.pitch.low': '낮음',
  'karaoke.chords.aria': '백킹 트랙의 예상 기타 코드',
  'karaoke.chords.analyzing': '코드를 찾는 중… {percent}%',
  'karaoke.chords.estimate': '예상 코드',
  'karaoke.chords.next': '다음',
  'karaoke.chords.in': '{seconds}에서',
  'karaoke.chords.none': '안정적인 코드를 찾을 수 없습니다.',
  'karaoke.chords.confidence': '오디오 추정 신뢰도: {percent}%',
  'karaoke.maker.open': '확인',
  'karaoke.maker.openTitle': '이 노래방 만들기 또는 편집',
  'karaoke.maker.dialog': '노래방 제작 도구',
  'karaoke.maker.eyebrow': 'FLUIDEQ 노래방 메이커',
  'karaoke.maker.close': '메이커 닫기',
  'karaoke.maker.exitBusy':
    '로컬 모델이 아직 실행 중입니다. 편집을 종료하기 전에 취소하거나 완료될 때까지 기다리십시오.',
  'karaoke.maker.songTitle': '노래 제목',
  'karaoke.maker.untitled': '제목없는 노래방',
  'karaoke.maker.undo': '실행 취소',
  'karaoke.maker.redo': '다시 실행',
  'karaoke.maker.apply': '플레이어에서 사용',
  'karaoke.maker.applyHint':
    '플레이어에서 이러한 편집 내용을 사용하세요. 원본 노래방 파일은 변경되지 않습니다. 내보내기는 새 파일을 생성합니다.',
  'karaoke.maker.lyrics': '가사',
  'karaoke.maker.toolsEdit': '편집 도구',
  'karaoke.maker.lyricsTiming': '가사 타이밍',
  'karaoke.maker.timingAll': '전곡',
  'karaoke.maker.timingFromWord': '선택한 단어에서',
  'karaoke.maker.timingAllHint':
    '모든 시간이 지정된 단어와 멜로디 음표를 함께 이동합니다.',
  'karaoke.maker.timingFromWordHint':
    '“{word}”와 그 이후의 모든 항목을 이동합니다. 이전 타이밍은 고정된 상태로 유지됩니다.',
  'karaoke.maker.earlier': '모든 가사를 앞으로 이동',
  'karaoke.maker.later': '나중에 모든 가사 이동',
  'karaoke.maker.openProject': '노래방 가져오기',
  'karaoke.maker.projectLoaded':
    '프로젝트가 로드되었습니다. 현재 오디오는 첨부된 상태로 유지됩니다.',
  'karaoke.maker.karaokeImported':
    '가라오케 타이밍을 가져왔습니다. 현재 오디오는 첨부된 상태로 유지됩니다.',
  'karaoke.maker.recordLines': '레코드 라인 항목',
  'karaoke.maker.syncLinesFromHere': '여기에서 라인 동기화',
  'karaoke.maker.markLine': '라인 시작 표시',
  'karaoke.maker.markLineEnd': '줄 끝 표시',
  'karaoke.maker.capturePressStart': '1단계 · START에서 Enter를 누르세요',
  'karaoke.maker.captureReplaceStart':
    '다음 가사 준비됨 · Enter를 누르면 해당 START가 대체됩니다.',
  'karaoke.maker.captureStartSaved':
    '{time}에 저장된 시작 · END에서 Enter 키를 누르세요.',
  'karaoke.maker.captureAutomaticStart':
    '자동 시작 {time} · END에서 Enter 키를 누르세요.',
  'karaoke.maker.captureStartPoint': '시작',
  'karaoke.maker.captureEndPoint': '종료',
  'karaoke.maker.captureGuideTitle': '라인 타이밍',
  'karaoke.maker.captureSetupTitle': '가사 타이밍을 녹음할 준비가 되셨나요?',
  'karaoke.maker.captureSetupBody':
    '가수의 말을 들어보세요. 줄이 시작되면 Enter 키를 누르고, 선택적으로 각 새 단어에서 Tab 키를 누른 다음 줄이 끝나면 다시 Enter 키를 누릅니다. 이렇게 하면 보류된 최종 단어가 전체 길이를 유지할 수 있습니다.',
  'karaoke.maker.captureStartRecording': '녹음 시작',
  'karaoke.maker.captureMoveGuide':
    '이 가이드를 이동하려면 드래그하세요. 위치를 재설정하려면 두 번 클릭하세요.',
  'karaoke.maker.selectionPanel': '선택 도구',
  'karaoke.maker.selectionMoveGuide':
    '드래그하여 선택 도구를 이동하세요. 위치를 재설정하려면 두 번 클릭하세요.',
  'karaoke.maker.dismissSelection': '선택 도구 닫기',
  'karaoke.maker.captureCountdownReady': '첫 번째 줄을 준비하세요',
  'karaoke.maker.captureGuideNext': '다음에 온다',
  'karaoke.maker.captureGuideAudio': '오디오 이동 2초 · Shift: 1초',
  'karaoke.maker.captureGuideLyrics': '가사 라인을 선택하세요',
  'karaoke.maker.captureGuidePlayback': '재생 또는 일시중지',
  'karaoke.maker.captureGuideWords': '다음 단어를 표시해 줘',
  'karaoke.maker.captureGuideUndo': '마지막 표시 취소',
  'karaoke.maker.stopRecording': '녹음 중지',
  'karaoke.maker.markNextWord': '다음 단어',
  'karaoke.maker.ignoreLine': '줄 무시',
  'karaoke.maker.lineTimingComplete':
    '라인 타이밍이 완료되었습니다. 플레이어에서 검토하고 사용할 준비가 되었습니다.',
  'karaoke.maker.panView': '손 · 팬 타임 라인',
  'karaoke.maker.panHint':
    '손 도구: 편집 없이 노래를 이동하려면 캔버스의 아무 곳이나 드래그하세요.',
  'karaoke.maker.scrubHint':
    '재생 헤드를 드래그하여 조용히 이동하세요. 가사에 대해 FluidEQ는 작은 오디오 신호만 재생합니다.',
  'karaoke.maker.addNote': '참고',
  'karaoke.maker.selectNotes': '메모 선택',
  'karaoke.maker.paintNotes': '페인트 노트',
  'karaoke.maker.selectNotesHint':
    '메모 주위에 상자를 드래그합니다. 전체 그룹을 이동하려면 선택한 메모를 드래그하세요. 선택 항목을 첨부하려면 가사 음절을 Ctrl 키를 누른 채 클릭하세요.',
  'karaoke.maker.paintNotesHint':
    '음표를 그리려면 피치 그리드를 드래그하세요. 페인트 도구는 활성 상태로 유지되므로 여러 메모를 추가할 수 있습니다.',
  'karaoke.maker.notesSelected': '선택한 메모',
  'karaoke.maker.copyNotes': '선택한 메모 복사',
  'karaoke.maker.pasteNotes': '플레이헤드에 메모 붙여넣기',
  'karaoke.maker.notePasted': '플레이헤드에 메모를 붙여넣었습니다.',
  'karaoke.maker.notesPasted': '{count} 메모가 재생 헤드에 붙여넣어졌습니다.',
  'karaoke.maker.detachNotes': '가사에서 분리',
  'karaoke.maker.noteAttachHelp':
    'Ctrl을 누른 채 선택한 메모를 단어나 음절 위로 끌어서 첨부하세요. 첨부된 메모는 해당 가사 타이밍을 따르며 분리될 때까지 완전히 잠긴 상태로 유지됩니다.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C는 선택 항목을 복사합니다. · Ctrl+V는 재생 헤드에 첫 번째 메모를 붙여넣습니다.',
  'karaoke.maker.attachedTo': '“{word}”에 부착됨',
  'karaoke.maker.noteUnattached': '가사에 첨부되지 않음',
  'karaoke.maker.splitWordSyllables': '단어를 음절로 나누기',
  'karaoke.maker.syllableEditorEyebrow': '음절 편집기',
  'karaoke.maker.syllableEditorTitle': '"{word}" 분할',
  'karaoke.maker.syllableEditorHint':
    '음절 경계를 추가하거나 제거하려면 문자 사이를 클릭하세요.',
  'karaoke.maker.syllableSplitPoint': '"{text}" 이후 분할 전환',
  'karaoke.maker.syllableEditorPreview': '결과 음절',
  'karaoke.maker.applySyllableSplit': '음절 분할 적용',
  'karaoke.maker.hearNote': '메모 듣기',
  'karaoke.maker.split': '분할',
  'karaoke.maker.delete': '삭제',
  'karaoke.maker.advanced': '수리 도구',
  'karaoke.maker.prepared':
    '이 노래방에는 이미 시간이 지정된 가사와 멜로디가 있습니다.',
  'karaoke.maker.repairLyrics': '가사 타이밍 재감지',
  'karaoke.maker.repairMelody': '멜로디 음표 재감지',
  'karaoke.maker.rebuildKaraoke': '가사 + 멜로디 재구성',
  'karaoke.maker.vocalStem': '보컬 전용 트랙 로드',
  'karaoke.maker.groupVoice': '음성 및 음악',
  'karaoke.maker.stemsTitle': '분리된 트랙',
  'karaoke.maker.stemBacking': '백킹 트랙',
  'karaoke.maker.stemSaveAs': '{name}를 다른 이름으로 저장',
  'karaoke.maker.stemSaveFormat': '{name}를 {format}로 저장',
  'karaoke.maker.stemMp3Encoding': 'MP3 인코딩…',
  'karaoke.maker.stemMp3Saved': 'MP3가 저장되었습니다.',
  'karaoke.maker.stemMp3Failed': 'MP3를 인코딩할 수 없습니다.',
  'karaoke.maker.stemVoice': '음성',
  'karaoke.maker.stemSave': '저장',
  'karaoke.maker.groupLyrics': '가사와 타이밍',
  'karaoke.maker.removeBackground': '음악에서 음성 분리',
  'karaoke.maker.removeBackgroundDone': '이미 분리된 음성',
  'karaoke.maker.separationDownloading':
    '분리 모델({percent}%) 다운로드 · 1회, 약 700MB',
  'karaoke.maker.separationReading': '노래 읽기',
  'karaoke.maker.separating': '음악에서 목소리를 분리하기',
  'karaoke.maker.separationDone':
    '음성이 분리되었습니다. 가사 감지가 준비되었습니다.',
  'karaoke.maker.separationSlow':
    '이 컴퓨터에는 그래픽 가속이 없으므로 1분 미만이 아닌 몇 분이 소요됩니다.',
  'karaoke.maker.separationRequired':
    '먼저 음성을 분리합니다. 가사 감지는 분리된 보컬을 읽습니다.',
  'karaoke.maker.separationRequiredMelody':
    '먼저 음성을 분리하세요. 음표 감지는 단일 음성과 일반적으로 악기 믹스를 따릅니다.',
  'karaoke.maker.wizardTitle': '이 노래를 자동으로 설정하세요',
  'karaoke.maker.wizardIntro':
    '이 노래에는 아직 가사 타이밍이 없습니다. FluidEQ는 음악에서 음성을 분리한 다음 음악에서 단어와 타이밍을 읽을 수 있습니다. 모든 것이 이 컴퓨터에서 실행됩니다.',
  'karaoke.maker.wizardStepSeparate': '목소리를 분리하라',
  'karaoke.maker.wizardStepTranscribe': '단어와 타이밍을 읽어보세요',
  'karaoke.maker.wizardLanguage': '가사의 언어',
  'karaoke.maker.wizardLanguageAuto': '자동으로 감지',
  'karaoke.maker.wizardStart': '자동으로 설정',
  'karaoke.maker.wizardSkip': '내가 직접 할게',
  'karaoke.maker.wizardCancel': '정지',
  'karaoke.maker.wizardHide': '백그라운드에서 계속',
  'karaoke.maker.wizardCancelled':
    '중지되었습니다. 완료된 것은 모두 보관되었습니다.',
  'karaoke.maker.export': '내보내기',
  'karaoke.maker.exportProject': 'FluidEQ 프로젝트',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': '향상된 LRC',
  'karaoke.maker.exportInstrumental': '백킹 트랙(보컬 없음)',
  'karaoke.maker.stats': '{notes} 노트 · {words} 단어 · {checks} 수표',
  'karaoke.maker.wordStateLegend': '가사 타이밍 작업 상태',
  'karaoke.maker.userAdjustedWords': '{count} 조정됨',
  'karaoke.maker.pendingWords': '{count} 보류 중',
  'karaoke.maker.artist': '아티스트',
  'karaoke.maker.songPosition': '노래 위치',
  'karaoke.maker.previousView': '이전 섹션',
  'karaoke.maker.nextView': '다음 섹션',
  'karaoke.maker.resetZoom': '시간에 맞춰 가사를 맞추려면 두 번 클릭하세요.',
  'karaoke.maker.livePreview': '실시간 미리보기',
  'karaoke.maker.showPreview': '미리보기 표시',
  'karaoke.maker.hidePreview': '미리보기 숨기기',
  'karaoke.maker.noteNormal': '참고',
  'karaoke.maker.noteGolden': '골든',
  'karaoke.maker.noteFree': '무료',
  'karaoke.maker.untimed': '시간 제한 없음',
  'karaoke.maker.applyUntimed':
    '{count} 가사 단어에는 아직 음성 타이밍이 확인되지 않았습니다. 플레이어에서 이 노래방을 사용하기 전에 이를 감지하거나 배치하세요.',
  'karaoke.maker.selectHint': '가사나 멜로디 음표를 선택하여 검사하세요.',
  'karaoke.maker.rights':
    '나는 이 오디오와 가사를 사용하고 내보낼 수 있는 권한이 있습니다.',
  'karaoke.maker.cancel': '취소',
  'karaoke.maker.localAnalysis': '지역 분석',
  'karaoke.maker.lyricsEyebrow': '가사',
  'karaoke.maker.lyricsTitle': '행당 가사 한 줄을 붙여넣거나 편집하세요.',
  'karaoke.maker.lyricsReferenceHint':
    '[Verse] 또는 [Chorus]와 같은 반복되는 대사와 마커를 포함하여 완전한 가사를 제공하세요. FluidEQ는 이 텍스트를 유지하고 로컬 음성 인식을 사용하여 타이밍을 찾습니다.',
  'karaoke.maker.referenceLyrics': '참고 가사',
  'karaoke.maker.wordTiming': '단어 타이밍',
  'karaoke.maker.lyricsWordCount': '참조의 {count} 단어',
  'karaoke.maker.lyricsTimedCount': '{total}의 {timed} 시간 초과',
  'karaoke.maker.lyricsApplyBeforeTiming':
    '단어 타이밍을 편집하기 전에 새 가사를 수락하세요',
  'karaoke.maker.lyricsNoTimedWords': '아직 시간 제한 단어가 없습니다.',
  'karaoke.maker.lyricsTimingEditorHint':
    '감지 후 단어를 선택하여 텍스트, 시작 시간 또는 길이를 수정하세요.',
  'karaoke.maker.lyricsSelectWord': '타이밍을 편집하려면 단어를 선택하세요.',
  'karaoke.maker.lyricsSelectedWord': '선택한 단어',
  'karaoke.maker.lyricsWordNavigation': '단어 탐색',
  'karaoke.maker.previousWord': '이전 단어',
  'karaoke.maker.nextWord': '다음 단어',
  'karaoke.maker.lyricsPlaceholder':
    '여기에 전체 가사를 붙여넣으세요…\n\n[구절]\n첫 번째 줄\n두 번째 줄',
  'karaoke.maker.loadLyricsFile': '가사 파일 로드',
  'karaoke.maker.lyricsFileLoaded': '{file}에서 가사를 로드했습니다.',
  'karaoke.maker.lyricsRequired':
    '타이밍과 멜로디를 감지하기 전에 전체 가사를 추가하거나 붙여넣으세요.',
  'karaoke.maker.detectTimingMelody': '타이밍과 멜로디를 감지',
  'karaoke.maker.acceptLyrics': '가사 수락',
  'karaoke.maker.acceptAndRecordLines': '타이밍 수락 및 기록',
  'karaoke.maker.continueInBackground': '백그라운드에서 계속',
  'karaoke.maker.clearLyrics': '가사 지우기',
  'karaoke.maker.clearLyricsTitle': '가사를 모두 삭제하시겠습니까?',
  'karaoke.maker.clearLyricsBody':
    '이렇게 하면 모든 가사와 타이밍이 제거됩니다. 멜로디 음표는 남아 있지만 단어 링크는 제거됩니다. 취소 후 취소가 가능합니다.',
  'karaoke.maker.clearNotes': '메모 지우기',
  'karaoke.maker.clearNotesTitle': '모든 멜로디 음표를 삭제하시겠습니까?',
  'karaoke.maker.clearNotesBody':
    '모든 가사와 단어 타이밍을 유지하면서 모든 멜로디 음표를 제거합니다. 취소 후 취소가 가능합니다.',
  'karaoke.maker.notesCleared': '모든 멜로디 음표가 지워졌습니다.',
  'karaoke.maker.lyricsCleared':
    '가사가 모두 지워졌습니다. 기존 메모는 단어 링크 없이 유지되었습니다.',
  'karaoke.maker.restore': '원본 복원',
  'karaoke.maker.restoreTitle': '원래 노래방을 복원하시겠습니까?',
  'karaoke.maker.restoreBody':
    '이렇게 하면 이 세션의 모든 편집 내용이 삭제되고 저장된 초안을 포함하여 노래방을 가져온 대로 다시 작성합니다. 복원 후 실행 취소가 가능합니다.',
  'karaoke.maker.restored': '가져온 원본이 복원되었습니다.',
  'karaoke.maker.replaceLyricsWarning':
    '말이 바뀌었어요. 이를 대체하면 단어 ID와 자동 타이밍이 다시 작성됩니다. 기존의 수동 단어 수정은 안정적으로 전송할 수 없습니다. 멜로디 음표는 남아 있으며 다시 연결됩니다.',
  'karaoke.maker.replaceAndDetect': '교체 및 감지',
  'karaoke.maker.wordText': '말씀',
  'karaoke.maker.wordPosition': '위치',
  'karaoke.maker.wordDuration': '길이(밀리초)',
  'karaoke.maker.wordTimingSliderHint':
    '공유 경계를 조정합니다. 이웃 단어는 줄 범위가 고정된 동안 시간을 주거나 받습니다.',
  'karaoke.maker.usePlayhead': '플레이헤드 사용',
  'karaoke.maker.playWord': '단어 재생',
  'karaoke.maker.replaceLyrics': '가사 바꾸기',
  'karaoke.maker.lyricsAutoAligned':
    '사용 가능한 멜로디에 새로운 가사가 적용되고 정렬됩니다.',
  'karaoke.maker.lyricsNeedPreparation':
    '새로운 가사가 적용되었습니다. 복구 도구를 열고 가사 타이밍 다시 감지를 선택하여 시간을 측정하세요.',
  'karaoke.maker.transcriptionEyebrow': '일회성 지역 모델',
  'karaoke.maker.transcriptionTitle': '음성 모델을 다운로드하시겠습니까?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ는 Hugging Face에서 MIT 라이센스 {model} 모델을 다운로드하여 이 PC에 캐시합니다. 한 번은 그래픽 가속 기능이 있는 경우 약 570MB, 그래픽 가속이 없는 경우 약 1.1GB입니다. 귀하의 오디오는 이 컴퓨터를 떠나지 않습니다. 첫 번째 실행에는 몇 분이 걸리며 상당한 메모리를 사용합니다.',
  'karaoke.maker.transcriptionReview':
    '인정은 단지 시작점일 뿐입니다. FluidEQ는 기존 텍스트를 일치시킬 때 원래 가사 철자를 유지하고 모든 타임스탬프는 편집 가능한 상태로 유지됩니다.',
  'karaoke.maker.notNow': '지금은 아님',
  'karaoke.maker.downloadPrepare': '가사 다운로드 및 준비',
  'karaoke.maker.downloadingWhisper': '음성 모델 다운로드 중',
  'karaoke.maker.downloadOverall': '전체 다운로드',
  'karaoke.maker.downloadFiles': '{total} 파일 중 {complete}',
  'karaoke.maker.loadingWhisper': '음성 모델 로드 중',
  'karaoke.maker.analysisRunning': '로컬에서 피치 분석',
  'karaoke.maker.analysisFound':
    '분석 결과 {count} 메모 영역이 발견되었습니다.',
  'karaoke.maker.basicPitchRunning': '멜로디 음표 감지',
  'karaoke.maker.basicPitchFound':
    '음성에서 {count} 편집 가능한 멜로디 메모를 찾았습니다.',
  'karaoke.maker.whisperPreparing': '가사 타이밍 준비',
  'karaoke.maker.whisperDecoding': '로컬에서 오디오 디코딩',
  'karaoke.maker.whisperTranscribing': '가사 타이밍 감지',
  'karaoke.maker.whisperTranscribingProgress':
    '가사 타이밍 감지 · {pass}/{passes} 통과 · {chunk}/{chunks} 차단',
  'karaoke.maker.whisperAligning': '노래에 가사 맞추기',
  'karaoke.maker.whisperComplete': '가사 타이밍이 감지되었습니다.',
  'karaoke.maker.whisperMatched':
    '속삭임이 {count} 인식된 단어와 일치합니다. 내보내기 전에 편집 가능한 타이밍을 검토하세요.',
  'karaoke.maker.speechMemory': 'AI 모델 메모리',
  'karaoke.maker.speechMemoryReady': 'RAM에서 준비됨',
  'karaoke.maker.speechMemoryCached': '디스크에 캐시됨',
  'karaoke.maker.speechMemoryMissing': '다운로드되지 않음',
  'karaoke.maker.modelWhisper': '연설(속삭임)',
  'karaoke.maker.modelPitch': '피치(RMVPE)',
  'karaoke.maker.modelSeparation': '분리(RoFormer)',
  'karaoke.maker.freeMemory': '지금 RAM 비우기',
  'karaoke.maker.memoryReleased':
    'RAM에서 음성 모델이 제거되었습니다. 다운로드한 파일은 캐시된 상태로 유지됩니다.',
  'karaoke.maker.memoryReleaseBusy':
    '음성 모델이 사용 중이어서 아직 출시할 수 없습니다.',
  'karaoke.maker.memoryAfterUse': '유휴 상태일 때',
  'karaoke.maker.memoryPolicy.ask': '매번 묻기',
  'karaoke.maker.memoryPolicy.auto': '자동으로 해제',
  'karaoke.maker.memoryPolicy.keep': '로드 상태 유지',
  'karaoke.maker.memoryPromptTitle': '자유 음성 모델 메모리?',
  'karaoke.maker.memoryPromptBody':
    '로컬 음성 모델이 유휴 상태입니다. 이를 해제하면 RAM이 절약됩니다. 더 빠른 재로드를 위해 해당 파일은 캐시된 상태로 유지됩니다.',
  'karaoke.maker.keepLoaded': '로드 상태 유지',
  'karaoke.maker.exported': '{file}를 내보냈습니다.',
  'karaoke.maker.exportedPartialLrc':
    '{lines} 가사 없이 {file}를 내보냈습니다. LRC는 줄이나 단어 중 하나에 시간이 필요하지만 둘 다 없습니다. Maker에서 시간을 측정하고 다시 내보내어 완전한 파일을 만드세요.',
  'karaoke.maker.exportedPartialUltraStar':
    '{words} 가사 없이 {file}를 내보냈습니다. UltraStar는 멜로디에 음표가 있는 경우에만 단어를 전달하며 여기에는 음표가 없습니다. 메모를 감지하거나 그린 후 전체 파일을 위해 다시 내보냅니다.',
  'karaoke.maker.exportFallback': '노래방 파일',
  'karaoke.maker.projectTooLarge': '프로젝트가 16MB보다 큽니다.',
  'karaoke.maker.previewResize': '실시간 미리보기 크기 조정',
  'karaoke.maker.seekBack': '{seconds}초 뒤로 이동',
  'karaoke.maker.seekForward': '{seconds}초 앞으로 이동',
  'karaoke.maker.jumpToStart': '노래 시작으로 이동',
  'karaoke.maker.jumpToEnd': '노래 끝으로 이동',
  'karaoke.maker.errorAudioLimits':
    '로컬 분석은 최대 1GB의 오디오 파일과 30분 미만의 녹음을 지원합니다.',
  'karaoke.maker.errorComponentUnavailable':
    '필수 로컬 분석 구성요소를 사용할 수 없습니다. FluidEQ를 다시 시작하고 다시 시도하십시오.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ는 이 오디오를 로컬에서 분석할 수 없습니다.',
  'karaoke.maker.errorExportNeedsNotes':
    'UltraStar 내보내기에는 최소한 하나의 멜로디 노트가 필요합니다.',
  'karaoke.maker.errorExport': 'FluidEQ는 이 노래방을 내보낼 수 없습니다.',
  'karaoke.maker.errorProjectVersion':
    '이 노래방 제작 도구 프로젝트는 지원되지 않는 FluidEQ 버전에 의해 생성되었습니다.',
  'karaoke.maker.errorImport':
    'FluidEQ는 이 노래방 또는 프로젝트 파일을 가져올 수 없습니다.',
  'karaoke.maker.errorParse':
    '선택한 가사 또는 노래방 파일을 구문 분석할 수 없습니다.',
  'karaoke.maker.downloadFailed': 'Whisper 모델 다운로드 실패',
  'karaoke.maker.pitchDownloadFailed': '피치 모델 다운로드 실패',
  'karaoke.maker.pitchDownloadError':
    'FluidEQ는 정확도가 더 높은 멜로디 모델을 다운로드할 수 없습니다. 번들 오프라인 모델에서도 멜로디 감지가 계속되었습니다. 인터넷 연결이나 방화벽을 확인한 후 다시 시도하세요.',
  'karaoke.maker.localAnalysisFailed': '로컬 분석 실패',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ가 Hugging Face에서 모델을 다운로드할 수 없습니다. 인터넷 연결이나 방화벽을 확인한 후 다시 시도하세요.',
  'karaoke.maker.tryAgain': '다시 시도',
  'karaoke.maker.dismiss': '오류 무시',
  'karaoke.maker.analysisSource': '“{file}”를 로컬 분석 소스로만 사용합니다.',
  'karaoke.maker.rightsRequired':
    '내보내기를 게시하기 전에 오디오 및 가사에 대한 권리가 있는지 확인하세요.',
  'karaoke.maker.draftRestored': '초안이 복원되었습니다.',
  'karaoke.maker.playerTimingLoaded':
    '현재 플레이어 타이밍을 사용합니다. 실행 취소는 저장된 초안을 복원합니다.',
  'karaoke.translation.picker': '가사 언어',
  'karaoke.translation.original': '기록된 대로',
  'karaoke.translation.add': '언어 추가',
  'karaoke.translation.remove': '이 언어 삭제',
  'karaoke.translation.target': '붙여넣는 가사의 언어',
  'karaoke.translation.paste':
    '노래 한 줄에 한 줄씩 해당 언어로 가사를 붙여넣으세요.',
  'karaoke.translation.mismatch':
    '노래에는 {expected} 노래 가사가 있고 이 텍스트에는 {received}가 있습니다. 상자 옆의 번호가 매겨진 선에 맞춰 정렬하세요.',
  'karaoke.translation.fit': '{syllables} 음절, {notes} 노트',
  'karaoke.translation.fitOk': '멜로디에 딱맞아',
  'karaoke.translation.empty': '아직 이 언어로 된 가사가 없습니다.',
  'karaoke.translation.exportLanguage': '가사 파일은 {language}에 작성됩니다.',
  'karaoke.import.clearTitle': '모든 노래방 곡을 목록에서 비울까요?',
  'karaoke.import.clearBody':
    '재생을 멈추고 노래방 재생 목록을 모두 비웁니다. 컴퓨터의 원본 파일은 삭제하지 않습니다.',
} satisfies Partial<Dictionary>;

export default karaoke;
