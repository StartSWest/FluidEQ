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
  'look.edit': '编辑外观',
  'look.create': '创建外观',
  'look.new': '新建外观',
  'look.close': '关闭外观编辑器',
  'look.closeHint': '关闭且不保存（Esc）',
  'look.pickForm': '请从上方选择形状，或按空格键。',
  'look.colourBy': '着色依据',
  'look.palette.cycle': '配色',
  'look.palette.flat': '纯色',
  'look.palette.flatHint': '整个图形使用一种颜色',
  'look.palette.frequency': '频率',
  'look.palette.frequencyHint': '颜色沿坐标轴变化，显示每个条柱所在的频段。',
  'look.palette.level': '电平',
  'look.palette.levelHint': '颜色沿坐标轴向上变化，显示每个条柱的响度。',
  'look.palette.heat': '热度',
  'look.palette.heatHint': '颜色随音量变化，由冷色渐变到红色。',
  'look.colours': '颜色',
  'look.colourValue': '颜色 {number}：{colour}',
  'look.removeColour': '移除颜色 {number}',
  'look.custom': '自定义',
  'look.customColour': '选择其他颜色',
  'look.reset': '重置',
  'look.addColour': '添加颜色',
  'look.addColourHint': '在渐变末尾添加一种颜色',
  'look.pieces': '分段',
  'look.gap': '间隔',
  'look.continuous': '此形状绘制为连续图形',
  'look.attack': '起音',
  'look.release': '释放',
  'look.releaseHint': '峰值在回落前保持的时间',
  'look.drawnAs': '绘制方式',
  'look.filled': '填充',
  'look.stroked': '描边',
  'look.fill': '填充度',
  'look.weight': '粗细',
  'look.rainbow': '彩虹',
  'look.glow': '辉光',
  'look.off': '关闭',
  'look.glowHint': '图形随节拍扩张和变亮的强度。',
  'look.glowNeedsRainbow': '需要彩虹模式。关闭时，辉光不会改变图形。',
  'look.needsRainbow': '需要彩虹模式。',
  'look.rainbowBorder': '彩虹边框',
  'look.rainbowBorderHint': '用贯穿整个色谱的颜色环绕图表。',
  'look.borderWeight': '边框粗细',
  'look.litPeaks': '峰值高亮',
  'look.litPeakWeight': '峰值粗细',
  'look.peakStyle': '标记',
  'look.peak.fall': '回落',
  'look.peak.ghost': '残影',
  'look.peak.ripple': '涟漪',
  'look.peak.sparks': '火花',
  'look.peak.beam': '光束',
  'look.peak.ceiling': '天花板',
  'look.peak.comet': '彗星',
  'look.peak.drip': '滴落',
  'look.peak.bead': '方块',
  'look.peak.cap': '顶盖',
  'look.peak.ring': '圆环',
  'look.peak.spark': '火花',
  'look.peak.chevron': '尖角',
  'look.peak.halo': '光晕',
  'look.peak.pin': '标针',
  'look.peak.crown': '王冠',
  'look.peak.cross': '十字',
  'look.peak.wave': '波形',
  'look.noLitPeaks': '此形状没有可高亮的尖端',
  'look.name': '名称',
  'look.resetAll': '重置所有设置',
  'look.resetAllHint': '恢复此形状的默认设置',
  'look.export': '将此外观导出到文件',
  'look.exportHint': '将此外观保存为可分享的文件',
  'look.import': '从文件导入外观',
  'look.delete': '删除此外观',
  'look.save': '保存',
  'look.saveHint': '保存并选择此外观',
  'look.full': '列表已满 — 请删除一个外观以腾出空间',
  'look.error.emptyFile': '该文件中未找到外观。',
  'look.error.readFile': 'FluidEQ 无法读取该外观文件。',
  'support.eyebrow': '完全自愿',
  'support.petHint': '按空格键让它跳一下',
  'support.game.hint': '波峰到达线上时跟着节拍按下',
  'support.game.howTo':
    '跟着节拍点击宠物或按空格键。坚持下去，到 ×10 会有惊喜。',
  'support.game.thanks':
    '如果这让你会心一笑，你的想法和支持就是它继续下去的动力。',
  'support.game.noAudio': '播放音乐后节拍会显示在这里',
  'support.game.listening': '正在寻找节拍…',
  'support.game.share': '分享',
  'support.game.shareEuphoria': '分享彩虹',
  'support.game.shareTitle': '分享你的分数',
  'support.game.shareUnlock':
    '达到 ×10，这张卡片就会变成彩虹模式，整条光谱都在上面。',
  'support.game.shareNote':
    '先保存卡片，再附加到你的帖子里：这些平台都无法从链接中取出图片。',
  'support.game.shareSave': '保存卡片',
  'support.game.shareCopyCard': '复制卡片',
  'support.game.shareCardCopied': '已复制 — 直接粘贴',
  'support.game.shareCopy': '复制文字',
  'support.game.shareCopied': '已复制',
  'support.game.shareLinkOnly': '只会分享链接，文字请自行粘贴',
  'support.game.euphoria': '彩虹模式',
  'support.game.euphoriaToggle': '开启或关闭彩虹模式',
  'support.game.perfect': '完美',
  'support.game.great': '很棒',
  'support.game.good': '不错',
  'support.game.miss': '未命中',
  'support.title': '支持这份工作',
  'support.close': '关闭',
  'support.pitch':
    'FluidEQ 是免费且开源的，以后也一样：源码是公开的，你随时可以自己免费构建，也从不做任何追踪。出售的是签名好、开箱即用的版本。如果它在你的设备里挣到了一席之地，一份支持就是在为维护它的时间、以及同一间工作室里接下来的想法买单。',
  'support.craft':
    '这是一个人的作品，投入了大量心血，以及近乎不讲道理的细节打磨。每一块面板都是手工画出来、反复推敲过的：频响曲线一眼看过去是什么感觉、菜单怎么展开、旋钮慢慢拖动时该有什么反应、按钮上该写哪几个字。这里没有一处是套了主题的现成组件。',
  'support.card': '银行卡或钱包',
  'support.card.hint':
    '由 Stripe 托管的安全结账。会在浏览器中打开——应用永远看不到你的卡片信息。',
  'support.coffee': '请我喝杯咖啡',
  'support.coffee.hint':
    '一次性的小费，不需要注册账号。点击可在浏览器中打开，也可以用手机扫码。',
  'support.verify': '发送前请核对地址。',
  'support.copy': '复制地址',
  'support.copied': '已复制',
  'support.openWallet': '在钱包中打开',
  'support.contributed': '我支持过了 — 解锁星星和舞蹈',
  'support.thanks': '谢谢 — 你的小伙伴有了它的星星，现在会跳舞了。',
  'support.releaseNotes': '看看这个版本有什么新变化',
  'support.footerBefore':
    '更想用时间来贡献？在这里提 issue 和 pull request 同样受欢迎：',
};

export default look;
