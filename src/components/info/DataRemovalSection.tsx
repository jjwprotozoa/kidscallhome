// src/components/info/DataRemovalSection.tsx
// Purpose: Personal information removal section for Info page

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

export const DataRemovalSection = () => {
  return (
    <section id="removal" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Personal Information Removal
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">
              Requesting Data Deletion
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              You can request deletion of your personal information and
              account data in the following ways:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>
                <strong>Feedback Form Request:</strong> Submit a request through{" "}
                <Link
                  to="/beta"
                  className="text-primary hover:underline font-medium"
                >
                  our Beta Program feedback form
                </Link>
                . Please select "Other" as the category and include "Account Deletion Request" in your message along with
                your account email address.
              </li>
              <li>
                <strong>In-App Request:</strong> Contact support through
                the app's support section (see Contact & Support below).
              </li>
            </ul>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">What Gets Deleted</h3>
            <p className="text-sm text-muted-foreground mb-2">
              When you request account deletion, the following data will
              be permanently removed:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>
                Parent account information (email, name, profile data)
              </li>
              <li>
                All children's accounts associated with your parent
                account
              </li>
              <li>All messages and call history</li>
              <li>Device registration information</li>
              <li>
                Subscription and payment information (after required
                retention period)
              </li>
            </ul>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Response Time</h3>
            <p className="text-sm text-muted-foreground">
              We typically process deletion requests within{" "}
              <strong>7-14 business days</strong>. You will receive a
              confirmation email once your data has been deleted. Some
              data may be retained for legal or regulatory compliance
              purposes for a limited time, but will not be used for
              service purposes.
            </p>
          </div>
          <Separator />
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-semibold mb-1">Important Note</p>
            <p className="text-xs text-muted-foreground">
              Account deletion is permanent and cannot be undone. Make
              sure you want to delete your account before submitting a
              request.
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
};

