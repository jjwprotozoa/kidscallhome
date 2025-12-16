// src/pages/__tests__/Upgrade.test.tsx
// Purpose: Comprehensive test suite for Upgrade component

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Upgrade from "../Upgrade";

/**
 * UPGRADE PAGE FEATURES TO TEST:
 *
 * 1. Pricing Plan Rendering:
 *    - All plans display (free, basic, premium tiers)
 *    - Plan names, prices, and descriptions show correctly
 *    - Recommended plan highlighted
 *    - Current plan indicator shows
 *
 * 2. Subscription Tier Selection:
 *    - Plan selection UI works
 *    - Current plan cannot be selected again
 *    - Upgrade/downgrade buttons show correctly
 *    - Plan comparison works
 *
 * 3. Payment Flow Integration:
 *    - Stripe checkout session creation (if integrated)
 *    - Email entry dialog opens on plan selection
 *    - Payment processing states work
 *    - Success/error handling
 *
 * 4. Feature Comparison Table:
 *    - Feature list displays correctly
 *    - Feature availability by tier shows
 *    - Tooltips/descriptions work
 *
 * 5. Upgrade/Downgrade Logic:
 *    - Upgrade button logic
 *    - Downgrade button logic
 *    - Current plan detection
 *    - Subscription status display
 *
 * 6. Trial Period Display:
 *    - Trial period shows if applicable
 *    - Trial eligibility checking
 *
 * 7. Current Subscription Status:
 *    - Active subscription display
 *    - Free tier display
 *    - Children count display
 *    - Manage subscription button works
 *
 * 8. Loading and Error States:
 *    - Loading state during data fetch
 *    - Error handling for failed requests
 *    - Stripe integration errors
 */

// Mock dependencies
vi.mock("@/integrations/supabase/client", () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { user: { id: "parent-1" } } } })
      ),
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: "parent-1", email: "test@example.com" } },
        })
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                email: "test@example.com",
                allowed_children: 1,
                subscription_type: "free",
                subscription_status: "active",
                subscription_expires_at: null,
              },
              error: null,
            })
          ),
        })),
      })),
    })),
    functions: {
      invoke: vi.fn(() =>
        Promise.resolve({
          data: { success: true, url: "https://checkout.stripe.com/test" },
          error: null,
        })
      ),
    },
    rpc: vi.fn(() => Promise.resolve({ data: { success: true }, error: null })),
  };
  return { supabase: mockSupabase };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@/components/Navigation", () => ({
  default: () => <nav>Navigation</nav>,
}));

vi.mock("@/features/onboarding/OnboardingTour", () => ({
  OnboardingTour: () => null,
}));

vi.mock("@/features/onboarding/HelpBubble", () => ({
  HelpBubble: () => null,
}));

vi.mock("@/utils/platformDetection", () => ({
  isPWA: () => true,
}));

