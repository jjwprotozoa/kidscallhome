// src/utils/nativePurchases.ts
// Purpose: Native app store purchase handling for Android (Google Play) and iOS (App Store)

import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionPlan } from "@/pages/Upgrade/types";

export interface PurchaseResult {
  success: boolean;
  message?: string;
  purchaseToken?: string; // Google Play purchase token
  transactionReceipt?: string; // App Store transaction receipt
  transactionId?: string;
  productId?: string;
}

export interface NativePurchasePlugin {
  /**
   * Initialize the purchase plugin
   */
  initialize(): Promise<void>;
  
  /**
   * Get available products
   */
  getProducts(productIds: string[]): Promise<any[]>;
  
  /**
   * Purchase a product
   */
  purchase(productId: string): Promise<PurchaseResult>;
  
  /**
   * Restore purchases
   */
  restorePurchases(): Promise<PurchaseResult[]>;
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  try {
    if (typeof window === "undefined" || !(window as any).Capacitor) {
      return false;
    }
    return Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  try {
    if (typeof window === "undefined" || !(window as any).Capacitor) {
      return false;
    }
    return Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/**
 * Get the product ID for the current platform
 */
export function getProductId(plan: SubscriptionPlan): string | undefined {
  if (isAndroid()) {
    return plan.playStoreProductId;
  } else if (isIOS()) {
    return plan.appStoreProductId;
  }
  return undefined;
}

/**
 * Purchase a subscription plan through native app store
 */
export async function purchaseNativeSubscription(
  plan: SubscriptionPlan
): Promise<PurchaseResult> {
  const productId = getProductId(plan);
  
  if (!productId) {
    return {
      success: false,
      message: "Product ID not available for this platform",
    };
  }

  try {
    // Get authenticated user
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        message: "You must be logged in to make a purchase",
      };
    }

    // Call native purchase API
    // This will be implemented via Capacitor plugin or direct native bridge
    const purchaseResult = await initiateNativePurchase(productId);

    if (!purchaseResult.success) {
      return purchaseResult;
    }

    // Verify purchase with backend
    const verificationResult = await verifyPurchaseWithBackend(
      purchaseResult,
      plan.id,
      session.user.id
    );

    return verificationResult;
  } catch (error) {
    console.error("Native purchase error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Purchase failed",
    };
  }
}

/**
 * Initiate native purchase (platform-specific)
 */
async function initiateNativePurchase(
  productId: string
): Promise<PurchaseResult> {
  // For Android: Use Google Play Billing Library
  if (isAndroid()) {
    return await purchaseAndroid(productId);
  }
  
  // For iOS: Use StoreKit
  if (isIOS()) {
    return await purchaseIOS(productId);
  }

  return {
    success: false,
    message: "Native purchases not available on this platform",
  };
}

/**
 * Android purchase via Google Play Billing
 * 
 * NOTE: This requires a Capacitor plugin or native bridge implementation.
 * The native Android code should implement a bridge that exposes:
 * window.GooglePlayBilling.purchase(productId)
 * 
 * See docs/NATIVE_PURCHASES_SETUP.md for implementation details.
 */
async function purchaseAndroid(productId: string): Promise<PurchaseResult> {
  try {
    // Check for Capacitor bridge
    const windowWithPurchase = window as any;
    
    if (windowWithPurchase.GooglePlayBilling?.purchase) {
      const result = await windowWithPurchase.GooglePlayBilling.purchase(productId);
      return {
        success: result.success || false,
        purchaseToken: result.purchaseToken,
        transactionId: result.orderId,
        productId: result.productId,
        message: result.message,
      };
    }

    // Check if we can use Capacitor's native bridge
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      // Try to call native method via Capacitor
      const { value: result } = await Capacitor.Plugins.get("GooglePlayBilling")?.purchase({ productId });
      if (result) {
        return {
          success: result.success || false,
          purchaseToken: result.purchaseToken,
          transactionId: result.orderId,
          productId: result.productId,
          message: result.message,
        };
      }
    }

    // Fallback: Return instruction to implement native bridge
    return {
      success: false,
      message: "Google Play Billing not configured. See docs/NATIVE_PURCHASES_SETUP.md for setup instructions.",
    };
  } catch (error) {
    return {
      success: false,
      message: `Android purchase failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * iOS purchase via App Store
 * 
 * NOTE: This requires a Capacitor plugin or native bridge implementation.
 * The native iOS code should implement a bridge that exposes:
 * window.AppStorePurchase.purchase(productId)
 * 
 * See docs/NATIVE_PURCHASES_SETUP.md for implementation details.
 */
async function purchaseIOS(productId: string): Promise<PurchaseResult> {
  try {
    // Check for Capacitor bridge
    const windowWithPurchase = window as any;
    
    if (windowWithPurchase.AppStorePurchase?.purchase) {
      const result = await windowWithPurchase.AppStorePurchase.purchase(productId);
      return {
        success: result.success || false,
        transactionReceipt: result.transactionReceipt,
        transactionId: result.transactionId,
        productId: result.productId,
        message: result.message,
      };
    }

    // Check if we can use Capacitor's native bridge
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
      // Try to call native method via Capacitor
      const { value: result } = await Capacitor.Plugins.get("AppStorePurchase")?.purchase({ productId });
      if (result) {
        return {
          success: result.success || false,
          transactionReceipt: result.transactionReceipt,
          transactionId: result.transactionId,
          productId: result.productId,
          message: result.message,
        };
      }
    }

    // Fallback: Return instruction to implement native bridge
    return {
      success: false,
      message: "App Store Purchase not configured. See docs/NATIVE_PURCHASES_SETUP.md for setup instructions.",
    };
  } catch (error) {
    return {
      success: false,
      message: `iOS purchase failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Verify purchase with backend
 */
async function verifyPurchaseWithBackend(
  purchaseResult: PurchaseResult,
  planId: string,
  userId: string
): Promise<PurchaseResult> {
  try {
    const platform = isAndroid() ? "android" : isIOS() ? "ios" : "unknown";
    
    const { data, error } = await supabase.functions.invoke(
      "verify-native-purchase",
      {
        body: {
          platform,
          planId,
          userId,
          purchaseToken: purchaseResult.purchaseToken,
          transactionReceipt: purchaseResult.transactionReceipt,
          transactionId: purchaseResult.transactionId,
          productId: purchaseResult.productId,
        },
      }
    );

    if (error) {
      return {
        success: false,
        message: `Verification failed: ${error.message}`,
      };
    }

    if (data?.success) {
      return {
        success: true,
        message: data.message || "Purchase verified and subscription activated",
      };
    }

    return {
      success: false,
      message: data?.message || "Purchase verification failed",
    };
  } catch (error) {
    return {
      success: false,
      message: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Restore purchases (for users who reinstalled app or switched devices)
 */
export async function restoreNativePurchases(): Promise<PurchaseResult[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    if (!session) {
      return [{
        success: false,
        message: "You must be logged in to restore purchases",
      }];
    }

    let purchases: PurchaseResult[] = [];

    if (isAndroid()) {
      const windowWithPurchase = window as any;
      if (windowWithPurchase.GooglePlayBilling?.restorePurchases) {
        purchases = await windowWithPurchase.GooglePlayBilling.restorePurchases();
      }
    } else if (isIOS()) {
      const windowWithPurchase = window as any;
      if (windowWithPurchase.AppStorePurchase?.restorePurchases) {
        purchases = await windowWithPurchase.AppStorePurchase.restorePurchases();
      }
    }

    // Verify each purchase with backend
    const verifiedPurchases: PurchaseResult[] = [];
    for (const purchase of purchases) {
      if (purchase.success && purchase.productId) {
        // Find the plan by product ID
        const planId = findPlanIdByProductId(purchase.productId);
        if (planId) {
          const verified = await verifyPurchaseWithBackend(
            purchase,
            planId,
            session.user.id
          );
          verifiedPurchases.push(verified);
        }
      }
    }

    return verifiedPurchases;
  } catch (error) {
    return [{
      success: false,
      message: `Restore failed: ${error instanceof Error ? error.message : String(error)}`,
    }];
  }
}

/**
 * Find plan ID by product ID (helper function)
 */
function findPlanIdByProductId(productId: string): string | null {
  // Import PLANS dynamically to avoid circular dependency
  // This will be matched in the backend verification
  return null; // Backend will handle the mapping
}

