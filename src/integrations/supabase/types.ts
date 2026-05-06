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
      bot_knowledge: {
        Row: {
          active: boolean
          answer: string
          created_at: string
          id: string
          kind: string
          question: string
          rating: number
          source: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          answer?: string
          created_at?: string
          id?: string
          kind?: string
          question?: string
          rating?: number
          source?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          answer?: string
          created_at?: string
          id?: string
          kind?: string
          question?: string
          rating?: number
          source?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          aggressiveness: number
          audience: string
          auto_crm: boolean
          business_hours: Json
          created_at: string
          enabled: boolean
          fallback_message: string
          greeting: string
          handoff_keywords: string[]
          id: string
          methodology: string
          objective: string
          product: string
          rules: string
          tone: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aggressiveness?: number
          audience?: string
          auto_crm?: boolean
          business_hours?: Json
          created_at?: string
          enabled?: boolean
          fallback_message?: string
          greeting?: string
          handoff_keywords?: string[]
          id?: string
          methodology?: string
          objective?: string
          product?: string
          rules?: string
          tone?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aggressiveness?: number
          audience?: string
          auto_crm?: boolean
          business_hours?: Json
          created_at?: string
          enabled?: boolean
          fallback_message?: string
          greeting?: string
          handoff_keywords?: string[]
          id?: string
          methodology?: string
          objective?: string
          product?: string
          rules?: string
          tone?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_message_audit: {
        Row: {
          action: string
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          new_content: string | null
          previous_content: string | null
          user_id: string
        }
        Insert: {
          action: string
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          new_content?: string | null
          previous_content?: string | null
          user_id: string
        }
        Update: {
          action?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          new_content?: string | null
          previous_content?: string | null
          user_id?: string
        }
        Relationships: []
      }
      channel_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          direction: string
          edited_at: string | null
          external_message_id: string | null
          feedback: string | null
          id: string
          media_type: string | null
          media_url: string | null
          metadata: Json
          original_content: string | null
          sender: string
          status: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          direction: string
          edited_at?: string | null
          external_message_id?: string | null
          feedback?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json
          original_content?: string | null
          sender?: string
          status?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          direction?: string
          edited_at?: string | null
          external_message_id?: string | null
          feedback?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json
          original_content?: string | null
          sender?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          access_token: string | null
          access_token_secret_name: string | null
          business_account_id: string | null
          config: Json
          created_at: string
          display_phone: string | null
          id: string
          name: string
          phone_number_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
          webhook_verify_token: string
        }
        Insert: {
          access_token?: string | null
          access_token_secret_name?: string | null
          business_account_id?: string | null
          config?: Json
          created_at?: string
          display_phone?: string | null
          id?: string
          name?: string
          phone_number_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
          webhook_verify_token?: string
        }
        Update: {
          access_token?: string | null
          access_token_secret_name?: string | null
          business_account_id?: string | null
          config?: Json
          created_at?: string
          display_phone?: string | null
          id?: string
          name?: string
          phone_number_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          webhook_verify_token?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          bot_active: boolean
          channel_id: string
          contact_name: string
          contact_phone: string
          created_at: string
          external_contact_id: string
          id: string
          last_message_at: string
          lead_id: string | null
          negotiation_id: string | null
          status: string
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_active?: boolean
          channel_id: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          external_contact_id: string
          id?: string
          last_message_at?: string
          lead_id?: string | null
          negotiation_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_active?: boolean
          channel_id?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          external_contact_id?: string
          id?: string
          last_message_at?: string
          lead_id?: string | null
          negotiation_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_templates: {
        Row: {
          created_at: string
          date_rule: string
          enabled: boolean
          holiday_key: string
          id: string
          message_template: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_rule?: string
          enabled?: boolean
          holiday_key: string
          id?: string
          message_template?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_rule?: string
          enabled?: boolean
          holiday_key?: string
          id?: string
          message_template?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      insights: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          title?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_events: {
        Row: {
          description: string
          id: string
          lead_id: string
          metadata: Json
          occurred_at: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          description?: string
          id?: string
          lead_id: string
          metadata?: Json
          occurred_at?: string
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          description?: string
          id?: string
          lead_id?: string
          metadata?: Json
          occurred_at?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_reminders: {
        Row: {
          created_at: string
          due_at: string
          id: string
          kind: string
          lead_id: string | null
          message: string
          meta: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          message?: string
          meta?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          message?: string
          meta?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          avatar: string | null
          birthday: string | null
          company: string
          created_at: string | null
          deleted_at: string | null
          deleted_reason: string | null
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
          birthday?: string | null
          company?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
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
          birthday?: string | null
          company?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
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
          loss_reason: string | null
          objections: Json | null
          objective: string | null
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
          loss_reason?: string | null
          objections?: Json | null
          objective?: string | null
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
          loss_reason?: string | null
          objections?: Json | null
          objective?: string | null
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
      reminder_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          meta: Json
          name: string
          stages: string[]
          threshold_hours: number
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          meta?: Json
          name?: string
          stages?: string[]
          threshold_hours?: number
          trigger_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          meta?: Json
          name?: string
          stages?: string[]
          threshold_hours?: number
          trigger_type?: string
          updated_at?: string
          user_id?: string
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
      training_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          client_profile: string
          created_at: string
          difficulty: string
          feedback: Json | null
          id: string
          product: string | null
          scenario: string
          score: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_profile?: string
          created_at?: string
          difficulty?: string
          feedback?: Json | null
          id?: string
          product?: string | null
          scenario?: string
          score?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_profile?: string
          created_at?: string
          difficulty?: string
          feedback?: Json | null
          id?: string
          product?: string | null
          scenario?: string
          score?: number | null
          status?: string
          updated_at?: string
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
