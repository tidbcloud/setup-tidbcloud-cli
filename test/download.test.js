const assert = require('assert');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const process = require('process');
const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const {
  DEFAULT_VERSION,
  getDownloadObject,
  verifyArchive,
} = require('../lib/utils');
const setup = require('../index');

async function main() {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'ticloud-download-test-'),
  );
  const archive = path.join(dir, 'archive');
  const gzip = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const digest = (data) =>
    crypto.createHash('sha256').update(data).digest('hex');
  const original = {
    getInput: core.getInput,
    setSecret: core.setSecret,
    setFailed: core.setFailed,
    info: core.info,
    addPath: core.addPath,
    downloadTool: tc.downloadTool,
    extractTar: tc.extractTar,
    extractZip: tc.extractZip,
  };
  try {
    await fs.writeFile(archive, gzip);
    await verifyArchive(archive, digest(gzip), 'tar.gz');
    await assert.rejects(
      verifyArchive(archive, digest(zip), 'tar.gz'),
      /SHA-256 mismatch/,
    );
    await assert.rejects(
      verifyArchive(archive, digest(gzip), 'zip'),
      /unexpected format/,
    );
    await fs.writeFile(archive, zip);
    await verifyArchive(archive, digest(zip), 'zip');
    assert.throws(
      () => getDownloadObject('0.1.6'),
      /SHA-256 digest is required/,
    );
    assert.strictEqual(
      getDownloadObject('0.1.6', digest(zip)).digest,
      digest(zip),
    );
    assert.throws(
      () => getDownloadObject(DEFAULT_VERSION, 'bad'),
      /SHA-256 digest is required/,
    );

    let failure;
    let extracted = false;
    let added = false;
    core.getInput = (name) =>
      ({ version: '0.1.6', sha256: digest(gzip) })[name] || '';
    core.setSecret = () => {};
    core.setFailed = (error) => {
      failure = error;
    };
    core.info = () => {};
    core.addPath = () => {
      added = true;
    };
    tc.downloadTool = async () => archive;
    tc.extractTar = async () => {
      extracted = true;
    };
    tc.extractZip = async () => {
      extracted = true;
    };
    await setup();
    assert.match(failure.message, /SHA-256 mismatch/);
    assert.strictEqual(extracted, false);
    assert.strictEqual(added, false);

    // Even with a matching hash, an archive for the wrong platform format
    // must not be extracted or added to PATH.
    failure = undefined;
    core.getInput = (name) =>
      ({ version: '0.1.6', sha256: digest(zip) })[name] || '';
    if (os.platform() !== 'win32') {
      await setup();
      assert.match(failure.message, /unexpected format/);
      assert.strictEqual(extracted, false);
      assert.strictEqual(added, false);
    }

    let downloaded = false;
    failure = undefined;
    core.getInput = (name) => ({ version: '0.1.6' })[name] || '';
    tc.downloadTool = async () => {
      downloaded = true;
      return archive;
    };
    await setup();
    assert.match(failure.message, /SHA-256 digest is required/);
    assert.strictEqual(downloaded, false);
    assert.strictEqual(extracted, false);
    assert.strictEqual(added, false);
  } finally {
    Object.assign(core, {
      getInput: original.getInput,
      setSecret: original.setSecret,
      setFailed: original.setFailed,
      info: original.info,
      addPath: original.addPath,
    });
    Object.assign(tc, {
      downloadTool: original.downloadTool,
      extractTar: original.extractTar,
      extractZip: original.extractZip,
    });
    await fs.rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
