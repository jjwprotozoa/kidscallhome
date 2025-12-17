// src/pages/DeviceManagement/DeviceManagement.tsx
// Purpose: Main orchestrator for DeviceManagement page

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
import { useDeviceData } from "./useDeviceData";
import { useDeviceHandlers } from "./useDeviceHandlers";
import { History, RefreshCw, Shield, Smartphone, ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeObject } from "@/utils/security";
import { HISTORY_PAGE_SIZE } from "./constants";

const DeviceManagement = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [deviceToRemove, setDeviceToRemove] = useState<Device | null>(null);
  const [deviceToRename, setDeviceToRename] = useState<Device | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");

  // Filter and pagination state
  const [historyChildFilter, setHistoryChildFilter] = useState<string>("all");
  const [historyDeviceTypeFilter, setHistoryDeviceTypeFilter] = useState<string>("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  // Active devices filter state
  const [activeChildFilter, setActiveChildFilter] = useState<string>("all");
  const [activeDeviceTypeFilter, setActiveDeviceTypeFilter] = useState<string>("all");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const historyContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    devices,
    deviceHistory,
    allChildren,
    loading,
    historyLoading,
    fetchDevices,
    fetchChildren,
    fetchDeviceHistory,
  } = useDeviceData();

  const {
    requireAuth,
    authPassword,
    setAuthPassword,
    handleRemoveDevice,
    handleRenameDevice,
    resetAuth,
  } = useDeviceHandlers(fetchDevices, fetchDeviceHistory, activeTab);

  useEffect(() => {
    fetchDevices();
    fetchChildren();

    // Set up real-time subscription for device updates
    const setupRealtimeSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

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
              err
            );
          } else if (status === "SUBSCRIBED") {
            safeLog.log("✅ [DEVICE MANAGEMENT] Subscribed to device updates");
          }
        });
    };

    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchDevices, fetchDeviceHistory, fetchChildren, activeTab]);

  useEffect(() => {
    if (
      activeTab === "history" &&
      deviceHistory.length === 0 &&
      !historyLoading
    ) {
      fetchDeviceHistory();
    }
  }, [activeTab, fetchDeviceHistory, deviceHistory.length, historyLoading]);

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

  const totalPages = Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE);
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE
  );

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

  const onRemoveDevice = async () => {
    if (!deviceToRemove) return;
    await handleRemoveDevice(deviceToRemove, () => {
      setDeviceToRemove(null);
      resetAuth();
    });
  };

  const onRenameDevice = async () => {
    if (!deviceToRename || !newDeviceName.trim()) return;
    await handleRenameDevice(deviceToRename, newDeviceName, () => {
      setDeviceToRename(null);
      setNewDeviceName("");
    });
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
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={fetchDevices} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <DeviceFilters
                  childFilter={activeChildFilter}
                  deviceTypeFilter={activeDeviceTypeFilter}
                  onChildFilterChange={setActiveChildFilter}
                  onDeviceTypeFilterChange={setActiveDeviceTypeFilter}
                  allChildren={allChildren}
                />
              </div>

              {filteredActiveDevices.length !== devices.length &&
                devices.length > 0 && (
                  <Card className="p-3 bg-muted/50 border-muted">
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredActiveDevices.length} of {devices.length}{" "}
                      active devices
                    </p>
                  </Card>
                )}

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
                <DeviceFilters
                  childFilter={historyChildFilter}
                  deviceTypeFilter={historyDeviceTypeFilter}
                  onChildFilterChange={setHistoryChildFilter}
                  onDeviceTypeFilterChange={setHistoryDeviceTypeFilter}
                  allChildren={allChildren}
                />
              </div>

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
                    <DeviceHistoryPagination
                      currentPage={historyPage}
                      totalPages={totalPages}
                      onPageChange={setHistoryPage}
                    />
                  </>
                )}
              </div>

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

      <DeviceRemovalDialog
        device={deviceToRemove}
        requireAuth={requireAuth}
        authPassword={authPassword}
        onAuthPasswordChange={setAuthPassword}
        onOpenChange={(open) => {
          if (!open) {
            setDeviceToRemove(null);
            resetAuth();
          }
        }}
        onRemove={onRemoveDevice}
      />

      <DeviceRenameDialog
        device={deviceToRename}
        newDeviceName={newDeviceName}
        onDeviceNameChange={setNewDeviceName}
        onOpenChange={(open) => !open && setDeviceToRename(null)}
        onRename={onRenameDevice}
      />
    </div>
  );
};

export default DeviceManagement;









