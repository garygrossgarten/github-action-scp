"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const node_ssh_1 = require("node-ssh");
const path_1 = __importDefault(require("path"));
const ssh2_streams_1 = require("ssh2-streams");
const fs_1 = __importDefault(require("fs"));
const keyboard_1 = require("./keyboard");
const path_2 = __importDefault(require("path"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const host = core.getInput('host') || 'localhost';
        const username = core.getInput('username');
        const port = +core.getInput('port') || 22;
        const privateKey = core.getInput('privateKey');
        const password = core.getInput('password');
        const passphrase = core.getInput('passphrase');
        const tryKeyboard = !!core.getInput('tryKeyboard');
        const verbose = !!core.getInput('verbose') || true;
        const recursive = !!core.getInput('recursive') || true;
        const concurrency = +core.getInput('concurrency') || 1;
        const local = core.getInput('local');
        const dotfiles = !!core.getInput('dotfiles') || true;
        const remote = core.getInput('remote');
        const rmRemote = !!core.getInput('rmRemote') || false;
        const atomicPut = core.getInput('atomicPut');
        if (atomicPut) {
            // patch SFTPStream to atomically rename files
            const originalFastPut = ssh2_streams_1.SFTPStream.prototype.fastPut;
            ssh2_streams_1.SFTPStream.prototype.fastPut = function (localPath, remotePath, opts, cb) {
                const parsedPath = path_2.default.posix.parse(remotePath);
                parsedPath.base = '.' + parsedPath.base;
                const tmpRemotePath = path_2.default.posix.format(parsedPath);
                const that = this;
                originalFastPut.apply(this, [
                    localPath,
                    tmpRemotePath,
                    opts,
                    function (error, result) {
                        if (error) {
                            cb(error, result);
                        }
                        else {
                            that.ext_openssh_rename(tmpRemotePath, remotePath, cb);
                        }
                    }
                ]);
            };
        }
        try {
            const ssh = yield connect(host, username, port, privateKey, password, passphrase, tryKeyboard);
            yield scp(ssh, local, remote, dotfiles, concurrency, verbose, recursive, rmRemote);
            ssh.dispose();
        }
        catch (err) {
            core.setFailed(err);
        }
    });
}
function connect(host = 'localhost', username, port = 22, privateKey, password, passphrase, tryKeyboard) {
    return __awaiter(this, void 0, void 0, function* () {
        const ssh = new node_ssh_1.NodeSSH();
        console.log(`Establishing a SSH connection to ${host}.`);
        try {
            const config = {
                host: host,
                port: port,
                username: username,
                password: password,
                passphrase: passphrase,
                tryKeyboard: tryKeyboard,
                onKeyboardInteractive: tryKeyboard ? keyboard_1.keyboardFunction(password) : null
            };
            if (privateKey) {
                console.log('using provided private key');
                config.privateKey = privateKey;
            }
            yield ssh.connect(config);
            console.log(`🤝 Connected to ${host}.`);
        }
        catch (err) {
            console.error(`⚠️ The GitHub Action couldn't connect to ${host}.`, err);
            core.setFailed(err.message);
        }
        return ssh;
    });
}
function scp(ssh, local, remote, dotfiles = false, concurrency, verbose = true, recursive = true, rmRemote = false) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Starting scp Action: ${local} to ${remote}`);
        try {
            if (isDirectory(local)) {
                if (rmRemote) {
                    yield cleanDirectory(ssh, remote);
                }
                yield putDirectory(ssh, local, remote, dotfiles, concurrency, verbose, recursive);
            }
            else {
                yield putFile(ssh, local, remote, verbose);
            }
            ssh.dispose();
            console.log('✅ scp Action finished.');
        }
        catch (err) {
            console.error(`⚠️ An error happened:(.`, err.message, err.stack);
            ssh.dispose();
            process.abort();
            core.setFailed(err.message);
        }
    });
}
function putDirectory(ssh, local, remote, dotfiles = false, concurrency = 3, verbose = false, recursive = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const failed = [];
        const successful = [];
        const status = yield ssh.putDirectory(local, remote, {
            recursive: recursive,
            concurrency: concurrency,
            validate: (path) => !path_1.default.basename(path).startsWith('.') || dotfiles,
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
        console.log(`The copy of directory ${local} was ${status ? 'successful' : 'unsuccessful'}.`);
        if (failed.length > 0) {
            console.log('failed transfers', failed.join(', '));
            yield putMany(failed, (failed) => __awaiter(this, void 0, void 0, function* () {
                console.log(`Retrying to copy ${failed.local} to ${failed.remote}.`);
                yield putFile(ssh, failed.local, failed.remote, true);
            }));
        }
    });
}
function cleanDirectory(ssh, remote, verbose = true) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield ssh.execCommand(`rm -rf ${remote}/*`);
            if (verbose) {
                console.log(`✔ Successfully deleted all files of ${remote}.`);
            }
        }
        catch (error) {
            console.error(`⚠️ An error happened:(.`, error.message, error.stack);
            ssh.dispose();
            core.setFailed(error.message);
        }
    });
}
function putFile(ssh, local, remote, verbose = true) {
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
            core.setFailed(error.message);
        }
    });
}
function isDirectory(path) {
    return fs_1.default.existsSync(path) && fs_1.default.lstatSync(path).isDirectory();
}
function putMany(array, asyncFunction) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const el of array) {
            yield asyncFunction(el);
        }
    });
}
run();
