const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const isSemver = require('is-semver');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const {
  DEFAULT_VERSION,
  getDownloadObject,
  setUpAuth,
  verifyArchive,
} = require('./lib/utils');

async function setup() {
  try {
    // Get version of tool to be installed
    let version = core.getInput('version');
    const privateKey = core.getInput('api_private_key');
    if (privateKey) core.setSecret(privateKey);
    const publicKey = core.getInput('api_public_key');
    if (publicKey) core.setSecret(publicKey);

    if (!version || version === 'latest') {
      version = DEFAULT_VERSION;
    }

    if (!isSemver(version)) {
      throw new Error(`Invalid version: ${version}`);
    }

    // Remove leading 'v' if present
    if (version.startsWith('v')) {
      version = version.slice(1);
    }

    // Download the specific version of the tool, e.g. as a tarball/zipball
    const download = getDownloadObject(version, core.getInput('sha256'));
    core.info(`Downloading ${download.url}`);

    const pathToTarball = await tc.downloadTool(download.url);
    await verifyArchive(pathToTarball, download.digest, download.format);
    core.info('CLI archive verified');

    const extract = download.format === 'zip' ? tc.extractZip : tc.extractTar;
    const extracted = await extract(pathToTarball);
    const binaryName = os.platform() === 'win32' ? 'ticloud.exe' : 'ticloud';
    const installDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ticloud-action-'),
    );
    const binary = path.join(installDir, binaryName);
    await fs.copyFile(path.join(extracted, binaryName), binary);
    if (os.platform() !== 'win32') await fs.chmod(binary, 0o755);

    core.addPath(installDir);
    await setUpAuth(publicKey, privateKey);
  } catch (e) {
    core.setFailed(e);
  }
}

module.exports = setup;

if (require.main === module) {
  setup();
}
