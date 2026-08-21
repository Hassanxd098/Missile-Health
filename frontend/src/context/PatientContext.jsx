import { createContext, useContext, useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setUser, logoutUser } from "../store/slices/authSlice";

const PatientContext = createContext(null);

const rememberMe = () => localStorage.getItem("missile_remember") === "1";
const IDLE_TIMEOUT_MS = (Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || 30)) * 60 * 1000;

export function PatientProvider({ children }) {
  const dispatch = useAppDispatch();
  const patient = useAppSelector((state) => state.auth.user);
  const idleTimer = useRef(null);

  const persist = useCallback((data) => {
    if (data.accessToken) localStorage.setItem("missile_access_token", data.accessToken);
    if (data.refreshToken) localStorage.setItem("missile_refresh_token", data.refreshToken);
    if (data.user) {
      localStorage.setItem("missile_user", JSON.stringify(data.user));
      dispatch(setUser(data.user));
    }
  }, [dispatch]);

  const scheduleIdleLogout = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      dispatch(logoutUser());
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }, IDLE_TIMEOUT_MS);
  }, [dispatch]);

  useEffect(() => scheduleIdleLogout(), [scheduleIdleLogout]);

  const login = useCallback((data, { remember = false } = {}) => {
    persist(data);
    localStorage.setItem("missile_remember", remember ? "1" : "0");
    scheduleIdleLogout();
    return data.user;
  }, [persist, scheduleIdleLogout]);

  const logout = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    dispatch(logoutUser());
  }, [dispatch]);

  useEffect(() => {
    const onExpired = () => { dispatch(logoutUser()); };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [dispatch]);

  return (
    <PatientContext.Provider value={{ patient, login, logout, persist, rememberMe }}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used within PatientProvider");
  return ctx;
}
