// src/components/devices/DeviceCard.tsx
// Purpose: Reusable device card component for displaying device information

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { countryCodeToFlag } from "@/utils/ipGeolocation";
import { parseDeviceInfo } from "@/utils/userAgentParser";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Edit2, Monitor, Smartphone, Tablet, Trash2 } from "lucide-react";

export interface Device {
  id: string;
  device_name: string;
  device_type: "mobile" | "tablet" | "desktop" | "other";
  last_used_child_id: string | null;
  last_login_at: string;
  last_ip_address: string | null;
  last_location: string | null;
  mac_address: string | null;
  user_agent: string | null;
  country_code?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  child_name?: string;
}

interface DeviceCardProps {
  device: Device;
  showActions?: boolean;
  showCreatedDate?: boolean;
  showRemovedDate?: boolean;
  onRename?: (device: Device) => void;
  onRemove?: (device: Device) => void;
}

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
  const daysSinceLogin =
    (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLogin > 30; // Consider stale if not used in 30 days
};

export const DeviceCard = ({
  device,
  showActions = true,
  showCreatedDate = false,
  showRemovedDate = false,
  onRename,
  onRemove,
}: DeviceCardProps) => {
  const stale = isDeviceStale(device.last_login_at);
  const isInactive = !device.is_active;

  return (
    <Card
      className={`p-4 space-y-3 ${
        isInactive ? "opacity-75 border-destructive/20 bg-muted/30" : ""
      } ${
        stale ? "border-yellow-200 dark:border-yellow-800" : ""
      }`}
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
        ) : showActions ? (
          <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-1 rounded">
            Active
          </span>
        ) : null}
      </div>

      {stale && (
        <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>Not used recently</span>
        </div>
      )}

      <div className="space-y-1 text-sm">
        {showCreatedDate && (
          <p className="text-muted-foreground">
            Created:{" "}
            <span className="font-medium">
              {formatDistanceToNow(new Date(device.created_at), {
                addSuffix: true,
              })}
            </span>
          </p>
        )}
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
        {showRemovedDate && isInactive && device.updated_at && (
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
              {countryCodeToFlag(device.country_code) || ""} {device.country_code}
            </span>
          </p>
        )}
        {device.user_agent &&
          (() => {
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

      {showActions && device.is_active && (
        <div className="flex gap-2 pt-2 border-t">
          <Button
            onClick={() => {
              // This will be handled by parent via onRename prop
              if (onRename) onRename(device);
            }}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Rename
          </Button>
          <Button
            onClick={() => {
              // This will be handled by parent via onRemove prop
              if (onRemove) onRemove(device);
            }}
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
};

