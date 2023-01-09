const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const isSemver = require('is-semver');

const {
  getDownloadObject,
  getLatestVersion,
  setUpAuth,
} = require('./lib/utils');

async function setup() {
  try {
    // Get version of tool to be installed
    let version = core.getInput('version');
    const privateKey = core.getInput('api_private_key');
    const publicKey = core.getInput('api_public_key');

    if (!version || version === 'latest') {
      version = await getLatestVersion();
    }

    if (!isSemver(version)) {
      throw new Error(`Invalid version: ${version}`);
    }

    // Remove leading 'v' if present
    if (version.startsWith('v')) {
      version = version.slice(1);
    }

    // Download the specific version of the tool, e.g. as a tarball/zipball
    const download = getDownloadObject(version);
    core.info(`Downloading ${download.url}`);

    const pathToTarball = await tc.downloadTool(download.url);
    core.info(`Downloaded to ${pathToTarball}`);

    // Extract the tarball/zipball onto host runner
    const extract = download.url.endsWith('.zip')
      ? tc.extractZip
      : tc.extractTar;
    const pathToCLI = await extract(pathToTarball);

    core.info(`Add ${pathToCLI} to PATH`);
    // Expose the tool by adding it to the PATH
    core.addPath(pathToCLI);

    await setUpAuth(publicKey, privateKey);
  } catch (e) {
    core.setFailed(e);
  }
}

module.exports = setup;

if (require.main === module) {
  setup();
}
