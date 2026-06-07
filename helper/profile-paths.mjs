const supportedProfiles = new Set(['codex']);

export function buildProfilePathPlan(options = {}) {
  const profile = options.profile ?? 'codex';
  if (!supportedProfiles.has(profile)) {
    throw new Error(`Unsupported profile: ${profile}`);
  }

  const platform = options.platform ?? process.platform;
  if (platform === 'win32') return windowsCodexPlan(options);
  return macosCodexPlan(options, platform);
}

export function profilePathPlanToText(plan) {
  const lines = [
    'Codex profile path plan',
    `Profile: ${plan.profile}`,
    `Platform: ${plan.platform}`,
    `Status: ${plan.status}`,
    '',
    'Sources:',
  ];

  for (const source of plan.sources) {
    lines.push(`  ${source.sourcePath} -> ${source.archivePath}`);
  }

  if (plan.notes.length > 0) {
    lines.push('', 'Notes:');
    for (const note of plan.notes) lines.push(`  - ${note}`);
  }

  return `${lines.join('\n')}\n`;
}

function macosCodexPlan(options, platform) {
  const homeDir = normalizePath(options.homeDir ?? process.env.HOME ?? '~');
  return {
    notes: ['macOS profile matches the current 0.26.x backup behavior.'],
    platform,
    profile: 'codex',
    sources: [
      source(`${homeDir}/.codex`, 'home/.codex'),
      source(`${homeDir}/Library/Application Support/Codex`, 'Library/Application Support/Codex'),
      source(`${homeDir}/Library/Application Support/OpenAI`, 'Library/Application Support/OpenAI'),
      source(`${homeDir}/Library/Application Support/OpenAI/Codex`, 'Library/Application Support/OpenAI/Codex'),
      source(`${homeDir}/Library/Application Support/com.openai.codex`, 'Library/Application Support/com.openai.codex'),
      source(`${homeDir}/Documents/Codex`, 'Documents/Codex'),
    ],
    status: platform === 'darwin' ? 'supported' : 'planned',
  };
}

function windowsCodexPlan(options) {
  const homeDir = normalizePath(options.homeDir ?? process.env.USERPROFILE ?? 'C:/Users/<user>');
  const appDataDir = normalizePath(options.appDataDir ?? process.env.APPDATA ?? `${homeDir}/AppData/Roaming`);
  const localAppDataDir = normalizePath(options.localAppDataDir ?? process.env.LOCALAPPDATA ?? `${homeDir}/AppData/Local`);
  const documentsDir = normalizePath(options.documentsDir ?? `${homeDir}/Documents`);

  return {
    notes: [
      'Windows support is planned and path discovery is not release-ready yet.',
      'This plan is for validation and documentation before Windows backup execution is enabled.',
    ],
    platform: 'win32',
    profile: 'codex',
    sources: [
      source(`${homeDir}/.codex`, 'home/.codex'),
      source(`${appDataDir}/Codex`, 'AppData/Roaming/Codex'),
      source(`${appDataDir}/OpenAI`, 'AppData/Roaming/OpenAI'),
      source(`${appDataDir}/OpenAI/Codex`, 'AppData/Roaming/OpenAI/Codex'),
      source(`${localAppDataDir}/Codex`, 'AppData/Local/Codex'),
      source(`${documentsDir}/Codex`, 'Documents/Codex'),
    ],
    status: 'planned',
  };
}

function normalizePath(value) {
  return String(value).replace(/\\/g, '/').replace(/\/+$/g, '');
}

function source(sourcePath, archivePath) {
  return { archivePath, sourcePath };
}
