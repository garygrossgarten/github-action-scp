"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const node_ssh_1 = __importDefault(require("node-ssh"));
const ssh2_streams_1 = require("ssh2-streams");
const fs_1 = __importDefault(require("fs"));
const keyboard_1 = require("./keyboard");
const path_1 = __importDefault(require("path"));
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
        const remote = core.getInput('remote');
        const atomicPut = core.getInput('atomicPut');
        if (atomicPut) {
            // patch SFTPStream to atomically rename files
            const originalFastPut = ssh2_streams_1.SFTPStream.prototype.fastPut;
            ssh2_streams_1.SFTPStream.prototype.fastPut = function (localPath, remotePath, opts, cb) {
                const parsedPath = path_1.default.posix.parse(remotePath);
                parsedPath.base = '.' + parsedPath.base;
                const tmpRemotePath = path_1.default.posix.format(parsedPath);
                const that = this;
                originalFastPut.apply(this, [localPath, tmpRemotePath, opts, function (error, result) {
                        if (error) {
                            cb(error, result);
                        }
                        else {
                            that.ext_openssh_rename(tmpRemotePath, remotePath, cb);
                        }
                    }]);
            };
        }
        try {
            const ssh = yield connect(host, username, port, privateKey, password, passphrase, tryKeyboard);
            yield scp(ssh, local, remote, concurrency, verbose, recursive);
            ssh.dispose();
        }
        catch (err) {
            core.setFailed(err);
        }
    });
}
function connect(host = 'localhost', username, port = 22, privateKey, password, passphrase, tryKeyboard) {
    return __awaiter(this, void 0, void 0, function* () {
        const ssh = new node_ssh_1.default();
        console.log(`Establishing a SSH connection to ${host}.`);
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
            core.setFailed(err.message);
        }
        return ssh;
    });
}
function scp(ssh, local, remote, concurrency, verbose = true, recursive = true) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Starting scp Action: ${local} to ${remote}`);
        try {
            if (isDirectory(local)) {
                yield putDirectory(ssh, local, remote, concurrency, verbose, recursive);
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
        }
    });
}
function putDirectory(ssh, local, remote, concurrency = 3, verbose = false, recursive = true) {
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
