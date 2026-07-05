import { useState, useEffect, useCallback } from "react";
import type { UserInfo } from "../types";

interface AuthResult {
  pingOk: boolean;
  authing: boolean;
  error: string | null;
  userInfo: UserInfo | null;
  checkPing: () => Promise<void>;
  handleLogin: () => Promise<void>;
  setUserInfo: (info: UserInfo | null) => void;
  setError: (err: string | null) => void;
  setPingOk: (ok: boolean) => void;
}

export function useAuth(
  setStatus: (s: any) => void,
  initQueueAndPlay: () => Promise<{ error?: string } | undefined>,
): AuthResult {
  const [pingOk, setPingOk] = useState(false);
  const [authing, setAuthing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const checkPing = useCallback(async () => {
    setStatus("pinging");
    setError(null);
    try {
      const result = await window.api.ping();
      if (result.ym && result.yt) {
        setPingOk(true);
        const restored = await window.api.ymRestoreSession();
        if (restored) {
          setUserInfo(restored);
          const res = await initQueueAndPlay();
          if (res?.error) {
            setError(res.error);
          }
          return;
        }
        setStatus("idle");
      } else {
        const failed: string[] = [];
        if (!result.ym) failed.push("Yandex Music");
        if (!result.yt) failed.push("YouTube Music");
        setError(`Unavailable: ${failed.join(", ")}`);
        setStatus("idle");
      }
    } catch (e: any) {
      setError(e.message ?? "Ping failed");
      setStatus("idle");
    }
  }, [setStatus, initQueueAndPlay]);

  useEffect(() => { checkPing(); }, [checkPing]);

  const handleLogin = useCallback(async () => {
    setAuthing(true);
    setError(null);
    try {
      await window.api.ymLoginOAuth();
      const info = await window.api.getUserInfo();
      setUserInfo(info);
      const res = await initQueueAndPlay();
      if (res?.error) {
        setError(res.error);
      }
    } catch (e: any) {
      setError(e.message === "Auth window closed" ? "Sign in cancelled" : e.message ?? "Auth failed");
    }
    setAuthing(false);
  }, [initQueueAndPlay]);

  return { pingOk, authing, error, userInfo, checkPing, handleLogin, setUserInfo, setError, setPingOk };
}
