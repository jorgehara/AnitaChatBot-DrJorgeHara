module.exports = {
  apps: [{
    name: 'chatbot-drjorgehara',
    script: '/root/.nvm/versions/node/v22.16.0/bin/node',
    args: '/root/AnitaChatBot-DrJorgeHara/dist/src/app.js',
    interpreter: 'none',
    cwd: '/root/AnitaChatBot-DrJorgeHara',
    env_production: {
      NODE_ENV: 'production'
    },
    env: {
      PATH: '/root/.nvm/versions/node/v22.16.0/bin:/usr/bin:/usr/sbin:$PATH'
    },
    autorestart: true,
    max_restarts: 10,
    min_uptime: 5000
  }]
};