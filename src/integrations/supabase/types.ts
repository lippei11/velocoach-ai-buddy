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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          avg_hr: number | null
          created_at: string | null
          distance_meters: number | null
          duration_seconds: number | null
          external_id: string
          ftp_at_time: number | null
          id: string
          intensity_factor: number | null
          name: string | null
          normalized_power: number | null
          raw_data: Json | null
          source: string
          sport_type: string | null
          start_date: string
          tss: number | null
          user_id: string
          zone_times: Json | null
        }
        Insert: {
          avg_hr?: number | null
          created_at?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          external_id: string
          ftp_at_time?: number | null
          id?: string
          intensity_factor?: number | null
          name?: string | null
          normalized_power?: number | null
          raw_data?: Json | null
          source?: string
          sport_type?: string | null
          start_date: string
          tss?: number | null
          user_id: string
          zone_times?: Json | null
        }
        Update: {
          avg_hr?: number | null
          created_at?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          external_id?: string
          ftp_at_time?: number | null
          id?: string
          intensity_factor?: number | null
          name?: string | null
          normalized_power?: number | null
          raw_data?: Json | null
          source?: string
          sport_type?: string | null
          start_date?: string
          tss?: number | null
          user_id?: string
          zone_times?: Json | null
        }
        Relationships: []
      }
      athlete_connections: {
        Row: {
          connected_at: string | null
          connection_status: string
          created_at: string | null
          dexcom_access_token: string | null
          dexcom_connected: boolean | null
          dexcom_connected_at: string | null
          dexcom_last_error: string | null
          dexcom_last_sync_at: string | null
          dexcom_password_vault_id: string | null
          dexcom_refresh_token: string | null
          dexcom_session_id: string | null
          dexcom_username: string | null
          id: string
          intervals_api_key: string
          intervals_athlete_id: string
          last_error: string | null
          last_sync_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          connection_status?: string
          created_at?: string | null
          dexcom_access_token?: string | null
          dexcom_connected?: boolean | null
          dexcom_connected_at?: string | null
          dexcom_last_error?: string | null
          dexcom_last_sync_at?: string | null
          dexcom_password_vault_id?: string | null
          dexcom_refresh_token?: string | null
          dexcom_session_id?: string | null
          dexcom_username?: string | null
          id?: string
          intervals_api_key: string
          intervals_athlete_id: string
          last_error?: string | null
          last_sync_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          connection_status?: string
          created_at?: string | null
          dexcom_access_token?: string | null
          dexcom_connected?: boolean | null
          dexcom_connected_at?: string | null
          dexcom_last_error?: string | null
          dexcom_last_sync_at?: string | null
          dexcom_password_vault_id?: string | null
          dexcom_refresh_token?: string | null
          dexcom_session_id?: string | null
          dexcom_username?: string | null
          id?: string
          intervals_api_key?: string
          intervals_athlete_id?: string
          last_error?: string | null
          last_sync_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      athlete_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          ftp: number | null
          id: string
          intervals_athlete_id: string | null
          max_hr: number | null
          name: string | null
          raw_data: Json | null
          resting_hr: number | null
          sport_types: Json | null
          synced_at: string | null
          updated_at: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          ftp?: number | null
          id?: string
          intervals_athlete_id?: string | null
          max_hr?: number | null
          name?: string | null
          raw_data?: Json | null
          resting_hr?: number | null
          sport_types?: Json | null
          synced_at?: string | null
          updated_at?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          ftp?: number | null
          id?: string
          intervals_athlete_id?: string | null
          max_hr?: number | null
          name?: string | null
          raw_data?: Json | null
          resting_hr?: number | null
          sport_types?: Json | null
          synced_at?: string | null
          updated_at?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_adjustments: {
        Row: {
          affected_workout_ids: Json | null
          changes: Json
          created_at: string | null
          explanation: string | null
          id: string
          plan_id: string
          reason: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          affected_workout_ids?: Json | null
          changes?: Json
          created_at?: string | null
          explanation?: string | null
          id?: string
          plan_id: string
          reason: string
          trigger_type: string
          user_id: string
        }
        Update: {
          affected_workout_ids?: Json | null
          changes?: Json
          created_at?: string | null
          explanation?: string | null
          id?: string
          plan_id?: string
          reason?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_adjustments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_workouts: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          duration_minutes: number | null
          id: string
          intervals_event_id: string | null
          name: string
          plan_id: string | null
          purpose: string | null
          synced_to_intervals: boolean | null
          tss_target: number | null
          user_id: string
          workout_type: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          intervals_event_id?: string | null
          name: string
          plan_id?: string | null
          purpose?: string | null
          synced_to_intervals?: boolean | null
          tss_target?: number | null
          user_id: string
          workout_type?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          intervals_event_id?: string | null
          name?: string
          plan_id?: string | null
          purpose?: string | null
          synced_to_intervals?: boolean | null
          tss_target?: number | null
          user_id?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          available_days: Json | null
          created_at: string | null
          current_ctl: number | null
          event_date: string | null
          fitness_context: string | null
          goal_event: string | null
          goal_type: string | null
          hours_per_week: number | null
          id: string
          phases: Json | null
          philosophy: string | null
          race_priority: string | null
          rationale: string | null
          status: string
          target_ctl: number | null
          user_id: string
          version: number
        }
        Insert: {
          available_days?: Json | null
          created_at?: string | null
          current_ctl?: number | null
          event_date?: string | null
          fitness_context?: string | null
          goal_event?: string | null
          goal_type?: string | null
          hours_per_week?: number | null
          id?: string
          phases?: Json | null
          philosophy?: string | null
          race_priority?: string | null
          rationale?: string | null
          status?: string
          target_ctl?: number | null
          user_id: string
          version?: number
        }
        Update: {
          available_days?: Json | null
          created_at?: string | null
          current_ctl?: number | null
          event_date?: string | null
          fitness_context?: string | null
          goal_event?: string | null
          goal_type?: string | null
          hours_per_week?: number | null
          id?: string
          phases?: Json | null
          philosophy?: string | null
          race_priority?: string | null
          rationale?: string | null
          status?: string
          target_ctl?: number | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          event_date: string | null
          fitness_context: string | null
          generated_at: string | null
          goal_event: string | null
          id: string
          plan_data: Json
          synced_to_intervals: boolean | null
          user_id: string
        }
        Insert: {
          event_date?: string | null
          fitness_context?: string | null
          generated_at?: string | null
          goal_event?: string | null
          id?: string
          plan_data?: Json
          synced_to_intervals?: boolean | null
          user_id: string
        }
        Update: {
          event_date?: string | null
          fitness_context?: string | null
          generated_at?: string | null
          goal_event?: string | null
          id?: string
          plan_data?: Json
          synced_to_intervals?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      wellness_days: {
        Row: {
          atl: number | null
          created_at: string | null
          ctl: number | null
          date: string
          hrv: number | null
          id: string
          ramp_rate: number | null
          resting_hr: number | null
          sleep_score: number | null
          source: string | null
          tsb: number | null
          user_id: string
          weight: number | null
        }
        Insert: {
          atl?: number | null
          created_at?: string | null
          ctl?: number | null
          date: string
          hrv?: number | null
          id?: string
          ramp_rate?: number | null
          resting_hr?: number | null
          sleep_score?: number | null
          source?: string | null
          tsb?: number | null
          user_id: string
          weight?: number | null
        }
        Update: {
          atl?: number | null
          created_at?: string | null
          ctl?: number | null
          date?: string
          hrv?: number | null
          id?: string
          ramp_rate?: number | null
          resting_hr?: number | null
          sleep_score?: number | null
          source?: string | null
          tsb?: number | null
          user_id?: string
          weight?: number | null
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
