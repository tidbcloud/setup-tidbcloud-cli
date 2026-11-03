const os = require('os');
const fs = require('fs/promises');
const { createReadStream } = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const exec = require('@actions/exec');

// Update these reviewed digests when changing the default CLI release.
const DEFAULT_VERSION = '1.0.0-beta.11';
const DEFAULT_DIGESTS = {
  'darwin-amd64':
    'c7619b34001ec99105f86d24b95f0d21b8edaf3dae858697314e0db5d5937200',
  'darwin-arm64':
    '9c6a9ecf0ed73fb15fb99b1e2459be6455df9ce2f4962f8aa3cde47ba1ff62b6',
  'linux-amd64':
    'af88a50ee088d3d9c95873ff3a7c166f4c554cb0e6d1900220e7ef0e97a5f439',
  'linux-arm64':
    'af69d9a98721f7051523eb4d1d11cc93c5cf45303f8a54e07c63239daaf9c12e',
  'windows-amd64':
    'b994419be1e9cc2700a34dcae41aa3360c76fce37ce0f278b2a75dcbcbc472d9',
};

async function verifyArchive(file, expectedDigest, format) {
  if (!/^[a-f0-9]{64}$/i.test(expectedDigest)) {
    throw new Error(
      'A valid SHA-256 digest is required for this CLI version and platform',
    );
  }
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== expectedDigest.toLowerCase()) {
    throw new Error('CLI archive SHA-256 mismatch');
  }

  const handle = await fs.open(file, 'r');
  try {
    const header = Buffer.alloc(4);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const valid =
      format === 'zip'
        ? bytesRead === 4 &&
          header.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
        : bytesRead >= 2 && header[0] === 0x1f && header[1] === 0x8b;
    if (!valid) throw new Error('CLI archive has an unexpected format');
  } finally {
    await handle.close();
  }
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

function getDownloadObject(version, expectedDigest = '') {
  const platform = mapOS(os.platform());
  const arch = mapArch(os.arch());
  const format = platform === 'windows' ? 'zip' : 'tar.gz';
  const filename = `ticloud_${version}_${platform}_${arch}.${format}`;
  const digest =
    expectedDigest ||
    (version === DEFAULT_VERSION && DEFAULT_DIGESTS[`${platform}-${arch}`]);
  if (!digest || !/^[a-f0-9]{64}$/i.test(digest)) {
    throw new Error(
      'A valid SHA-256 digest is required for this CLI version and platform',
    );
  }
  return {
    url: `https://github.com/tidbcloud/tidbcloud-cli/releases/download/v${version}/${filename}`,
    digest,
    format,
  };
}

module.exports = {
  DEFAULT_VERSION,
  getDownloadObject,
  setUpAuth,
  verifyArchive,
};
