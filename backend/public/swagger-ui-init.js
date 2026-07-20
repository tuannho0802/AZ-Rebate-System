// Custom Swagger UI hook — auto-authorize sau khi login, KHÔNG được tự tạo
// lại SwaggerUIBundle ở đây. NestJS SwaggerModule đã tự khởi tạo sẵn
// `window.ui` bằng script inline TRƯỚC KHI file customJs này được load (đây
// là cách swagger-ui-express/nestjs chèn customJs — luôn sau script khởi
// tạo chính). Gọi lại `new SwaggerUIBundle({...})` ở đây sẽ tạo ra 1
// instance UI thứ 2, không biết địa chỉ file OpenAPI JSON thật (vì không
// truyền đúng `url`) -> Swagger cố fetch "/undefined" -> lỗi 404 đã gặp.
// Cách đúng: chỉ "nghe" request/response thật của trình duyệt qua
// window.fetch, không đụng gì tới việc khởi tạo UI.
(function () {
  const LOGIN_PATH_REGEX = /\/auth\/(admin|user)\/login(\?.*)?$/;

  const originalFetch = window.fetch;

  window.fetch = function (...args) {
    return originalFetch.apply(this, args).then((response) => {
      try {
        const requestUrl =
          typeof args[0] === 'string'
            ? args[0]
            : args[0] && typeof args[0].url === 'string'
              ? args[0].url
              : '';

        if (requestUrl && LOGIN_PATH_REGEX.test(requestUrl) && response.ok) {
          // clone() bắt buộc — response.json() gốc chỉ đọc được 1 lần, mà
          // Swagger UI vẫn cần đọc lại response gốc để hiển thị kết quả
          // trong "Try it out".
          response
            .clone()
            .json()
            .then((data) => {
              const token = data && data.accessToken;
              if (token && window.ui && typeof window.ui.preauthorizeApiKey === 'function') {
                // QUAN TRỌNG: KHÔNG thêm tiền tố "Bearer " thủ công ở đây.
                // Với security scheme kiểu http/bearer, Swagger UI tự thêm
                // "Bearer " khi gắn vào header Authorization — truyền thêm
                // vào sẽ ra "Bearer Bearer <token>" và mọi request sau đó
                // vẫn bị 401 dù tưởng đã auto-authorize thành công.
                window.ui.preauthorizeApiKey('access-token', token);
                // eslint-disable-next-line no-console
                console.log(
                  '%c✅ Token đã được tự động authorize từ login response',
                  'color: #16a34a; font-weight: bold;',
                );
              }
            })
            .catch(() => {
              // Không phải JSON hợp lệ hoặc không có accessToken -> bỏ qua im lặng.
            });
        }
      } catch (e) {
        // Không được để lỗi ở đây làm crash luồng fetch thật của Swagger UI.
      }

      return response;
    });
  };
})();