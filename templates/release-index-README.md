# Release Index

![Last Commit](https://img.shields.io/github/last-commit/saiki-mbs/release-index/master)
![Auto Update](https://img.shields.io/badge/updates-automated-success)
![Data](https://img.shields.io/badge/data-JSON-blue)

Machine-readable release snapshots for IDEs, plugins, runtimes, platforms, and tools.

Last updated (UTC): **{{LAST_UPDATED_UTC}}**

## Data layout

- `ide/<product>/<channel>/version.json`
- `plugins/<provider>/<product>/<channel>/version.json`
- `platforms/<product>/<channel>/version.json`
- `runtimes/<product>/<channel>/version.json`
- `tools/<product>/<channel>/version.json`
- `meta/version.json`

## Quick links

- [IDE](./ide/)
- [Plugins](./plugins/)
- [Platforms](./platforms/)
- [Runtimes](./runtimes/)
- [Tools](./tools/)
- [Metadata](./meta/version.json)

## File examples

- [VS Code stable](./ide/vscode/stable/version.json)
- [WakaTime VS Code latest](./plugins/vscode/vscode-wakatime/latest/version.json)
- [Go latest](./runtimes/go/latest/version.json)
- [Linux latest](./platforms/linux/latest/version.json)
- [Nginx latest](./tools/nginx/latest/version.json)

## Raw URL examples

- [VS Code stable raw](https://raw.githubusercontent.com/saiki-mbs/release-index/master/ide/vscode/stable/version.json)
- [WakaTime VS Code raw](https://raw.githubusercontent.com/saiki-mbs/release-index/master/plugins/vscode/vscode-wakatime/latest/version.json)

## History model

Old snapshots are archived only when a channel file changes:

- `<group>/<product>/old/<timestamp>__<release>/version.json`

## Notes

- `latest` and `stable` files contain one current entry for that channel.
- `old/` grows only when the current file changes.
- `meta/version.json` includes per-target sync status.

