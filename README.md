# setup-tidbcloud-cli

The `tidbcloud/setup-tidbcloud-cli` action is a JavaScript action that sets up [`ticloud`](https://github.com/tidbcloud/tidbcloud-cli) in your GitHub Actions workflow by:

- Downloading a specific version of `ticloud` and adding it to the `PATH`.
- Configuring `ticloud` with API token.

## Prerequisites

- This action requires TiDB Cloud API Key to execute `ticloud` commands.
  See [Authentication](https://docs.pingcap.com/tidbcloud/api/v1beta#section/Authentication) for more details.
- This action only support following runners:

| Architecture Support | macOS | Linux | Windows |
| -------------------- | ----- | ----- | ------- |
| arm64                | ✔    | ✔    | ✘       |
| amd64                | ✔    | ✔    | ✔      |

## Usage

This action can be run on `ubuntu-latest`, `windows-latest`, and `macos-latest` GitHub Actions runners. When running on `windows-latest` the shell should be set to Bash.
See [Prerequisites](#prerequisites) on how to get API key and then set them to repository secrets.

```yaml
uses: tidbcloud/setup-tidbcloud-cli@v0
with:
  api_public_key: ${{ secrets.TIDB_CLOUD_API_PUBLIC_KEY }}
  api_private_key: ${{ secrets.TIDB_CLOUD_API_PRIVATE_KEY }}
```

A specific version of `ticloud` can be installed(Releases can be found [here](https://github.com/tidbcloud/tidbcloud-cli/releases)):

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

### Release security

Releases are published after the default-branch release workflow independently
rebuilds the tagged commit with the pinned build dependencies. The `release`
environment must have required reviewers configured in GitHub; publication fails
closed if they are missing. Configure reviewers who can independently approve
releases, prevent self-review, and restrict deployment to the protected default
branch (the release workflow runs on that branch). Protect `main` and the
release workflow from unreviewed changes, and restrict creation or movement of
`v*` tags, including `v0`, to authorized maintainers and the release workflow.
Set the repository default workflow token permissions to read-only. Only create
release tags on commits containing the hardened workflows: tagging an older
commit can run that commit's old tag-triggered workflows. These repository
settings are required for the integrity gate to be trustworthy.

The release verifier pins its build dependencies to a commit in `release.yml`
and requires the tagged `package.json` and lockfile to match. To update
build dependencies, review the dependency changes and update that pin to an
independently reviewed commit before releasing.
