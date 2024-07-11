import * as core from '@actions/core';
import {Config, NodeSSH} from 'node-ssh';
import fsPath from 'path';
import {SFTPStream} from 'ssh2-streams';
import fs from 'fs';
import {keyboardFunction} from './keyboard';
import path from 'path';

function getBoolWithDefault(key: string, defaultVal: boolean): boolean {
  const val = core.getInput(key);
  if (val === '') {
    return defaultVal;
  }
  return !!val;
}

async function run() {
  const host: string = core.getInput('host') || 'localhost';
  const username: string = core.getInput('username');
  const port: number = +core.getInput('port') || 22;
  const privateKey: string = core.getInput('privateKey');
  const password: string = core.getInput('password');
  const passphrase: string = core.getInput('passphrase');
  const tryKeyboard: boolean = !!core.getInput('tryKeyboard');
  const verbose: boolean = getBoolWithDefault('verbose', true);
  const recursive: boolean = getBoolWithDefault('recursive', true);
  const concurrency: number = +core.getInput('concurrency') || 1;
  const local: string = core.getInput('local');
  const dotfiles: boolean = getBoolWithDefault('dotfiles', true);
  const remote: string = core.getInput('remote');
  const rmRemote: boolean = getBoolWithDefault('rmRemote', false);
  const atomicPut: string = core.getInput('atomicPut');

  if (atomicPut) {
    // patch SFTPStream to atomically rename files
    const originalFastPut = SFTPStream.prototype.fastPut;
    SFTPStream.prototype.fastPut = function (localPath, remotePath, opts, cb) {
      const parsedPath = path.posix.parse(remotePath);
      parsedPath.base = '.' + parsedPath.base;
      const tmpRemotePath = path.posix.format(parsedPath);
      const that = this;
      originalFastPut.apply(this, [
        localPath,
        tmpRemotePath,
        opts,
        function (error, result) {
          if (error) {
            cb(error, result);
          } else {
            that.ext_openssh_rename(tmpRemotePath, remotePath, cb);
          }
        }
      ]);
    };
  }

  try {
    const ssh = await connect(
      host,
      username,
      port,
      privateKey,
      password,
      passphrase,
      tryKeyboard
    );

    await scp(
      ssh,
      local,
      remote,
      dotfiles,
      concurrency,
      verbose,
      recursive,
      rmRemote
    );

    ssh.dispose();
  } catch (err) {
    core.setFailed(err);
  }
}

async function connect(
  host = 'localhost',
  username: string,
  port = 22,
  privateKey: string,
  password: string,
  passphrase: string,
  tryKeyboard: boolean
) {
  const ssh = new NodeSSH();
  console.log(`Establishing a SSH connection to ${host}.`);

  try {
    const config: Config = {
      host: host,
      port: port,
      username: username,
      password: password,
      passphrase: passphrase,
      tryKeyboard: tryKeyboard,
      onKeyboardInteractive: tryKeyboard ? keyboardFunction(password) : null
    };
    if (privateKey) {
      console.log('using provided private key');
      config.privateKey = privateKey;
    }
    await ssh.connect(config);
    console.log(`🤝 Connected to ${host}.`);
  } catch (err) {
    console.error(`⚠️ The GitHub Action couldn't connect to ${host}.`, err);
    core.setFailed(err.message);
  }

  return ssh;
}

async function scp(
  ssh: NodeSSH,
  local: string,
  remote: string,
  dotfiles = false,
  concurrency: number,
  verbose = true,
  recursive = true,
  rmRemote = false
) {
  console.log(`Starting scp Action: ${local} to ${remote}`);

  try {
    if (isDirectory(local)) {
      if (rmRemote) {
        await cleanDirectory(ssh, remote);
      }
      await putDirectory(
        ssh,
        local,
        remote,
        dotfiles,
        concurrency,
        verbose,
        recursive
      );
    } else {
      await putFile(ssh, local, remote, verbose);
    }
    ssh.dispose();
    console.log('✅ scp Action finished.');
  } catch (err) {
    console.error(`⚠️ An error happened:(.`, err.message, err.stack);
    ssh.dispose();
    process.abort();
    core.setFailed(err.message);
  }
}
async function putDirectory(
  ssh: NodeSSH,
  local: string,
  remote: string,
  dotfiles = false,
  concurrency = 3,
  verbose = false,
  recursive = true
) {
  const failed: {local: string; remote: string}[] = [];
  const successful = [];
  const status = await ssh.putDirectory(local, remote, {
    recursive: recursive,
    concurrency: concurrency,
    validate: (path: string) =>
      !fsPath.basename(path).startsWith('.') || dotfiles,
    tick: function (localPath, remotePath, error) {
      if (error) {
        if (verbose) {
          console.log(`❕copy failed for ${localPath}.`);
        }
        failed.push({local: localPath, remote: remotePath});
      } else {
        if (verbose) {
          console.log(`✔ successfully copied ${localPath}.`);
        }
        successful.push({local: localPath, remote: remotePath});
      }
    }
  });

  console.log(
    `The copy of directory ${local} was ${
      status ? 'successful' : 'unsuccessful'
    }.`
  );

  if (failed.length > 0) {
    console.log('failed transfers', failed.join(', '));
    await putMany(failed, async failed => {
      console.log(`Retrying to copy ${failed.local} to ${failed.remote}.`);
      await putFile(ssh, failed.local, failed.remote, true);
    });
  }
}

async function cleanDirectory(ssh: NodeSSH, remote: string, verbose = true) {
  try {
    await ssh.execCommand(`rm -rf ${remote}/*`);
    if (verbose) {
      console.log(`✔ Successfully deleted all files of ${remote}.`);
    }
  } catch (error) {
    console.error(`⚠️ An error happened:(.`, error.message, error.stack);
    ssh.dispose();
    core.setFailed(error.message);

  }
}

async function putFile(
  ssh: NodeSSH,
  local: string,
  remote: string,
  verbose = true
) {
  try {
    await ssh.putFile(local, remote);
    if (verbose) {
      console.log(`✔ Successfully copied file ${local} to remote ${remote}.`);
    }
  } catch (error) {
    console.error(`⚠️ An error happened:(.`, error.message, error.stack);
    ssh.dispose();
    core.setFailed(error.message);
  }
}

function isDirectory(path: string) {
  return fs.existsSync(path) && fs.lstatSync(path).isDirectory();
}

async function putMany<T>(
  array: T[],
  asyncFunction: (item: T) => Promise<any>
) {
  for (const el of array) {
    await asyncFunction(el);
  }
}

process.on('uncaughtException', (err) => {
  if (err['code'] !== 'ECONNRESET')
    throw err
})

run();
