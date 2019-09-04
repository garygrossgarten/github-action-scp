#!/usr/bin/env node
import { CorePlugin } from "@fivethree/billy-plugin-core";
import { GithubActionsPlugin } from "@garygrossgarten/billy-plugin-github-actions";
export interface SCP extends CorePlugin, GithubActionsPlugin {
}
export declare class SCP {
    ssh(local: string, remote: string, host: string, username: string, port: number, privateKey: string, password: string, passphrase: string, tryKeyboard: boolean): Promise<void>;
    private connect;
    private scp;
}
