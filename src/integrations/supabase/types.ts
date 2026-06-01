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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          role: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          credits_used: number | null
          endpoint: string
          error: string | null
          formats: string[] | null
          id: string
          input_query: string | null
          input_url: string | null
          options: Json | null
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number | null
          endpoint: string
          error?: string | null
          formats?: string[] | null
          id?: string
          input_query?: string | null
          input_url?: string | null
          options?: Json | null
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number | null
          endpoint?: string
          error?: string | null
          formats?: string[] | null
          id?: string
          input_query?: string | null
          input_url?: string | null
          options?: Json | null
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monitor_events: {
        Row: {
          created_at: string
          delivered_to_discord: boolean
          diff: string | null
          id: string
          kind: string
          matched_keywords: string[] | null
          monitor_id: string
          snapshot: string | null
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_to_discord?: boolean
          diff?: string | null
          id?: string
          kind: string
          matched_keywords?: string[] | null
          monitor_id: string
          snapshot?: string | null
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_to_discord?: boolean
          diff?: string | null
          id?: string
          kind?: string
          matched_keywords?: string[] | null
          monitor_id?: string
          snapshot?: string | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitor_events_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      monitors: {
        Row: {
          created_at: string
          discord_webhook_url: string | null
          enabled: boolean
          failure_count: number
          id: string
          interval_minutes: number
          keywords: string[] | null
          last_checked_at: string | null
          last_hash: string | null
          last_snapshot: string | null
          name: string
          selector: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discord_webhook_url?: string | null
          enabled?: boolean
          failure_count?: number
          id?: string
          interval_minutes?: number
          keywords?: string[] | null
          last_checked_at?: string | null
          last_hash?: string | null
          last_snapshot?: string | null
          name: string
          selector?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          discord_webhook_url?: string | null
          enabled?: boolean
          failure_count?: number
          id?: string
          interval_minutes?: number
          keywords?: string[] | null
          last_checked_at?: string | null
          last_hash?: string | null
          last_snapshot?: string | null
          name?: string
          selector?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_cycle: string | null
          block_reason: string | null
          blocked_until: string | null
          created_at: string
          credits_remaining: number
          daily_credit_limit: number
          display_name: string | null
          id: string
          last_credit_reset: string
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          billing_cycle?: string | null
          block_reason?: string | null
          blocked_until?: string | null
          created_at?: string
          credits_remaining?: number
          daily_credit_limit?: number
          display_name?: string | null
          id?: string
          last_credit_reset?: string
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          billing_cycle?: string | null
          block_reason?: string | null
          blocked_until?: string | null
          created_at?: string
          credits_remaining?: number
          daily_credit_limit?: number
          display_name?: string | null
          id?: string
          last_credit_reset?: string
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signup_allowlist: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      snapshot_runs: {
        Row: {
          created_at: string
          credits_used: number | null
          error: string | null
          finished_at: string | null
          id: string
          kind: string | null
          name: string | null
          params: Json
          progress: Json
          recipe: Json
          result: Json | null
          snapshot_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string | null
          name?: string | null
          params?: Json
          progress?: Json
          recipe?: Json
          result?: Json | null
          snapshot_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string | null
          name?: string | null
          params?: Json
          progress?: Json
          recipe?: Json
          result?: Json | null
          snapshot_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      snapshots: {
        Row: {
          created_at: string
          deliverables: string[]
          description: string | null
          id: string
          kind: string
          name: string
          params: Json
          recipe: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deliverables?: string[]
          description?: string | null
          id?: string
          kind: string
          name: string
          params?: Json
          recipe?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deliverables?: string[]
          description?: string | null
          id?: string
          kind?: string
          name?: string
          params?: Json
          recipe?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_credits: { Args: { _amount: number }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reset_daily_credits_all: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
