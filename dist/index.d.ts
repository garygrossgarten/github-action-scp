#!/usr/bin/env node
import { CorePlugin } from "@fivethree/billy-plugin-core";
import { GithubActionsPlugin } from "@garygrossgarten/billy-plugin-github-actions";
import node_ssh from "node-ssh";
export interface SCP extends CorePlugin, GithubActionsPlugin {
}
export declare class SCP {
    ssh(local: string, remote: string, concurrency: number, recursive: boolean, verbose: boolean, host: string, username: string, port: number, privateKey: string, password: string, passphrase: string, tryKeyboard: boolean): Promise<void>;
    private connect;
    private scp;
    putDirectory(ssh: node_ssh, local: string, remote: string, concurrency?: number, verbose?: boolean, recursive?: boolean): Promise<void>;
    putFile(ssh: node_ssh, local: string, remote: string, verbose?: boolean): Promise<void>;
    private isDirectory;
    private putMany;
    test(): Promise<void>;
}
