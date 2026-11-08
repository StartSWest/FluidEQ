// The Studio's palette control (contract 9, `scenePalette.ts`): its words,
// and the stock palettes its Presets menu offers.
const studioPalette = {
  'studioPalette.group': '颜色',
  'studioPalette.lead':
    '场景的调色板，从低音到高音。改动会立刻显示在舞台上，并保存到场景中。',
  'studioPalette.presets': '预设',
  'studioPalette.reverse': '反转',
  'studioPalette.reverseHint': '把调色板倒过来：高音的颜色换到低音。',
  'studioPalette.strip': '{name}：{count} 种颜色',
  'studioPalette.stop':
    '第 {index} 种颜色（共 {count} 种），{colour}，位于 {percent}%',
  'studioPalette.colour': '所选色标的颜色',
  'studioPalette.hint':
    '点击色带添加颜色。拖动色标可移动，点击可更改颜色，右键点击或拖出色带可删除。调色板至少保留两种颜色。',
  'studioPalette.preset.rainbow': '彩虹',
  'studioPalette.preset.viridis': 'Viridis',
  'studioPalette.preset.magma': 'Magma',
  'studioPalette.preset.inferno': 'Inferno',
  'studioPalette.preset.plasma': 'Plasma',
  'studioPalette.preset.turbo': 'Turbo',
  'studioPalette.preset.sunset': '日落',
  'studioPalette.preset.ocean': '海洋',
  'studioPalette.preset.fire': '火焰',
  'studioPalette.preset.ice': '冰',
  'studioPalette.preset.neon': '霓虹',
  'studioPalette.preset.vaporwave': 'Vaporwave',
  'studioPalette.preset.aurora': '极光',
  'studioPalette.preset.forest': '森林',
  'studioPalette.preset.gold': '金色',
  'studioPalette.preset.pastel': '粉彩',
  'studioPalette.preset.cool': '冷色',
  'studioPalette.preset.spring': '春天',
  'studioPalette.preset.tropical': '热带',
  'studioPalette.preset.chrome': '铬',
} as const;

export default studioPalette;
