export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          created_at: string
          email: string | null
          event_timestamp: string
          event_type: string
          id: string
          ip: string | null
          metadata: Json | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_timestamp?: string
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          severity: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_timestamp?: string
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          answer: Json | null
          call_type: string | null
          callee_id: string | null
          callee_profile: Json | null
          caller_id: string | null
          caller_profile: Json | null
          caller_type: string | null
          child_ice_candidates: Json | null
          child_id: string | null
          created_at: string | null
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          family_member_id: string | null
          id: string
          missed_call: boolean | null
          missed_call_read_at: string | null
          offer: Json | null
          parent_ice_candidates: Json | null
          parent_id: string | null
          status: string | null
          version: number | null
        }
        Insert: {
          answer?: Json | null
          call_type?: string | null
          callee_id?: string | null
          callee_profile?: Json | null
          caller_id?: string | null
          caller_profile?: Json | null
          caller_type?: string | null
          child_ice_candidates?: Json | null
          child_id?: string | null
          created_at?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          family_member_id?: string | null
          id?: string
          missed_call?: boolean | null
          missed_call_read_at?: string | null
          offer?: Json | null
          parent_ice_candidates?: Json | null
          parent_id?: string | null
          status?: string | null
          version?: number | null
        }
        Update: {
          answer?: Json | null
          call_type?: string | null
          callee_id?: string | null
          callee_profile?: Json | null
          caller_id?: string | null
          caller_profile?: Json | null
          caller_type?: string | null
          child_ice_candidates?: Json | null
          child_id?: string | null
          created_at?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          family_member_id?: string | null
          id?: string
          missed_call?: boolean | null
          missed_call_read_at?: string | null
          offer?: Json | null
          parent_ice_candidates?: Json | null
          parent_id?: string | null
          status?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      calls_backup: {
        Row: {
          backup_created_at: string | null
          call_type: string | null
          callee_id: string | null
          callee_profile: Json | null
          caller_id: string | null
          caller_profile: Json | null
          created_at: string | null
          id: string | null
          status: string | null
        }
        Insert: {
          backup_created_at?: string | null
          call_type?: string | null
          callee_id?: string | null
          callee_profile?: Json | null
          caller_id?: string | null
          caller_profile?: Json | null
          created_at?: string | null
          id?: string | null
          status?: string | null
        }
        Update: {
          backup_created_at?: string | null
          call_type?: string | null
          callee_id?: string | null
          callee_profile?: Json | null
          caller_id?: string | null
          caller_profile?: Json | null
          created_at?: string | null
          id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      children: {
        Row: {
          avatar_color: string | null
          created_at: string
          id: string
          login_code: string
          name: string
          parent_id: string
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string
          id?: string
          login_code: string
          name: string
          parent_id: string
        }
        Update: {
          avatar_color?: string | null
          created_at?: string
          id?: string
          login_code?: string
          name?: string
          parent_id?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          country_code: string | null
          created_at: string
          device_identifier: string
          device_name: string
          device_type: string
          id: string
          is_active: boolean | null
          last_ip_address: unknown
          last_location: string | null
          last_login_at: string | null
          last_used_child_id: string | null
          mac_address: string | null
          parent_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          device_identifier: string
          device_name: string
          device_type: string
          id?: string
          is_active?: boolean | null
          last_ip_address?: unknown
          last_location?: string | null
          last_login_at?: string | null
          last_used_child_id?: string | null
          mac_address?: string | null
          parent_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          device_identifier?: string
          device_name?: string
          device_type?: string
          id?: string
          is_active?: boolean | null
          last_ip_address?: unknown
          last_location?: string | null
          last_login_at?: string | null
          last_used_child_id?: string | null
          mac_address?: string | null
          parent_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_last_used_child_id_fkey"
            columns: ["last_used_child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string | null
          id: string
          invite_code: string
          name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invite_code: string
          name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invite_code?: string
          name?: string | null
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string | null
          internal_id: string
          invitation_accepted_at: string | null
          invitation_sent_at: string | null
          invitation_token: string | null
          name: string
          parent_id: string
          relationship: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string | null
          internal_id?: string
          invitation_accepted_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          name: string
          parent_id: string
          relationship: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string | null
          internal_id?: string
          invitation_accepted_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          name?: string
          parent_id?: string
          relationship?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          child_id: string
          content: string
          created_at: string | null
          family_member_id: string | null
          id: string
          read_at: string | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          child_id: string
          content: string
          created_at?: string | null
          family_member_id?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
          sender_type: string
        }
        Update: {
          child_id?: string
          content?: string
          created_at?: string | null
          family_member_id?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          allowed_children: number | null
          created_at: string | null
          email: string
          email_updates_opt_in: boolean
          family_code: string | null
          id: string
          name: string | null
          privacy_cookie_accepted: boolean
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_link_id: string | null
          stripe_subscription_id: string | null
          subscription_cancel_reason: string | null
          subscription_cancelled_at: string | null
          subscription_expires_at: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          subscription_type: string | null
        }
        Insert: {
          allowed_children?: number | null
          created_at?: string | null
          email: string
          email_updates_opt_in?: boolean
          family_code?: string | null
          id: string
          name?: string | null
          privacy_cookie_accepted?: boolean
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_reason?: string | null
          subscription_cancelled_at?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          subscription_type?: string | null
        }
        Update: {
          allowed_children?: number | null
          created_at?: string | null
          email?: string
          email_updates_opt_in?: boolean
          family_code?: string | null
          id?: string
          name?: string | null
          privacy_cookie_accepted?: boolean
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_reason?: string | null
          subscription_cancelled_at?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          subscription_type?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          family_id: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          family_id?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          family_id?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_checkout_sessions: {
        Row: {
          checkout_session_id: string
          created_at: string
          id: string
          parent_id: string
          subscription_type: string
          used_at: string
        }
        Insert: {
          checkout_session_id: string
          created_at?: string
          id?: string
          parent_id: string
          subscription_type: string
          used_at?: string
        }
        Update: {
          checkout_session_id?: string
          created_at?: string
          id?: string
          parent_id?: string
          subscription_type?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_checkout_sessions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_add_child: { Args: { p_parent_id: string }; Returns: boolean }
      can_child_view_parent: { Args: { parent_uuid: string }; Returns: boolean }
      cancel_subscription: {
        Args: { p_cancel_reason?: string; p_parent_id: string }
        Returns: Json
      }
      check_family_member_email: {
        Args: { email_to_check: string; parent_id_to_check: string }
        Returns: {
          found: boolean
          invitation_token: string
          status: string
        }[]
      }
      cleanup_old_audit_logs: {
        Args: { p_retention_days?: number }
        Returns: number
      }
      ensure_call_ending_columns: { Args: never; Returns: undefined }
      generate_kid_friendly_login_code: { Args: never; Returns: string }
      generate_unique_family_code: { Args: never; Returns: string }
      generate_unique_login_code: { Args: never; Returns: string }
      get_audit_logs: {
        Args: {
          p_end_date?: string
          p_event_type?: string
          p_limit?: number
          p_severity?: string
          p_start_date?: string
          p_user_id?: string
        }
        Returns: {
          created_at: string
          email: string
          event_timestamp: string
          event_type: string
          id: string
          ip: string
          metadata: Json
          severity: string
          user_agent: string
          user_id: string
        }[]
      }
      get_full_login_code: { Args: { p_child_id: string }; Returns: string }
      get_parent_name_for_child: {
        Args: { parent_uuid: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      increment_call_version: { Args: { call_id: string }; Returns: undefined }
      log_audit_event: {
        Args: {
          p_email?: string
          p_event_type: string
          p_ip?: string
          p_metadata?: Json
          p_severity?: string
          p_timestamp?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      process_expired_subscriptions: {
        Args: never
        Returns: {
          action_taken: string
          children_count: number
          parent_id: string
          subscription_type: string
        }[]
      }
      reactivate_subscription: {
        Args: {
          p_allowed_children: number
          p_parent_id: string
          p_subscription_type: string
        }
        Returns: Json
      }
      revoke_device: {
        Args: { p_device_id: string; p_parent_id: string }
        Returns: boolean
      }
      update_device_login:
        | {
            Args: {
              p_child_id?: string
              p_device_identifier: string
              p_device_name: string
              p_device_type: string
              p_ip_address: unknown
              p_parent_id: string
              p_user_agent: string
            }
            Returns: string
          }
        | {
            Args: {
              p_child_id?: string
              p_country_code?: string
              p_device_identifier: string
              p_device_name: string
              p_device_type: string
              p_ip_address: string
              p_mac_address?: string
              p_parent_id: string
              p_user_agent: string
            }
            Returns: string
          }
      upgrade_family_subscription: {
        Args: {
          p_allowed_children: number
          p_family_email: string
          p_stripe_checkout_session_id?: string
          p_stripe_customer_id?: string
          p_stripe_payment_link_id?: string
          p_stripe_price_id?: string
          p_stripe_subscription_id?: string
          p_subscription_type: string
        }
        Returns: Json
      }
      verify_child_can_insert_call: {
        Args: { p_child_id: string; p_parent_id: string }
        Returns: boolean
      }
      verify_child_can_send_message: {
        Args: { p_child_id: string; p_sender_id: string }
        Returns: boolean
      }
      verify_child_parent: {
        Args: { p_child_id: string; p_parent_id: string }
        Returns: boolean
      }
      verify_child_parent_relationship: {
        Args: { p_child_id: string; p_parent_id: string }
        Returns: boolean
      }
      get_referral_stats: {
        Args: { p_parent_id: string }
        Returns: {
          referral_code: string
          total_referrals: number
          pending_referrals: number
          completed_referrals: number
          total_bonus_days: number
          bonus_weeks: number
        }
      }
      get_referral_list: {
        Args: { p_parent_id: string }
        Returns: {
          id: string
          referred_email: string
          status: string
          reward_days: number
          created_at: string
          credited_at: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
