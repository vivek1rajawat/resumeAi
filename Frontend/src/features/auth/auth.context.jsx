import { createContext, useState, useEffect } from "react";
import { getMe } from "./services/auth.api";


export const AuthContext = createContext()


export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Runs exactly once for the whole app (AuthProvider mounts once at the
    // root), so a successful login/register right after this is never
    // clobbered by a second, redundant session check.
    useEffect(() => {
        const initSession = async () => {
            try {
                const data = await getMe();
                setUser(data?.user || null);
            } catch (err) {
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        initSession();
    }, []);


    return (
        <AuthContext.Provider value={{user,setUser,loading,setLoading,error,setError}} >
            {children}
        </AuthContext.Provider>
    )


}