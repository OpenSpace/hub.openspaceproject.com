// pm2 config for running the hub in production: `yarn build`, then `pm2 start ecosystem.config.cjs`.
// One process serves everything (the API, the admin panel and the built frontend) on PORT;
// the web server in front of it (e.g. Apache) handles HTTPS and proxies to it.
// Settings such as DATABASE_URI and PAYLOAD_SECRET come from hub-be/.env
module.exports = {
  apps: [
    {
      name: 'openspace-hub',
      cwd: './hub-be',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--no-deprecation',
        PORT: 3000,
      },
    },
  ],
}
