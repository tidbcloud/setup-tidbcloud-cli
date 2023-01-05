# setup-tidbcloud-cli

The `tidbcloud/setup-tidbcloud-cli` action is a JavaScript action that sets up `ticloud` in your GitHub Actions workflow by:

- Downloading a specific version of `ticloud` and adding it to the `PATH`.
- Configuring `ticlooud` with API token.

## Prerequisites

- This action requires TiDB Cloud API Key to execute `ticloud` commands.
  See [Authentication](https://docs.pingcap.com/tidbcloud/api/v1beta#section/Authentication) for more details.
- This action only support follwing runners:

| Architecture Support | macOS | Linux | Windows |
| -------------------- | ----- | ----- | ------- |
| arm64                | ✔     | ✔     | ✘       |
| amd64                | ✔     | ✔     | ✔       |

## Usage

This action can be run on `ubuntu-latest`, `windows-latest`, and `macos-latest` GitHub Actions runners. When running on `windows-latest` the shell should be set to Bash.

```yaml
uses: tidbcloud/setup-tidbcloud-cli@v0
with:
  api_public_key: ${{ secrets.TIDB_CLOUD_API_PUBLIC_KEY }}
  api_private_key: ${{ secrets.TIDB_CLOUD_API_PRIVATE_KEY }}
```

A specific version of Terraform CLI can be installed:

```yaml
uses: tidbcloud/setup-tidbcloud-cli@v0
with:
  version: 0.1.6
  api_public_key: ${{ secrets.TIDB_CLOUD_API_PUBLIC_KEY }}
  api_private_key: ${{ secrets.TIDB_CLOUD_API_PRIVATE_KEY }}
```

## Inputs

The action supports the following inputs:

- `api_public_key` - (required) The public key of TiDB Cloud api.
- `api_private_key` - (required) The private key of TiDB Cloud api.
- `version` - (optional) The version of `ticloud` to install, defaulting to latest version.

## License

See [LICENSE](LICENSE).
