import axios from "axios";

const getBaseUrl = () => {
  let url = import.meta.env.VITE_API_BASE_URL;
  if (url) {
    url = url.trim();
    if (!url.endsWith("/api")) {
      url = url.replace(/\/+$/, "") + "/api";
    }
    return url;
  }
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return `${window.location.origin}/api`;
  }
  return "http://localhost:4000/api";
};

const API_BASE_URL = getBaseUrl();

const client = axios.create({ baseURL: API_BASE_URL });

let refreshPromise = null;

const store = {
  getAccess: () => localStorage.getItem("missile_access_token"),
  getRefresh: () => localStorage.getItem("missile_refresh_token"),
  set: ({ accessToken, refreshToken, user }) => {
    if (accessToken) localStorage.setItem("missile_access_token", accessToken);
    if (refreshToken) localStorage.setItem("missile_refresh_token", refreshToken);
    if (user) localStorage.setItem("missile_user", JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem("missile_access_token");
    localStorage.removeItem("missile_refresh_token");
    localStorage.removeItem("missile_user");
  },
};

// Silent single-flight refresh of the access token.
async function refreshAccessToken() {
  const refreshToken = store.getRefresh();
  if (!refreshToken) throw new Error("no-refresh-token");
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then(({ data }) => {
        store.set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
        return data.accessToken;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

client.interceptors.request.use((config) => {
  const token = store.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (response?.status === 401 && config && !config._retried) {
      config._retried = true;
      try {
        const accessToken = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return client(config);
      } catch {
        store.clear();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("auth:expired"));
      }
    }
    return Promise.reject(error);
  },
);

export { store as authStore };
export default client;