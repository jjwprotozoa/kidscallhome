// src/pages/SupportedDevices.tsx
// Supported devices page for Kids Call Home

import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tablet, Laptop, Smartphone } from "lucide-react";

const SupportedDevices = () => {
  const devices = [
    { icon: Tablet, name: "iPad", desc: "All iPad models" },
    { icon: Tablet, name: "Android Tablets", desc: "Samsung, Lenovo, and more" },
    { icon: Tablet, name: "Kindle Fire", desc: "Fire tablets" },
    { icon: Laptop, name: "Chromebook", desc: "School laptops" },
    { icon: Smartphone, name: "iPhone", desc: "All iPhone models" },
    { icon: Smartphone, name: "Android Phones", desc: "Most Android devices" },
  ];

  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Supported Devices
          </h1>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Kids Call Home works on most devices with a camera and internet connection. No SIM card or phone number required.
          </p>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 mb-12">
            {devices.map((device, index) => (
              <Card key={index} className="p-6 text-center">
                <device.icon
                  className="h-12 w-12 text-primary mx-auto mb-3"
                  aria-hidden="true"
                />
                <h3 className="font-bold text-base mb-1">{device.name}</h3>
                <p className="text-sm text-muted-foreground">{device.desc}</p>
              </Card>
            ))}
          </div>

          <div className="space-y-4 mb-8">
            <h2 className="text-2xl font-semibold">Requirements</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Device with a camera (for video calls)</li>
              <li>Internet connection (Wi-Fi or mobile data)</li>
              <li>Modern web browser (Chrome, Safari, Firefox, Edge)</li>
              <li>No SIM card or phone number required</li>
            </ul>
          </div>

          <div className="space-y-4 mb-8">
            <h2 className="text-2xl font-semibold">Progressive Web App (PWA)</h2>
            <p className="text-muted-foreground">
              Kids Call Home works as a Progressive Web App, which means you can install it on your device's home screen and use it like a native app. This works on most modern devices and provides a better experience than using it in a browser.
            </p>
          </div>

          <div className="border-t pt-6 mt-8 text-center">
            <Link
              to="/"
              className="inline-block text-sm text-primary hover:underline"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};

export default SupportedDevices;





