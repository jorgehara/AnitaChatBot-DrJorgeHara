module.exports = {
  apps: [{
    name: 'chatbot-drjorgehara',
    script: '/root/AnitaChatBot-DrJorgeHara/node_modules/.bin/tsx',
    args: './src/app.ts',
    interpreter: 'none',
    cwd: '/root/AnitaChatBot-DrJorgeHara',
    env_production: {
      NODE_ENV: 'production',
      PATH: '/root/.nvm/versions/node/v22.16.0/bin:/usr/bin:/usr/sbin:$PATH'
    },
    autorestart: true,
    max_restarts: 10,
    min_uptime: 5000
  }]
};