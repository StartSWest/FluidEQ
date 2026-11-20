/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Auto EQ on the EQ page: its button, its panel, Manage, and the note that
 * took the Output panel’s old switch’s place. */
export default {
  'autoEq.title': '自动均衡',
  'autoEq.aria': '自动均衡：决定每首歌的声音',
  'autoEq.tagline': '为你挑选每首歌的声音',
  'autoEq.state.measuring': '测量中',
  'autoEq.state.paused': '已暂停',
  'autoEq.state.song': '歌曲',
  'autoEq.state.album': '专辑',
  'autoEq.state.yours': '你的',
  'autoEq.aside':
    'DSP 关闭、游戏链开启或游戏播放自己的声音时，它会暂时让开，之后恢复原样。',
  'autoEq.now.nothing': '没有播放',
  'autoEq.now.yours': '你的声音',
  'autoEq.now.yoursWhy': '这首歌没有保存任何声音：播放你最后选择的声音。',
  'autoEq.now.song': '这首歌的声音',
  'autoEq.now.songWhy': '每次播放这首歌时都会恢复。',
  'autoEq.now.album': '{album} 的声音',
  'autoEq.now.albumUnnamed': '所在专辑的声音',
  'autoEq.now.albumWhy': '已在媒体库中为整张专辑设置。',
  'autoEq.songs.title': '歌曲声音',
  'autoEq.songs.hint':
    '保存了声音的歌曲会使用它。播放时修改，这首歌会保留修改。其他歌曲使用你的声音。',
  'autoEq.songs.nothing': '播放一首歌即可保存它的声音',
  'autoEq.songs.saved': '已为这首歌保存',
  'autoEq.songs.none': '这首歌没有保存任何声音',
  'autoEq.songs.save': '为这首歌保存',
  'autoEq.songs.forget': '忘记',
  'autoEq.albums.title': '专辑声音',
  'autoEq.albums.hint':
    '仅限媒体库。专辑中的每首歌都使用它，有自己预设的歌曲除外。',
  'autoEq.albums.nothing': '在媒体库中专辑的页面上设置专辑声音',
  'autoEq.albums.libraryOnly': '仅限媒体库：不适用于其他播放器',
  'autoEq.albums.set': '{album}：{preset}',
  'autoEq.albums.none': '这张专辑没有设置声音',
  'autoEq.smart.title': '智能校正',
  'autoEq.smart.hint':
    '从音源测量每首歌，并为这首歌保留其校正。叠加在任何预设之上。',
  'autoEq.smart.modes': '校正方式',
  'autoEq.smart.waiting': '等待歌曲',
  'autoEq.smart.willSave': '歌曲结束时为这首歌保存',
  'autoEq.smart.savesIn': '{remaining} 后为这首歌保存',
  'autoEq.smart.onceHint': '对正在播放的内容测量一次，立即应用',
  'autoEq.smart.once': '测量一次',
  'autoEq.savedCount': '已保存：{songs} · {albums}',
  'autoEq.manage': '管理',
  'autoEq.manage.title': '已保存的声音',
  'autoEq.manage.back': '返回自动均衡',
  'autoEq.manage.songs': '歌曲',
  'autoEq.manage.albums': '专辑',
  'autoEq.manage.search': '搜索已保存的声音',
  'autoEq.manage.wholeSound': '{preset}，含音色和 EQ',
  'autoEq.manage.forget': '忘记',
  'autoEq.manage.others': '来自其他播放器的歌曲：{count}',
  'autoEq.manage.othersHint': 'Spotify、YouTube 和浏览器。从不保留它们的名称。',
  'autoEq.manage.empty': '还没有保存任何内容',
  'autoEq.manage.noMatch': '没有匹配项',
  'autoEq.manage.resetKeeps':
    '“重置所有设置”会保留这些。只有“忘记”会删除它们。',
  'autoEq.manage.forgetAll': '全部忘记',
  'autoEq.manage.forgetAllConfirm': '永久全部忘记',
  'autoEq.moved.title': '每首歌的声音现在位于自动均衡中',
  'autoEq.moved.body':
    '“记住每首歌的声音”已移到 EQ 页面的自动均衡中。你保存的 {count} 首歌也一并迁移了。',
  'autoEq.moved.bodyOne':
    '“记住每首歌的声音”已移到 EQ 页面的自动均衡中。你保存的歌曲也一并迁移了。',
  'autoEq.moved.open': '打开自动均衡',
  'autoEq.moved.dismiss': '知道了',
};
