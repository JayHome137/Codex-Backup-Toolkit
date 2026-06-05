export type CommandStatus = 'success' | 'warning' | 'error';

export type CommandResult = {
  status: CommandStatus;
  output: string;
};

export type CommandRunner = {
  run(command: string): Promise<CommandResult>;
};

export function createMockCommandRunner(): CommandRunner {
  return {
    async run(command: string): Promise<CommandResult> {
      if (command.includes('codexrestore.sh')) {
        return {
          status: 'warning',
          output: `恢复在网页版预览版中仅支持预览。\n\n命令：\n${command}`,
        };
      }

      if (command.includes('--doctor')) {
        return {
          status: 'success',
          output: 'codexbackup doctor\n目标端：local\nok: zsh 可用\nok: tar 可用\nok: rsync 可用\nok: shasum 可用\n环境检查通过。',
        };
      }

      if (command.includes('codexinstallautomation.sh validate')) {
        return {
          status: 'success',
          output: '已校验 launchd plist，label：dev.codexbackup.toolkit.test.local\n没有加载任何 launchd 任务。',
        };
      }

      if (command.includes('codexbackup.sh')) {
        return {
          status: 'success',
          output: 'Codex 备份\n目标端：local\n备份写入位置：\n  $HOME/CodexBackups/codex-backup-mac-YYYYmmdd-HHMMSS.tar.gz',
        };
      }

      return {
        status: 'error',
        output: `未知命令：\n${command}`,
      };
    },
  };
}
