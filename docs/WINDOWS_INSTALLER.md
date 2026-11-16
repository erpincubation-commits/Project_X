# Windows installer pipeline

## Build locally

Run on Windows after installing Node.js 22.12+:

```powershell
npm ci
npm run package:windows
npm run test:packaged
```

Output is `release/SMB-ERP-0.2.0-x64-setup.exe`, its `.sha256` checksum and `release/win-unpacked/`. The filename follows the desktop version. `npm run package:windows:dir` produces only the unpacked application.

The build uses pinned Electron and bundled assets. An archive check rejects server code, tests, databases, `.env`, certificates and private keys, and verifies required runtime assets. Only the desktop client is distributed; NestJS and PostgreSQL are deployed separately. No running database is needed to build or check the packaged connection screen.

NSIS installs per user, supports a directory choice and shortcuts, and preserves profile data/logs on uninstall. Packaging never publishes a release or installs it on the build machine.

## GitHub Actions

`.github/workflows/windows-installer.yml` runs on pull requests, main/master pushes, version tags and manual dispatch. Ubuntu checks builds, contracts, logging and the PostgreSQL API. Windows builds NSIS, launches the packaged app to check the assets/preload/sandbox, and uploads the installer/checksum as workflow artifacts retained for 14 days. It does not publish a GitHub release.

Push the workflow before expecting a remote run. Local checks do not establish that GitHub CI has executed.

## Signing

Default artifacts are unsigned unless signing credentials are supplied. Configure protected secrets `WIN_CSC_LINK` (base64 PFX or a supported certificate location) and `WIN_CSC_KEY_PASSWORD`. Dispatch with `sign_release` enabled. This sets `ERP_REQUIRE_SIGNING=true`, which fails packaging if signing credentials are absent or signing fails. Do not commit signing material.

For protected local signing, set those environment variables before building. Verify installer behaviour and signing on a separate Windows machine before distribution. No automatic update service is configured.

References: [Windows signing](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/) and [NSIS configuration](https://www.electron.build/docs/nsis/).
