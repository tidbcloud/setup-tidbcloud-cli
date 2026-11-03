const os = require('os');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const core = require('@actions/core');
const http = require('@actions/http-client');
const exec = require('@actions/exec');

async function getLatestVersion() {
  const client = new http.HttpClient('tidbcloud-cli-action');
  const url =
    'https://raw.githubusercontent.com/tidbcloud/tidbcloud-cli/main/latest-version';
  const response = await client.get(url);
  core.debug(`Response status code: ${response.message.statusCode}`);
  return response.readBody();
}

async function setUpAuth(publicKey, privateKey) {
  // Older ticloud versions require both flags, even when their values are empty.
  await exec.exec(
    'ticloud',
    [
      'config',
      'create',
      '--profile-name',
      'default',
      '--public-key',
      '',
      '--private-key',
      '',
    ],
    { silent: true },
  );

  const configPath = path.join(os.homedir(), '.ticloud', 'config.toml');
  const config = await fs.readFile(configPath, 'utf8');
  const section = config.match(/^\[default\][ \t]*$/m);
  if (!section) throw new Error('Could not find the default ticloud profile');

  const start = section.index + section[0].length;
  const remainder = config.slice(start);
  const nextSection = remainder.search(/^[ \t]*\[/m);
  const end = nextSection === -1 ? config.length : start + nextSection;
  let profile = config.slice(start, end);
  for (const [name, value] of [
    ['public-key', publicKey],
    ['private-key', privateKey],
  ]) {
    const entry = new RegExp(`^(${name}[ \\t]*=[ \\t]*)(?:""|'')[ \\t]*$`, 'm');
    if (!entry.test(profile)) {
      throw new Error(`Could not find empty ${name} in the ticloud profile`);
    }
    profile = profile.replace(
      entry,
      (_, prefix) => prefix + JSON.stringify(value),
    );
  }

  // Replace atomically so a failed write cannot corrupt an existing config.
  const temporaryPath = `${configPath}.${crypto.randomBytes(16).toString('hex')}.tmp`;
  try {
    await fs.writeFile(
      temporaryPath,
      config.slice(0, start) + profile + config.slice(end),
      { mode: 0o600, flag: 'wx' },
    );
    await fs.rename(temporaryPath, configPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

// arch in [x64...] (https://nodejs.org/api/os.html#os_os_arch)
// return value in [amd64]
function mapArch(arch) {
  const mappings = {
    x64: 'amd64',
  };
  return mappings[arch] || arch;
}

// os in [darwin, linux, win32...] (https://nodejs.org/api/os.html#os_os_platform)
// return value in [darwin, linux, windows]
function mapOS(osName) {
  const mappings = {
    win32: 'windows',
  };
  return mappings[osName] || osName;
}

function getDownloadObject(version) {
  const platform = os.platform();
  const filename = `ticloud_${version}_${mapOS(platform)}_${mapArch(
    os.arch(),
  )}`;
  const extension = platform === 'win32' ? 'zip' : 'tar.gz';
  const url = `https://github.com/tidbcloud/tidbcloud-cli/releases/download/v${version}/${filename}.${extension}`;
  return {
    url,
  };
}

module.exports = { getDownloadObject, getLatestVersion, setUpAuth };
