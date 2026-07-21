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
import { loadProfile, saveProfile } from "../services/storage/progressStorage";
import { defaultProfile, type PersistedProfile } from "../services/storage/schemas";
import { useStorageService } from "../services/storage/StorageServiceProvider";

export type ProfileContextValue = {
  /** The player profile — best score, Bolts, cumulative stats, tutorial. */
  profile: PersistedProfile;
  /** True once the persisted profile has loaded (before this, `profile` is the
   *  default and must not be written back). */
  loaded: boolean;
  /** Apply a pure update and persist it. The updater must be idempotent-safe;
   *  callers (run settlement) guard against double-application themselves. */
  updateProfile: (updater: (current: PersistedProfile) => PersistedProfile) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** Loads and persists the player profile, separate from any GameState. Profile
 *  and Bolts never live on GameState — this is their only home. */
export function ProfileProvider({
  children,
  now = Date.now,
}: {
  children: ReactNode;
  now?: () => number;
}) {
  const storage = useStorageService();
  const [profile, setProfile] = useState<PersistedProfile>(() => defaultProfile(now()));
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let stored: PersistedProfile;
      try {
        stored = await loadProfile(storage, now());
      } catch (error) {
        // Load failure: keep the default profile (already in state) so the
        // player is never blocked; record for diagnostics.
        reportCaught("persistence", error, { op: "loadProfile" });
        loadedRef.current = true;
        if (!cancelled) {
          setLoaded(true);
        }
        return;
      }
      if (cancelled) {
        return;
      }
      setProfile(stored);
      loadedRef.current = true;
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateProfile = useCallback(
    (updater: (current: PersistedProfile) => PersistedProfile) => {
      setProfile((current) => {
        const next = { ...updater(current), updatedAt: now() };
        // Only persist after the initial load so a default never overwrites a
        // real profile mid-hydration.
        if (loadedRef.current) {
          void saveProfile(storage, next).catch((error) =>
            reportCaught("persistence", error, { op: "saveProfile" }),
          );
        }
        return next;
      });
    },
    [storage, now],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, loaded, updateProfile }),
    [profile, loaded, updateProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return value;
}
