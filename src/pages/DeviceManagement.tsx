// src/pages/DeviceManagement.tsx
// Purpose: Device management page for parents to view and manage authorized devices

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import {
  Smartphone,
  Tablet,
  Monitor,
  Trash2,
  Edit2,
  AlertTriangle,
  Shield,
  Plus,
  RefreshCw,
  History,
  ArrowUp,
  Filter,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { parseDeviceInfo } from "@/utils/userAgentParser";
import { countryCodeToFlag } from "@/utils/ipGeolocation";

interface Device {
  id: string;
  device_name: string;
  device_type: "mobile" | "tablet" | "desktop" | "other";
  last_used_child_id: string | null;
  last_login_at: string;
  last_ip_address: string | null;
  last_location: string | null;
  mac_address: string | null;
  user_agent: string | null;
  country_code: string | null;
  is_active: boolean;
  created_at: string;
  child_name?: string; // Joined from children table
}

const DeviceManagement = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceHistory, setDeviceHistory] = useState<Device[]>([]);
  const [allChildren, setAllChildren] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [deviceToRemove, setDeviceToRemove] = useState<Device | null>(null);
  const [deviceToRename, setDeviceToRename] = useState<Device | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [showAddDeviceDialog, setShowAddDeviceDialog] = useState(false);
  const [requireAuth, setRequireAuth] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  
  // Filter and pagination state
  const [historyChildFilter, setHistoryChildFilter] = useState<string>("all");
  const [historyDeviceTypeFilter, setHistoryDeviceTypeFilter] = useState<string>("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const historyPageSize = 10;
  
  // Active devices filter state
  const [activeChildFilter, setActiveChildFilter] = useState<string>("all");
  const [activeDeviceTypeFilter, setActiveDeviceTypeFilter] = useState<string>("all");
  
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const historyContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("devices")
        .select(`
          *,
          children:last_used_child_id (
            name
          )
        `)
        .eq("parent_id", user.id)
        .eq("is_active", true) // Only show active devices
        .order("last_login_at", { ascending: false });

      // Check if devices table doesn't exist (migration not run)
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        toast({
          title: "Database Migration Required",
          description: "The devices table doesn't exist yet. Please run the migration: supabase/migrations/20250122000000_add_device_management.sql",
          variant: "destructive",
          duration: 10000,
        });
        console.error("❌ [DEVICE MANAGEMENT] Migration not run:", error);
        return;
      }

      if (error) throw error;

      // Transform data to include child name
      const transformedDevices = (data || []).map((device: any) => ({
        ...device,
        child_name: device.children?.name || null,
      }));

      console.log("📋 [DEVICE MANAGEMENT] Fetched devices:", {
        count: transformedDevices.length,
        devices: transformedDevices.map((d: Device) => ({
          id: d.id,
          name: d.device_name,
          isActive: d.is_active,
        })),
      });

      setDevices(transformedDevices);
    } catch (error: any) {
      console.error("Error fetching devices:", error);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("children")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      setAllChildren(data || []);
    } catch (error: any) {
      console.error("Error fetching children:", error);
    }
  }, []);

  const fetchDeviceHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch ALL devices (active and inactive) for history
      const { data, error } = await supabase
        .from("devices")
        .select(`
          *,
          children:last_used_child_id (
            name
          )
        `)
        .eq("parent_id", user.id)
        .order("updated_at", { ascending: false }); // Order by last update (when deactivated or last login)

      if (error) throw error;

      // Transform data to include child name
      const transformedDevices = (data || []).map((device: any) => ({
        ...device,
        child_name: device.children?.name || null,
      }));

      console.log("📋 [DEVICE MANAGEMENT] Fetched device history:", {
        count: transformedDevices.length,
        active: transformedDevices.filter((d: Device) => d.is_active).length,
        inactive: transformedDevices.filter((d: Device) => !d.is_active).length,
      });

      setDeviceHistory(transformedDevices);
    } catch (error: any) {
      console.error("Error fetching device history:", error);
      toast({
        title: "Error",
        description: "Failed to load device history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDevices();
    fetchChildren();

    // Set up real-time subscription for device updates
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Clean up existing channel if any
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

      // Subscribe to INSERT and UPDATE events on devices table for this parent
        channelRef.current = supabase
        .channel("device-management-updates")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "devices",
            filter: `parent_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("📱 [DEVICE MANAGEMENT] New device added:", payload.new);
            // Refresh devices list when a new device is added
            fetchDevices();
            if (activeTab === "history") {
              fetchDeviceHistory();
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "devices",
            filter: `parent_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("📱 [DEVICE MANAGEMENT] Device updated:", {
              deviceId: payload.new.id,
              deviceName: payload.new.device_name,
              isActive: payload.new.is_active,
              oldIsActive: payload.old?.is_active,
            });
            // Refresh devices list when a device is updated (e.g., last_login_at changes or is_active changes)
            fetchDevices();
            if (activeTab === "history") {
              fetchDeviceHistory();
            }
          }
        )
        .subscribe((status, err) => {
          if (err) {
            console.error("❌ [DEVICE MANAGEMENT] Subscription error:", err);
          } else if (status === "SUBSCRIBED") {
            console.log("✅ [DEVICE MANAGEMENT] Subscribed to device updates");
          }
        });
    };

    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchDevices, fetchDeviceHistory, activeTab]);

  // Load history when switching to history tab
  useEffect(() => {
    if (activeTab === "history" && deviceHistory.length === 0 && !historyLoading) {
      fetchDeviceHistory();
    }
  }, [activeTab, fetchDeviceHistory, deviceHistory.length, historyLoading]);

  // Handle scroll for back-to-top button
  useEffect(() => {
    if (activeTab !== "history") {
      setShowBackToTop(false);
      return;
    }

    const handleScroll = () => {
      if (historyContainerRef.current) {
        const scrollTop = historyContainerRef.current.scrollTop;
        setShowBackToTop(scrollTop > 400);
      }
    };

    const container = historyContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      // Check initial scroll position
      handleScroll();
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [activeTab]);

  // Filter and paginate history
  const filteredHistory = deviceHistory.filter((device) => {
    if (historyChildFilter !== "all" && device.last_used_child_id !== historyChildFilter) {
      return false;
    }
    if (historyDeviceTypeFilter !== "all" && device.device_type !== historyDeviceTypeFilter) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredHistory.length / historyPageSize);
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setHistoryPage(1);
  }, [historyChildFilter, historyDeviceTypeFilter]);

  const scrollToTop = () => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Filter active devices
  const filteredActiveDevices = devices.filter((device) => {
    if (activeChildFilter !== "all" && device.last_used_child_id !== activeChildFilter) {
      return false;
    }
    if (activeDeviceTypeFilter !== "all" && device.device_type !== activeDeviceTypeFilter) {
      return false;
    }
    return true;
  });

  const handleRemoveDevice = async () => {
    if (!deviceToRemove) {
      console.warn("⚠️ [DEVICE MANAGEMENT] No device selected for removal");
      return;
    }

    console.log("🔍 [DEVICE MANAGEMENT] Remove device initiated:", {
      deviceId: deviceToRemove.id,
      deviceName: deviceToRemove.device_name,
      requireAuth,
    });

    // Require re-authentication
    if (!requireAuth) {
      console.log("🔐 [DEVICE MANAGEMENT] Showing password prompt");
      
      // Show warning toast first, then update state after a brief delay to ensure toast is visible
      const childInfo = deviceToRemove.child_name 
        ? ` (used by ${deviceToRemove.child_name})`
        : "";
      toast({
        title: "⚠️ Warning: Device Removal",
        description: `You are about to remove "${deviceToRemove.device_name}"${childInfo}. This action requires password confirmation and cannot be undone.`,
        variant: "destructive",
        duration: 5000,
      });
      
      // Small delay to ensure toast renders before dialog updates
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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("❌ [DEVICE MANAGEMENT] User auth error:", userError);
        throw new Error("Not authenticated");
      }

      console.log("🔐 [DEVICE MANAGEMENT] Verifying password for user:", user.email);

      // Verify password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email || "",
        password: authPassword,
      });

      if (authError) {
        console.error("❌ [DEVICE MANAGEMENT] Password verification failed:", authError);
        toast({
          title: "Authentication Failed",
          description: "Incorrect password. Please try again.",
          variant: "destructive",
        });
        setAuthPassword("");
        return;
      }

      console.log("✅ [DEVICE MANAGEMENT] Password verified, calling revoke_device RPC");

      // Revoke device
      const { data: revokeResult, error } = await supabase.rpc("revoke_device", {
        p_device_id: deviceToRemove.id,
        p_parent_id: user.id,
      });

      console.log("📡 [DEVICE MANAGEMENT] RPC response:", { revokeResult, error });

      if (error) {
        console.error("❌ [DEVICE MANAGEMENT] RPC error:", error);
        throw error;
      }

      // Check if device was actually revoked (function returns boolean)
      if (revokeResult === false) {
        console.warn("⚠️ [DEVICE MANAGEMENT] Device not found or permission denied");
        throw new Error("Device not found or you don't have permission to remove it");
      }

      console.log("✅ [DEVICE MANAGEMENT] Device revoked successfully:", {
        deviceId: deviceToRemove.id,
        deviceName: deviceToRemove.device_name,
        revokeResult,
      });

      // Store device name for toast (before clearing state)
      const removedDeviceName = deviceToRemove.device_name;

      // Close dialog first
      setDeviceToRemove(null);
      setRequireAuth(false);
      setAuthPassword("");
      
      // Show success toast with prominent green styling
      toast({
        title: "✅ Device Removed Successfully",
        description: `${removedDeviceName} has been removed and will need to be re-authorized on next login.`,
        variant: "success",
        duration: 5000,
      });
      
      // Refresh devices list and history
      console.log("🔄 [DEVICE MANAGEMENT] Refreshing devices list");
      await fetchDevices();
      if (activeTab === "history") {
        await fetchDeviceHistory();
      }
    } catch (error: any) {
      console.error("❌ [DEVICE MANAGEMENT] Error removing device:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove device. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRenameDevice = async () => {
    if (!deviceToRename || !newDeviceName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("devices")
        .update({ device_name: newDeviceName.trim() })
        .eq("id", deviceToRename.id)
        .eq("parent_id", user.id);

      if (error) throw error;

      toast({
        title: "Device Renamed",
        description: `Device renamed to "${newDeviceName.trim()}"`,
      });

      setDeviceToRename(null);
      setNewDeviceName("");
      fetchDevices();
    } catch (error: any) {
      console.error("Error renaming device:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to rename device. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "mobile":
        return <Smartphone className="h-5 w-5" />;
      case "tablet":
        return <Tablet className="h-5 w-5" />;
      case "desktop":
        return <Monitor className="h-5 w-5" />;
      default:
        return <Smartphone className="h-5 w-5" />;
    }
  };

  const isDeviceStale = (lastLogin: string) => {
    const daysSinceLogin = (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLogin > 30; // Consider stale if not used in 30 days
  };

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
      <OnboardingTour role="parent" pageKey="parent_devices" />
      <HelpBubble role="parent" pageKey="parent_devices" />
      <div
        className="px-4 pb-4"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mt-2">
            <h1 className="text-3xl font-bold">Device Management</h1>
            <p className="text-muted-foreground mt-2">
              View and manage all devices authorized to access your family account
            </p>
          </div>

          {/* Info Card */}
          <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-700 dark:text-blue-300 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  About Device Management
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This page shows all devices that have been used to access your family account.
                  You can remove devices you no longer use or recognize. Removing a device will
                  require re-authorization the next time someone tries to log in from that device.
                </p>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            if (value === "history" && deviceHistory.length === 0) {
              fetchDeviceHistory();
            }
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active Devices</TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Active Devices Tab */}
            <TabsContent value="active" className="space-y-4">
              {/* Actions and Filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={fetchDevices} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                
                {/* Filters */}
                <div className="flex flex-1 gap-2">
                  <Select value={activeChildFilter} onValueChange={setActiveChildFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by child" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Children</SelectItem>
                      {allChildren.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={activeDeviceTypeFilter} onValueChange={setActiveDeviceTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by device type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filter Info */}
              {filteredActiveDevices.length !== devices.length && devices.length > 0 && (
                <Card className="p-3 bg-muted/50 border-muted">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredActiveDevices.length} of {devices.length} active devices
                  </p>
                </Card>
              )}

              {/* Devices List */}
              <div data-tour="parent-devices-list">
              {loading ? (
            <Card className="p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading devices...</p>
            </Card>
              ) : filteredActiveDevices.length === 0 ? (
                <Card className="p-12 text-center">
                  <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">
                    {devices.length === 0 
                      ? "No devices found"
                      : "No devices match your filters"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {devices.length === 0
                      ? "Devices will appear here after they're used to log in"
                      : "Try adjusting your filters"}
                  </p>
                </Card>
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredActiveDevices.map((device) => {
                const stale = isDeviceStale(device.last_login_at);
                return (
                  <Card
                    key={device.id}
                    className={`p-4 space-y-3 ${
                      !device.is_active ? "opacity-60" : ""
                    } ${stale ? "border-yellow-200 dark:border-yellow-800" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-1">{getDeviceIcon(device.device_type)}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{device.device_name}</h3>
                          <p className="text-sm text-muted-foreground capitalize">
                            {device.device_type}
                          </p>
                        </div>
                      </div>
                      {!device.is_active && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          Revoked
                        </span>
                      )}
                    </div>

                    {stale && (
                      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Not used recently</span>
                      </div>
                    )}

                    <div className="space-y-1 text-sm">
                      {device.child_name && (
                        <p className="text-muted-foreground">
                          Last used by: <span className="font-medium">{device.child_name}</span>
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        Last login:{" "}
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(device.last_login_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </p>
                      {device.country_code && (
                        <p className="text-muted-foreground">
                          Country:{" "}
                          <span className="font-medium text-base">
                            {countryCodeToFlag(device.country_code) || ''} {device.country_code}
                          </span>
                        </p>
                      )}
                      {device.user_agent && (() => {
                        const deviceInfo = parseDeviceInfo(device.user_agent);
                        return (
                          <>
                            <p className="text-muted-foreground">
                              Browser: <span className="font-medium">{deviceInfo.browser.fullName}</span>
                            </p>
                            <p className="text-muted-foreground">
                              OS: <span className="font-medium">{deviceInfo.os.fullName}</span>
                            </p>
                            {deviceInfo.deviceModel && (
                              <p className="text-muted-foreground">
                                Model: <span className="font-medium">{deviceInfo.deviceModel}</span>
                              </p>
                            )}
                          </>
                        );
                      })()}
                      {device.mac_address && (
                        <p className="text-muted-foreground">
                          MAC: <span className="font-mono text-xs">{device.mac_address}</span>
                        </p>
                      )}
                      {device.last_ip_address && (
                        <p className="text-muted-foreground">
                          IP: <span className="font-mono text-xs">{device.last_ip_address}</span>
                        </p>
                      )}
                      {device.last_location && (
                        <p className="text-muted-foreground">
                          Location Details: <span className="font-medium">{device.last_location}</span>
                        </p>
                      )}
                    </div>

                    {device.is_active && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          onClick={() => {
                            setDeviceToRename(device);
                            setNewDeviceName(device.device_name);
                          }}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Rename
                        </Button>
                        <Button
                          onClick={() => setDeviceToRemove(device)}
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
              </div>
            </TabsContent>

            {/* Device History Tab */}
            <TabsContent value="history" className="space-y-4">
              {/* Actions and Filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={fetchDeviceHistory} variant="outline" size="sm" disabled={historyLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
                  Refresh History
                </Button>
                
                {/* Filters */}
                <div className="flex flex-1 gap-2">
                  <Select value={historyChildFilter} onValueChange={setHistoryChildFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by child" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Children</SelectItem>
                      {allChildren.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={historyDeviceTypeFilter} onValueChange={setHistoryDeviceTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by device type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* History Info */}
              <Card className="p-4 bg-muted/50 border-muted">
                <div className="flex items-start gap-3">
                  <History className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">
                      Device History
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      This is a read-only history of all devices that have accessed your account, including removed devices. 
                      This history cannot be modified and serves as a security audit trail.
                      {filteredHistory.length !== deviceHistory.length && (
                        <span className="block mt-1 font-medium">
                          Showing {filteredHistory.length} of {deviceHistory.length} devices
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </Card>

              {/* History List - Scrollable Container */}
              <div 
                ref={historyContainerRef}
                className="max-h-[calc(100vh-400px)] overflow-y-auto space-y-4"
                style={{ scrollBehavior: 'smooth' }}
              >
                {historyLoading ? (
                  <Card className="p-12 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading device history...</p>
                  </Card>
                ) : filteredHistory.length === 0 ? (
                  <Card className="p-12 text-center">
                    <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">No devices found</p>
                    <p className="text-sm text-muted-foreground">
                      {deviceHistory.length === 0 
                        ? "Device history will appear here as devices are used or removed"
                        : "Try adjusting your filters"}
                    </p>
                  </Card>
                ) : (
                  <>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {paginatedHistory.map((device) => {
                    const stale = isDeviceStale(device.last_login_at);
                    const isInactive = !device.is_active;
                    return (
                      <Card
                        key={device.id}
                        className={`p-4 space-y-3 ${
                          isInactive ? "opacity-75 border-destructive/20 bg-muted/30" : ""
                        } ${stale ? "border-yellow-200 dark:border-yellow-800" : ""}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="mt-1">{getDeviceIcon(device.device_type)}</div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">{device.device_name}</h3>
                              <p className="text-sm text-muted-foreground capitalize">
                                {device.device_type}
                              </p>
                            </div>
                          </div>
                          {isInactive ? (
                            <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                              Removed
                            </span>
                          ) : (
                            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-1 rounded">
                              Active
                            </span>
                          )}
                        </div>

                        {stale && (
                          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Not used recently</span>
                          </div>
                        )}

                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            Created:{" "}
                            <span className="font-medium">
                              {formatDistanceToNow(new Date(device.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </p>
                          {device.child_name && (
                            <p className="text-muted-foreground">
                              Last used by: <span className="font-medium">{device.child_name}</span>
                            </p>
                          )}
                          <p className="text-muted-foreground">
                            Last login:{" "}
                            <span className="font-medium">
                              {formatDistanceToNow(new Date(device.last_login_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </p>
                          {isInactive && (
                            <p className="text-muted-foreground">
                              Removed:{" "}
                              <span className="font-medium">
                                {formatDistanceToNow(new Date(device.updated_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            </p>
                          )}
                          {device.country_code && (
                            <p className="text-muted-foreground">
                              Country:{" "}
                              <span className="font-medium text-base">
                                {countryCodeToFlag(device.country_code) || ''} {device.country_code}
                              </span>
                            </p>
                          )}
                          {device.user_agent && (() => {
                            const deviceInfo = parseDeviceInfo(device.user_agent);
                            return (
                              <>
                                <p className="text-muted-foreground">
                                  Browser: <span className="font-medium">{deviceInfo.browser.fullName}</span>
                                </p>
                                <p className="text-muted-foreground">
                                  OS: <span className="font-medium">{deviceInfo.os.fullName}</span>
                                </p>
                                {deviceInfo.deviceModel && (
                                  <p className="text-muted-foreground">
                                    Model: <span className="font-medium">{deviceInfo.deviceModel}</span>
                                  </p>
                                )}
                              </>
                            );
                          })()}
                          {device.mac_address && (
                            <p className="text-muted-foreground">
                              MAC: <span className="font-mono text-xs">{device.mac_address}</span>
                            </p>
                          )}
                          {device.last_ip_address && (
                            <p className="text-muted-foreground">
                              IP: <span className="font-mono text-xs">{device.last_ip_address}</span>
                            </p>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          disabled={historyPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground px-4">
                          Page {historyPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                          disabled={historyPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Back to Top Button */}
              {showBackToTop && (
                <Button
                  onClick={scrollToTop}
                  className="fixed bottom-6 right-6 rounded-full shadow-lg z-50 h-12 w-12 p-0"
                  size="icon"
                  variant="default"
                >
                  <ArrowUp className="h-5 w-5" />
                  <span className="sr-only">Back to top</span>
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Remove Device Dialog */}
      <AlertDialog
        open={!!deviceToRemove}
        onOpenChange={(open) => {
          if (!open) {
            setDeviceToRemove(null);
            setRequireAuth(false);
            setAuthPassword("");
          }
        }}
      >
        <AlertDialogContent key={requireAuth ? "password" : "confirm"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {requireAuth ? "Confirm Password" : "Remove Device?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {requireAuth ? (
                <>
                  For security, please enter your password to remove{" "}
                  <strong>{deviceToRemove?.device_name}</strong>. This device will need to be
                  re-authorized on next login.
                </>
              ) : (
                <>
                  Removing <strong>{deviceToRemove?.device_name}</strong> will revoke its access.
                  You'll need to re-authorize this device the next time someone tries to log in
                  from it. This action requires password confirmation.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {requireAuth && (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter your password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRemoveDevice();
                  }
                }}
                autoFocus
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                // If we're not requiring auth yet, trigger handleRemoveDevice which will show warning toast
                if (!requireAuth) {
                  e.preventDefault();
                  handleRemoveDevice();
                  return;
                }
                // Otherwise, proceed with device removal
                await handleRemoveDevice();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {requireAuth ? "Remove Device" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Device Dialog */}
      <Dialog open={!!deviceToRename} onOpenChange={(open) => !open && setDeviceToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Device</DialogTitle>
            <DialogDescription>
              Give this device a friendly name to easily identify it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Device name"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newDeviceName.trim()) {
                  handleRenameDevice();
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeviceToRename(null)}>
                Cancel
              </Button>
              <Button onClick={handleRenameDevice} disabled={!newDeviceName.trim()}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceManagement;

