const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const isSemver = require('is-semver');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const process = require('process');

const {
  DEFAULT_VERSION,
  getDownloadObject,
  setUpAuth,
  verifyArchive,
} = require('./lib/utils');

async function cleanup() {
  const directory = core.getState('directory');
  if (directory) await fs.rm(directory, { recursive: true, force: true });
}

async function setup() {
  let installDir;
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
    if (!process.env.RUNNER_TEMP) throw new Error('RUNNER_TEMP is required');
    installDir = await fs.mkdtemp(
      path.join(process.env.RUNNER_TEMP, 'ticloud-action-'),
    );
    core.saveState('directory', installDir);
    const home = path.join(installDir, 'home');
    await fs.mkdir(home, { mode: 0o700 });
    await fs.mkdir(path.join(installDir, 'bin'));
    const binary = path.join(installDir, 'bin', binaryName);
    await fs.copyFile(path.join(extracted, binaryName), binary);
    if (os.platform() !== 'win32') await fs.chmod(binary, 0o755);

    await setUpAuth(publicKey, privateKey, home, binary);
    // Scope HOME to the CLI process so other tools keep their original HOME.
    const launcher = os.platform() === 'win32' ? 'ticloud.cmd' : 'ticloud';
    const script =
      os.platform() === 'win32'
        ? '@echo off\r\nsetlocal\r\nset "HOME=%~dp0home"\r\nset "USERPROFILE=%~dp0home"\r\n"%~dp0bin\\ticloud.exe" %*\r\nexit /b %errorlevel%\r\n'
        : '#!/bin/sh\nTICLOUD_ACTION_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit 1\nexport HOME="$TICLOUD_ACTION_DIR/home"\nexec "$TICLOUD_ACTION_DIR/bin/ticloud" "$@"\n';
    await fs.writeFile(path.join(installDir, launcher), script, {
      mode: 0o700,
    });
    core.addPath(installDir);
  } catch (e) {
    if (installDir) await fs.rm(installDir, { recursive: true, force: true });
    core.setFailed(e);
  }
}

module.exports = setup;
module.exports.cleanup = cleanup;

if (require.main === module) {
  const isPost = core.getState('isPost') === 'true';
  if (!isPost) core.saveState('isPost', 'true');
  const run = isPost ? cleanup : setup;
  run().catch((error) => core.setFailed(error));
}
