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
      ai_rate_limit: {
        Row: {
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          model: string
          operation: string
          output_tokens: number
          user_id: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model: string
          operation: string
          output_tokens?: number
          user_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          operation?: string
          output_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      containers: {
        Row: {
          created_at: string
          id: string
          label: string
          room_id: string
          user_id: string
          wall_id: string | null
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          room_id: string
          user_id: string
          wall_id?: string | null
          x: number
          y: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          room_id?: string
          user_id?: string
          wall_id?: string | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "containers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "containers_wall_id_fkey"
            columns: ["wall_id"]
            isOneToOne: false
            referencedRelation: "walls"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          container_id: string
          created_at: string
          embedding: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          container_id: string
          created_at?: string
          embedding?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          container_id?: string
          created_at?: string
          embedding?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          trial_ends_at: string | null
          tutorial_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          trial_ends_at?: string | null
          tutorial_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          trial_ends_at?: string | null
          tutorial_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string
          id: string
          name: string
          photo_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string
          raw_event: Json | null
          status: string
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          provider: string
          provider_customer_id?: string | null
          provider_subscription_id: string
          raw_event?: Json | null
          status: string
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string
          raw_event?: Json | null
          status?: string
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          id: string
          month: string
          searches_count: number
          transcriptions_count: number
          user_id: string
        }
        Insert: {
          id?: string
          month: string
          searches_count?: number
          transcriptions_count?: number
          user_id: string
        }
        Update: {
          id?: string
          month?: string
          searches_count?: number
          transcriptions_count?: number
          user_id?: string
        }
        Relationships: []
      }
      user_security: {
        Row: {
          biometric_enabled: boolean
          created_at: string
          pin_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          biometric_enabled?: boolean
          created_at?: string
          pin_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          biometric_enabled?: boolean
          created_at?: string
          pin_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      walls: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "walls_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_ai_rate_limit: { Args: { _user_id: string }; Returns: number }
      log_ai_usage: {
        Args: {
          _cost_usd: number
          _input_tokens: number
          _model: string
          _operation: string
          _output_tokens: number
          _user_id: string
        }
        Returns: undefined
      }
      match_items: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          container_id: string
          container_label: string
          id: string
          name: string
          room_id: string
          room_name: string
          similarity: number
        }[]
      }
    }
    Enums: {
      subscription_plan: "free" | "pro" | "premium"
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
      subscription_plan: ["free", "pro", "premium"],
    },
  },
} as const
