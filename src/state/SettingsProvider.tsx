import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { reportCaught } from "../services/diagnostics/reportError";
import { loadSettings, saveSettings } from "../services/storage/settingsStorage";
import { defaultSettings, type PersistedSettings } from "../services/storage/schemas";
import { useStorageService } from "../services/storage/StorageServiceProvider";

export type SettingsContextValue = {
  settings: PersistedSettings;
  loaded: boolean;
  /** Merge a patch into settings and persist it. */
  updateSettings: (patch: Partial<PersistedSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Loads and persists player settings (sound/music/haptics, reduced-motion
 *  override, theme). Survives app restart via StorageService. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const storage = useStorageService();
  const [settings, setSettings] = useState<PersistedSettings>(() => defaultSettings());
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let stored: PersistedSettings;
      try {
        stored = await loadSettings(storage);
      } catch (error) {
        // Load failure: keep the defaults (already in state); record it.
        reportCaught("persistence", error, { op: "loadSettings" });
        loadedRef.current = true;
        if (!cancelled) {
          setLoaded(true);
        }
        return;
      }
      if (cancelled) {
        return;
      }
      setSettings(stored);
      loadedRef.current = true;
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<PersistedSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        if (loadedRef.current) {
          void saveSettings(storage, next).catch((error) =>
            reportCaught("persistence", error, { op: "saveSettings" }),
          );
        }
        return next;
      });
    },
    [storage],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loaded, updateSettings }),
    [settings, loaded, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return value;
}
