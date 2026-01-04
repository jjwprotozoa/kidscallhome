// src/pages/HomePage/DeviceCompatibilitySection.tsx
// Works on Any Device section showing supported devices

import { Card } from "@/components/ui/card";
import { Laptop, Smartphone, Tablet } from "lucide-react";

export const DeviceCompatibilitySection = () => {
  const devices = [
    { icon: Tablet, name: "iPad", desc: "All iPad models" },
    {
      icon: Tablet,
      name: "Android Tablets",
      desc: "Samsung, Lenovo, etc.",
    },
    { icon: Tablet, name: "Kindle Fire", desc: "Fire tablets" },
    { icon: Laptop, name: "Chromebook", desc: "School laptops" },
    { icon: Smartphone, name: "Phones", desc: "iPhone & Android" },
  ];

  return (
    <section
      className="bg-muted/30 py-12 md:py-16"
      aria-labelledby="device-compatibility-heading"
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 max-w-4xl mx-auto">
          <h2
            id="device-compatibility-heading"
            className="text-2xl md:text-3xl font-bold mb-4"
          >
            Works on Any Device
          </h2>
          <div className="w-full flex justify-center">
            <p className="text-lg text-muted-foreground max-w-2xl px-4">
              No SIM card or phone number needed. Works on tablets, phones, and
              laptops — Wi-Fi or mobile data connects your family instantly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 max-w-5xl mx-auto">
          {devices.map((device, index) => (
            <Card
              key={index}
              className="p-4 md:p-6 text-center hover:shadow-lg transition-shadow"
            >
              <device.icon
                className="h-10 w-10 md:h-12 md:w-12 text-primary mx-auto mb-3"
                aria-hidden="true"
              />
              <h3 className="font-bold text-sm md:text-base mb-1 break-words px-1">
                {device.name}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                {device.desc}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center max-w-4xl mx-auto">
          <div className="w-full flex justify-center">
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl px-4">
              <strong className="text-foreground">No phone plan required.</strong>{" "}
              Works on any device with a camera and internet connection — Wi-Fi
              or mobile data is all you need.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

