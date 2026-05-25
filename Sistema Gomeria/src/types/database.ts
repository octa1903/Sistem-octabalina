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
      app_features: {
        Row: {
          cash_shifts: boolean
          customer_display: boolean
          low_stock_notifications: boolean
          negative_stock_alert: boolean
          open_tickets: boolean
          order_types: boolean
          singleton: boolean
          time_clock: boolean
        }
        Insert: {
          cash_shifts?: boolean
          customer_display?: boolean
          low_stock_notifications?: boolean
          negative_stock_alert?: boolean
          open_tickets?: boolean
          order_types?: boolean
          singleton?: boolean
          time_clock?: boolean
        }
        Update: {
          cash_shifts?: boolean
          customer_display?: boolean
          low_stock_notifications?: boolean
          negative_stock_alert?: boolean
          open_tickets?: boolean
          order_types?: boolean
          singleton?: boolean
          time_clock?: boolean
        }
        Relationships: []
      }
      app_metadata: {
        Row: {
          last_local_backup_at: string | null
          migrated_from_local_at: string | null
          schema_version: number
          singleton: boolean
        }
        Insert: {
          last_local_backup_at?: string | null
          migrated_from_local_at?: string | null
          schema_version?: number
          singleton?: boolean
        }
        Update: {
          last_local_backup_at?: string | null
          migrated_from_local_at?: string | null
          schema_version?: number
          singleton?: boolean
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          employee_id: string | null
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
          store_id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          employee_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
          store_id: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          employee_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          active: boolean
          address: string | null
          branch: string | null
          created_at: string
          id: string
          legacy_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          branch?: string | null
          created_at?: string
          id?: string
          legacy_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          branch?: string | null
          created_at?: string
          id?: string
          legacy_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          at: string
          cash_session_id: string
          employee_id: string
          id: string
          import_batch_id: string | null
          legacy_id: string | null
          reason: string
          type: string
        }
        Insert: {
          amount: number
          at?: string
          cash_session_id: string
          employee_id: string
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          reason: string
          type: string
        }
        Update: {
          amount?: number
          at?: string
          cash_session_id?: string
          employee_id?: string
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          reason?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by_employee_id: string | null
          counted_cash: number | null
          expected_cash: number | null
          id: string
          import_batch_id: string | null
          notes: string | null
          opened_at: string
          opened_by_employee_id: string
          opening_float: number
          status: string
          store_id: string
          variance: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by_employee_id?: string | null
          counted_cash?: number | null
          expected_cash?: number | null
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          opened_at?: string
          opened_by_employee_id: string
          opening_float: number
          status?: string
          store_id: string
          variance?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by_employee_id?: string | null
          counted_cash?: number | null
          expected_cash?: number | null
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          opened_at?: string
          opened_by_employee_id?: string
          opening_float?: number
          status?: string
          store_id?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_employee_id_fkey"
            columns: ["closed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_employee_id_fkey"
            columns: ["opened_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      checks: {
        Row: {
          amount: number
          bank_id: string | null
          cashed: boolean
          check_number: string
          collection_date: string | null
          created_at: string
          customer_id: string | null
          detail: string | null
          emission_date: string | null
          entry_date: string | null
          exit_date: string | null
          given_by: string | null
          given_to: string | null
          id: string
          import_batch_id: string | null
          legacy_id: string | null
          receipt_id: string | null
          status: string | null
          supplier_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          cashed?: boolean
          check_number: string
          collection_date?: string | null
          created_at?: string
          customer_id?: string | null
          detail?: string | null
          emission_date?: string | null
          entry_date?: string | null
          exit_date?: string | null
          given_by?: string | null
          given_to?: string | null
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          receipt_id?: string | null
          status?: string | null
          supplier_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          cashed?: boolean
          check_number?: string
          collection_date?: string | null
          created_at?: string
          customer_id?: string | null
          detail?: string | null
          emission_date?: string | null
          entry_date?: string | null
          exit_date?: string | null
          given_by?: string | null
          given_to?: string | null
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          receipt_id?: string | null
          status?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checks_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_account_movements: {
        Row: {
          amount: number
          at: string
          customer_id: string
          employee_id: string | null
          id: string
          import_batch_id: string | null
          legacy_id: string | null
          notes: string | null
          payment_method_id: string | null
          receipt_id: string | null
          type: string
        }
        Insert: {
          amount: number
          at?: string
          customer_id: string
          employee_id?: string | null
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          notes?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          at?: string
          customer_id?: string
          employee_id?: string | null
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          notes?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cam_import_batch_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_movements_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders: {
        Row: {
          address: string | null
          client_message: string | null
          confirmed_by_employee_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          internal_notes: string | null
          items: Json
          notes: string | null
          numero: string
          payment_method_id: string | null
          receipt_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          store_id: string | null
          tipo: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_message?: string | null
          confirmed_by_employee_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          internal_notes?: string | null
          items?: Json
          notes?: string | null
          numero: string
          payment_method_id?: string | null
          receipt_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          store_id?: string | null
          tipo: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_message?: string | null
          confirmed_by_employee_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          internal_notes?: string | null
          items?: Json
          notes?: string | null
          numero?: string
          payment_method_id?: string | null
          receipt_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          store_id?: string | null
          tipo?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_confirmed_by_employee_id_fkey"
            columns: ["confirmed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_balance: number
          address: Json | null
          auth_user_id: string | null
          birthday: string | null
          created_at: string
          credit_limit: number
          customer_type: string
          default_salesperson_id: string | null
          deleted_at: string | null
          email: string | null
          first_visit: string | null
          id: string
          import_batch_id: string | null
          import_store_id: string | null
          label: string | null
          last_visit: string | null
          legacy_cuit: string | null
          legacy_id: string | null
          name: string
          note: string | null
          phone: string | null
          pin_hash: string | null
          points_balance: number
          total_spent: number
          total_visits: number
          updated_at: string
          wholesale_discount: number | null
        }
        Insert: {
          account_balance?: number
          address?: Json | null
          auth_user_id?: string | null
          birthday?: string | null
          created_at?: string
          credit_limit?: number
          customer_type?: string
          default_salesperson_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_visit?: string | null
          id?: string
          import_batch_id?: string | null
          import_store_id?: string | null
          label?: string | null
          last_visit?: string | null
          legacy_cuit?: string | null
          legacy_id?: string | null
          name: string
          note?: string | null
          phone?: string | null
          pin_hash?: string | null
          points_balance?: number
          total_spent?: number
          total_visits?: number
          updated_at?: string
          wholesale_discount?: number | null
        }
        Update: {
          account_balance?: number
          address?: Json | null
          auth_user_id?: string | null
          birthday?: string | null
          created_at?: string
          credit_limit?: number
          customer_type?: string
          default_salesperson_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_visit?: string | null
          id?: string
          import_batch_id?: string | null
          import_store_id?: string | null
          label?: string | null
          last_visit?: string | null
          legacy_cuit?: string | null
          legacy_id?: string | null
          name?: string
          note?: string | null
          phone?: string | null
          pin_hash?: string | null
          points_balance?: number
          total_spent?: number
          total_visits?: number
          updated_at?: string
          wholesale_discount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_default_salesperson_id_fkey"
            columns: ["default_salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_import_batch_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_import_store_id_fkey"
            columns: ["import_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          id: string
          name: string
          pin_restricted: boolean
          store_ids: string[] | null
          type: string
          value: number | null
        }
        Insert: {
          id?: string
          name: string
          pin_restricted?: boolean
          store_ids?: string[] | null
          type: string
          value?: number | null
        }
        Update: {
          id?: string
          name?: string
          pin_restricted?: boolean
          store_ids?: string[] | null
          type?: string
          value?: number | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          pin_hash: string
          role_id: string
          store_ids: string[] | null
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          pin_hash: string
          role_id: string
          store_ids?: string[] | null
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          pin_hash?: string
          role_id?: string
          store_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          fetched_at: string
          from_currency: string
          id: string
          rate: number
          rate_buy: number
          rate_sell: number
          source: string
          to_currency: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date: string
          fetched_at?: string
          from_currency?: string
          id?: string
          rate?: number
          rate_buy: number
          rate_sell: number
          source: string
          to_currency?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          fetched_at?: string
          from_currency?: string
          id?: string
          rate?: number
          rate_buy?: number
          rate_sell?: number
          source?: string
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          errors: Json
          finished_at: string | null
          id: string
          inserted_rows: number
          notes: string | null
          skipped_rows: number
          source: string
          started_at: string
          status: string
          store_id: string | null
          total_rows: number
          triggered_by_employee_id: string | null
        }
        Insert: {
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          inserted_rows?: number
          notes?: string | null
          skipped_rows?: number
          source: string
          started_at?: string
          status?: string
          store_id?: string | null
          total_rows?: number
          triggered_by_employee_id?: string | null
        }
        Update: {
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          inserted_rows?: number
          notes?: string | null
          skipped_rows?: number
          source?: string
          started_at?: string
          status?: string
          store_id?: string | null
          total_rows?: number
          triggered_by_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_triggered_by_employee_id_fkey"
            columns: ["triggered_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_companies: {
        Row: {
          account_balance: number
          active: boolean
          address: Json | null
          contact_name: string | null
          created_at: string
          cuit: string | null
          email: string | null
          id: string
          legacy_id: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_balance?: number
          active?: boolean
          address?: Json | null
          contact_name?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          id?: string
          legacy_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_balance?: number
          active?: boolean
          address?: Json | null
          contact_name?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          id?: string
          legacy_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      insurance_company_movements: {
        Row: {
          amount: number
          at: string
          employee_id: string | null
          id: string
          insurance_company_id: string
          notes: string | null
          payment_method_id: string | null
          receipt_id: string | null
          type: string
        }
        Insert: {
          amount: number
          at?: string
          employee_id?: string | null
          id?: string
          insurance_company_id: string
          notes?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          at?: string
          employee_id?: string | null
          id?: string
          insurance_company_id?: string
          notes?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_company_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_company_movements_insurance_company_id_fkey"
            columns: ["insurance_company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_company_movements_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_company_movements_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_policies: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string | null
          id: string
          insurance_company_id: string
          insured_address: string | null
          insured_name: string | null
          insured_phones: string | null
          legacy_id: string | null
          policy_number: string
          store_id: string | null
          updated_at: string
          vehicle_model: string | null
          vehicle_plate: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          id?: string
          insurance_company_id: string
          insured_address?: string | null
          insured_name?: string | null
          insured_phones?: string | null
          legacy_id?: string | null
          policy_number: string
          store_id?: string | null
          updated_at?: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          id?: string
          insurance_company_id?: string
          insured_address?: string | null
          insured_name?: string | null
          insured_phones?: string | null
          legacy_id?: string | null
          policy_number?: string
          store_id?: string | null
          updated_at?: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_insurance_company_id_fkey"
            columns: ["insurance_company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_config: {
        Row: {
          earn_percent: number
          enabled: boolean
          singleton: boolean
        }
        Insert: {
          earn_percent?: number
          enabled?: boolean
          singleton?: boolean
        }
        Update: {
          earn_percent?: number
          enabled?: boolean
          singleton?: boolean
        }
        Relationships: []
      }
      modifier_groups: {
        Row: {
          id: string
          name: string
          options: Json
          store_ids: string[] | null
        }
        Insert: {
          id?: string
          name: string
          options?: Json
          store_ids?: string[] | null
        }
        Update: {
          id?: string
          name?: string
          options?: Json
          store_ids?: string[] | null
        }
        Relationships: []
      }
      open_tickets_config: {
        Row: {
          predefined_names: string[]
          store_id: string
          use_predefined: boolean
        }
        Insert: {
          predefined_names?: string[]
          store_id: string
          use_predefined?: boolean
        }
        Update: {
          predefined_names?: string[]
          store_id?: string
          use_predefined?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "open_tickets_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_config: {
        Row: {
          blocked_dates: string[]
          enabled: boolean
          max_days_ahead: number
          max_orders_per_day: number
          min_days_ahead: number
          singleton: boolean
          time_slots: string[]
          work_days: boolean[]
        }
        Insert: {
          blocked_dates?: string[]
          enabled?: boolean
          max_days_ahead?: number
          max_orders_per_day?: number
          min_days_ahead?: number
          singleton?: boolean
          time_slots?: string[]
          work_days?: boolean[]
        }
        Update: {
          blocked_dates?: string[]
          enabled?: boolean
          max_days_ahead?: number
          max_orders_per_day?: number
          min_days_ahead?: number
          singleton?: boolean
          time_slots?: string[]
          work_days?: boolean[]
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          id: string
          name: string
          sort_order: number
          store_ids: string[] | null
          surcharge_percent: number
          type: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          store_ids?: string[] | null
          surcharge_percent?: number
          type: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          store_ids?: string[] | null
          surcharge_percent?: number
          type?: string
        }
        Relationships: []
      }
      receipt_config: {
        Row: {
          email_logo_url: string | null
          footer: string
          header: string
          printed_logo_url: string | null
          show_comments: boolean
          show_customer_info: boolean
          store_id: string
        }
        Insert: {
          email_logo_url?: string | null
          footer?: string
          header?: string
          printed_logo_url?: string | null
          show_comments?: boolean
          show_customer_info?: boolean
          store_id: string
        }
        Update: {
          email_logo_url?: string | null
          footer?: string
          header?: string
          printed_logo_url?: string | null
          show_comments?: boolean
          show_customer_info?: boolean
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_lines: {
        Row: {
          category_id: string | null
          category_name: string | null
          gross: number
          id: string
          line_discounts: Json
          line_taxes: Json
          modifiers: Json
          net: number
          quantity: number
          receipt_id: string
          tire_brand: string | null
          tire_id: string | null
          tire_model: string | null
          tire_size: string | null
          total: number
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          gross: number
          id?: string
          line_discounts?: Json
          line_taxes?: Json
          modifiers?: Json
          net: number
          quantity: number
          receipt_id: string
          tire_brand?: string | null
          tire_id?: string | null
          tire_model?: string | null
          tire_size?: string | null
          total: number
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          gross?: number
          id?: string
          line_discounts?: Json
          line_taxes?: Json
          modifiers?: Json
          net?: number
          quantity?: number
          receipt_id?: string
          tire_brand?: string | null
          tire_id?: string | null
          tire_model?: string | null
          tire_size?: string | null
          total?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_lines_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          afip_data: Json | null
          applied_discounts: Json
          applied_taxes: Json
          cash_session_id: string
          created_at: string
          customer_id: string | null
          employee_id: string
          id: string
          import_batch_id: string | null
          insurance_policy_id: string | null
          insurance_split: Json | null
          issued_at: string | null
          legacy_id: string | null
          legacy_number: string | null
          notes: string | null
          parked_name: string | null
          payments: Json
          points_earned: number
          points_redeemed: number
          receipt_number: string
          refund_of_receipt_id: string | null
          salesperson_commission_amount: number | null
          salesperson_commission_pct: number | null
          salesperson_id: string | null
          status: string
          store_id: string
          subtotal_gross: number
          subtotal_net: number
          total: number
          total_cogs: number
          total_discounts: number
          total_taxes: number
          type: string
          vehicle_owner_name: string | null
        }
        Insert: {
          afip_data?: Json | null
          applied_discounts?: Json
          applied_taxes?: Json
          cash_session_id: string
          created_at?: string
          customer_id?: string | null
          employee_id: string
          id?: string
          import_batch_id?: string | null
          insurance_policy_id?: string | null
          insurance_split?: Json | null
          issued_at?: string | null
          legacy_id?: string | null
          legacy_number?: string | null
          notes?: string | null
          parked_name?: string | null
          payments?: Json
          points_earned?: number
          points_redeemed?: number
          receipt_number: string
          refund_of_receipt_id?: string | null
          salesperson_commission_amount?: number | null
          salesperson_commission_pct?: number | null
          salesperson_id?: string | null
          status: string
          store_id: string
          subtotal_gross: number
          subtotal_net: number
          total: number
          total_cogs: number
          total_discounts: number
          total_taxes: number
          type: string
          vehicle_owner_name?: string | null
        }
        Update: {
          afip_data?: Json | null
          applied_discounts?: Json
          applied_taxes?: Json
          cash_session_id?: string
          created_at?: string
          customer_id?: string | null
          employee_id?: string
          id?: string
          import_batch_id?: string | null
          insurance_policy_id?: string | null
          insurance_split?: Json | null
          issued_at?: string | null
          legacy_id?: string | null
          legacy_number?: string | null
          notes?: string | null
          parked_name?: string | null
          payments?: Json
          points_earned?: number
          points_redeemed?: number
          receipt_number?: string
          refund_of_receipt_id?: string | null
          salesperson_commission_amount?: number | null
          salesperson_commission_pct?: number | null
          salesperson_id?: string | null
          status?: string
          store_id?: string
          subtotal_gross?: number
          subtotal_net?: number
          total?: number
          total_cogs?: number
          total_discounts?: number
          total_taxes?: number
          type?: string
          vehicle_owner_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_import_batch_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_insurance_policy_id_fkey"
            columns: ["insurance_policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_refund_of_receipt_id_fkey"
            columns: ["refund_of_receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: string
          is_system: boolean
          max_discount_percent: number
          name: string
          permissions: string[]
        }
        Insert: {
          id?: string
          is_system?: boolean
          max_discount_percent?: number
          name: string
          permissions?: string[]
        }
        Update: {
          id?: string
          is_system?: boolean
          max_discount_percent?: number
          name?: string
          permissions?: string[]
        }
        Relationships: []
      }
      salespeople: {
        Row: {
          active: boolean
          created_at: string
          cuit: string | null
          default_commission_pct: number
          email: string | null
          id: string
          legacy_id: string | null
          name: string
          phone: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cuit?: string | null
          default_commission_pct?: number
          email?: string | null
          id?: string
          legacy_id?: string | null
          name: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cuit?: string | null
          default_commission_pct?: number
          email?: string | null
          id?: string
          legacy_id?: string | null
          name?: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salespeople_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          address: Json | null
          created_at: string
          description: string | null
          fiscal_identity: Json | null
          id: string
          name: string
          phone: string | null
          pos_device_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: Json | null
          created_at?: string
          description?: string | null
          fiscal_identity?: Json | null
          id?: string
          name: string
          phone?: string | null
          pos_device_name?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: Json | null
          created_at?: string
          description?: string | null
          fiscal_identity?: Json | null
          id?: string
          name?: string
          phone?: string | null
          pos_device_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_account_movements: {
        Row: {
          amount: number
          at: string
          employee_id: string | null
          id: string
          import_batch_id: string | null
          legacy_id: string | null
          notes: string | null
          payment_method_id: string | null
          receipt_id: string | null
          supplier_id: string
          supplier_invoice_id: string | null
          type: string
        }
        Insert: {
          amount: number
          at?: string
          employee_id?: string | null
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          notes?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          supplier_id: string
          supplier_invoice_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          at?: string
          employee_id?: string | null
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          notes?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          supplier_id?: string
          supplier_invoice_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_account_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_account_movements_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_account_movements_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_account_movements_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_account_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_account_movements_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          created_at: string
          date: string
          due_date: string | null
          id: string
          items: Json
          iva: number
          notes: string | null
          number: string
          paid: boolean
          store_id: string | null
          subtotal: number
          supplier: string
          supplier_id: string | null
          total: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          due_date?: string | null
          id?: string
          items?: Json
          iva?: number
          notes?: string | null
          number: string
          paid?: boolean
          store_id?: string | null
          subtotal?: number
          supplier: string
          supplier_id?: string | null
          total?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          due_date?: string | null
          id?: string
          items?: Json
          iva?: number
          notes?: string | null
          number?: string
          paid?: boolean
          store_id?: string | null
          subtotal?: number
          supplier?: string
          supplier_id?: string | null
          total?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_list_items: {
        Row: {
          cost_ars: number
          cost_original: number
          created_at: string
          id: string
          price_list_id: string
          price_suggested: number | null
          raw_brand: string | null
          raw_model: string | null
          raw_sku: string | null
          raw_size: string
          tire_id: string | null
        }
        Insert: {
          cost_ars: number
          cost_original: number
          created_at?: string
          id?: string
          price_list_id: string
          price_suggested?: number | null
          raw_brand?: string | null
          raw_model?: string | null
          raw_sku?: string | null
          raw_size: string
          tire_id?: string | null
        }
        Update: {
          cost_ars?: number
          cost_original?: number
          created_at?: string
          id?: string
          price_list_id?: string
          price_suggested?: number | null
          raw_brand?: string | null
          raw_model?: string | null
          raw_sku?: string | null
          raw_size?: string
          tire_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "supplier_price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_list_items_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_lists: {
        Row: {
          currency: string
          effective_date: string
          exchange_rate_id: string | null
          id: string
          imported_at: string
          imported_by: string | null
          list_name: string
          notes: string | null
          row_count: number
          supplier_id: string | null
          supplier_name: string
        }
        Insert: {
          currency?: string
          effective_date: string
          exchange_rate_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          list_name: string
          notes?: string | null
          row_count?: number
          supplier_id?: string | null
          supplier_name: string
        }
        Update: {
          currency?: string
          effective_date?: string
          exchange_rate_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          list_name?: string
          notes?: string | null
          row_count?: number
          supplier_id?: string | null
          supplier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_lists_exchange_rate_id_fkey"
            columns: ["exchange_rate_id"]
            isOneToOne: false
            referencedRelation: "exchange_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_lists_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_lists_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_balance: number
          active: boolean
          address: string | null
          category: string | null
          cell: string | null
          city: string | null
          contact_name: string | null
          created_at: string
          cuit: string | null
          email: string | null
          fiscal_position: string | null
          id: string
          import_batch_id: string | null
          legacy_id: string | null
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          retention_pct: number | null
          rubro: string | null
          updated_at: string
        }
        Insert: {
          account_balance?: number
          active?: boolean
          address?: string | null
          category?: string | null
          cell?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          fiscal_position?: string | null
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          legal_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          retention_pct?: number | null
          rubro?: string | null
          updated_at?: string
        }
        Update: {
          account_balance?: number
          active?: boolean
          address?: string | null
          category?: string | null
          cell?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          fiscal_position?: string | null
          id?: string
          import_batch_id?: string | null
          legacy_id?: string | null
          legal_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          retention_pct?: number | null
          rubro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      taxes: {
        Row: {
          applies_to_tire_ids: string[]
          apply_to_new_tires: boolean
          depends_on_order_type: boolean
          id: string
          inclusion: string
          name: string
          rate: number
          store_ids: string[] | null
        }
        Insert: {
          applies_to_tire_ids?: string[]
          apply_to_new_tires?: boolean
          depends_on_order_type?: boolean
          id?: string
          inclusion: string
          name: string
          rate: number
          store_ids?: string[] | null
        }
        Update: {
          applies_to_tire_ids?: string[]
          apply_to_new_tires?: boolean
          depends_on_order_type?: boolean
          id?: string
          inclusion?: string
          name?: string
          rate?: number
          store_ids?: string[] | null
        }
        Relationships: []
      }
      tire_store_overrides: {
        Row: {
          available: boolean
          location: string | null
          low_stock_threshold: number
          price: number
          stock: number
          store_id: string
          tire_id: string
        }
        Insert: {
          available?: boolean
          location?: string | null
          low_stock_threshold?: number
          price: number
          stock?: number
          store_id: string
          tire_id: string
        }
        Update: {
          available?: boolean
          location?: string | null
          low_stock_threshold?: number
          price?: number
          stock?: number
          store_id?: string
          tire_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tire_store_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_store_overrides_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
        ]
      }
      tires: {
        Row: {
          available_in_all_stores: boolean
          barcode: string | null
          brand: string
          category_id: string
          cost: number
          created_at: string
          default_margin: number | null
          default_price: number
          id: string
          image_url: string | null
          model: string
          modifier_group_ids: string[]
          notes: string | null
          size: string
          sku: string | null
          tax_ids: string[]
          updated_at: string
        }
        Insert: {
          available_in_all_stores?: boolean
          barcode?: string | null
          brand: string
          category_id: string
          cost?: number
          created_at?: string
          default_margin?: number | null
          default_price?: number
          id?: string
          image_url?: string | null
          model: string
          modifier_group_ids?: string[]
          notes?: string | null
          size: string
          sku?: string | null
          tax_ids?: string[]
          updated_at?: string
        }
        Update: {
          available_in_all_stores?: boolean
          barcode?: string | null
          brand?: string
          category_id?: string
          cost?: number
          created_at?: string
          default_margin?: number | null
          default_price?: number
          id?: string
          image_url?: string | null
          model?: string
          modifier_group_ids?: string[]
          notes?: string | null
          size?: string
          sku?: string | null
          tax_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tires_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_config: {
        Row: {
          global_discount: number
          min_order_amount: number
          min_units_per_item: number
          singleton: boolean
        }
        Insert: {
          global_discount?: number
          min_order_amount?: number
          min_units_per_item?: number
          singleton?: boolean
        }
        Update: {
          global_discount?: number
          min_order_amount?: number
          min_units_per_item?: number
          singleton?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      customers_active: {
        Row: {
          account_balance: number | null
          address: Json | null
          auth_user_id: string | null
          birthday: string | null
          created_at: string | null
          credit_limit: number | null
          customer_type: string | null
          default_salesperson_id: string | null
          deleted_at: string | null
          email: string | null
          first_visit: string | null
          id: string | null
          import_batch_id: string | null
          import_store_id: string | null
          label: string | null
          last_visit: string | null
          legacy_cuit: string | null
          legacy_id: string | null
          name: string | null
          note: string | null
          phone: string | null
          pin_hash: string | null
          points_balance: number | null
          total_spent: number | null
          total_visits: number | null
          updated_at: string | null
          wholesale_discount: number | null
        }
        Insert: {
          account_balance?: number | null
          address?: Json | null
          auth_user_id?: string | null
          birthday?: string | null
          created_at?: string | null
          credit_limit?: number | null
          customer_type?: string | null
          default_salesperson_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_visit?: string | null
          id?: string | null
          import_batch_id?: string | null
          import_store_id?: string | null
          label?: string | null
          last_visit?: string | null
          legacy_cuit?: string | null
          legacy_id?: string | null
          name?: string | null
          note?: string | null
          phone?: string | null
          pin_hash?: string | null
          points_balance?: number | null
          total_spent?: number | null
          total_visits?: number | null
          updated_at?: string | null
          wholesale_discount?: number | null
        }
        Update: {
          account_balance?: number | null
          address?: Json | null
          auth_user_id?: string | null
          birthday?: string | null
          created_at?: string | null
          credit_limit?: number | null
          customer_type?: string | null
          default_salesperson_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_visit?: string | null
          id?: string | null
          import_batch_id?: string | null
          import_store_id?: string | null
          label?: string | null
          last_visit?: string | null
          legacy_cuit?: string | null
          legacy_id?: string | null
          name?: string | null
          note?: string | null
          phone?: string | null
          pin_hash?: string | null
          points_balance?: number | null
          total_spent?: number | null
          total_visits?: number | null
          updated_at?: string | null
          wholesale_discount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_default_salesperson_id_fkey"
            columns: ["default_salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_import_batch_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_import_store_id_fkey"
            columns: ["import_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_summary: {
        Row: {
          cogs: number | null
          day: string | null
          discounts: number | null
          gross: number | null
          net: number | null
          refunds_count: number | null
          sales_count: number | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_by_item: {
        Row: {
          category_id: string | null
          category_name: string | null
          cogs: number | null
          day: string | null
          net: number | null
          quantity: number | null
          store_id: string | null
          tire_brand: string | null
          tire_id: string | null
          tire_model: string | null
          tire_size: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_lines_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_by_payment: {
        Row: {
          day: string | null
          payment_method_id: string | null
          refund_amount: number | null
          refund_tx: number | null
          sale_amount: number | null
          sale_tx: number | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_latest_cost: {
        Row: {
          cost_ars: number | null
          cost_original: number | null
          currency: string | null
          effective_date: string | null
          exchange_rate_id: string | null
          list_name: string | null
          supplier_name: string | null
          tire_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_lists_exchange_rate_id_fkey"
            columns: ["exchange_rate_id"]
            isOneToOne: false
            referencedRelation: "exchange_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_list_items_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _pbkdf2_sha256: {
        Args: {
          p_dklen: number
          p_iter: number
          p_password: string
          p_salt: string
        }
        Returns: string
      }
      _pbkdf2_sha256_block: {
        Args: {
          p_block_index: number
          p_iter: number
          p_password: string
          p_salt: string
        }
        Returns: string
      }
      _verify_customer_pin: {
        Args: { p_hash: string; p_pin: string }
        Returns: boolean
      }
      apply_receipt_to_stock: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      bulk_adjust_tire_prices: {
        Args: {
          p_brand?: string
          p_category_id?: string
          p_dry_run?: boolean
          p_pct_delta: number
          p_store_id?: string
          p_touch_cost?: boolean
          p_touch_default_price?: boolean
          p_touch_overrides?: boolean
        }
        Returns: Json
      }
      close_cash_session: {
        Args: {
          p_counted_cash: number
          p_employee_id: string
          p_session_id: string
        }
        Returns: Json
      }
      create_receipt_with_lines: {
        Args: { p_lines: Json; p_receipt: Json }
        Returns: string
      }
      current_employee_has_permission: { Args: { p: string }; Returns: boolean }
      current_employee_id: { Args: never; Returns: string }
      current_employee_max_discount: { Args: never; Returns: number }
      current_employee_role: { Args: never; Returns: string }
      current_employee_store_ids: { Args: never; Returns: string[] }
      customer_in_scope: { Args: { p_customer_id: string }; Returns: boolean }
      customer_login: {
        Args: { p_customer_id: string; p_pin: string }
        Returns: {
          customer_id: string
          customer_name: string
          expires_at: string
          token: string
        }[]
      }
      customer_self_movements: {
        Args: { p_limit?: number; p_token: string }
        Returns: {
          amount: number
          at: string
          customer_id: string
          id: string
          notes: string
          payment_method_id: string
          receipt_id: string
          type: string
        }[]
      }
      log_action: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity_id?: string
          p_entity_type: string
          p_reason?: string
          p_store_id: string
        }
        Returns: string
      }
      recompute_customer_account_balance: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recompute_customer_metrics: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recompute_insurance_company_balance: {
        Args: { p_id: string }
        Returns: undefined
      }
      recompute_supplier_account_balance: {
        Args: { p_supplier_id: string }
        Returns: undefined
      }
      store_in_scope: { Args: { p_store_id: string }; Returns: boolean }
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
