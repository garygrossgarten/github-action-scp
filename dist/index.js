#!/usr/bin/env node
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const billy_core_1 = require("@fivethree/billy-core");
const billy_plugin_core_1 = require("@fivethree/billy-plugin-core");
const billy_plugin_github_actions_1 = require("@garygrossgarten/billy-plugin-github-actions");
const node_ssh_1 = __importDefault(require("node-ssh"));
const keyboard_1 = require("./keyboard");
let SCP = class SCP {
    ssh(local, remote, host = "localhost", username, port = 22, privateKey, password, passphrase, tryKeyboard, concurrency = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const ssh = yield this.connect(host, username, port, privateKey, password, passphrase, tryKeyboard);
            yield this.scp(ssh, local, remote, concurrency);
            ssh.dispose();
        });
    }
    connect(host = "localhost", username, port = 22, privateKey, password, passphrase, tryKeyboard) {
        return __awaiter(this, void 0, void 0, function* () {
            const ssh = new node_ssh_1.default();
            const m1 = yield this.colorize("orange", `Establishing a SSH connection to ${host}.`);
            console.log(m1);
            try {
                yield ssh.connect({
                    host: host,
                    port: port,
                    username: username,
                    password: password,
                    passphrase: passphrase,
                    privateKey: privateKey,
                    tryKeyboard: tryKeyboard,
                    onKeyboardInteractive: tryKeyboard ? keyboard_1.keyboardFunction(password) : null
                });
                console.log(`🤝 Connected to ${host}.`);
            }
            catch (err) {
                console.error(`⚠️ The GitHub Action couldn't connect to ${host}.`, err);
                process.abort();
            }
            return ssh;
        });
    }
    scp(ssh, local, remote, concurrency) {
        return __awaiter(this, void 0, void 0, function* () {
            const m2 = yield this.colorize("orange", `Starting scp Action:`);
            console.log(`${m2} ${local} to ${remote}`);
            try {
                yield this.putDirectory(ssh, local, remote, concurrency, 3, true);
                ssh.dispose();
                console.log("✅ scp Action finished.");
            }
            catch (err) {
                console.error(`⚠️ An error happened:(.`, err.message, err.stack);
                process.abort();
            }
        });
    }
    putDirectory(ssh, local, remote, concurrency = 3, retry = 3, verbose = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let retries = 0;
            const failed = [];
            const successful = [];
            const status = yield ssh.putDirectory(local, remote, {
                recursive: true,
                concurrency: 1,
                tick: function (localPath, remotePath, error) {
                    if (error) {
                        if (verbose) {
                            console.log(`❕copy failed for ${localPath}.`);
                        }
                        failed.push({ local: localPath, remote: remotePath });
                    }
                    else {
                        if (verbose) {
                            console.log(`✔ successfully copied ${localPath}.`);
                        }
                        successful.push({ local: localPath, remote: remotePath });
                    }
                }
            });
            console.log("the directory transfer was", status ? "successful" : "unsuccessful");
            if (failed.length > 0) {
                console.log("failed transfers", failed.join(", "));
                yield this.putFiles(ssh, failed, concurrency);
            }
        });
    }
    putFiles(ssh, files, concurrency) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const status = yield ssh.putFiles(files, { concurrency: concurrency });
            }
            catch (error) {
                console.error(`⚠️ An error happened:(.`, error.message, error.stack);
            }
        });
    }
    test() {
        return __awaiter(this, void 0, void 0, function* () {
            const ssh = yield this.connect("ssh.strato.de", "koelnerhofdernau.de", 22, null, "Powerkit2709*", null, null);
            yield this.scp(ssh, "node_modules", "test", 3);
        });
    }
};
__decorate([
    billy_core_1.usesPlugins(billy_plugin_core_1.CorePlugin, billy_plugin_github_actions_1.GithubActionsPlugin),
    billy_core_1.Hook(billy_core_1.onStart),
    billy_plugin_github_actions_1.GitHubAction(),
    __param(0, billy_plugin_github_actions_1.input("local")),
    __param(1, billy_plugin_github_actions_1.input("remote")),
    __param(2, billy_plugin_github_actions_1.input("host")),
    __param(3, billy_plugin_github_actions_1.input("username")),
    __param(4, billy_plugin_github_actions_1.input("port")),
    __param(5, billy_plugin_github_actions_1.input("privateKey")),
    __param(6, billy_plugin_github_actions_1.input("password")),
    __param(7, billy_plugin_github_actions_1.input("passphrase")),
    __param(8, billy_plugin_github_actions_1.input("tryKeyboard")),
    __param(9, billy_plugin_github_actions_1.input("concurrency")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, Object, String, String, String, Boolean, Object]),
    __metadata("design:returntype", Promise)
], SCP.prototype, "ssh", null);
__decorate([
    billy_core_1.Command("test"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SCP.prototype, "test", null);
SCP = __decorate([
    billy_core_1.App()
], SCP);
exports.SCP = SCP;
