// src/features/safety/components/SafetyModeSettings.tsx
// Component for managing safety mode settings

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X, Plus } from "lucide-react";
import type { SafetyModeSettings as SafetyModeSettingsType } from "@/types/family-communication";

export const SafetyModeSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [settings, setSettings] = useState<SafetyModeSettingsType>({
    keyword_alerts: false,
    export_conversations: false,
    alert_threshold: "medium",
    keywords: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keywordsDialogOpen, setKeywordsDialogOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
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
            const loadedSettings = family.safety_mode_settings as SafetyModeSettingsType;
            setSettings({
              ...loadedSettings,
              keywords: loadedSettings.keywords || [],
            });
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

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    // Normalize: lowercase and trim, but preserve spaces for phrases
    const keyword = newKeyword.toLowerCase().trim().replace(/\s+/g, ' ');
    const currentKeywords = settings.keywords || [];
    
    if (currentKeywords.includes(keyword)) {
      toast({
        title: "Word/phrase already exists",
        description: "This word or phrase is already in your blocked words list",
        variant: "destructive",
      });
      return;
    }

    setSettings({
      ...settings,
      keywords: [...currentKeywords, keyword],
    });
    setNewKeyword("");
  };

  const handleRemoveKeyword = (index: number) => {
    const currentKeywords = settings.keywords || [];
    setSettings({
      ...settings,
      keywords: currentKeywords.filter((_, i) => i !== index),
    });
  };

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
      setKeywordsDialogOpen(false);
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Blocked Words</Label>
                <Dialog open={keywordsDialogOpen} onOpenChange={setKeywordsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" type="button">
                      <Plus className="h-4 w-4 mr-1" />
                      Manage Words
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Manage Blocked Words</DialogTitle>
                      <DialogDescription>
                        Add or remove words and phrases that will be filtered from chat messages. 
                        You can add single words (e.g., "stupid") or phrases (e.g., "home alone", "parents away"). 
                        These will be blocked for all family members.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex gap-2">
                        <Input
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          placeholder="Enter a word or phrase (e.g., 'home alone')"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddKeyword();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleAddKeyword}
                          disabled={
                            !newKeyword.trim() || 
                            (settings.keywords || []).includes(newKeyword.toLowerCase().trim().replace(/\s+/g, ' '))
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="border rounded-md p-3 max-h-[300px] overflow-y-auto">
                        {settings.keywords && settings.keywords.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {settings.keywords.map((keyword, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm"
                              >
                                <span>{keyword}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveKeyword(index)}
                                  className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                                  aria-label={`Remove ${keyword}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No custom words or phrases added. Default word filter will be used.
                          </p>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {settings.keywords && settings.keywords.length > 0 && (
                <p className="text-xs text-gray-500">
                  {settings.keywords.length} custom word{settings.keywords.length !== 1 ? "s/phrases" : ""} configured
                </p>
              )}
            </div>

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

