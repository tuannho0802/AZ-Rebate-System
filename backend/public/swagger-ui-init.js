// Custom Swagger UI initializer - auto-authorize after login
window.ui = SwaggerUIBundle({
  configUrl: undefined,
  dom_id: '#swagger-ui',
  presets: [
    SwaggerUIBundle.presets.apis,
    SwaggerUIBundle.SwaggerUIStandalonePreset
  ],
  layout: "BaseLayout",
  requestInterceptor: function(req) {
    return req;
  },
  responseInterceptor: function(res) {
    // Try to parse response as JSON
    if (res.ok || res.status === 200) {
      res.text().then(function(text) {
        try {
          const data = JSON.parse(text);
          // Check if this is a login response with accessToken
          if (data.accessToken || data.token) {
            const token = data.accessToken || data.token;
            window.ui.preauthorizeApiKey('access-token', 'Bearer ' + token);
            // Show a toast notification
            if (window.ui.preAuthToast) {
              window.ui.preAuthToast();
            }
          }
        } catch (e) {
          // Not JSON or not a login response
        }
      });
    }
    return res;
  }
});

// Expose preAuthToast for use in customJs
window.ui.preAuthToast = function() {
  // This will be called after authorization is set
  setTimeout(() => {
    console.log('✅ Token autorized automatically from login response');
  }, 100);
};
