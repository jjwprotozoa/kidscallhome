// src/pages/DeviceManagement.tsx
// Purpose: Device management page for parents to view and manage authorized devices

import { DeviceCard, type Device } from "@/components/devices/DeviceCard";
import { DeviceFilters } from "@/components/devices/DeviceFilters";
import { DeviceHistoryPagination } from "@/components/devices/DeviceHistoryPagination";
import { DeviceRemovalDialog } from "@/components/devices/DeviceRemovalDialog";
import { DeviceRenameDialog } from "@/components/devices/DeviceRenameDialog";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError, sanitizeObject } from "@/utils/security";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowUp, History, RefreshCw, Shield, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Device type is exported from DeviceCard component

const DeviceManagement = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceHistory, setDeviceHistory] = useState<Device[]>([]);
  const [allChildren, setAllChildren] = useState<
    Array<{ id: string; name: string }>
  >([]);
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
  const [historyDeviceTypeFilter, setHistoryDeviceTypeFilter] =
    useState<string>("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const historyPageSize = 10;

  // Active devices filter state
  const [activeChildFilter, setActiveChildFilter] = useState<string>("all");
  const [activeDeviceTypeFilter, setActiveDeviceTypeFilter] =
    useState<string>("all");

  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const historyContainerRef = useRef<HTMLDivElement | null>(null);

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
        .eq("is_active", true) // Only show active devices
        .order("last_login_at", { ascending: false });

      // Check if devices table doesn't exist (migration not run)
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

      // Transform data to include child name
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

      // Fetch ALL devices (active and inactive) for history
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
        .order("updated_at", { ascending: false }); // Order by last update (when deactivated or last login)

      if (error) throw error;

      // Transform data to include child name
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

  useEffect(() => {
    fetchDevices();
    fetchChildren();

    // Set up real-time subscription for device updates
    const setupRealtimeSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
            safeLog.log(
              "📱 [DEVICE MANAGEMENT] New device added:",
              sanitizeObject(payload.new)
            );
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
            safeLog.log(
              "📱 [DEVICE MANAGEMENT] Device updated:",
              sanitizeObject({
                deviceId: payload.new.id,
                deviceName: payload.new.device_name,
                isActive: payload.new.is_active,
                oldIsActive: payload.old?.is_active,
              })
            );
            // Refresh devices list when a device is updated (e.g., last_login_at changes or is_active changes)
            fetchDevices();
            if (activeTab === "history") {
              fetchDeviceHistory();
            }
          }
        )
        .subscribe((status, err) => {
          if (err) {
            safeLog.error(
              "❌ [DEVICE MANAGEMENT] Subscription error:",
              sanitizeError(err)
            );
          } else if (status === "SUBSCRIBED") {
            safeLog.log("✅ [DEVICE MANAGEMENT] Subscribed to device updates");
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
  }, [fetchDevices, fetchDeviceHistory, fetchChildren, activeTab]);

  // Load history when switching to history tab
  useEffect(() => {
    if (
      activeTab === "history" &&
      deviceHistory.length === 0 &&
      !historyLoading
    ) {
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
    if (
      historyChildFilter !== "all" &&
      device.last_used_child_id !== historyChildFilter
    ) {
      return false;
    }
    if (
      historyDeviceTypeFilter !== "all" &&
      device.device_type !== historyDeviceTypeFilter
    ) {
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
    if (
      activeChildFilter !== "all" &&
      device.last_used_child_id !== activeChildFilter
    ) {
      return false;
    }
    if (
      activeDeviceTypeFilter !== "all" &&
      device.device_type !== activeDeviceTypeFilter
    ) {
      return false;
    }
    return true;
  });

  const handleRemoveDevice = async () => {
    if (!deviceToRemove) {
      safeLog.warn("⚠️ [DEVICE MANAGEMENT] No device selected for removal");
      return;
    }

    safeLog.log(
      "🔍 [DEVICE MANAGEMENT] Remove device initiated:",
      sanitizeObject({
        deviceId: deviceToRemove.id,
        deviceName: deviceToRemove.device_name,
        requireAuth,
      })
    );

    // Require re-authentication
    if (!requireAuth) {
      // SECURITY: Don't log password-related actions with sensitive context
      safeLog.log("🔐 [DEVICE MANAGEMENT] Showing password prompt");

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

      // SECURITY: Sanitize email before logging
      safeLog.log(
        "🔐 [DEVICE MANAGEMENT] Verifying password for user:",
        sanitizeObject({ email: user.email })
      );

      // Verify password
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

      // SECURITY: Don't log password verification success with sensitive context
      safeLog.log(
        "✅ [DEVICE MANAGEMENT] Password verified, calling revoke_device RPC"
      );

      // Revoke device
      const { data: revokeResult, error } = await supabase.rpc(
        "revoke_device",
        {
          p_device_id: deviceToRemove.id,
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

      // Check if device was actually revoked (function returns boolean)
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
          deviceId: deviceToRemove.id,
          deviceName: deviceToRemove.device_name,
          revokeResult,
        })
      );

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
      safeLog.log("🔄 [DEVICE MANAGEMENT] Refreshing devices list");
      await fetchDevices();
      if (activeTab === "history") {
        await fetchDeviceHistory();
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

  const handleRenameDevice = async () => {
    if (!deviceToRename || !newDeviceName.trim()) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
              View and manage all devices authorized to access your family
              account
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
                  This page shows all devices that have been used to access your
                  family account. You can remove devices you no longer use or
                  recognize. Removing a device will require re-authorization the
                  next time someone tries to log in from that device.
                </p>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value);
              if (value === "history" && deviceHistory.length === 0) {
                fetchDeviceHistory();
              }
            }}
          >
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
                <DeviceFilters
                  childFilter={activeChildFilter}
                  deviceTypeFilter={activeDeviceTypeFilter}
                  onChildFilterChange={setActiveChildFilter}
                  onDeviceTypeFilterChange={setActiveDeviceTypeFilter}
                  allChildren={allChildren}
                />
              </div>

              {/* Filter Info */}
              {filteredActiveDevices.length !== devices.length &&
                devices.length > 0 && (
                  <Card className="p-3 bg-muted/50 border-muted">
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredActiveDevices.length} of {devices.length}{" "}
                      active devices
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
                    {filteredActiveDevices.map((device) => (
                      <DeviceCard
                        key={device.id}
                        device={device}
                        showActions={true}
                        onRename={(device) => {
                          setDeviceToRename(device);
                          setNewDeviceName(device.device_name);
                        }}
                        onRemove={(device) => setDeviceToRemove(device)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Device History Tab */}
            <TabsContent value="history" className="space-y-4">
              {/* Actions and Filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={fetchDeviceHistory}
                  variant="outline"
                  size="sm"
                  disabled={historyLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${
                      historyLoading ? "animate-spin" : ""
                    }`}
                  />
                  Refresh History
                </Button>

                {/* Filters */}
                <DeviceFilters
                  childFilter={historyChildFilter}
                  deviceTypeFilter={historyDeviceTypeFilter}
                  onChildFilterChange={setHistoryChildFilter}
                  onDeviceTypeFilterChange={setHistoryDeviceTypeFilter}
                  allChildren={allChildren}
                />
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
                      This is a read-only history of all devices that have
                      accessed your account, including removed devices. This
                      history cannot be modified and serves as a security audit
                      trail.
                      {filteredHistory.length !== deviceHistory.length && (
                        <span className="block mt-1 font-medium">
                          Showing {filteredHistory.length} of{" "}
                          {deviceHistory.length} devices
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
                style={{ scrollBehavior: "smooth" }}
              >
                {historyLoading ? (
                  <Card className="p-12 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Loading device history...
                    </p>
                  </Card>
                ) : filteredHistory.length === 0 ? (
                  <Card className="p-12 text-center">
                    <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">
                      No devices found
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {deviceHistory.length === 0
                        ? "Device history will appear here as devices are used or removed"
                        : "Try adjusting your filters"}
                    </p>
                  </Card>
                ) : (
                  <>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {paginatedHistory.map((device) => (
                        <DeviceCard
                          key={device.id}
                          device={device}
                          showActions={false}
                          showCreatedDate={true}
                          showRemovedDate={true}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    <DeviceHistoryPagination
                      currentPage={historyPage}
                      totalPages={totalPages}
                      onPageChange={setHistoryPage}
                    />
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
      <DeviceRemovalDialog
        device={deviceToRemove}
        requireAuth={requireAuth}
        authPassword={authPassword}
        onAuthPasswordChange={setAuthPassword}
        onOpenChange={(open) => {
          if (!open) {
            setDeviceToRemove(null);
            setRequireAuth(false);
            setAuthPassword("");
          }
        }}
        onRemove={handleRemoveDevice}
      />

      {/* Rename Device Dialog */}
      <DeviceRenameDialog
        device={deviceToRename}
        newDeviceName={newDeviceName}
        onDeviceNameChange={setNewDeviceName}
        onOpenChange={(open) => !open && setDeviceToRename(null)}
        onRename={handleRenameDevice}
      />
    </div>
  );
};

export default DeviceManagement;
