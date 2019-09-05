# GitHub Action SCP

Simple GitHub Action to copy a folder or single file to a remote server using SSH. This is working with the latest [GitHub Actions](https://github.com/features/actions).

## ✨ Example Usage

**Copy a folder recursively to a remote server**

```yml
- name: Copy folder content recursively to remote
        uses: garygrossgarten/github-action-scp@release
        with:
          local: test
          remote: scp/directory
          host: ${{ secrets.HOST }}
          username: ${{ secrets.SSH_USER }}
          password: ${{ secrets.PASSWORD }}

```

**Copy a single file to a remote server**

```yml
- name: Copy single file to remote
        uses: garygrossgarten/github-action-scp@release
        with:
          local: test/oof.txt
          remote: scp/single/oof.txt
          host: ${{ secrets.HOST }}
          username: ${{ secrets.SSH_USER }}
          password: ${{ secrets.PASSWORD }}

```

🔐 Set your secrets here: `https://github.com/USERNAME/REPO/settings/secrets`.

Check out [the workflow example](.github/workflows/scp-example-workflow.yml) for a minimalistic yaml workflow in GitHub Actions.

**Result**

![result of example ssh workflow](result.png)

## Options

- **local** - _string_ - Path to local folder you want to copy. **required**

- **remote** - _string_ - Path to folder to copy the contents to. **required**

- **concurrency** - _number_ - Number of concurrent file transfers. **Default:** `1`

- **recursive** - _boolean_ - Copy directory contents recursively. **Default:** `true`

- **verbose** - _boolean_ - Output every single file transfer status. **Default:** `true`

- **host** - _string_ - Hostname or IP address of the server. **Default:** `'localhost'`

- **port** - _integer_ - Port number of the server. **Default:** `22`

- **username** - _string_ - Username for authentication. **Default:** (none)

- **password** - _string_ - Password for password-based user authentication. **Default:** (none)

- **privateKey** - _mixed_ - _Buffer_ or _string_ that contains a private key for either key-based or hostbased user authentication (OpenSSH format). **Default:** (none)

- **passphrase** - _string_ - For an encrypted private key, this is the passphrase used to decrypt it. **Default:** (none)

- **tryKeyboard** - _boolean_ - Try keyboard-interactive user authentication if primary user authentication method fails. **Default:** `false`

## Development

---

This thing is build using Typescript and
[ssh2](https://github.com/mscdex/ssh2) (via [node-ssh](https://github.com/steelbrain/node-ssh)). 🚀
