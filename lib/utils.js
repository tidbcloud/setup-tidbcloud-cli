const os = require('os');
const path = require('path');
const github = require('@actions/github');
const exec = require('@actions/exec');

async function getLatestVersion() {
  const octokit = github.getOctokit();
  const { data: versionRes } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
    owner: 'tidbcloud',
    repo: 'tidbcloud-cli',
  });
  const versionJson = JSON.parse(versionRes);
  return versionJson.tag_name;
}

async function setUpAuth(publicKey, privateKey) {
  await exec.exec('ticloud', ['config', 'create', '--profile-name', 'default', '--public-key', publicKey, '--private-key', privateKey]);
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
  const filename = `ticloud_${version}_${mapOS(platform)}_${mapArch(os.arch())}`;
  const extension = platform === 'win32' ? 'zip' : 'tar.gz';
  const binPath = platform === 'win32' ? 'bin' : path.join(filename, 'bin');
  const url = `https://github.com/tidbcloud/tidbcloud-cli/releases/download/v${version}/${filename}.${extension}`;
  return {
    url,
    binPath,
  };
}

module.exports = { getDownloadObject, getLatestVersion, setUpAuth };
