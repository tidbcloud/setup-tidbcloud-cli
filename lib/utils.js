const os = require('os');
const core = require('@actions/core');
const http = require('@actions/http-client');
const exec = require('@actions/exec');

async function getLatestVersion() {
  const client = new http.HttpClient('tidbcloud-cli-action');
  const url =
    'https://raw.githubusercontent.com/tidbcloud/tidbcloud-cli/main/latest-version';
  const response = await client.get(url);
  core.debug(
    `Response status code: ${
      response.message.statusCode
    }, body: ${response.readBody()}`,
  );
  return response.readBody();
}

async function setUpAuth(publicKey, privateKey) {
  await exec.exec('ticloud', [
    'config',
    'create',
    '--profile-name',
    'default',
    '--public-key',
    publicKey,
    '--private-key',
    privateKey,
  ]);
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
