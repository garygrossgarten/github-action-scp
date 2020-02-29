#!/usr/bin/env node
import {
  App,
  Hook,
  onStart,
  usesPlugins,
  Command
} from "@fivethree/billy-core";
import { CorePlugin } from "@fivethree/billy-plugin-core";
import {
  GithubActionsPlugin,
  input,
  GitHubAction
} from "@garygrossgarten/billy-plugin-github-actions";

import fs from "fs";
import node_ssh from "node-ssh";
import { keyboardFunction } from "./keyboard";

export interface SCP extends CorePlugin, GithubActionsPlugin {}
@App()
export class SCP {
  @usesPlugins(CorePlugin, GithubActionsPlugin)
  @Hook(onStart)
  @GitHubAction()
  async ssh(
    @input("local") local: string,
    @input("remote") remote: string,
    @input("concurrency") concurrency = 1,
    @input("recursive") recursive = true,
    @input("verbose") verbose = true,
    @input("host") host = "localhost",
    @input("username") username: string,
    @input("port") port = 22,
    @input("privateKey") privateKey: string,
    @input("password") password: string,
    @input("passphrase") passphrase: string,
    @input("tryKeyboard") tryKeyboard: boolean,
    @input("localSeparator") localSeparator: string
  ) {
    const ssh = await this.connect(
      host,
      username,
      port,
      privateKey,
      password,
      passphrase,
      tryKeyboard
    );

    if(typeof localSeparator!='undefined' && localSeparator){
      local.split(localSeparator).forEach(function (item) {  
        await this.scp(ssh, item, remote, concurrency, verbose, recursive);
      }); 
    }
    else{
      await this.scp(ssh, local, remote, concurrency, verbose, recursive);
    }

    ssh.dispose();
  }

  private async connect(
    host = "localhost",
    username: string,
    port = 22,
    privateKey: string,
    password: string,
    passphrase: string,
    tryKeyboard: boolean
  ) {
    const ssh = new node_ssh();
    const m1 = await this.colorize(
      "orange",
      `Establishing a SSH connection to ${host}.`
    );
    console.log(m1);

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
      process.abort();
    }

    return ssh;
  }

  private async scp(
    ssh: node_ssh,
    local: string,
    remote: string,
    concurrency: number,
    verbose = true,
    recursive = true
  ) {
    const m2 = await this.colorize("orange", `Starting scp Action:`);
    console.log(`${m2} ${local} to ${remote}`);

    try {
      if (this.isDirectory(local)) {
        await this.putDirectory(
          ssh,
          local,
          remote,
          concurrency,
          verbose,
          recursive
        );
      } else {
        await this.putFile(ssh, local, remote, verbose);
      }
      ssh.dispose();
      console.log("✅ scp Action finished.");
    } catch (err) {
      console.error(`⚠️ An error happened:(.`, err.message, err.stack);
      ssh.dispose();
      process.abort();
    }
  }
  async putDirectory(
    ssh: node_ssh,
    local: string,
    remote: string,
    concurrency = 3,
    verbose = false,
    recursive = true
  ) {
    const failed: { local: string; remote: string }[] = [];
    const successful = [];
    const status = await ssh.putDirectory(local, remote, {
      recursive: recursive,
      concurrency: concurrency,
      tick: function(localPath, remotePath, error) {
        if (error) {
          if (verbose) {
            console.log(`❕copy failed for ${localPath}.`);
          }
          failed.push({ local: localPath, remote: remotePath });
        } else {
          if (verbose) {
            console.log(`✔ successfully copied ${localPath}.`);
          }
          successful.push({ local: localPath, remote: remotePath });
        }
      }
    });

    console.log(
      `The copy of directory ${local} was ${
        status ? "successful" : "unsuccessful"
      }.`
    );
    if (failed.length > 0) {
      console.log("failed transfers", failed.join(", "));
      await this.putMany(failed, async failed => {
        console.log(`Retrying to copy ${failed.local} to ${failed.remote}.`);
        await this.putFile(ssh, failed.local, failed.remote, true);
      });
    }
  }

  async putFile(ssh: node_ssh, local: string, remote: string, verbose = true) {
    try {
      await ssh.putFile(local, remote);
      if (verbose) {
        console.log(`✔ Successfully copied file ${local} to remote ${remote}.`);
      }
    } catch (error) {
      console.error(`⚠️ An error happened:(.`, error.message, error.stack);
      ssh.dispose();
      process.abort();
    }
  }

  private isDirectory(path: string) {
    return fs.existsSync(path) && fs.lstatSync(path).isDirectory();
  }

  private async putMany<T>(
    array: T[],
    asyncFunction: (item: T) => Promise<any>
  ) {
    for (const el of array) {
      await asyncFunction(el);
    }
  }

  @Command("test")
  async test() {
    const ssh = await this.connect(
      process.env.HOST,
      process.env.SSH_USER,
      22,
      null,
      process.env.PW,
      null,
      null
    );

    await this.scp(ssh, "dist", "scp/directory", 1, true, true);
  }
}
