const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const process = require('process');
const core = require('@actions/core');
const exec = require('@actions/exec');
const { setUpAuth } = require('../lib/utils');
const setup = require('../index');

async function main() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ticloud-action-test-'));
  const originalHome = os.homedir;
  const originalExec = exec.exec;
  const originalInput = core.getInput;
  const originalSecret = core.setSecret;
  const originalFailed = core.setFailed;
  const configPath = path.join(home, '.ticloud', 'config.toml');
  const events = [];
  try {
    os.homedir = () => home;
    await fs.mkdir(path.dirname(configPath));
    exec.exec = async (command, args, options) => {
      assert.strictEqual(command, '/test/ticloud');
      assert.strictEqual(options.env.HOME, home);
      assert.strictEqual(options.env.USERPROFILE, home);
      assert.deepStrictEqual(args, [
        'config',
        'create',
        '--profile-name',
        'default',
        '--public-key',
        '',
        '--private-key',
        '',
      ]);
      assert.strictEqual(options.silent, true);
      await fs.writeFile(
        configPath,
        "current-profile = 'default'\n\n[default]\nprivate-key = ''\npublic-key = ''\n\n[other]\nprivate-key = 'preserved'\n",
      );
    };
    await setUpAuth('public"key', 'private\\key', home, '/test/ticloud');
    const config = await fs.readFile(configPath, 'utf8');
    assert(config.includes('public-key = "public\\"key"'));
    assert(config.includes('private-key = "private\\\\key"'));
    assert(config.includes("[other]\nprivate-key = 'preserved'"));
    if (process.platform !== 'win32') {
      assert.strictEqual((await fs.stat(configPath)).mode & 0o777, 0o600);
    }

    const malformed = "[default]\nprivate-key = 'not-empty'\npublic-key = ''\n";
    exec.exec = async () => fs.writeFile(configPath, malformed);
    await assert.rejects(
      setUpAuth('public', 'private', home, '/test/ticloud'),
      /empty private-key/,
    );
    assert.strictEqual(await fs.readFile(configPath, 'utf8'), malformed);

    core.getInput = (name) => {
      events.push(`get:${name}`);
      return {
        version: 'invalid',
        api_private_key: 'private',
        api_public_key: 'public',
      }[name];
    };
    core.setSecret = (value) => events.push(`mask:${value}`);
    core.setFailed = () => events.push('failed');
    await setup();
    assert.deepStrictEqual(events, [
      'get:version',
      'get:api_private_key',
      'mask:private',
      'get:api_public_key',
      'mask:public',
      'failed',
    ]);
  } finally {
    os.homedir = originalHome;
    exec.exec = originalExec;
    core.getInput = originalInput;
    core.setSecret = originalSecret;
    core.setFailed = originalFailed;
    await fs.rm(home, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
