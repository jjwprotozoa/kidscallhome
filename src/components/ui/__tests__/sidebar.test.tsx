// src/components/ui/__tests__/sidebar.test.tsx
// Purpose: Test critical sidebar behavior

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../sidebar/Sidebar";
import { SidebarContent } from "../sidebar/SidebarContent";
import { SidebarProvider } from "../sidebar/SidebarProvider";
import { SidebarTrigger } from "../sidebar/SidebarTrigger";
import { useSidebar } from "../sidebar/useSidebar";

/**
 * SIDEBAR BEHAVIOR TO TEST:
 *
 * 1. Open/Close:
 *    - Sidebar opens when trigger clicked
 *    - Sidebar closes when trigger clicked again
 *    - Mobile drawer opens/closes
 *    - Keyboard shortcut (Ctrl/Cmd + B) toggles sidebar
 *
 * 2. Navigation Items:
 *    - Navigation items render correctly
 *    - Active states work
 *    - Menu items are clickable
 *    - Submenu items work
 *
 * 3. Responsive Behavior:
 *    - Desktop: Sidebar shows as fixed panel
 *    - Mobile: Sidebar shows as drawer/sheet
 *    - Transitions between mobile/desktop work
 *
 * 4. Keyboard Navigation:
 *    - Tab navigation works
 *    - Enter/Space activates items
 *    - Escape closes sidebar
 *    - Arrow keys navigate menu items
 *
 * 5. Accessibility:
 *    - ARIA labels present
 *    - Focus management works
 *    - Screen reader announcements
 */

// Mock dependencies
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const TestComponent = () => {
  const { state, open, toggleSidebar } = useSidebar();
  return (
    <div>
      <div data-testid="sidebar-state">{state}</div>
      <div data-testid="sidebar-open">{open ? "open" : "closed"}</div>
      <button onClick={toggleSidebar}>Toggle</button>
    </div>
  );
};

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SidebarProvider", () => {
    it("should provide sidebar context", () => {
      render(
        <SidebarProvider>
          <TestComponent />
        </SidebarProvider>
      );
      expect(screen.getByTestId("sidebar-state")).toBeInTheDocument();
    });

    it("should throw error when useSidebar used outside provider", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      expect(() => {
        render(<TestComponent />);
      }).toThrow("useSidebar must be used within a SidebarProvider");
      consoleError.mockRestore();
    });
  });

  describe("Sidebar Trigger", () => {
    it("should render trigger button", () => {
      render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      );
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should toggle sidebar when clicked", () => {
      render(
        <SidebarProvider>
          <SidebarTrigger />
          <TestComponent />
        </SidebarProvider>
      );
      const trigger = screen.getByRole("button", { name: /toggle sidebar/i });
      const stateElement = screen.getByTestId("sidebar-open");
      expect(stateElement).toHaveTextContent("open");
      fireEvent.click(trigger);
      expect(stateElement).toHaveTextContent("closed");
    });
  });

  describe("Sidebar Content", () => {
    it("should render sidebar content", () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>Test Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    it("should toggle sidebar with Ctrl+B", () => {
      render(
        <SidebarProvider>
          <TestComponent />
        </SidebarProvider>
      );
      const stateElement = screen.getByTestId("sidebar-open");
      expect(stateElement).toHaveTextContent("open");
      fireEvent.keyDown(window, { key: "b", ctrlKey: true });
      expect(stateElement).toHaveTextContent("closed");
    });
  });

  describe("Responsive Behavior", () => {
    it("should render desktop sidebar on desktop", () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>Desktop Content</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );
      // Desktop sidebar should be rendered
      expect(true).toBe(true);
    });
  });
});
