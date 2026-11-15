# Development commands and diagnostic logs

Run commands from the repository root after `npm ci` and PostgreSQL setup.

| Command | Behaviour |
|---|---|
| `npm run dev` | Build once, then start shared-package compilers, NestJS watch mode, Vite and Electron |
| `npm run dev:server` | Start server and shared-package compiler watchers |
| `npm run dev:desktop` | Start Vite and Electron watchers against an independent API |
| `npm start` | Build bundled assets and open the desktop with a local API |
| `npm run build` | Build all workspaces |
| `npm run check` | Check TypeScript across workspaces |
| `npm test` | Exercise contracts and logging safeguards |
| `npm run test:integration` | Exercise HTTP/PostgreSQL behaviour in a temporary schema |
| `npm run test:desktop` | Exercise two real Electron clients |
| `npm run package:windows` | Produce NSIS and a SHA-256 checksum |
| `npm run package:windows:dir` | Produce an unpacked Windows desktop |
| `npm run test:packaged` | Launch and check the packaged desktop |

The API defaults to port 3001; Vite uses `127.0.0.1:5173`. Stop conflicting processes before running development. Renderer edits reload through Vite. Desktop main-process edits rebuild and restart Electron; unsaved forms may be lost. Server edits restart Node after compilation. Compiler errors appear in the terminal and do not emit invalid JavaScript. Shared contracts and logging build before their consumers.

Development accepts only the fixed local Vite origin for IPC. WebSocket and inline-style CSP allowances apply to development HTML only. Packaged builds use bundled assets and restrictive production CSP.

Press Ctrl+C to stop processes owned by the launcher. Windows cleanup targets only their process trees. PostgreSQL remains independent; use `npm run db:start` after a reboot and `npm run db:stop` when required.

## Diagnostic logs

Each line is JSON with a UTC timestamp, level, component, process ID and event. API logs include the route template, status, duration and request ID. A field allowlist excludes request bodies, arbitrary URLs/query values, passwords, tokens, database URLs, raw exception messages and customer records. PostgreSQL audit records remain separate from diagnostics.

| Process | Log folder |
|---|---|
| Desktop | Its user-data folder, normally `%APPDATA%/SMB ERP/logs` |
| Server | `.local/logs/server`, or the server's `ERP_LOG_DIR` |
| Launcher | `.local/logs/launcher` |

Use **Diagnostic logs** in the desktop footer or error panel to open the folder. Startup failures show the folder path; renderer crashes offer reload or close. Files rotate at 5 MiB with three backups per process ID. Previous process logs remain available; administrators should apply their own folder retention policy. File-write failures warn in the console without interrupting database work.

API errors display a reference ID matching `X-Request-ID` and both desktop/server logs. Share that reference and relevant diagnostic entries with the administrator. Never send `.env` as a log attachment.

## Windows development permissions

If Electron explicitly reports that sandboxed applications cannot read its runtime directory, grant read/execute access to that runtime only from a normal Windows terminal:

```powershell
icacls '.\node_modules\electron\dist' /grant '*S-1-15-2-1:(OI)(CI)(RX)'
```

Keep Electron sandboxing enabled. The restricted execution environment used during automation may require GUI checks under the normal Windows account. PostgreSQL's separate restricted-token limitation is described in POSTGRES_SETUP.md.
