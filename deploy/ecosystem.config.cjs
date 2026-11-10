// pm2 configuration for the hub, which runs as one Next process that serves the API, the admin
// panel and the built frontend on port 3000 (Apache proxies to it, see apache-hub.conf).
//
// From the repo root, after `npm ci && npm run build`:
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save && pm2 startup          # once, so it comes back after a reboot
// After pulling changes:
//   npm ci && npm run build && pm2 reload deploy/ecosystem.config.cjs
//
// This starts next directly instead of going through `npm start`, so pm2 watches the server
// process itself and its restarts and signals aren't swallowed by an npm wrapper. The working
// directory is hub-be, the same as `npm start -w hub-be` uses, which is where next finds its
// build in .next and the settings in hub-be/.env

const path = require('path')

const repoRoot = path.resolve(__dirname, '..')

module.exports = {
  apps: [
    {
      name: 'openspace-hub',
      // npm workspaces install next in the repo root's node_modules
      script: path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start',
      cwd: path.join(repoRoot, 'hub-be'),
      // One process: Payload's jobs and the upload handling assume a single instance, and Apache
      // proxies to this one port
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // What `npm start` passes through cross-env
        NODE_OPTIONS: '--no-deprecation',
      },
      // Large bundle uploads (up to 512 MB) can take a while; don't let pm2 kill the process
      // mid-upload when it restarts or reloads
      kill_timeout: 600000,
      // Restart on failure, but stop flapping if it can't come up at all
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      min_uptime: 30000,
      // Never watch files in production: a build writes into .next while the app is running
      watch: false,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
