// src/components/devices/DeviceFilters.tsx
// Purpose: Reusable filter component for device lists

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";

interface Child {
  id: string;
  name: string;
}

interface DeviceFiltersProps {
  childFilter: string;
  deviceTypeFilter: string;
  onChildFilterChange: (value: string) => void;
  onDeviceTypeFilterChange: (value: string) => void;
  allChildren: Child[];
}

export const DeviceFilters = ({
  childFilter,
  deviceTypeFilter,
  onChildFilterChange,
  onDeviceTypeFilterChange,
  allChildren,
}: DeviceFiltersProps) => {
  return (
    <div className="flex flex-1 gap-2">
      <Select value={childFilter} onValueChange={onChildFilterChange}>
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

      <Select value={deviceTypeFilter} onValueChange={onDeviceTypeFilterChange}>
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
  );
};

