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
      cash_movements: {
        Row: {
          amount: number
          at: string
          cash_session_id: string
          employee_id: string
          id: string
          reason: string
          type: string
        }
        Insert: {
          amount: number
          at?: string
          cash_session_id: string
          employee_id: string
          id?: string
          reason: string
          type: string
        }
        Update: {
          amount?: number
          at?: string
          cash_session_id?: string
          employee_id?: string
          id?: string
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
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by_employee_id: string | null
          counted_cash: number | null
          expected_cash: number | null
          id: string
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
      customer_account_movements: {
        Row: {
          amount: number
          at: string
          customer_id: string
          employee_id: string | null
          id: string
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
          notes?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_account_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
          email: string | null
          first_visit: string | null
          id: string
          label: string | null
          last_visit: string | null
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
          email?: string | null
          first_visit?: string | null
          id?: string
          label?: string | null
          last_visit?: string | null
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
          email?: string | null
          first_visit?: string | null
          id?: string
          label?: string | null
          last_visit?: string | null
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
        Relationships: []
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
          category_id: string
          category_name: string
          gross: number
          id: string
          line_discounts: Json
          line_taxes: Json
          modifiers: Json
          net: number
          quantity: number
          receipt_id: string
          tire_brand: string
          tire_id: string
          tire_model: string
          tire_size: string
          total: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          category_id: string
          category_name: string
          gross: number
          id?: string
          line_discounts?: Json
          line_taxes?: Json
          modifiers?: Json
          net: number
          quantity: number
          receipt_id: string
          tire_brand: string
          tire_id: string
          tire_model: string
          tire_size: string
          total: number
          unit_cost: number
          unit_price: number
        }
        Update: {
          category_id?: string
          category_name?: string
          gross?: number
          id?: string
          line_discounts?: Json
          line_taxes?: Json
          modifiers?: Json
          net?: number
          quantity?: number
          receipt_id?: string
          tire_brand?: string
          tire_id?: string
          tire_model?: string
          tire_size?: string
          total?: number
          unit_cost?: number
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
          applied_discounts: Json
          applied_taxes: Json
          cash_session_id: string
          created_at: string
          customer_id: string | null
          employee_id: string
          id: string
          notes: string | null
          parked_name: string | null
          payments: Json
          points_earned: number
          points_redeemed: number
          receipt_number: string
          refund_of_receipt_id: string | null
          status: string
          store_id: string
          subtotal_gross: number
          subtotal_net: number
          total: number
          total_cogs: number
          total_discounts: number
          total_taxes: number
          type: string
        }
        Insert: {
          applied_discounts?: Json
          applied_taxes?: Json
          cash_session_id: string
          created_at?: string
          customer_id?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          parked_name?: string | null
          payments?: Json
          points_earned?: number
          points_redeemed?: number
          receipt_number: string
          refund_of_receipt_id?: string | null
          status: string
          store_id: string
          subtotal_gross: number
          subtotal_net: number
          total: number
          total_cogs: number
          total_discounts: number
          total_taxes: number
          type: string
        }
        Update: {
          applied_discounts?: Json
          applied_taxes?: Json
          cash_session_id?: string
          created_at?: string
          customer_id?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          parked_name?: string | null
          payments?: Json
          points_earned?: number
          points_redeemed?: number
          receipt_number?: string
          refund_of_receipt_id?: string | null
          status?: string
          store_id?: string
          subtotal_gross?: number
          subtotal_net?: number
          total?: number
          total_cogs?: number
          total_discounts?: number
          total_taxes?: number
          type?: string
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
            foreignKeyName: "receipts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
          name: string
          permissions: string[]
        }
        Insert: {
          id?: string
          is_system?: boolean
          name: string
          permissions?: string[]
        }
        Update: {
          id?: string
          is_system?: boolean
          name?: string
          permissions?: string[]
        }
        Relationships: []
      }
      stores: {
        Row: {
          active: boolean
          address: Json | null
          created_at: string
          description: string | null
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
          id?: string
          name?: string
          phone?: string | null
          pos_device_name?: string
          updated_at?: string
        }
        Relationships: []
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
      current_employee_role: { Args: never; Returns: string }
      current_employee_store_ids: { Args: never; Returns: string[] }
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
      recompute_customer_metrics: {
        Args: { p_customer_id: string }
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
