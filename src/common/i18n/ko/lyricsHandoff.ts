const lyricsHandoff = {
  'library.lyrics.karaoke.open': '노래방에서 열기',
  'library.lyrics.karaoke.opening': '여는 중…',
  'library.lyrics.karaoke.hintTimed':
    '이 싱크 가사로 노래방을 시작하고 메이커에서 타이밍을 고칩니다',
  'library.lyrics.karaoke.hintPlain':
    '이 가사로 노래방을 시작하고 메이커에서 타이밍을 맞춥니다',
  'library.lyrics.karaoke.failed': '이 노래를 노래방에서 열지 못했습니다.',
  'library.lyrics.remove.button': '가사 삭제',
  'library.lyrics.remove.askFile':
    '{name} 파일을 삭제할까요? 노래 옆의 가사 파일이 지워집니다.',
  'library.lyrics.remove.askKept':
    'FluidEQ가 이 노래를 위해 보관한 가사 사본을 삭제할까요?',
  'library.lyrics.remove.busy': '가사를 삭제하는 중…',
  'library.lyrics.remove.confirm': '삭제',
  'library.lyrics.remove.keep': '유지',
  'library.lyrics.remove.inSong':
    '이 가사는 노래 파일 안에 들어 있습니다. FluidEQ는 노래 파일을 절대 바꾸지 않으므로 여기서 삭제할 수 없습니다.',
  'library.lyrics.remove.failed': '가사를 삭제하지 못했습니다.',
  'library.lyrics.remove.understood': '확인',

  'karaoke.maker.song.save': '라이브러리에 저장',
  'karaoke.maker.song.saveHint':
    '이 타이밍을 라이브러리에서 노래의 가사로 저장합니다',
  'karaoke.maker.song.openedTimed':
    '라이브러리에 있는 노래의 싱크 가사로 열었습니다.',
  'karaoke.maker.song.keptTimed':
    '이 노래의 노래방을 이미 만들고 있었기 때문에 마지막 상태 그대로 열었습니다. ‘원본 복원’을 누르면 노래의 가사로 다시 시작합니다.',
  'karaoke.maker.song.keptPlain':
    '이 노래의 노래방을 이미 만들고 있었기 때문에 마지막 상태 그대로 열었습니다. 노래의 가사를 대신 쓰려면 편집기에 있습니다.',
  'karaoke.maker.song.savedBeside': '노래 옆에 {name} 파일로 저장했습니다.',
  'karaoke.maker.song.savedKept':
    'FluidEQ 가사 폴더에 저장했습니다. 노래 폴더에 쓸 수 없습니다.',
  'karaoke.maker.song.untimedLeftOut':
    '타이밍이 없는 줄은 제외했습니다({lines}).',
  'karaoke.maker.song.tagsFirst':
    '노래 태그에도 싱크 가사가 있어서 라이브러리에는 그 가사가 먼저 표시됩니다.',
  'karaoke.maker.song.nothingTimed':
    '아직 저장할 것이 없습니다. 시간이 지정된 줄이 없습니다.',
  'karaoke.maker.song.failed': '가사를 노래에 저장하지 못했습니다.',
  'karaoke.maker.song.gone': '이 노래는 더 이상 라이브러리에 없습니다.',
  'karaoke.maker.song.replaceTitle': '{name} 파일을 바꿀까요?',
  'karaoke.maker.song.replaceKeptTitle': 'FluidEQ 사본을 바꿀까요?',
  'karaoke.maker.song.replaceBody':
    '이 노래는 이미 {name}에 가사가 있습니다. 메이커의 타이밍으로 바뀝니다.',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ가 이 노래의 가사를 이미 보관하고 있습니다. 메이커의 타이밍으로 바뀝니다.',
  'karaoke.maker.song.replace': '바꾸기',
} as const;

export default lyricsHandoff;
