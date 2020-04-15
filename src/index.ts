import * as core from '@actions/core';
import node_ssh from 'node-ssh';
import fs from "fs";
import {keyboardFunction} from './keyboard';

async function run() {
  const host: string = core.getInput('host') || 'localhost';
  const username: string = core.getInput('username');
  const port: number = +core.getInput('port') || 22;
  const privateKey: string = core.getInput('privateKey');
  const password: string = core.getInput('password');
  const passphrase: string = core.getInput('passphrase');
  const tryKeyboard: boolean = !!core.getInput('tryKeyboard');
  const verbose: boolean = !!core.getInput('verbose') || true;
  const recursive: boolean = !!core.getInput('recursive') || true;
  const concurrency: number = +core.getInput('concurrency') || 1;
  const local: string = core.getInput('local');
  const remote: string = core.getInput('remote');

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
    await scp(ssh, local, remote, concurrency, verbose, recursive);

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
  const ssh = new node_ssh();
  console.log(`Establishing a SSH connection to ${host}.`);

  try {
    await ssh.connect({
      host: host,
      port: port,
      username: username,
      password: password,
      passphrase: passphrase,
      privateKey: privateKey,
      tryKeyboard: tryKeyboard,
      onKeyboardInteractive: tryKeyboard ? keyboardFunction(password) : null
    });
    console.log(`🤝 Connected to ${host}.`);
  } catch (err) {
    console.error(`⚠️ The GitHub Action couldn't connect to ${host}.`, err);
    core.setFailed(err.message);
  }

  return ssh;
}

async function scp(
  ssh: node_ssh,
  local: string,
  remote: string,
  concurrency: number,
  verbose = true,
  recursive = true
) {
  console.log(`Starting scp Action: ${local} to ${remote}`);

  try {
    if (isDirectory(local)) {
      await putDirectory(ssh, local, remote, concurrency, verbose, recursive);
    } else {
      await putFile(ssh, local, remote, verbose);
    }
    ssh.dispose();
    console.log('✅ scp Action finished.');
  } catch (err) {
    console.error(`⚠️ An error happened:(.`, err.message, err.stack);
    ssh.dispose();
    process.abort();
  }
}
async function putDirectory(
  ssh: node_ssh,
  local: string,
  remote: string,
  concurrency = 3,
  verbose = false,
  recursive = true
) {
  const failed: {local: string; remote: string}[] = [];
  const successful = [];
  const status = await ssh.putDirectory(local, remote, {
    recursive: recursive,
    concurrency: concurrency,
    tick: function(localPath, remotePath, error) {
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

async function putFile(
  ssh: node_ssh,
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

run();
