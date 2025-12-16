// src/components/ui/sidebar/index.ts
// Purpose: Barrel export for all sidebar components (maintains shadcn/ui export pattern)

export { SidebarProvider } from './SidebarProvider';
export { useSidebar } from './useSidebar';
export { Sidebar, SidebarRail, SidebarInset } from './Sidebar';
export { SidebarTrigger } from './SidebarTrigger';
export { SidebarContent } from './SidebarContent';
export {
  SidebarHeader,
  SidebarFooter,
  SidebarInput,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from './SidebarNavigation';
export type { SidebarContext } from './types';








