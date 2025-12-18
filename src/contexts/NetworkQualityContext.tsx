// src/contexts/NetworkQualityContext.tsx
// Global context for sharing network quality state across components
// Used by call screens to broadcast quality info to navigation

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { NetworkQualityLevel, ConnectionType, NetworkStats } from "@/features/calls/hooks/useNetworkQuality";

interface NetworkQualityState {
  isInCall: boolean;
  qualityLevel: NetworkQualityLevel;
  connectionType: ConnectionType;
  isVideoPausedDueToNetwork: boolean;
}

interface NetworkQualityContextType {
  state: NetworkQualityState;
  setCallActive: (active: boolean) => void;
  updateQuality: (
    qualityLevel: NetworkQualityLevel,
    connectionType: ConnectionType,
    isVideoPausedDueToNetwork: boolean
  ) => void;
}

const defaultState: NetworkQualityState = {
  isInCall: false,
  qualityLevel: "moderate",
  connectionType: "unknown",
  isVideoPausedDueToNetwork: false,
};

const NetworkQualityContext = createContext<NetworkQualityContextType>({
  state: defaultState,
  setCallActive: () => {},
  updateQuality: () => {},
});

export const NetworkQualityProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<NetworkQualityState>(defaultState);

  const setCallActive = useCallback((active: boolean) => {
    setState(prev => ({
      ...prev,
      isInCall: active,
      // Reset to defaults when call ends
      ...(active ? {} : {
        qualityLevel: "moderate" as NetworkQualityLevel,
        connectionType: "unknown" as ConnectionType,
        isVideoPausedDueToNetwork: false,
      }),
    }));
  }, []);

  const updateQuality = useCallback((
    qualityLevel: NetworkQualityLevel,
    connectionType: ConnectionType,
    isVideoPausedDueToNetwork: boolean
  ) => {
    setState(prev => ({
      ...prev,
      qualityLevel,
      connectionType,
      isVideoPausedDueToNetwork,
    }));
  }, []);

  return (
    <NetworkQualityContext.Provider value={{ state, setCallActive, updateQuality }}>
      {children}
    </NetworkQualityContext.Provider>
  );
};

export const useNetworkQualityContext = () => useContext(NetworkQualityContext);

