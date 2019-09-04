#!/usr/bin/env node
import { CorePlugin } from "@fivethree/billy-plugin-core";
import { GithubActionsPlugin } from "@garygrossgarten/billy-plugin-github-actions";
import node_ssh from "node-ssh";
export interface SCP extends CorePlugin, GithubActionsPlugin {
}
export declare class SCP {
    ssh(local: string, remote: string, host: string, username: string, port: number, privateKey: string, password: string, passphrase: string, tryKeyboard: boolean, concurrency?: number): Promise<void>;
    private connect;
    private scp;
    putDirectory(ssh: node_ssh, local: string, remote: string, concurrency?: number, retry?: number, verbose?: boolean): Promise<void>;
    putFiles(ssh: node_ssh, files: {
        local: string;
        remote: string;
    }[], concurrency: number): Promise<void>;
    test(): Promise<void>;
}
