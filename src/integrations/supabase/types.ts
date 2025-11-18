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
      calls: {
        Row: {
          answer: Json | null
          caller_type: string
          child_ice_candidates: Json | null
          child_id: string
          created_at: string
          ended_at: string | null
          id: string
          offer: Json | null
          parent_ice_candidates: Json | null
          parent_id: string
          status: string
        }
        Insert: {
          answer?: Json | null
          caller_type: string
          child_ice_candidates?: Json | null
          child_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          offer?: Json | null
          parent_ice_candidates?: Json | null
          parent_id: string
          status?: string
        }
        Update: {
          answer?: Json | null
          caller_type?: string
          child_ice_candidates?: Json | null
          child_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          offer?: Json | null
          parent_ice_candidates?: Json | null
          parent_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      child_sessions: {
        Row: {
          child_id: string
          created_at: string
          expires_at: string
          id: string
          last_used_at: string
          token: string
        }
        Insert: {
          child_id: string
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          token: string
        }
        Update: {
          child_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          avatar_color: string | null
          created_at: string | null
          id: string
          login_code: string
          name: string
          parent_id: string
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string | null
          id?: string
          login_code: string
          name: string
          parent_id: string
        }
        Update: {
          avatar_color?: string | null
          created_at?: string | null
          id?: string
          login_code?: string
          name?: string
          parent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_parent_id_fkey"
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
          id: string
          sender_id: string
          sender_type: string
        }
        Insert: {
          child_id: string
          content: string
          created_at?: string | null
          id?: string
          sender_id: string
          sender_type: string
        }
        Update: {
          child_id?: string
          content?: string
          created_at?: string | null
          id?: string
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
        ]
      }
      parents: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_child_with_code: {
        Args: { p_login_code: string }
        Returns: {
          avatar_color: string
          child_id: string
          child_name: string
          parent_id: string
          session_token: string
        }[]
      }
      cleanup_expired_child_sessions: { Args: never; Returns: number }
      generate_unique_login_code: { Args: never; Returns: string }
      get_child_id_from_token: { Args: { p_token: string }; Returns: string }
      get_child_messages: {
        Args: { p_child_id: string; p_token: string }
        Returns: {
          child_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
          sender_type: string
        }[]
      }
      get_parent_name: { Args: { p_parent_id: string }; Returns: string }
      logout_child_session: { Args: { p_token: string }; Returns: boolean }
      send_child_message: {
        Args: { p_child_id: string; p_content: string; p_token: string }
        Returns: string
      }
      verify_child_call_access: {
        Args: { p_call_id: string; p_child_id: string }
        Returns: boolean
      }
      verify_child_can_send_message: {
        Args: { p_child_id: string; p_sender_id: string }
        Returns: boolean
      }
      verify_child_session: {
        Args: { p_child_id: string; p_token: string }
        Returns: boolean
      }
      verify_login_code: {
        Args: { p_code: string }
        Returns: {
          avatar_color: string
          id: string
          name: string
          parent_id: string
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
