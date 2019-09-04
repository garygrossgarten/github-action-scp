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
    @input("host") host = "localhost",
    @input("username") username: string,
    @input("port") port = 22,
    @input("privateKey") privateKey: string,
    @input("password") password: string,
    @input("passphrase") passphrase: string,
    @input("tryKeyboard") tryKeyboard: boolean,
    @input("concurrency") concurrency = 1
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

    await this.scp(ssh, local, remote, concurrency);

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
    concurrency: number
  ) {
    const m2 = await this.colorize("orange", `Starting scp Action:`);
    console.log(`${m2} ${local} to ${remote}`);

    try {
      await this.putDirectory(ssh, local, remote, concurrency, 3, true);
      ssh.dispose();
      console.log("✅ scp Action finished.");
    } catch (err) {
      console.error(`⚠️ An error happened:(.`, err.message, err.stack);
      process.abort();
    }
  }
  async putDirectory(
    ssh: node_ssh,
    local: string,
    remote: string,
    concurrency = 3,
    retry = 3,
    verbose = false
  ) {
    let retries = 0;
    const failed: { local: string; remote: string }[] = [];
    const successful = [];
    const status = await ssh.putDirectory(local, remote, {
      recursive: true,
      concurrency: 1,
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
      "the directory transfer was",
      status ? "successful" : "unsuccessful"
    );
    if (failed.length > 0) {
      console.log("failed transfers", failed.join(", "));
      await this.putFiles(ssh, failed, concurrency);
    }
  }
  async putFiles(
    ssh: node_ssh,
    files: { local: string; remote: string }[],
    concurrency: number
  ) {
    try {
      const status = await ssh.putFiles(files, { concurrency: concurrency });
    } catch (error) {
      console.error(`⚠️ An error happened:(.`, error.message, error.stack);
    }
  }

  @Command("test")
  async test() {
    const ssh = await this.connect(
      "ssh.strato.de",
      "koelnerhofdernau.de",
      22,
      null,
      "Powerkit2709*",
      null,
      null
    );

    await this.scp(ssh, "node_modules", "test", 3);
  }
}
