// The Studio's palette control (contract 9, `scenePalette.ts`): its words,
// and the stock palettes its Presets menu offers.
const studioPalette = {
  'studioPalette.group': '색상',
  'studioPalette.lead':
    '장면의 팔레트입니다(저음에서 고음 순). 바꾸면 바로 무대에 보이고 장면에 저장됩니다.',
  'studioPalette.presets': '프리셋',
  'studioPalette.reverse': '뒤집기',
  'studioPalette.reverseHint':
    '팔레트를 뒤집어 고음 쪽 색을 저음 쪽으로 보냅니다.',
  'studioPalette.strip': '{name}: {count}가지 색',
  'studioPalette.stop':
    '{count}개 중 {index}번째 색, {colour}, {percent}% 위치',
  'studioPalette.colour': '선택한 지점의 색',
  'studioPalette.hint':
    '띠를 클릭하면 색이 추가됩니다. 끌어서 옮기고, 클릭해서 바꾸고, 마우스 오른쪽 클릭이나 띠 밖으로 끌어 빼면 지워집니다. 팔레트에는 적어도 두 가지 색이 남습니다.',
  'studioPalette.preset.rainbow': '무지개',
  'studioPalette.preset.viridis': 'Viridis',
  'studioPalette.preset.magma': 'Magma',
  'studioPalette.preset.inferno': 'Inferno',
  'studioPalette.preset.plasma': 'Plasma',
  'studioPalette.preset.turbo': 'Turbo',
  'studioPalette.preset.sunset': '노을',
  'studioPalette.preset.ocean': '바다',
  'studioPalette.preset.fire': '불꽃',
  'studioPalette.preset.ice': '얼음',
  'studioPalette.preset.neon': '네온',
  'studioPalette.preset.vaporwave': 'Vaporwave',
  'studioPalette.preset.aurora': '오로라',
  'studioPalette.preset.forest': '숲',
  'studioPalette.preset.gold': '금빛',
  'studioPalette.preset.pastel': '파스텔',
  'studioPalette.preset.cool': '쿨',
  'studioPalette.preset.spring': '봄',
  'studioPalette.preset.tropical': '트로피컬',
  'studioPalette.preset.chrome': '크롬',
  'studioPalette.pickColour': '{name}: 색 고르기',
} as const;

export default studioPalette;