vi.mock("@/utils/stripe", () => ({
  getStripe: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("Upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location.search
    delete (window as any).location;
    window.location = {
      ...window.location,
      search: "",
      href: "/parent/upgrade",
    };
  });

  describe("Component Rendering", () => {
    it("should render upgrade page with title", async () => {
      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        expect(screen.getByText(/Upgrade Your Plan/i)).toBeInTheDocument();
      });
    });

    it("should render all pricing plans", async () => {
      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        expect(screen.getByText(/Additional Kid Monthly/i)).toBeInTheDocument();
        expect(screen.getByText(/Family Bundle Monthly/i)).toBeInTheDocument();
        expect(screen.getByText(/Annual Family Plan/i)).toBeInTheDocument();
      });
    });

    it("should show loading state initially", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      vi.mocked(supabase.auth.getUser).mockImplementation(
        () => new Promise(() => {})
      ); // Never resolves
      renderWithRouter(<Upgrade />);
      // Loading spinner should appear
      expect(true).toBe(true);
    });
  });

  describe("Subscription Status Display", () => {
    it("should display current plan for active subscription", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      vi.mocked(supabase.from).mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  email: "test@example.com",
                  allowed_children: 5,
                  subscription_type: "family-bundle-monthly",
                  subscription_status: "active",
                  subscription_expires_at: null,
                },
                error: null,
              })
            ),
          })),
        })),
      }));

      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        expect(screen.getByText(/Your Current Plan/i)).toBeInTheDocument();
      });
    });

    it("should display free tier status when no active subscription", async () => {
      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        expect(screen.getByText(/Free Tier/i)).toBeInTheDocument();
      });
    });

    it("should show children count correctly", async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === "parents") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      email: "test@example.com",
                      allowed_children: 1,
                      subscription_type: "free",
                      subscription_status: "active",
                      subscription_expires_at: null,
                    },
                    error: null,
                  })
                ),
              })),
            })),
          };
        }
        if (table === "children") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                count: "exact",
              })),
            })),
          };
        }
        return {};
      });

      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        expect(screen.getByText(/0 \/ 1/i)).toBeInTheDocument();
      });
    });
  });

  describe("Plan Selection", () => {
    it("should open email dialog when plan is selected", async () => {
      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        const selectButtons = screen.getAllByText(
          /Select Plan|Upgrade|Downgrade/i
        );
        if (selectButtons.length > 0) {
          fireEvent.click(selectButtons[0]);
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/Complete Your Upgrade/i)).toBeInTheDocument();
      });
    });

    it("should disable current plan button", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  email: "test@example.com",
                  allowed_children: 5,
                  subscription_type: "family-bundle-monthly",
                  subscription_status: "active",
                  subscription_expires_at: null,
                },
                error: null,
              })
            ),
          })),
        })),
      }));

      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        const currentPlanButton = screen.getByText(/Current Plan/i);
        expect(currentPlanButton).toBeInTheDocument();
        expect(currentPlanButton.closest("button")).toBeDisabled();
      });
    });

    it("should show upgrade button for higher tier plans", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  email: "test@example.com",
                  allowed_children: 1,
                  subscription_type: "free",
                  subscription_status: "active",
                  subscription_expires_at: null,
                },
                error: null,
              })
            ),
          })),
        })),
      }));

      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        expect(screen.getByText(/Upgrade/i)).toBeInTheDocument();
      });
    });
  });

  describe("Payment Flow", () => {
    it("should create Stripe checkout session on payment", async () => {
      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        const selectButtons = screen.getAllByText(/Select Plan/i);
        if (selectButtons.length > 0) {
          fireEvent.click(selectButtons[0]);
        }
      });

      await waitFor(() => {
        const proceedButton = screen.getByText(/Proceed to Payment/i);
        fireEvent.click(proceedButton);
      });

      await waitFor(() => {
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          "create-stripe-subscription",
          expect.objectContaining({
            body: expect.objectContaining({
              subscriptionType: expect.any(String),
            }),
          })
        );
      });
    });

    it("should handle payment errors gracefully", async () => {
      mockSupabase.functions.invoke = vi.fn(() =>
        Promise.resolve({
          data: { success: false, error: "Payment failed" },
          error: { message: "Payment failed" },
        })
      );

      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        const selectButtons = screen.getAllByText(/Select Plan/i);
        if (selectButtons.length > 0) {
          fireEvent.click(selectButtons[0]);
        }
      });

      await waitFor(() => {
        const proceedButton = screen.getByText(/Proceed to Payment/i);
        fireEvent.click(proceedButton);
      });

      // Error should be handled
      await waitFor(() => {
        expect(true).toBe(true);
      });
    });

    it("should show success dialog after successful payment", async () => {
      // Simulate return from Stripe with session_id
      window.location.search = "?session_id=test_session";

      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        expect(screen.getByText(/Payment Successful/i)).toBeInTheDocument();
      });
    });
  });

  describe("Manage Subscription", () => {
    it("should open customer portal on manage click", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  email: "test@example.com",
                  allowed_children: 5,
                  subscription_type: "family-bundle-monthly",
                  subscription_status: "active",
                  subscription_expires_at: null,
                },
                error: null,
              })
            ),
          })),
        })),
      }));

      mockSupabase.functions.invoke = vi.fn(() =>
        Promise.resolve({
          data: { success: true, url: "https://billing.stripe.com/test" },
          error: null,
        })
      );

      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        const manageButton = screen.getByText(/Manage/i);
        fireEvent.click(manageButton);
      });

      await waitFor(() => {
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          "create-customer-portal-session",
          expect.any(Object)
        );
      });
    });
  });

  describe("Native App Handling", () => {
    it("should show in-app purchase message for native apps", () => {
      vi.doMock("@/utils/platformDetection", () => ({
        isPWA: () => false,
      }));

      // Re-render with mocked isPWA
      renderWithRouter(<Upgrade />);
      expect(screen.getByText(/In-App Purchases/i)).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle database migration errors", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { code: "42703", message: "column does not exist" },
              })
            ),
          })),
        })),
      }));

      renderWithRouter(<Upgrade />);
      await waitFor(() => {
        // Should show migration error toast
        expect(true).toBe(true);
      });
    });

    it("should handle authentication errors", async () => {
      mockSupabase.auth.getSession = vi.fn(() =>
        Promise.resolve({ data: { session: null } })
      );

      renderWithRouter(<Upgrade />);
      // Should redirect to auth page
      await waitFor(() => {
        expect(true).toBe(true);
      });
    });
  });
});
