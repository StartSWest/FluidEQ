// The Studio's palette control (contract 9, `scenePalette.ts`): its words,
// and the stock palettes its Presets menu offers.
const studioPalette = {
  'studioPalette.group': '顏色',
  'studioPalette.lead':
    '場景的調色盤，從低音到高音。變更會立刻顯示在舞台上，並儲存到場景中。',
  'studioPalette.presets': '預設',
  'studioPalette.reverse': '反轉',
  'studioPalette.reverseHint': '把調色盤倒過來：高音的顏色換到低音。',
  'studioPalette.strip': '{name}：{count} 種顏色',
  'studioPalette.stop':
    '第 {index} 種顏色（共 {count} 種），{colour}，位於 {percent}%',
  'studioPalette.colour': '所選色標的顏色',
  'studioPalette.hint':
    '點按色帶新增顏色。拖曳色標可移動，點按可變更顏色，按右鍵或拖出色帶可刪除。調色盤至少保留兩種顏色。',
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
  'studioPalette.preset.aurora': '極光',
  'studioPalette.preset.forest': '森林',
  'studioPalette.preset.gold': '金色',
  'studioPalette.preset.pastel': '粉彩',
  'studioPalette.preset.cool': '冷色',
  'studioPalette.preset.spring': '春天',
  'studioPalette.preset.tropical': '熱帶',
  'studioPalette.preset.chrome': '鉻',
  'studioPalette.pickColour': '{name}：選擇顏色',
} as const;

export default studioPalette;
