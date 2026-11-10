# OpenSpace Hub

## Development Setup

You need Node 22 (22.23.4+) or 24 (24.22.1+), which comes with npm, and
MongoDB 8.0 running locally (see [Installing MongoDB](#installing-mongodb)). Three files hold settings and keys that aren't in git; copy them from
an existing setup, or ask a maintainer:

| File | What |
|---|---|
| `hub-be/.env` | Database and secret: `cp hub-be/.env.example hub-be/.env`, then `cd hub-be && npm run generate:payload-secret -- --write` (the backend won't start with the example's placeholder) |
| `hub-fe/.env` | Firebase web app settings: `cp hub-fe/.env.example hub-fe/.env` and fill them in |
| `hub-be/config/authentication-4b8de-firebase-adminsdk.json` | The Firebase admin key, used to check logins |

Then, from the repo root:

1. `npm install` installs the root's tools, the frontend and the backend (npm workspaces, one
   `package-lock.json`, packages in the root `node_modules`)
2. `npm run dev` starts both: the hub at `localhost:5173`, the backend and admin panel at
   `localhost:3000`. On an empty database the backend adds the default site settings
   (OpenSpace versions, item types, licenses) and their tags when it starts
3. Sign in on the hub, then make yourself an admin. This also prints a password for the admin
   panel at `localhost:3000/admin`, since accounts made by signing in don't have one:
   ```bash
   cd hub-be && npm run make-admin -- you@example.com
   ```
4. Optional: import the items from the old hub with `cd hub-be && npm run seed`. It needs the old hub's
   data export (ask a maintainer) in a folder called `ingest` in `hub-be`, and creates the items with their images and files,
   and their authors (with placeholder emails that are replaced when they first sign in).
   To copy an existing hub instead, restore its `npm run backup` (see `hub-be/src/scripts/backup.ts`)

### Installing MongoDB

Use MongoDB 8.0: the backend's driver (mongodb 6.12, through Payload's mongoose adapter) isn't
certified for newer servers, and package managers now default to 9.0. The hub connects to
`mongodb://127.0.0.1/...` (`DATABASE_URI` in `hub-be/.env`), and the database is created on
first start.

- **Windows**: `winget install MongoDB.Server --version 8.0.23` (it asks for admin rights), plus
  `winget install MongoDB.Shell` for `mongosh`. It installs and starts a `MongoDB` service that
  starts with Windows and only listens on localhost
- **macOS**: `brew tap mongodb/brew && brew install mongodb-community@8.0 && brew services start mongodb-community@8.0`
- **RHEL / Rocky / Alma** (like the hub's server): add the repo, then install and start it:
  ```bash
  sudo tee /etc/yum.repos.d/mongodb-org-8.0.repo <<'EOF'
  [mongodb-org-8.0]
  name=MongoDB Repository
  baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/8.0/x86_64/
  gpgcheck=1
  enabled=1
  gpgkey=https://pgp.mongodb.com/server-8.0.asc
  EOF
  sudo dnf install -y mongodb-org
  sudo systemctl enable --now mongod
  ```

Check it's up with `mongosh --eval 'db.version()'`. Keep it bound to localhost (the default):
it has no password, and only the hub process needs to reach it.

## Running the Projects

Both projects can be run either:
- From the monorepo root
- From within their respective folders

Arguments for a script go after `--`, e.g. `npm run make-admin -- you@example.com`; otherwise npm
takes options like `--write` for itself.

## Deployment

The backend serves the built frontend too, so the hub runs as one process behind a web server
that handles HTTPS. Run it with pm2; it uses these files on disk:

- `hub-be/.env`: `PAYLOAD_SECRET` (each server its own: `npm run generate:payload-secret`, or
  `node hub-be/src/scripts/generate-payload-secret.mjs`) and, if the hub isn't
  opened at https://hub.openspaceproject.com, `ALLOWED_ORIGINS` set to the address it is
- `hub-fe/.env`: the Firebase web settings
- `hub-be/config/authentication-4b8de-firebase-adminsdk.json`: the Firebase admin key
- `hub-be/uploads/` and `hub-be/media/`: uploaded files (copy them over to move an existing hub)

Whatever address the hub is opened at must also be in Firebase's authorized domains
(Firebase console → Authentication → Settings), or the login popup won't open.

A new server can start with an empty database: the default site settings are added when it
first starts. Sign in on the hub, then make yourself an admin with `npm run make-admin -- you@example.com`
in `hub-be/`. It prints a
password for the admin panel at `/admin`.

Before going live:
- Give the server its own `PAYLOAD_SECRET`
- Remove test addresses from Firebase's authorized domains (the project is shared with other
  OpenSpace apps)

#### With pm2

0. Install MongoDB 8.0 and start it as a service ([Installing MongoDB](#installing-mongodb))
1. With `hub-fe/.env` (Firebase settings) and `hub-be/.env` in place, run `npm ci`,
   then `npm run build` at the repo root. This builds the frontend (pointed at
   `https://hub.openspaceproject.com` by `hub-fe/.env.production`), copies it into
   `hub-be/public/` and builds the backend
2. `pm2 start deploy/ecosystem.config.cjs` at the repo root runs it on port 3000 (`pm2 save`
   and `pm2 startup` once, so it comes back after a reboot). After pulling changes:
   `npm ci && npm run build && pm2 reload deploy/ecosystem.config.cjs`
3. Point Apache at it with [deploy/apache-hub.conf](deploy/apache-hub.conf), which lists the
   setup commands, including the Let's Encrypt certificate

To try a production build locally, build the frontend with
`VITE_PAYLOAD_API_URL=http://localhost:3000`, and start the backend with
`ALLOWED_ORIGINS=http://localhost:3000` so the admin panel login works.

### Backend (hub-be)
- The backend is a Next.js app using PayloadCMS
- Media uploads and asset bundles are saved to disk, in a folder per uploader
- Ensure proper credentials are set in `.env`
- Give each server its own random `PAYLOAD_SECRET`: `npm run generate:payload-secret -- --write` puts one in `.env` (or run it without `-- --write` to print one). The backend refuses to start without it
- Follow PayloadCMS deployment instructions in their [documentation](https://payloadcms.com/docs/production/deployment)

### Frontend
- Can be built statically using `npm run build`
- The root `npm run build` copies it into the backend, which serves it; it can also be hosted
  anywhere as flat files

## Additional Notes

- Make sure to have all required environment variables in `.env`
- The frontend can be deployed separately from the backend
- Both applications can live side by side or on different servers
