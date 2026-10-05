import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Auth, getTokens, setTokens } from "../api/client";
import { syncGuestProgress } from "../lib/progress";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getTokens());

  useEffect(() => {
    if (!getTokens()) return;
    Auth.me()
      .then(setUser)
      .catch(() => setTokens(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("anivexa:logout", onLogout);
    return () => window.removeEventListener("anivexa:logout", onLogout);
  }, []);

  const finish = useCallback(async (payload) => {
    setTokens({ access: payload.access, refresh: payload.refresh });
    setUser(payload.user);
    await syncGuestProgress();
    return payload.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      login: async (identifier, password) => finish(await Auth.login(identifier, password)),
      register: async (form) => finish(await Auth.register(form)),
      logout: () => {
        setTokens(null);
        setUser(null);
      },
      setUser,
      finish,
    }),
    [user, ready, finish]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
