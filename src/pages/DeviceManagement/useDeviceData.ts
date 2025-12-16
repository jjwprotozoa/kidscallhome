// src/pages/DeviceManagement/useDeviceData.ts
// Purpose: Hook for fetching device data

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { safeLog, sanitizeError, sanitizeObject } from "@/utils/security";
import { Device } from "./types";

export const useDeviceData = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceHistory, setDeviceHistory] = useState<Device[]>([]);
  const [allChildren, setAllChildren] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { toast } = useToast();

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("devices")
        .select(
          `
          *,
          children:last_used_child_id (
            name
          )
        `
        )
        .eq("parent_id", user.id)
        .eq("is_active", true)
        .order("last_login_at", { ascending: false });

      if (
        error &&
        (error.code === "42P01" || error.message?.includes("does not exist"))
      ) {
        toast({
          title: "Database Migration Required",
          description:
            "The devices table doesn't exist yet. Please run the migration: supabase/migrations/20250122000000_add_device_management.sql",
          variant: "destructive",
          duration: 10000,
        });
        safeLog.error(
          "❌ [DEVICE MANAGEMENT] Migration not run:",
          sanitizeError(error)
        );
        return;
      }

      if (error) throw error;

      const transformedDevices = (data || []).map((device) => ({
        ...device,
        child_name: device.children?.name || null,
      })) as Device[];

      safeLog.log("📋 [DEVICE MANAGEMENT] Fetched devices:", {
        count: transformedDevices.length,
        devices: transformedDevices.map((d: Device) => ({
          id: d.id,
          name: d.device_name,
          isActive: d.is_active,
        })),
      });

      setDevices(transformedDevices);
    } catch (error: unknown) {
      safeLog.error("Error fetching devices:", sanitizeError(error));
      toast({
        title: "Error",
        description: "Failed to load devices. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchChildren = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("children")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      setAllChildren(data || []);
    } catch (error: unknown) {
      safeLog.error("Error fetching children:", sanitizeError(error));
    }
  }, []);

  const fetchDeviceHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("devices")
        .select(
          `
          *,
          children:last_used_child_id (
            name
          )
        `
        )
        .eq("parent_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const transformedDevices = (data || []).map((device) => ({
        ...device,
        child_name: device.children?.name || null,
      })) as Device[];

      safeLog.log("📋 [DEVICE MANAGEMENT] Fetched device history:", {
        count: transformedDevices.length,
        active: transformedDevices.filter((d: Device) => d.is_active).length,
        inactive: transformedDevices.filter((d: Device) => !d.is_active).length,
      });

      setDeviceHistory(transformedDevices);
    } catch (error: unknown) {
      safeLog.error("Error fetching device history:", sanitizeError(error));
      toast({
        title: "Error",
        description: "Failed to load device history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  return {
    devices,
    deviceHistory,
    allChildren,
    loading,
    historyLoading,
    fetchDevices,
    fetchChildren,
    fetchDeviceHistory,
  };
};







