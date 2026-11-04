const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const process = require('process');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const exec = require('@actions/exec');
const setup = require('../index');

async function main() {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), 'ticloud-cleanup-test-'),
  );
  const originalTemp = process.env.RUNNER_TEMP;
  const originalHome = os.homedir;
  const originals = [core, tc, exec].map((object) => ({ ...object }));
  const persistentHome = path.join(temporary, 'persistent');
  const archive = path.join(temporary, 'archive');
  const data = Buffer.from(
    os.platform() === 'win32' ? [0x50, 0x4b, 3, 4] : [0x1f, 0x8b, 8, 0],
  );
  let directory;
  let added;
  let failure;
  let failAuth = false;
  try {
    process.env.RUNNER_TEMP = temporary;
    os.homedir = () => persistentHome;
    await fs.mkdir(persistentHome);
    await fs.writeFile(archive, data);
    core.getInput = (name) =>
      ({
        version: '0.1.6',
        sha256: crypto.createHash('sha256').update(data).digest('hex'),
        api_public_key: 'public',
        api_private_key: 'private',
      })[name] || '';
    core.setSecret = () => {};
    core.info = () => {};
    core.saveState = (name, value) => {
      assert.strictEqual(name, 'directory');
      directory = value;
    };
    core.getState = () => directory;
    core.addPath = (value) => {
      added = value;
    };
    core.setFailed = (error) => {
      failure = error;
    };
    tc.downloadTool = async () => archive;
    const extract = async () => {
      const extracted = path.join(temporary, 'extracted');
      await fs.mkdir(extracted, { recursive: true });
      // A harmless fake CLI exercises the launcher without network or credentials.
      await fs.writeFile(
        path.join(
          extracted,
          os.platform() === 'win32' ? 'ticloud.exe' : 'ticloud',
        ),
        '#!/bin/sh\ncat "$HOME/.ticloud/config.toml"\n',
      );
      return extracted;
    };
    tc.extractTar = extract;
    tc.extractZip = extract;
    exec.exec = async (binary, args, options) => {
      assert.strictEqual(options.env.HOME, path.join(directory, 'home'));
      assert.strictEqual(options.env.USERPROFILE, options.env.HOME);
      assert(!args.includes('private'));
      assert.strictEqual(
        binary,
        path.join(
          directory,
          'bin',
          os.platform() === 'win32' ? 'ticloud.exe' : 'ticloud',
        ),
      );
      assert(directory.startsWith(`${temporary}${path.sep}`));
      if (failAuth) throw new Error('authentication setup failed');
      const config = path.join(options.env.HOME, '.ticloud');
      await fs.mkdir(config);
      await fs.writeFile(
        path.join(config, 'config.toml'),
        "[default]\npublic-key = ''\nprivate-key = ''\n",
      );
    };
    await setup();
    assert.strictEqual(failure, undefined);
    assert.strictEqual(added, directory);
    assert(
      (
        await fs.readFile(
          path.join(directory, 'home/.ticloud/config.toml'),
          'utf8',
        )
      ).includes('private-key = "private"'),
    );
    assert.deepStrictEqual(await fs.readdir(persistentHome), []);
    if (os.platform() !== 'win32') {
      const result = await originals[2].getExecOutput(
        path.join(directory, 'ticloud'),
        [],
        { silent: true },
      );
      assert(result.stdout.includes('private-key = "private"'));
    }
    await setup.cleanup();
    await assert.rejects(fs.stat(directory), { code: 'ENOENT' });
    await setup.cleanup(); // Cleanup is safe to repeat.
    // A post step after an early setup failure must not run setup again.
    const post = await originals[2].getExecOutput(
      process.execPath,
      [require.resolve('../index')],
      {
        silent: true,
        env: { ...process.env, STATE_isPost: 'true', STATE_directory: '' },
      },
    );
    assert.strictEqual(post.exitCode, 0);
    assert.strictEqual(post.stdout, '');
    failAuth = true;
    added = undefined;
    await setup();
    assert.match(failure.message, /authentication setup failed/);
    assert.strictEqual(added, undefined);
    await assert.rejects(fs.stat(directory), { code: 'ENOENT' });
    assert.deepStrictEqual(await fs.readdir(persistentHome), []);
  } finally {
    [core, tc, exec].forEach((object, index) => {
      for (const [key, value] of Object.entries(originals[index])) {
        if (Object.getOwnPropertyDescriptor(object, key).writable)
          object[key] = value;
      }
    });
    os.homedir = originalHome;
    if (originalTemp === undefined) delete process.env.RUNNER_TEMP;
    else process.env.RUNNER_TEMP = originalTemp;
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
