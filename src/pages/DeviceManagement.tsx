// src/pages/DeviceManagement.tsx
// Purpose: Device management page for parents to view and manage authorized devices

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  is_active: boolean;
  created_at: string;
  child_name?: string; // Joined from children table
}

const DeviceManagement = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceToRemove, setDeviceToRemove] = useState<Device | null>(null);
  const [deviceToRename, setDeviceToRename] = useState<Device | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [showAddDeviceDialog, setShowAddDeviceDialog] = useState(false);
  const [requireAuth, setRequireAuth] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const { toast } = useToast();

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

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRemoveDevice = async () => {
    if (!deviceToRemove) return;

    // Require re-authentication
    if (!requireAuth) {
      setRequireAuth(true);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Verify password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email || "",
        password: authPassword,
      });

      if (authError) {
        toast({
          title: "Authentication Failed",
          description: "Incorrect password. Please try again.",
          variant: "destructive",
        });
        setAuthPassword("");
        return;
      }

      // Revoke device
      const { error } = await supabase.rpc("revoke_device", {
        p_device_id: deviceToRemove.id,
        p_parent_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Device Removed",
        description: `${deviceToRemove.device_name} has been removed and will need to be re-authorized.`,
      });

      setDeviceToRemove(null);
      setRequireAuth(false);
      setAuthPassword("");
      fetchDevices();
    } catch (error: any) {
      console.error("Error removing device:", error);
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

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={fetchDevices} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Devices List */}
          {loading ? (
            <Card className="p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading devices...</p>
            </Card>
          ) : devices.length === 0 ? (
            <Card className="p-12 text-center">
              <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No devices found</p>
              <p className="text-sm text-muted-foreground">
                Devices will appear here after they're used to log in
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {devices.map((device) => {
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
                      {device.last_ip_address && (
                        <p className="text-muted-foreground">
                          IP: <span className="font-mono text-xs">{device.last_ip_address}</span>
                        </p>
                      )}
                      {device.last_location && (
                        <p className="text-muted-foreground">
                          Location: <span className="font-medium">{device.last_location}</span>
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
        <AlertDialogContent>
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
              onClick={handleRemoveDevice}
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

