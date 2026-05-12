import axios from 'axios';

const SAFE_METHODS = new Set(['get', 'head', 'options', 'trace']);

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(encodedName)) {
      return decodeURIComponent(trimmed.slice(encodedName.length));
    }
  }
  return null;
}

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Se for FormData, remove Content-Type para o browser enviar boundary correto.
api.interceptors.request.use(
  (config) => {
    const method = String(config.method || 'get').toLowerCase();
    if (!SAFE_METHODS.has(method)) {
      const csrfToken = getCookie('fortcordis_csrf');
      if (csrfToken) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratamento de erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Sessao expirada/invalidada.
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
