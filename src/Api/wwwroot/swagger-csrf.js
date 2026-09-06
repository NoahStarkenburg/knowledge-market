(function () {
    function getCookie(name) {
        const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[2]) : "";
    }

    function isUnsafe(method) {
        method = (method || "").toUpperCase();
        return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
    }

    // Swagger UI exposes `window.ui` after it loads
    const interval = setInterval(() => {
        if (!window.ui) return;

        clearInterval(interval);

        // Inject a request interceptor: runs before each request
        const old = window.ui.getConfigs().requestInterceptor;

        window.ui.getConfigs().requestInterceptor = function (req) {
            try {
                if (isUnsafe(req.method)) {
                    const csrf = getCookie("km_csrf");
                    if (csrf) {
                        req.headers = req.headers || {};
                        req.headers["X-CSRF"] = csrf;
                    }
                }
            } catch (e) { }

            return old ? old(req) : req;
        };
    }, 100);
})();
