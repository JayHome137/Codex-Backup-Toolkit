import type { RestorePlanAction } from './actions';
import { targetLabels } from './config';

export type RestorePlanGuide = {
  needs: string[];
  riskNotes: string[];
  title: string;
  willDo: string[];
  willNotDo: string[];
};

export function buildRestorePlanGuide(action: RestorePlanAction): RestorePlanGuide {
  const encrypted = action.encrypted === true;
  const targetLabel = action.target ? targetLabels[action.target] : '当前';

  return {
    title: action.source === 'latest' ? '最新备份恢复预案' : '指定归档恢复预案',
    willDo: action.source === 'latest'
      ? [`从当前 ${action.target ?? '目标端'} 目标端选择最新备份并生成预案。`, '输出将展示预案命令和 helper 返回的检查信息。']
      : [`读取指定归档路径：${action.archivePath ?? '尚未填写归档路径'}`, '输出将展示指定归档的恢复预案。'],
    willNotDo: [
      '不会解压归档。',
      '不会覆盖、删除或移动本机文件。',
      '不会创建安全备份；安全备份只属于真实恢复阶段。',
      '不会安装、卸载或修改定时任务。',
    ],
    needs: [
      action.source === 'latest' ? '确认当前目标端配置仍指向要检查的备份位置。' : '确认归档路径来自可信的 helper 历史或手动选择。',
      encrypted ? '准备 age identity 文件，仅用于生成可读的恢复预案。' : '未勾选加密归档时，不会附加 age identity 参数。',
      `当前恢复预案上下文：${targetLabel}。`,
    ],
    riskNotes: [
      '这是只读预案，不代表已经完成真实恢复。',
      encrypted ? '没有 identity 时，加密归档只能生成有限预案或在后续真实恢复前补齐。' : '如果归档实际是加密文件，需要先切换为加密归档。',
      '真实恢复仍需离开本 GUI 的预案流程后另行确认。',
    ],
  };
}
