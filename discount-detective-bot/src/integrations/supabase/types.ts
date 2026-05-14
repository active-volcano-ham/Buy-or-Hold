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
      fx_rates: {
        Row: {
          fetched_at: string
          pair: string
          rate: number
        }
        Insert: {
          fetched_at?: string
          pair: string
          rate: number
        }
        Update: {
          fetched_at?: string
          pair?: string
          rate?: number
        }
        Relationships: []
      }
      price_history: {
        Row: {
          checked_at: string
          id: string
          price: number
          product_id: string
        }
        Insert: {
          checked_at?: string
          id?: string
          price: number
          product_id: string
        }
        Update: {
          checked_at?: string
          id?: string
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          currency: string | null
          current_price: number | null
          device_id: string
          id: string
          image_url: string | null
          last_checked_at: string | null
          original_price: number | null
          site_name: string | null
          target_discount_percent: number | null
          target_hit: boolean
          target_hit_at: string | null
          title: string | null
          unavailable: boolean
          unavailable_reason: string | null
          updated_at: string
          url: string
          wish_price: number | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          current_price?: number | null
          device_id: string
          id?: string
          image_url?: string | null
          last_checked_at?: string | null
          original_price?: number | null
          site_name?: string | null
          target_discount_percent?: number | null
          target_hit?: boolean
          target_hit_at?: string | null
          title?: string | null
          unavailable?: boolean
          unavailable_reason?: string | null
          updated_at?: string
          url: string
          wish_price?: number | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          current_price?: number | null
          device_id?: string
          id?: string
          image_url?: string | null
          last_checked_at?: string | null
          original_price?: number | null
          site_name?: string | null
          target_discount_percent?: number | null
          target_hit?: boolean
          target_hit_at?: string | null
          title?: string | null
          unavailable?: boolean
          unavailable_reason?: string | null
          updated_at?: string
          url?: string
          wish_price?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_id: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          device_id: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          device_id?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      stock_price_history: {
        Row: {
          checked_at: string
          id: string
          price: number
          stock_id: string
        }
        Insert: {
          checked_at?: string
          id?: string
          price: number
          stock_id: string
        }
        Update: {
          checked_at?: string
          id?: string
          price?: number
          stock_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_price_history_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
        ]
      }
      stocks: {
        Row: {
          change_percent: number | null
          created_at: string
          currency: string | null
          current_price: number | null
          device_id: string
          id: string
          last_checked_at: string | null
          market: string
          name: string | null
          previous_close: number | null
          target_buy_price: number | null
          target_sell_price: number | null
          ticker: string
          updated_at: string
        }
        Insert: {
          change_percent?: number | null
          created_at?: string
          currency?: string | null
          current_price?: number | null
          device_id: string
          id?: string
          last_checked_at?: string | null
          market: string
          name?: string | null
          previous_close?: number | null
          target_buy_price?: number | null
          target_sell_price?: number | null
          ticker: string
          updated_at?: string
        }
        Update: {
          change_percent?: number | null
          created_at?: string
          currency?: string | null
          current_price?: number | null
          device_id?: string
          id?: string
          last_checked_at?: string | null
          market?: string
          name?: string | null
          previous_close?: number | null
          target_buy_price?: number | null
          target_sell_price?: number | null
          ticker?: string
          updated_at?: string
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
