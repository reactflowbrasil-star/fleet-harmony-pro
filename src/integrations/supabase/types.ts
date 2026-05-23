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
      companies: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          plan: Database["public"]["Enums"]["company_plan"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          plan?: Database["public"]["Enums"]["company_plan"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          plan?: Database["public"]["Enums"]["company_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          address: string | null
          cnh: string | null
          cnh_category: string | null
          cnh_expiry: string | null
          company_id: string
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          address?: string | null
          cnh?: string | null
          cnh_category?: string | null
          cnh_expiry?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          address?: string | null
          cnh?: string | null
          cnh_category?: string | null
          cnh_expiry?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          company_id: string
          created_at: string
          current_km: number | null
          driver_id: string | null
          filled_at: string
          fuel_type: string | null
          id: string
          liters: number
          notes: string | null
          price_per_liter: number
          receipt_url: string | null
          station: string | null
          status: Database["public"]["Enums"]["fuel_status"]
          total_value: number
          trip_id: string | null
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_km?: number | null
          driver_id?: string | null
          filled_at?: string
          fuel_type?: string | null
          id?: string
          liters: number
          notes?: string | null
          price_per_liter: number
          receipt_url?: string | null
          station?: string | null
          status?: Database["public"]["Enums"]["fuel_status"]
          total_value: number
          trip_id?: string | null
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_km?: number | null
          driver_id?: string | null
          filled_at?: string
          fuel_type?: string | null
          id?: string
          liters?: number
          notes?: string | null
          price_per_liter?: number
          receipt_url?: string | null
          station?: string | null
          status?: Database["public"]["Enums"]["fuel_status"]
          total_value?: number
          trip_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_points: {
        Row: {
          accuracy: number | null
          company_id: string
          heading: number | null
          id: number
          lat: number
          lng: number
          recorded_at: string
          speed: number | null
          trip_id: string
        }
        Insert: {
          accuracy?: number | null
          company_id: string
          heading?: number | null
          id?: number
          lat: number
          lng: number
          recorded_at?: string
          speed?: number | null
          trip_id: string
        }
        Update: {
          accuracy?: number | null
          company_id?: string
          heading?: number | null
          id?: number
          lat?: number
          lng?: number
          recorded_at?: string
          speed?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_points_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_points_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance: {
        Row: {
          company_id: string
          created_at: string
          current_km: number | null
          id: string
          invoice_url: string | null
          maintenance_type: Database["public"]["Enums"]["maintenance_type"]
          next_date: string | null
          next_km: number | null
          notes: string | null
          parts: string | null
          service_date: string
          services: string | null
          value: number | null
          vehicle_id: string
          workshop: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          current_km?: number | null
          id?: string
          invoice_url?: string | null
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          next_date?: string | null
          next_km?: number | null
          notes?: string | null
          parts?: string | null
          service_date: string
          services?: string | null
          value?: number | null
          vehicle_id: string
          workshop?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          current_km?: number | null
          id?: string
          invoice_url?: string | null
          maintenance_type?: Database["public"]["Enums"]["maintenance_type"]
          next_date?: string | null
          next_km?: number | null
          notes?: string | null
          parts?: string | null
          service_date?: string
          services?: string | null
          value?: number | null
          vehicle_id?: string
          workshop?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          attachment_url: string | null
          company_id: string
          created_at: string
          driver_id: string | null
          due_date: string | null
          id: string
          infraction_date: string
          infraction_type: string | null
          location: string | null
          notes: string | null
          points: number | null
          status: Database["public"]["Enums"]["ticket_status"]
          value: number
          vehicle_id: string
        }
        Insert: {
          attachment_url?: string | null
          company_id: string
          created_at?: string
          driver_id?: string | null
          due_date?: string | null
          id?: string
          infraction_date: string
          infraction_type?: string | null
          location?: string | null
          notes?: string | null
          points?: number | null
          status?: Database["public"]["Enums"]["ticket_status"]
          value: number
          vehicle_id: string
        }
        Update: {
          attachment_url?: string | null
          company_id?: string
          created_at?: string
          driver_id?: string | null
          due_date?: string | null
          id?: string
          infraction_date?: string
          infraction_type?: string | null
          location?: string | null
          notes?: string | null
          points?: number | null
          status?: Database["public"]["Enums"]["ticket_status"]
          value?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          company_id: string
          created_at: string
          destination: string | null
          distance_m: number | null
          driver_id: string
          end_at: string | null
          end_km: number | null
          id: string
          notes: string | null
          origin: string | null
          start_at: string | null
          start_km: number | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          destination?: string | null
          distance_m?: number | null
          driver_id: string
          end_at?: string | null
          end_km?: number | null
          id?: string
          notes?: string | null
          origin?: string | null
          start_at?: string | null
          start_km?: number | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          destination?: string | null
          distance_m?: number | null
          driver_id?: string
          end_at?: string | null
          end_km?: number | null
          id?: string
          notes?: string | null
          origin?: string | null
          start_at?: string | null
          start_km?: number | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          chassis: string | null
          color: string | null
          company_id: string
          created_at: string
          current_km: number
          fuel_type: string | null
          id: string
          model: string
          notes: string | null
          photo_url: string | null
          plate: string
          renavam: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          tank_capacity: number | null
          updated_at: string
          vehicle_type: string | null
          year: number | null
        }
        Insert: {
          brand: string
          chassis?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          current_km?: number
          fuel_type?: string | null
          id?: string
          model: string
          notes?: string | null
          photo_url?: string | null
          plate: string
          renavam?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tank_capacity?: number | null
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Update: {
          brand?: string
          chassis?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          current_km?: number
          fuel_type?: string | null
          id?: string
          model?: string
          notes?: string | null
          photo_url?: string | null
          plate?: string
          renavam?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tank_capacity?: number | null
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_driver_id: { Args: { _user_id: string }; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "fleet_manager" | "driver"
      company_plan: "starter" | "professional" | "enterprise"
      driver_status: "active" | "inactive" | "suspended"
      fuel_status: "pending" | "approved" | "rejected"
      maintenance_type: "preventive" | "corrective"
      ticket_status: "pending" | "paid" | "appealed" | "cancelled"
      trip_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      vehicle_status: "active" | "inactive" | "maintenance" | "sold"
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
      app_role: ["admin", "fleet_manager", "driver"],
      company_plan: ["starter", "professional", "enterprise"],
      driver_status: ["active", "inactive", "suspended"],
      fuel_status: ["pending", "approved", "rejected"],
      maintenance_type: ["preventive", "corrective"],
      ticket_status: ["pending", "paid", "appealed", "cancelled"],
      trip_status: ["scheduled", "in_progress", "completed", "cancelled"],
      vehicle_status: ["active", "inactive", "maintenance", "sold"],
    },
  },
} as const
