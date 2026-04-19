module.exports = {
  apps: [{
    name: 'chatbot-drjorgehara',
    script: '/root/AnitaChatBot-DrJorgeHara/node_modules/.bin/tsx',
    args: '/root/AnitaChatBot-DrJorgeHara/src/app.ts',
    cwd: '/root/AnitaChatBot-DrJorgeHara',
    env_production: {
      NODE_ENV: 'production'
    },
    env: {
      PATH: '/root/.nvm/versions/node/v22.16.0/bin:/usr/bin:/usr/sbin:$PATH'
    },
    autorestart: true,
    max_restarts: 10,
    min_uptime: 5000,
    kill_timeout: 5000,
    listen_timeout: 15000
  }]
};