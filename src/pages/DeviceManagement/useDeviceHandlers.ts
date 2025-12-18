// src/pages/DeviceManagement/useDeviceHandlers.ts
// Purpose: Hook for device CRUD operations

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { safeLog, sanitizeError, sanitizeObject } from "@/utils/security";
import { Device } from "./types";

export const useDeviceHandlers = (
  refreshDevices: () => Promise<void>,
  refreshHistory: () => Promise<void>,
  activeTab: string
) => {
  const { toast } = useToast();
  const [requireAuth, setRequireAuth] = useState(false);
  const [authPassword, setAuthPassword] = useState("");

  const handleRemoveDevice = async (
    device: Device,
    onComplete: () => void
  ) => {
    if (!device) {
      safeLog.warn("⚠️ [DEVICE MANAGEMENT] No device selected for removal");
      return;
    }

    safeLog.log(
      "🔍 [DEVICE MANAGEMENT] Remove device initiated:",
      sanitizeObject({
        deviceId: device.id,
        deviceName: device.device_name,
        requireAuth,
      })
    );

    if (!requireAuth) {
      safeLog.log("🔐 [DEVICE MANAGEMENT] Showing password prompt");

      const childInfo = device.child_name
        ? ` (used by ${device.child_name})`
        : "";
      toast({
        title: "⚠️ Warning: Device Removal",
        description: `You are about to remove "${device.device_name}"${childInfo}. This action requires password confirmation and cannot be undone.`,
        variant: "destructive",
        duration: 5000,
      });

      setTimeout(() => {
        setRequireAuth(true);
      }, 100);
      return;
    }

    if (!authPassword.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter your password to confirm device removal.",
        variant: "destructive",
      });
      return;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        safeLog.error(
          "❌ [DEVICE MANAGEMENT] User auth error:",
          sanitizeError(userError)
        );
        throw new Error("Not authenticated");
      }

      safeLog.log(
        "🔐 [DEVICE MANAGEMENT] Verifying password for user:",
        sanitizeObject({ email: user.email })
      );

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email || "",
        password: authPassword,
      });

      if (authError) {
        safeLog.error(
          "❌ [DEVICE MANAGEMENT] Password verification failed:",
          sanitizeError(authError)
        );
        toast({
          title: "Authentication Failed",
          description: "Incorrect password. Please try again.",
          variant: "destructive",
        });
        setAuthPassword("");
        return;
      }

      safeLog.log(
        "✅ [DEVICE MANAGEMENT] Password verified, calling revoke_device RPC"
      );

      const { data: revokeResult, error } = await supabase.rpc(
        "revoke_device",
        {
          p_device_id: device.id,
          p_parent_id: user.id,
        }
      );

      safeLog.log(
        "📡 [DEVICE MANAGEMENT] RPC response:",
        sanitizeObject({ revokeResult, error })
      );

      if (error) {
        safeLog.error(
          "❌ [DEVICE MANAGEMENT] RPC error:",
          sanitizeError(error)
        );
        throw error;
      }

      if (revokeResult === false) {
        safeLog.warn(
          "⚠️ [DEVICE MANAGEMENT] Device not found or permission denied"
        );
        throw new Error(
          "Device not found or you don't have permission to remove it"
        );
      }

      safeLog.log(
        "✅ [DEVICE MANAGEMENT] Device revoked successfully:",
        sanitizeObject({
          deviceId: device.id,
          deviceName: device.device_name,
          revokeResult,
        })
      );

      const removedDeviceName = device.device_name;

      setRequireAuth(false);
      setAuthPassword("");
      onComplete();

      toast({
        title: "✅ Device Removed Successfully",
        description: `${removedDeviceName} has been removed and will need to be re-authorized on next login.`,
        variant: "success",
        duration: 5000,
      });

      safeLog.log("🔄 [DEVICE MANAGEMENT] Refreshing devices list");
      await refreshDevices();
      if (activeTab === "history") {
        await refreshHistory();
      }
    } catch (error: unknown) {
      safeLog.error(
        "❌ [DEVICE MANAGEMENT] Error removing device:",
        sanitizeError(error)
      );
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to remove device. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleRenameDevice = async (
    device: Device,
    newName: string,
    onComplete: () => void
  ) => {
    if (!device || !newName.trim()) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("devices")
        .update({ device_name: newName.trim() })
        .eq("id", device.id)
        .eq("parent_id", user.id);

      if (error) throw error;

      toast({
        title: "Device Renamed",
        description: `Device renamed to "${newName.trim()}"`,
      });

      onComplete();
      await refreshDevices();
    } catch (error: unknown) {
      safeLog.error("Error renaming device:", sanitizeError(error));
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to rename device. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return {
    requireAuth,
    authPassword,
    setAuthPassword,
    handleRemoveDevice,
    handleRenameDevice,
    resetAuth: () => {
      setRequireAuth(false);
      setAuthPassword("");
    },
  };
};










