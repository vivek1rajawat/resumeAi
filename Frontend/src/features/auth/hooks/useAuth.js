import { useContext } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout } from "../services/auth.api";

export const useAuth = () => {

    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }

    const { user, setUser, loading, setLoading, error, setError } = context;

    const handleLogin = async ({ email, password }) => {
        setLoading(true);
        setError(null);
        try {
            const data = await login({ email, password });
            setUser(data?.user || null);
            return true;
        } catch (err) {
            console.error("Login Error:", err);
            setError(err?.response?.data?.message || "Login failed. Please try again.");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async ({ username, email, password }) => {
        setLoading(true);
        setError(null);
        try {
            const data = await register({ username, email, password });
            setUser(data?.user || null);
            return true;
        } catch (err) {
            console.error("Register Error:", err);
            setError(err?.response?.data?.message || "Registration failed. Please try again.");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await logout();
            setUser(null);
            return true;
        } catch (err) {
            console.error("Logout Error:", err);
            setError(err?.response?.data?.message || "Logout failed. Please try again.");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { user, loading, error, handleRegister, handleLogin, handleLogout };
};