// src/features/safety/components/SafetyModeSettings.tsx
// Component for managing safety mode settings

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SafetyModeSettings as SafetyModeSettingsType } from "@/types/family-communication";

export const SafetyModeSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [settings, setSettings] = useState<SafetyModeSettingsType>({
    keyword_alerts: false,
    ai_content_scanning: false,
    export_conversations: false,
    alert_threshold: "medium",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: adultProfile } = await supabase
          .from("adult_profiles")
          .select("family_id")
          .eq("user_id", user.id)
          .eq("role", "parent")
          .single();

        if (!adultProfile) return;

        const { data: family } = await supabase
          .from("families")
          .select("safety_mode_enabled, safety_mode_settings")
          .eq("id", adultProfile.family_id)
          .single();

        if (family) {
          setEnabled(family.safety_mode_enabled || false);
          if (family.safety_mode_settings) {
            setSettings(family.safety_mode_settings as SafetyModeSettingsType);
          }
        }
      } catch (error) {
        console.error("Error fetching safety settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adultProfile } = await supabase
        .from("adult_profiles")
        .select("family_id")
        .eq("user_id", user.id)
        .eq("role", "parent")
        .single();

      if (!adultProfile) return;

      const { error } = await supabase
        .from("families")
        .update({
          safety_mode_enabled: enabled,
          safety_mode_settings: settings,
        })
        .eq("id", adultProfile.family_id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Safety mode settings have been updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading settings...</div>;
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable Safety Mode</p>
            <p className="text-sm text-gray-600">
              Optional monitoring features for child safety
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <div className="pl-4 space-y-3 border-l-2 border-gray-200">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.keyword_alerts}
                onChange={(e) => setSettings({...settings, keyword_alerts: e.target.checked})}
                className="rounded"
              />
              <span>Keyword Alerts</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.ai_content_scanning}
                onChange={(e) => setSettings({...settings, ai_content_scanning: e.target.checked})}
                className="rounded"
              />
              <span>AI Content Scanning</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.export_conversations}
                onChange={(e) => setSettings({...settings, export_conversations: e.target.checked})}
                className="rounded"
              />
              <span>Allow Conversation Export</span>
            </label>

            <div>
              <Label className="block text-sm font-medium mb-1">Alert Threshold</Label>
              <Select
                value={settings.alert_threshold}
                onValueChange={(value) => setSettings({...settings, alert_threshold: value as "low" | "medium" | "high"})}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (more alerts)</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High (fewer alerts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </Card>
  );
};

