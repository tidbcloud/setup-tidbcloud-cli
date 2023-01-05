const os = require('os');
const http = require('@actions/http-client');
const exec = require('@actions/exec');

async function getLatestVersion() {
  const client = new http.HttpClient('Action setup-tidbcloud-cli');
  const res = await client.get(
    'https://api.github.com/repos/tidbcloud/tidbcloud-cli/releases/latest',
  );
  const body = await res.readBody();
  const versionJson = JSON.parse(body);
  return versionJson.tag_name;
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
