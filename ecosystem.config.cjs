module.exports = {
  apps: [
    {
      name: "cbdrop",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      restart_delay: 2000,
      max_memory_restart: "1G",
      kill_timeout: 5000,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
