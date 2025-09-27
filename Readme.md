# push-to
As I was unable to find an all-in-one solution for pushing to remote targets, I wrote one on my own.  
It can push to:
- local targets (using relative or absolute paths)  
- FTP(s)
- SFTP

It can also load from all of it.
# Core concept
Because I plan to use it to deploy a lot of static websites, it does always do the following steps:
1. create additional directories
2. upload assets (see `lib/createPlan` `getAssetExtensions()`)
3. upload production code
4. delete old production code
5. delete old assets
6. delete unneeded directories

This way you prevent html files to refer to already deleted assets, or html files to refer to not yet uploaded assets.
# Global properties
## Testing first
Set this one:
```ini
DRY_RUN=true
```
It won't change anything on the remote side, just pretend to do so. If you set the logging level to debug, it will tell you things it would have done.
## Debugging
In case one needs it:
```ini
LOG_LEVEL=debug
```
Can be any of `trace`, `debug`, `info`, `warn`, `error`.  
Default: `info`
## Assets
You can define extensions that count as assets; e.g. in case you upload a node.js application and don't wannt js files to count as asset.
```ini
ASSETS_EXTENSIONS=jpg,jpeg,svg,css,...
```
See `lib/createPlan`, function `getAssetExtensions()` for what extensions count as asset per default.
## Keep remote files
There are two ways to keep remote files.

Please be aware that those will only affect exiting remote files; in case you have local files matching a pattern, that don't exist on the remote site, they will get uploaded (without overriding/deleting remote files).
### Don't delete
Using this will **not delete** remote files in case they are not present in the source directory.  
But it will **override** them, when present in source.

Usage example:
```ini
DONT_DELETE_TARGET_FILES=**/.env,backup/**
```
This will keep all `.env` files and everything in the backup folder
### Don't override
This will keep the remote files and **don't override them** in case they are present in the source file.  
It won't delete them in case the source file is present, and it won't override them in case the source file is not present.

Usage example:
```ini
DONT_OVERRIDE_TARGET_FILES=**/.env
```
This will keep all env files present on the remote site.  
In case there are local `.env` files that do also exist on the remote site, they won't be uploaded.  
In case there are local `.env` files that don't exist on the remote site, they will be uploaded.
### About the patterns
You may use `*` or `**` only once in every path, where `*` does match exactly one filename/directory and `**` matches 0-n files/directories.

Examples:
| Pattern | Matches | Does not match |
| `*` | `/index.html` <br> `/index.css` <br> `/.env` | `/directory/index.js` <br> `/another/directory/.env` |
| `**` | `/index.html` <br> `/assets/main.css` <br> `/assets/fonts/font-awesome.woff` | _N/A_ |
| `**.env` | `/.env` <br> `/worker/example.env` <br> `/cluster/proxy/.env` | _Anything other then `.env` files_ |
| `*.env` | `/.env` <br> `/example.env` | _Anything other then `.env` files, or `.env` files that are not in the root directory_ |
| `worker/*.env` | `/worker/.env` <br> `/worker/example.env` | _Anything other then `.env` files, or `.env` files that are not in the worker directory_ |
| `worker/**/.env` | `/worker/.env` <br> `/worker/sub/.env` | _Anything other then `.env` files, or files in worker that have something in front of the `.env` extension_ |
| `worker/**.env` | `/worker/.env` <br> `/worker/proxy/.env` <br> `/worker/proxy/example.env` | _Anything other then `.env` files, or `.env` files that are not in the worker directory/any subdirectories of the worker directory_ |

These patterns apply to both, "don't delete" and "don't override".
# Connection methods
## Directory
Can be used to handle 

## FTP
FTP over a **non encrypted** connection

### as source
```ini
SOURCE=ftp://example.com/httpdocs/prod
SOURCE_USERNAME=test
SOURCE_PASSWORD=i.am.secure
```

### as target
```ini
TARGET=ftp://example.com:21
TARGET_USERNAME=test
TARGET_PASSWORD=i.am.secure
```

## FTPS
FTP over an **encrypted** connection.  
Similar to ftp, except for the additional property `IGNORE_SSL_TRUST` (default: `false`).

### as source
```ini
SOURCE=ftp://example.com:21/httpdocs/prod
SOURCE_USERNAME=test
SOURCE_PASSWORD=i.am.secure
# SOURCE_IGNORE_SSL_TRUST=false
```

### as target
```ini
TARGET=ftp://example.com:21
TARGET_USERNAME=test
TARGET_PASSWORD=i.am.secure
TARGET_IGNORE_SSL_TRUST=true
```