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
      ai_recommendations: {
        Row: {
          bid_id: string
          confidence: number
          created_at: string
          generated_at: string
          id: string
          model: string
          rationale: string
          recommendation: string
        }
        Insert: {
          bid_id: string
          confidence?: number
          created_at?: string
          generated_at?: string
          id?: string
          model?: string
          rationale: string
          recommendation: string
        }
        Update: {
          bid_id?: string
          confidence?: number
          created_at?: string
          generated_at?: string
          id?: string
          model?: string
          rationale?: string
          recommendation?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_code: string
          actor_id: string | null
          actor_label: string
          actor_role: string
          client_info: string
          created_at: string
          detail: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: string | null
          old_value: string | null
          organisation: string
          result: string
        }
        Insert: {
          action: string
          actor_code?: string
          actor_id?: string | null
          actor_label: string
          actor_role?: string
          client_info?: string
          created_at?: string
          detail?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          organisation?: string
          result?: string
        }
        Update: {
          action?: string
          actor_code?: string
          actor_id?: string | null
          actor_label?: string
          actor_role?: string
          client_info?: string
          created_at?: string
          detail?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          organisation?: string
          result?: string
        }
        Relationships: []
      }
      bids: {
        Row: {
          amount: number
          bid_code: string | null
          compliance_score: number
          created_at: string
          device_fingerprint: string
          document_author: string
          document_hash: string
          id: string
          risk_score: number
          scenario: string
          status: string
          submission_ip: string
          submitted_at: string
          tender_id: string
          vendor_id: string
          verification_status: string
        }
        Insert: {
          amount: number
          bid_code?: string | null
          compliance_score?: number
          created_at?: string
          device_fingerprint: string
          document_author: string
          document_hash: string
          id?: string
          risk_score?: number
          scenario?: string
          status?: string
          submission_ip: string
          submitted_at: string
          tender_id: string
          vendor_id: string
          verification_status?: string
        }
        Update: {
          amount?: number
          bid_code?: string | null
          compliance_score?: number
          created_at?: string
          device_fingerprint?: string
          document_author?: string
          document_hash?: string
          id?: string
          risk_score?: number
          scenario?: string
          status?: string
          submission_ip?: string
          submitted_at?: string
          tender_id?: string
          vendor_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_checks: {
        Row: {
          bid_id: string
          checked_at: string
          confidence: number
          created_at: string
          detected_value: string
          evidence_document: string
          evidence_page: number | null
          expected_value: string
          id: string
          rationale: string
          requirement_id: string | null
          requirement_title: string
          result: string
          verification_status: string
        }
        Insert: {
          bid_id: string
          checked_at?: string
          confidence?: number
          created_at?: string
          detected_value: string
          evidence_document?: string
          evidence_page?: number | null
          expected_value: string
          id?: string
          rationale?: string
          requirement_id?: string | null
          requirement_title: string
          result?: string
          verification_status?: string
        }
        Update: {
          bid_id?: string
          checked_at?: string
          confidence?: number
          created_at?: string
          detected_value?: string
          evidence_document?: string
          evidence_page?: number | null
          expected_value?: string
          id?: string
          rationale?: string
          requirement_id?: string | null
          requirement_title?: string
          result?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_checks_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_checks_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "tender_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          bid_id: string
          decided_at: string
          decided_by: string
          decision: string
          id: string
          rationale: string
        }
        Insert: {
          bid_id: string
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          rationale: string
        }
        Update: {
          bid_id?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          rationale?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_confidence: number
          bid_id: string
          created_at: string
          doc_type: string
          extracted: Json
          file_name: string
          id: string
          page_count: number
          status: string
          updated_at: string
          uploaded_at: string
          verification_status: string
        }
        Insert: {
          ai_confidence?: number
          bid_id: string
          created_at?: string
          doc_type: string
          extracted?: Json
          file_name: string
          id?: string
          page_count?: number
          status?: string
          updated_at?: string
          uploaded_at?: string
          verification_status?: string
        }
        Update: {
          ai_confidence?: number
          bid_id?: string
          created_at?: string
          doc_type?: string
          extracted?: Json
          file_name?: string
          id?: string
          page_count?: number
          status?: string
          updated_at?: string
          uploaded_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          level: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          level?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          level?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          code: string
          created_at: string
          label: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          label: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          label?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          login_count: number
          must_change_password: boolean
          org_id: string | null
          organisation: string | null
          phone: string | null
          status: string
          updated_at: string
          user_code: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          login_count?: number
          must_change_password?: boolean
          org_id?: string | null
          organisation?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_code?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          login_count?: number
          must_change_password?: boolean
          org_id?: string | null
          organisation?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_flags: {
        Row: {
          bid_id: string
          code: string
          created_at: string
          id: string
          rationale: string
          score: number
          severity: string
          source: string
          title: string
        }
        Insert: {
          bid_id: string
          code: string
          created_at?: string
          id?: string
          rationale: string
          score?: number
          severity: string
          source?: string
          title: string
        }
        Update: {
          bid_id?: string
          code?: string
          created_at?: string
          id?: string
          rationale?: string
          score?: number
          severity?: string
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_flags_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_code: string
          role: Database["public"]["Enums"]["app_role"]
          scope: string
        }
        Insert: {
          created_at?: string
          permission_code: string
          role: Database["public"]["Enums"]["app_role"]
          scope?: string
        }
        Update: {
          created_at?: string
          permission_code?: string
          role?: Database["public"]["Enums"]["app_role"]
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      system_config: {
        Row: {
          category: string
          key: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          category?: string
          key: string
          label: string
          updated_at?: string
          value: string
        }
        Update: {
          category?: string
          key?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      tender_requirements: {
        Row: {
          code: string
          created_at: string
          expected_value: string
          id: string
          mandatory: boolean
          sort_order: number
          tender_id: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          expected_value: string
          id?: string
          mandatory?: boolean
          sort_order?: number
          tender_id: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          expected_value?: string
          id?: string
          mandatory?: boolean
          sort_order?: number
          tender_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tender_requirements_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      tenders: {
        Row: {
          buyer: string
          category: string
          closes_at: string
          created_at: string
          currency: string
          department: string
          description: string
          estimated_value: number
          id: string
          reference: string
          status: string
          title: string
        }
        Insert: {
          buyer: string
          category: string
          closes_at: string
          created_at?: string
          currency?: string
          department?: string
          description?: string
          estimated_value: number
          id?: string
          reference: string
          status?: string
          title: string
        }
        Update: {
          buyer?: string
          category?: string
          closes_at?: string
          created_at?: string
          currency?: string
          department?: string
          description?: string
          estimated_value?: number
          id?: string
          reference?: string
          status?: string
          title?: string
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
      vendors: {
        Row: {
          address: string
          annual_turnover: number | null
          bank_fingerprint: string
          contact_email: string
          contact_phone: string
          country: string
          created_at: string
          gstin: string | null
          id: string
          incorporated_on: string
          msme_class: string | null
          name: string
          owner_user_id: string | null
          pan: string | null
          registration_no: string
          udyam: string | null
        }
        Insert: {
          address: string
          annual_turnover?: number | null
          bank_fingerprint: string
          contact_email: string
          contact_phone: string
          country: string
          created_at?: string
          gstin?: string | null
          id?: string
          incorporated_on: string
          msme_class?: string | null
          name: string
          owner_user_id?: string | null
          pan?: string | null
          registration_no: string
          udyam?: string | null
        }
        Update: {
          address?: string
          annual_turnover?: number | null
          bank_fingerprint?: string
          contact_email?: string
          contact_phone?: string
          country?: string
          created_at?: string
          gstin?: string | null
          id?: string
          incorporated_on?: string
          msme_class?: string | null
          name?: string
          owner_user_id?: string | null
          pan?: string | null
          registration_no?: string
          udyam?: string | null
        }
        Relationships: []
      }
      verification_results: {
        Row: {
          bid_id: string
          checked_at: string
          created_at: string
          detail: string
          id: string
          reference: string
          source_code: string
          status: string
        }
        Insert: {
          bid_id: string
          checked_at?: string
          created_at?: string
          detail?: string
          id?: string
          reference?: string
          source_code: string
          status?: string
        }
        Update: {
          bid_id?: string
          checked_at?: string
          created_at?: string
          detail?: string
          id?: string
          reference?: string
          source_code?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_results_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_sources: {
        Row: {
          code: string
          connection_status: string
          created_at: string
          environment: string
          id: string
          last_checked_at: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          connection_status?: string
          created_at?: string
          environment?: string
          id?: string
          last_checked_at?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          connection_status?: string
          created_at?: string
          environment?: string
          id?: string
          last_checked_at?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_permission_unused_placeholder: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_bid: {
        Args: { _bid_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "reviewer"
        | "viewer"
        | "super_admin"
        | "procurement_admin"
        | "government_officer"
        | "bidder"
        | "auditor"
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
    Enums: {
      app_role: [
        "admin",
        "reviewer",
        "viewer",
        "super_admin",
        "procurement_admin",
        "government_officer",
        "bidder",
        "auditor",
      ],
    },
  },
} as const
