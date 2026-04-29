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
      ai_settings: {
        Row: {
          aggressiveness: number | null
          id: string
          methodology: string | null
          notifications: Json | null
          tone: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aggressiveness?: number | null
          id?: string
          methodology?: string | null
          notifications?: Json | null
          tone?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aggressiveness?: number | null
          id?: string
          methodology?: string | null
          notifications?: Json | null
          tone?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          avatar: string | null
          company: string
          created_at: string | null
          email: string | null
          id: string
          last_contact: string | null
          name: string
          phone: string | null
          product: string | null
          score: number | null
          source: string | null
          stage: string | null
          updated_at: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          avatar?: string | null
          company?: string
          created_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          phone?: string | null
          product?: string | null
          score?: number | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          avatar?: string | null
          company?: string
          created_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          phone?: string | null
          product?: string | null
          score?: number | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      negotiation_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          negotiation_id: string
          role: string
          sentiment: string | null
          technique: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          id?: string
          negotiation_id: string
          role?: string
          sentiment?: string | null
          technique?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          negotiation_id?: string
          role?: string
          sentiment?: string | null
          technique?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_messages_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiations: {
        Row: {
          client_name: string
          closing_probability: number | null
          company: string
          created_at: string | null
          id: string
          last_activity: string | null
          lead_id: string | null
          lead_score: number | null
          objections: Json | null
          product: string | null
          sentiment: string | null
          stage: string | null
          strategies: Json | null
          updated_at: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          client_name?: string
          closing_probability?: number | null
          company?: string
          created_at?: string | null
          id?: string
          last_activity?: string | null
          lead_id?: string | null
          lead_score?: number | null
          objections?: Json | null
          product?: string | null
          sentiment?: string | null
          stage?: string | null
          strategies?: Json | null
          updated_at?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          client_name?: string
          closing_probability?: number | null
          company?: string
          created_at?: string | null
          id?: string
          last_activity?: string | null
          lead_id?: string | null
          lead_score?: number | null
          objections?: Json | null
          product?: string | null
          sentiment?: string | null
          stage?: string | null
          strategies?: Json | null
          updated_at?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negotiations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      scripts: {
        Row: {
          audience: string | null
          created_at: string | null
          id: string
          product: string | null
          rating: number | null
          sections: Json | null
          stage: string | null
          title: string
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audience?: string | null
          created_at?: string | null
          id?: string
          product?: string | null
          rating?: number | null
          sections?: Json | null
          stage?: string | null
          title?: string
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audience?: string | null
          created_at?: string | null
          id?: string
          product?: string | null
          rating?: number | null
          sections?: Json | null
          stage?: string | null
          title?: string
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
