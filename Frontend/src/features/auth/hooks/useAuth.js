import { useContext, useEffect } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe } from "../services/auth.api";

export const useAuth = () => {

    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }

    const { user, setUser, loading, setLoading } = context;

    const handleLogin = async ({ email, password }) => {
        setLoading(true);
        try {
            const data = await login({ email, password });
            setUser(data?.user || null);
        } catch (err) {
            console.error("Login Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async ({ username, email, password }) => {
        setLoading(true);
        try {
            const data = await register({ username, email, password });
            setUser(data?.user || null);
        } catch (err) {
            console.error("Register Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await logout();
            setUser(null);
        } catch (err) {
            console.error("Logout Error:", err);
        } finally {
            setLoading(false);
        }
    };
    //

    useEffect(() => {

        const getAndSetUser = async () => {
            try {
                const data = await getMe();
                setUser(data?.user || null);
            } catch (err) {
                console.error("GetMe Error:", err);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        getAndSetUser();

    }, [setUser, setLoading]);

    return { user, loading, handleRegister, handleLogin, handleLogout };
};