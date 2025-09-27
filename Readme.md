# tino-kuptz/push-to
> [!NOTE]
> This is still work in progress and in a very early stage
> I already use it, but please be aware that it isn't bulletproof yet

As I was unable to find an all-in-one solution for pushing to remote targets, I wrote one on my own.  
It can push to:
- local targets (using relative or absolute paths)  
- FTP(s)
- SFTP

It can also load from all of those.
# Core concept
> [!CAUTION]
> Please read this carefully. This plugin deletes files in the target in case they are not present in the source.
> In case you want to keep e.g. config files in the target folder, you need to explicitly state that.

Because I plan to use it to deploy a lot of static websites, it does always do the following steps:
1. create additional directories
2. upload asset files (see `lib/createPlan`:`getAssetExtensions()`) replacing existing ones
3. upload non-assets ("logic") files replacing existing ones
4. delete non-asset files that aren't in the source directory
5. delete asset files that aren't in the source directory
6. delete unneeded directories

In my case asset files receive a hash in their filename all the time when websites are build (e.g. `index.abcdef.css`). With the steps listed above no real "downtime" occurs, no matter how long the upload takes, as
- old non-asset files (".html") still can refer to the old assets
- when a new non-asset file is uploaded, its new assets are alredy there
- when a old asset file is deleted, it isn't referenced by its non-assets anymore (as they already have been deleted)

All this efford to just prevent a downtime from 2 minutes when patching websites 🥲
# Quick usage
```yml
steps:
# just demo
- name: build
  image: node:22-alpine
  commands:
  - npm install
  - npm run generate
- name: push-to-sftp
  image: ghcr.io/tino-kuptz/push-to:latest
  settings:
    source_path: .output/public
    # source_path: /drone/src/.output/public
    target_path: sftp://my-public-server.com/test
    # target_path: ftp://<host>:<port>/<path>
    # target_path: sftp://<host>:<port>/<path>
    # target_path: ftps://<host>:<port>/<path>
    # target_path: . (or any other path)
    target_username:
      from_secret: TARGET_USERNAME
    target_password:
      from_secret: TARGET_PASSWORD
    # dry_run: true
    # log_level: debug
    # dont_override_target_files: **.env
    # dont_delete_target_files: *.log
```
# Global properties
> [!NOTE]
> When using in drone ci, you need to remove the prefix "plugin_" of these. 
> Use `dry_run: true` in settings, DO NOT use `PLUGIN_DRY_RUN: true`
## Testing first
Set this one:
```ini
PLUGIN_DRY_RUN=true
```
The plugin won't change anything on the remote site then, it'll just pretend to do so. If you set the logging level to debug, it will tell you things it would have done.

One of the very first logging lines will tell you if dry_run was detected. It won't be logged anywhere else.
## Debugging
In case one needs it:
```ini
PLUGIN_LOG_LEVEL=debug
```
Can be any of `trace`, `debug`, `info`, `warn`, `error`.  
Default: `info`
## Assets
You can define extensions that count as assets; e.g. in case you upload a node.js application and don't want js files to count as asset.
```ini
PLUGIN_ASSETS_EXTENSIONS=jpg,jpeg,svg,css,...
```
See `lib/createPlan`, function `getAssetExtensions()` for what extensions count as asset per default.
## Keep remote files
**THIS PLUGIN WILL DELETE EVERYTHING ON THE REMOTE SITE**.  
In case that's not what you wanted, there are two ways of keeping them.

Please be aware that those will only affect exiting remote files; in case you have local files matching a pattern, that don't exist on the remote site, they will get uploaded (without overriding/deleting remote files).
### Don't delete
Using this will **not delete** remote files in case they are not present in the source directory.  
But it will **override** them, when present in source.

Usage example:
```ini
PLUGIN_DONT_DELETE_TARGET_FILES=**/.env,backup/**
```
This will keep all `.env` files and everything in the backup folder
### Don't override
This will keep the remote files and **don't override them** in case they are present in the source file.  
It won't delete them in case the source file is present, and it won't override them in case the source file is not present.

