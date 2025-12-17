# Native App Store Purchases Setup Guide

This guide explains how to set up in-app purchases for Google Play Store (Android) and Apple App Store (iOS).

## Overview

The app supports subscriptions through:

- **PWA (Web)**: Stripe payment links
- **Android (Play Store)**: Google Play Billing Library
- **iOS (App Store)**: StoreKit 2

All subscriptions are stored in the database and sync across platforms.

## Architecture

```
┌─────────────────┐
│  Native App     │
│  (Android/iOS)  │
└────────┬────────┘
         │
         │ Native Purchase API
         ▼
┌─────────────────┐
│  Frontend       │
│  nativePurchases│
│  Service        │
└────────┬────────┘
         │
         │ Verify Purchase
         ▼
┌─────────────────┐
│  Backend        │
│  verify-native- │
│  purchase       │
└────────┬────────┘
         │
         │ Update Subscription
         ▼
┌─────────────────┐
│  Database       │
│  (Supabase)     │
└─────────────────┘
```

## Product IDs

### Google Play Store (Android)

Configure these subscription IDs in Google Play Console:

- `additional_kid_monthly` - $4.99/month
- `additional_kid_annual` - $49.99/year
- `family_bundle_monthly` - $14.99/month
- `family_bundle_annual` - $149.99/year
- `annual_family_plan` - $99/year

### Apple App Store (iOS)

Configure these product IDs in App Store Connect:

- `com.kidscallhome.additional_kid_monthly` - $4.99/month
- `com.kidscallhome.additional_kid_annual` - $49.99/year
- `com.kidscallhome.family_bundle_monthly` - $14.99/month
- `com.kidscallhome.family_bundle_annual` - $149.99/year
- `com.kidscallhome.annual_family_plan` - $99/year

## Android Implementation

### 1. Add Google Play Billing Library

In `android/app/build.gradle`:

```gradle
dependencies {
    implementation 'com.android.billingclient:billing:6.0.1'
    implementation 'com.android.billingclient:billing-ktx:6.0.1'
}
```

### 2. Create Capacitor Plugin Bridge

Create `android/app/src/main/java/com/kidscallhome/app/GooglePlayBillingPlugin.java`:

```java
package com.kidscallhome.app;

import android.app.Activity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.android.billingclient.api.*;

@CapacitorPlugin(name = "GooglePlayBilling")
public class GooglePlayBillingPlugin extends Plugin {
    private BillingClient billingClient;
    private String currentProductId;

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases()
            .build();
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    // Billing client is ready
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Try to restart the connection
            }
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) {
            call.reject("Product ID is required");
            return;
        }

        currentProductId = productId;

        // Query available products
        List<String> skuList = Collections.singletonList(productId);
        SkuDetailsParams.Builder params = SkuDetailsParams.newBuilder()
            .setSkusList(skuList)
            .setType(BillingClient.SkuType.SUBS);

        billingClient.querySkuDetailsAsync(params.build(), (billingResult, skuDetailsList) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK
                && skuDetailsList != null && !skuDetailsList.isEmpty()) {

                SkuDetails skuDetails = skuDetailsList.get(0);
                BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setSkuDetails(skuDetails)
                    .build();

                BillingResult result = billingClient.launchBillingFlow(
                    getActivity(),
                    flowParams
                );

                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Failed to launch billing flow: " + result.getDebugMessage());
                }
            } else {
                call.reject("Product not found");
            }
        });
    }

    private PurchasesUpdatedListener purchasesUpdatedListener = (billingResult, purchases) -> {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK
            && purchases != null) {
            for (Purchase purchase : purchases) {
                handlePurchase(purchase);
            }
        }
    };

    private void handlePurchase(Purchase purchase) {
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("purchaseToken", purchase.getPurchaseToken());
            result.put("orderId", purchase.getOrderId());
            result.put("productId", purchase.getSkus().get(0));

            // Notify JavaScript
            notifyListeners("purchaseComplete", result);

            // Acknowledge purchase
            if (!purchase.isAcknowledged()) {
                AcknowledgePurchaseParams acknowledgePurchaseParams =
                    AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.getPurchaseToken())
                        .build();
                billingClient.acknowledgePurchase(acknowledgePurchaseParams, null);
            }
        }
    }
}
```

### 3. Register Plugin

In `MainActivity.java`:

