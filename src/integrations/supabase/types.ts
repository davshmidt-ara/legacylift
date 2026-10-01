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
      contact_submissions: {
        Row: {
          consent: boolean
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
        }
        Insert: {
          consent?: boolean
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          consent?: boolean
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      firm_invites: {
        Row: {
          created_at: string
          email: string
          firm_id: string
          invited_by: string | null
        }
        Insert: {
          created_at?: string
          email: string
          firm_id: string
          invited_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          firm_id?: string
          invited_by?: string | null
        }
        Relationships: []
      }
      firm_log: {
        Row: {
          author: string | null
          created_at: string
          firm_id: string
          id: string
          text: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          firm_id: string
          id?: string
          text: string
        }
        Update: {
          author?: string | null
          created_at?: string
          firm_id?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
      firm_members: {
        Row: {
          created_at: string
          firm_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          user_id?: string
        }
        Relationships: []
      }
      firms: {
        Row: {
          city: string
          contact_name: string
          created_at: string
          email: string
          firm_name: string
          id: string
          industry: string
          manual_done: string[]
          notes: string
          owner: string
          package: string
          phone: string
          stage: string
          updated_at: string
        }
        Insert: {
          city?: string
          contact_name?: string
          created_at?: string
          email?: string
          firm_name: string
          id?: string
          industry?: string
          manual_done?: string[]
          notes?: string
          owner?: string
          package?: string
          phone?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          city?: string
          contact_name?: string
          created_at?: string
          email?: string
          firm_name?: string
          id?: string
          industry?: string
          manual_done?: string[]
          notes?: string
          owner?: string
          package?: string
          phone?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          display_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          data: Json
          firm_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          data?: Json
          firm_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          data?: Json
          firm_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_staff: { Args: { p_email: string; p_display_name?: string }; Returns: boolean }
      claim_invites: { Args: Record<PropertyKey, never>; Returns: number }
      confirmed_email: { Args: Record<PropertyKey, never>; Returns: string }
      firm_member_emails: { Args: { p_firm_id: string }; Returns: { user_id: string; email: string }[] }
      is_firm_member: { Args: { p_firm_id: string }; Returns: boolean }
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean }
      my_workspaces: { Args: Record<PropertyKey, never>; Returns: { firm_id: string; business_name: string }[] }
      set_task_done: { Args: { p_firm_id: string; p_task: string; p_done: boolean }; Returns: string[] }
      staff_exists: { Args: Record<PropertyKey, never>; Returns: boolean }
      staff_list: { Args: Record<PropertyKey, never>; Returns: { user_id: string; email: string; display_name: string }[] }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