Usage example:
```ini
PLUGIN_DONT_OVERRIDE_TARGET_FILES=**/.env
```
This will keep all env files present on the remote site.  
In case there are local `.env` files that do also exist on the remote site, they won't be uploaded.  
In case there are local `.env` files that don't exist on the remote site, they will be uploaded.
### About the patterns
You may use `*` or `**` only once in every path, where `*` does match exactly one filename/directory and `**` matches 0-n files/directories.

Examples:
| Pattern | Matches | Does not match |
|---|---|---|
| `*` | `/index.html` <br> `/index.css` <br> `/.env` | `/directory/index.js` <br> `/another/directory/.env` |
| `**` | `/index.html` <br> `/assets/main.css` <br> `/assets/fonts/font-awesome.woff` | _N/A_ |
| `**.env` | `/.env` <br> `/worker/example.env` <br> `/cluster/proxy/.env` | _Anything other then `.env` files_ |
| `*.env` | `/.env` <br> `/example.env` | _Anything other then `.env` files, and `.env` files that are not in the root directory_ |
| `worker/*.env` | `/worker/.env` <br> `/worker/example.env` | _Anything other then `.env` files, and `.env` files that are not in the worker directory_ |
| `worker/**.env` | `/worker/.env` <br> `/worker/proxy/.env` <br> `/worker/proxy/example.env` | _Anything other then `.env` files, or `.env` files that are not in the worker directory/any subdirectories of the worker directory_ |

These patterns apply to both, "don't delete" and "don't override".

Please use `dry_run: true` the very first time and check for messages info messages (level 30) to verify if your patterns match:
```json
{
    "level":30, "time":1759005963063, "pid":1, "hostname":"11bcc8a138d9", "name":"createPlan",
    "msg":"Skipping file replacement due to DONT_OVERRIDE_TARGET_FILES: config/default.yml"
}
```
# Connection methods
## Directory
### as source
```ini
PLUGIN_SOURCE_PATH=dist
```
### as target
```ini
PLUGIN_TARGET_PATH=/drone/src/target
```
## FTP
FTP over a **unencrypted** connection
### as source
```ini
PLUGIN_SOURCE_PATH=ftp://example.com/httpdocs/prod
SOURCE_USERNAME=test
SOURCE_PASSWORD=i.am.secure
```
### as target
```ini
PLUGIN_TARGET_PATH=ftp://example.com:21
TARGET_USERNAME=test
TARGET_PASSWORD=i.am.secure
```
## FTPS
FTP over an **encrypted** connection.  
Similar to ftp, except for the additional property `IGNORE_SSL_TRUST` (default: `false`).
### as source
```ini
PLUGIN_SOURCE_PATH=ftps://example.com:21/httpdocs/prod
SOURCE_USERNAME=test
SOURCE_PASSWORD=i.am.secure
# SOURCE_IGNORE_SSL_TRUST=false
```
### as target
```ini
PLUGIN_TARGET_PATH=ftps://example.com/release
TARGET_USERNAME=test
TARGET_PASSWORD=i.am.secure
TARGET_IGNORE_SSL_TRUST=true
```
## SFTP
SSH file transfer
### as source
```ini
PLUGIN_SOURCE_PATH=sftp://example.com:22/httpdocs/prod
SOURCE_USERNAME=test
SOURCE_PASSWORD=i.am.secure
```
### as target
```ini
PLUGIN_TARGET_PATH=sftp://example.com
TARGET_USERNAME=test
TARGET_PASSWORD=i.am.secure
```
# Development
## Local build
```sh
docker build -t ghcr.io/tino-kuptz/push-to:test .
```
## Local run
Assuming there is a directory `test_fs` in the root folder of this project
```sh
docker run \
    -v ./test_fs:/drone/src \
    -e "PLUGIN_SOURCE_PATH=source" \
    -e "PLUGIN_TARGET_PATH=sftp://myserver.org/test" \
    -e "PLUGIN_TARGET_USERNAME=my_ssh_user" \
    -e "PLUGIN_TARGET_PASSWORD=my_ssh_pass" \
    -e "PLUGIN_DRY_RUN=true" \
    ghcr.io/tino-kuptz/push-to:test
```
This will push the local directory `test_fs/source` to `myserver.org/test`