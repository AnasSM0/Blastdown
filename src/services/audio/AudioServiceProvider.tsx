import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createNoOpAudioService } from "./NoOpAudioService";
import type { AudioService } from "./types";

const AudioServiceContext = createContext<AudioService | null>(null);

/** Supplies the app's `AudioService`. Defaults to the safe no-op so nothing
 *  that merely renders under this provider ever touches expo-audio; the root
 *  layout passes the real `createExpoAudioService()`, and tests inject a
 *  recording no-op. This module deliberately does not import the expo-audio
 *  implementation, keeping the native dependency out of most test trees. */
export function AudioServiceProvider({
  children,
  service,
}: {
  children: ReactNode;
  service?: AudioService;
}) {
  const value = useMemo(() => service ?? createNoOpAudioService(), [service]);
  return <AudioServiceContext.Provider value={value}>{children}</AudioServiceContext.Provider>;
}

export function useAudioService(): AudioService {
  const service = useContext(AudioServiceContext);
  if (!service) {
    throw new Error("useAudioService must be used within an AudioServiceProvider");
  }
  return service;
}
