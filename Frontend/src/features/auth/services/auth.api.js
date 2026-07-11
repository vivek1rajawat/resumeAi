import axios from "axios";

const TOKEN_KEY = "auth_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
};
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true
});

// Cross-domain deployments (e.g. Vercel frontend + Render backend) can have
// their auth cookie silently blocked by browser third-party cookie policies.
// Sending the token as a Bearer header is a reliable fallback that doesn't
// depend on cookie behavior.
api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// REGISTER
export async function register({ username, email, password }) {
    try {
        const response = await api.post("/api/auth/register", {
            username,
            email,
            password
        });

        setToken(response.data?.token);
        return response.data;

    } catch (err) {
        console.error("Register API Error:", err?.response?.data || err.message);
        throw err; // 🔥 important
    }
}

// LOGIN
export async function login({ email, password }) {
    try {
        const response = await api.post("/api/auth/login", {
            email,
            password
        });

        setToken(response.data?.token);
        return response.data;

    } catch (err) {
        console.error("Login API Error:", err?.response?.data || err.message);
        throw err; // 🔥 important
    }
}

// LOGOUT
export async function logout() {
    try {
        const response = await api.get("/api/auth/logout");
        return response.data;

    } catch (err) {
        console.error("Logout API Error:", err?.response?.data || err.message);
        throw err;
    } finally {
        clearToken();
    }
}

// GET CURRENT USER
export async function getMe() {
    try {
        const response = await api.get("/api/auth/get-me");
        return response.data;

    } catch (err) {
        console.error("GetMe API Error:", err?.response?.data || err.message);
        throw err;
    }
}