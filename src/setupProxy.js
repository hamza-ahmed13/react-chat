const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://cinnova-chat-api.deliveredoncloud.com',
      changeOrigin: true,
    })
  );

  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'https://cinnova-chat-api.deliveredoncloud.com',
      changeOrigin: true,
      ws: true,
    })
  );
};
