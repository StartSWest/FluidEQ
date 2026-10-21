/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const announce = {
  'announce.eyebrow': '“可视化”新增 · {count} 个场景',
  'announce.try': '立即试用',
  'announce.later': '稍后',
  'announce.previewNote': '预览。没有发送任何内容，也没有记录任何内容。',
  'announce.untitled': '新场景',
  'announce.tab': '公告',
  'announce.pageHint':
    '每个人只会看到一次公告，以大尺寸显示在他们打开的任何内容之上。免费体验将在两天内结束的会员，还会看到一行关于保留 Plus 的提示。',
  'announce.field.title': '标题',
  'announce.field.titlePlaceholder': '例如：夜间驾驶',
  'announce.field.body': '内容简介',
  'announce.field.bodyPlaceholder':
    '例如：六个新的城市夜景场景，随你的低音和高音而动。',
  'announce.field.scenes': '包含的场景：{count} / {most}。第一个是大画面。',
  'announce.field.noScenes':
    'FluidEQ 的场景还没有加载。请先打开一次“可视化”，然后再回来。',
  'announce.field.when': '发布时间',
  'announce.field.audience': '谁能看到',
  'announce.audience.everyone': '所有已登录的人',
  'announce.audience.everyoneLine':
    'Plus 会员、免费体验用户和免费账户。免费账户会被引导到“可视化”去试用这些场景。',
  'announce.audience.members': 'Plus 会员和免费体验用户',
  'announce.audience.membersLine': '所有现在就能播放这些场景的人。',
  'announce.audience.trialEnding': '仅限 2 天内结束的免费体验',
  'announce.audience.trialEndingLine': '即将决定是否付费的会员。',
  'announce.trials.dayAfter': '次日 {date}，有 {count} 个免费体验结束。',
  'announce.trials.twoAfter': '再下一天还有 {count} 个。',
  'announce.preview': '预览',
  'announce.schedule': '安排发布',
  'announce.saveChanges': '保存更改',
  'announce.stopEditing': '停止编辑',
  'announce.done': '已安排。将于 {date} 发布。',
  'announce.listTitle': '已安排和正在显示',
  'announce.listEmpty': '没有安排任何公告。',
  'announce.state.out': '正在显示',
  'announce.state.later': '已安排',
  'announce.edit': '编辑',
  'announce.cancel': '取消',
  'announce.cancelAsk': '取消这条公告？',
  'announce.cancelOut': '不再向还没看过的人显示它？',
  'announce.keep': '保留',
} as const;

export default announce;
