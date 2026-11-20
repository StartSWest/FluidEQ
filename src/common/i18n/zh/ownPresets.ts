/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': '新建预设',
  'eq.own.newHint': '属于你自己的曲线和效果架',
  'eq.own.dialogHint':
    '一条用于主均衡的曲线和一个用于 DSP 页面的效果架，以你的名字保存。',
  'eq.own.name': '名称',
  'eq.own.defaultName': '我的预设',
  'eq.own.defaultFrom': '我的{name}',
  'eq.own.curveFrom': '曲线起点',
  'eq.own.curveFromHint': '接下来由你调整',
  'eq.own.fromPlaying': '{name}（正在播放）',
  'eq.own.flat': '平直',
  'eq.own.rackFrom': '效果架起点',
  'eq.own.rackOf': '{name}的效果架',
  'eq.own.rackNow': '当前 DSP 页面',
  'eq.own.rackEmpty': '空',
  'eq.own.create': '创建并调整曲线',
  'eq.own.editing': '正在编辑',
  'eq.own.parts': '预设组成',
  'eq.own.curve': '曲线',
  'eq.own.rack': '效果架',
  'eq.own.unsaved': '未保存',
  'eq.own.discard': '放弃',
  'eq.own.save': '保存预设',
  'eq.own.addBand': '添加频段',
  'eq.own.curveBands': '“{name}”曲线的频段',
  'eq.own.edit': '编辑',
  'eq.own.more': '“{name}”的更多操作',
  'eq.own.renameLabel': '“{name}”的新名称',
  'eq.own.about': '你自己的预设。曲线在主均衡中播放，效果架在 DSP 页面中播放。',
  'eq.own.deleteAsk':
    '删除“{name}”？它将从“我的”中移除。如果正在播放，它的曲线和效果架会停止。',
  'eq.own.keep': '保留',
  'eq.own.emptyTitle': '还没有你自己的预设',
  'eq.own.emptyHint':
    '“新建预设”会创建一个：用于主均衡的曲线和用于 DSP 页面的效果架。',
} as const;
