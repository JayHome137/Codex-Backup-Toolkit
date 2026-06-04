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
          output: `Restore is preview-only in the Web MVP.\n\nCommand:\n${command}`,
        };
      }

      if (command.includes('--doctor')) {
        return {
          status: 'success',
          output: 'codexbackup doctor\nTarget: local\nok: zsh available\nok: tar available\nok: rsync available\nok: shasum available\nDoctor passed.',
        };
      }

      if (command.includes('codexinstallautomation.sh validate')) {
        return {
          status: 'success',
          output: 'Validated launchd plist for label: dev.codexbackup.toolkit.test.local\nNo launchd job was loaded.',
        };
      }

      if (command.includes('codexbackup.sh')) {
        return {
          status: 'success',
          output: 'Codex backup\nTarget: local\nBackup written to:\n  $HOME/CodexBackups/codex-backup-mac-YYYYmmdd-HHMMSS.tar.gz',
        };
      }

      return {
        status: 'error',
        output: `Unknown command:\n${command}`,
      };
    },
  };
}