```java
import com.kidscallhome.app.GooglePlayBillingPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register the plugin
        registerPlugin(GooglePlayBillingPlugin.class);
    }
}
```

### 4. Expose to JavaScript

In `android/app/src/main/assets/public/index.html` or via Capacitor bridge:

```javascript
// This will be automatically available via Capacitor
window.GooglePlayBilling = {
  purchase: async (productId) => {
    const result = await Capacitor.Plugins.GooglePlayBilling.purchase({
      productId,
    });
    return result;
  },
};
```

## iOS Implementation

### 1. Enable In-App Purchases

In Xcode:

1. Select your project target
2. Go to "Signing & Capabilities"
3. Add "In-App Purchase" capability

### 2. Create Capacitor Plugin Bridge

Create `ios/App/App/AppStorePurchasePlugin.swift`:

```swift
import Foundation
import Capacitor
import StoreKit

@objc(AppStorePurchasePlugin)
public class AppStorePurchasePlugin: CAPPlugin {
    private var products: [String: Product] = [:]

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Product ID is required")
            return
        }

        Task {
            do {
                // Load products
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found")
                    return
                }

                // Purchase
                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    let transaction = try checkVerified(verification)

                    // Get receipt
                    if let appStoreReceiptURL = Bundle.main.appStoreReceiptURL,
                       let receiptData = try? Data(contentsOf: appStoreReceiptURL) {
                        let receiptString = receiptData.base64EncodedString()

                        let result = [
                            "success": true,
                            "transactionReceipt": receiptString,
                            "transactionId": String(transaction.id),
                            "productId": productId
                        ]

                        call.resolve(result)

                        // Finish transaction
                        await transaction.finish()
                    } else {
                        call.reject("Failed to get receipt")
                    }

                case .userCancelled:
                    call.reject("User cancelled purchase")

                case .pending:
                    call.reject("Purchase pending")

                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreError.failedVerification
        case .verified(let safe):
            return safe
        }
    }
}

enum StoreError: Error {
    case failedVerification
}
```

### 3. Register Plugin

In `ios/App/App/AppDelegate.swift`:

```swift
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Register plugin
        return true
    }
}
```

## Backend Setup

### 1. Environment Variables

Add to Supabase Dashboard → Edge Functions → Secrets:

```bash
# Google Play
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# App Store
APP_STORE_SHARED_SECRET=your_app_store_shared_secret
APP_STORE_PRODUCTION=true  # or false for sandbox
```

### 2. Google Play Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a service account
3. Download JSON key
4. Add to Google Play Console → Settings → API access
5. Grant "View financial data" permission
6. Add JSON content to `GOOGLE_SERVICE_ACCOUNT_KEY`

### 3. App Store Shared Secret

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. My Apps → Your App → App Information
3. Copy "Shared Secret" under "App-Specific Shared Secret"
4. Add to `APP_STORE_SHARED_SECRET`

### 4. Deploy Edge Function

```bash
supabase functions deploy verify-native-purchase
```

## Testing

### Android Testing

1. Upload app to Google Play Console (Internal Testing track)
2. Add test accounts in Play Console → Settings → License Testing
3. Test purchases will be free and auto-renew every 5 minutes

### iOS Testing

1. Create sandbox test accounts in App Store Connect
2. Sign out of App Store on test device
3. Test purchases will use sandbox accounts
4. Set `APP_STORE_PRODUCTION=false` for sandbox testing

## Troubleshooting

### Android: "Product not found"

- Verify product IDs match exactly in Play Console
- Ensure products are published (not draft)
- Check that app is signed with correct keystore

### iOS: "Product not found"

- Verify product IDs match exactly in App Store Connect
- Ensure products are "Ready to Submit" or "Approved"
- Check that In-App Purchase capability is enabled

### Backend: "Verification failed"

- Check service account permissions (Google Play)
- Verify shared secret is correct (App Store)
- Check that products exist in store consoles
- Review edge function logs in Supabase Dashboard

## Next Steps

1. Implement native purchase bridges (Android/iOS)
2. Configure products in store consoles
3. Set up backend environment variables
4. Test purchases in sandbox/test environments
5. Deploy to production

For detailed implementation examples, see:

- [Google Play Billing Documentation](https://developer.android.com/google/play/billing)
- [StoreKit 2 Documentation](https://developer.apple.com/documentation/storekit)
