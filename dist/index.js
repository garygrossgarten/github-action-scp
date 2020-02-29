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
const fs_1 = __importDefault(require("fs"));
const node_ssh_1 = __importDefault(require("node-ssh"));
const keyboard_1 = require("./keyboard");
let SCP = class SCP {
    ssh(local, remote, concurrency = 1, recursive = true, verbose = true, host = "localhost", username, port = 22, privateKey, password, passphrase, tryKeyboard, localSeparator) {
        return __awaiter(this, void 0, void 0, function* () {
            const ssh = yield this.connect(host, username, port, privateKey, password, passphrase, tryKeyboard);
            if (typeof localSeparator != 'undefined' && localSeparator) {
                var nbCompletedCopies = 0;
                var locals = local.split(localSeparator);
                locals.forEach(function (item) {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield this.scp(ssh, item, remote, concurrency, verbose, recursive);
                        nbCompletedCopies++;
                        if (nbCompletedCopies == locals.length) {
                            ssh.dispose();
                        }
                    });
                });
            }
            else {
                yield this.scp(ssh, local, remote, concurrency, verbose, recursive);
                ssh.dispose();
            }
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
    scp(ssh, local, remote, concurrency, verbose = true, recursive = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const m2 = yield this.colorize("orange", `Starting scp Action:`);
            console.log(`${m2} ${local} to ${remote}`);
            try {
                if (this.isDirectory(local)) {
                    yield this.putDirectory(ssh, local, remote, concurrency, verbose, recursive);
                }
                else {
                    yield this.putFile(ssh, local, remote, verbose);
                }
                ssh.dispose();
                console.log("✅ scp Action finished.");
            }
            catch (err) {
                console.error(`⚠️ An error happened:(.`, err.message, err.stack);
                ssh.dispose();
                process.abort();
            }
        });
    }
    putDirectory(ssh, local, remote, concurrency = 3, verbose = false, recursive = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const failed = [];
            const successful = [];
            const status = yield ssh.putDirectory(local, remote, {
                recursive: recursive,
                concurrency: concurrency,
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
            console.log(`The copy of directory ${local} was ${status ? "successful" : "unsuccessful"}.`);
            if (failed.length > 0) {
                console.log("failed transfers", failed.join(", "));
                yield this.putMany(failed, (failed) => __awaiter(this, void 0, void 0, function* () {
                    console.log(`Retrying to copy ${failed.local} to ${failed.remote}.`);
                    yield this.putFile(ssh, failed.local, failed.remote, true);
                }));
            }
        });
    }
    putFile(ssh, local, remote, verbose = true) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield ssh.putFile(local, remote);
                if (verbose) {
                    console.log(`✔ Successfully copied file ${local} to remote ${remote}.`);
                }
            }
            catch (error) {
                console.error(`⚠️ An error happened:(.`, error.message, error.stack);
                ssh.dispose();
                process.abort();
            }
        });
    }
    isDirectory(path) {
        return fs_1.default.existsSync(path) && fs_1.default.lstatSync(path).isDirectory();
    }
    putMany(array, asyncFunction) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const el of array) {
                yield asyncFunction(el);
            }
        });
    }
    test() {
        return __awaiter(this, void 0, void 0, function* () {
            const ssh = yield this.connect(process.env.HOST, process.env.SSH_USER, 22, null, process.env.PW, null, null);
            yield this.scp(ssh, "dist", "scp/directory", 1, true, true);
        });
    }
};
__decorate([
    billy_core_1.usesPlugins(billy_plugin_core_1.CorePlugin, billy_plugin_github_actions_1.GithubActionsPlugin),
    billy_core_1.Hook(billy_core_1.onStart),
    billy_plugin_github_actions_1.GitHubAction(),
    __param(0, billy_plugin_github_actions_1.input("local")),
    __param(1, billy_plugin_github_actions_1.input("remote")),
    __param(2, billy_plugin_github_actions_1.input("concurrency")),
    __param(3, billy_plugin_github_actions_1.input("recursive")),
    __param(4, billy_plugin_github_actions_1.input("verbose")),
    __param(5, billy_plugin_github_actions_1.input("host")),
    __param(6, billy_plugin_github_actions_1.input("username")),
    __param(7, billy_plugin_github_actions_1.input("port")),
    __param(8, billy_plugin_github_actions_1.input("privateKey")),
    __param(9, billy_plugin_github_actions_1.input("password")),
    __param(10, billy_plugin_github_actions_1.input("passphrase")),
    __param(11, billy_plugin_github_actions_1.input("tryKeyboard")),
    __param(12, billy_plugin_github_actions_1.input("localSeparator")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object, Object, Object, String, Object, String, String, String, Boolean, String]),
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
