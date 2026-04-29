// =====================================================================
// database.ts — Tipos generados a mano para Supabase
// Normalmente se regenera con: supabase gen types typescript
// Refleja exactamente el schema en supabase/migrations/0001_init.sql
// =====================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          address: Json | null;
          phone: string | null;
          description: string | null;
          pos_device_name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['stores']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['stores']['Row']>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          color: string;
          sort_order: number;
        };
        Insert: { id?: string; name: string; color?: string; sort_order?: number };
        Update: Partial<Database['public']['Tables']['categories']['Row']>;
      };
      tires: {
        Row: {
          id: string;
          brand: string;
          model: string;
          size: string;
          category_id: string;
          cost: number;
          default_price: number;
          default_margin: number;
          sku: string | null;
          barcode: string | null;
          image_url: string | null;
          notes: string | null;
          tax_ids: string[];
          modifier_group_ids: string[];
          available_in_all_stores: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['tires']['Row']> & {
          brand: string;
          model: string;
          size: string;
          category_id: string;
        };
        Update: Partial<Database['public']['Tables']['tires']['Row']>;
      };
      tire_store_overrides: {
        Row: {
          tire_id: string;
          store_id: string;
          available: boolean;
          price: number;
          stock: number;
          low_stock_threshold: number;
          location: string | null;
        };
        Insert: Database['public']['Tables']['tire_store_overrides']['Row'];
        Update: Partial<Database['public']['Tables']['tire_store_overrides']['Row']>;
      };
      modifier_groups: {
        Row: {
          id: string;
          name: string;
          options: Json;
          store_ids: string[] | null;
        };
        Insert: { id?: string; name: string; options?: Json; store_ids?: string[] | null };
        Update: Partial<Database['public']['Tables']['modifier_groups']['Row']>;
      };
      discounts: {
        Row: {
          id: string;
          name: string;
          type: 'percent' | 'amount';
          value: number | null;
          pin_restricted: boolean;
          store_ids: string[] | null;
        };
        Insert: { id?: string; name: string; type: 'percent' | 'amount'; value?: number | null; pin_restricted?: boolean; store_ids?: string[] | null };
        Update: Partial<Database['public']['Tables']['discounts']['Row']>;
      };
      taxes: {
        Row: {
          id: string;
          name: string;
          rate: number;
          inclusion: 'included' | 'added';
          applies_to_tire_ids: string[];
          apply_to_new_tires: boolean;
          depends_on_order_type: boolean;
          store_ids: string[] | null;
        };
        Insert: { id?: string; name: string; rate: number; inclusion: 'included' | 'added'; applies_to_tire_ids?: string[]; apply_to_new_tires?: boolean; depends_on_order_type?: boolean; store_ids?: string[] | null };
        Update: Partial<Database['public']['Tables']['taxes']['Row']>;
      };
      payment_methods: {
        Row: {
          id: string;
          type: 'cash' | 'card' | 'transfer' | 'other';
          name: string;
          surcharge_percent: number;
          store_ids: string[] | null;
          sort_order: number;
        };
        Insert: { id?: string; type: 'cash' | 'card' | 'transfer' | 'other'; name: string; surcharge_percent?: number; store_ids?: string[] | null; sort_order?: number };
        Update: Partial<Database['public']['Tables']['payment_methods']['Row']>;
      };
      roles: {
        Row: {
          id: string;
          name: string;
          permissions: string[];
          is_system: boolean;
        };
        Insert: { id?: string; name: string; permissions?: string[]; is_system?: boolean };
        Update: Partial<Database['public']['Tables']['roles']['Row']>;
      };
      employees: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          role_id: string;
          store_ids: string[] | null;
          pin_hash: string;
          auth_user_id: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: { id?: string; name: string; email?: string | null; phone?: string | null; role_id: string; store_ids?: string[] | null; pin_hash: string; auth_user_id?: string | null; active?: boolean };
        Update: Partial<Database['public']['Tables']['employees']['Row']>;
      };
      customers: {
        Row: {
          id: string;
          name: string;
          label: string | null;
          email: string | null;
          phone: string | null;
          address: Json | null;
          birthday: string | null;
          note: string | null;
          first_visit: string | null;
          last_visit: string | null;
          total_visits: number;
          total_spent: number;
          points_balance: number;
          credit_limit: number;
          account_balance: number;
          pin_hash: string | null;
          customer_type: 'retail' | 'wholesale';
          wholesale_discount: number | null;
          auth_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['customers']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['customers']['Row']>;
      };
      cash_sessions: {
        Row: {
          id: string;
          store_id: string;
          opened_at: string;
          opened_by_employee_id: string;
          opening_float: number;
          closed_at: string | null;
          closed_by_employee_id: string | null;
          expected_cash: number | null;
          counted_cash: number | null;
          variance: number | null;
          notes: string | null;
          status: 'open' | 'closed';
        };
        Insert: { id?: string; store_id: string; opened_by_employee_id: string; opening_float: number; opened_at?: string; status?: 'open' | 'closed' };
        Update: Partial<Database['public']['Tables']['cash_sessions']['Row']>;
      };
      cash_movements: {
        Row: {
          id: string;
          cash_session_id: string;
          type: 'pay_in' | 'pay_out';
          amount: number;
          reason: string;
          employee_id: string;
          at: string;
        };
        Insert: { id?: string; cash_session_id: string; type: 'pay_in' | 'pay_out'; amount: number; reason: string; employee_id: string; at?: string };
        Update: Partial<Database['public']['Tables']['cash_movements']['Row']>;
      };
      receipts: {
        Row: {
          id: string;
          receipt_number: string;
          store_id: string;
          cash_session_id: string;
          employee_id: string;
          customer_id: string | null;
          type: 'sale' | 'refund';
          status: 'completed' | 'parked';
          parked_name: string | null;
          refund_of_receipt_id: string | null;
          applied_discounts: Json;
          applied_taxes: Json;
          payments: Json;
          subtotal_gross: number;
          total_discounts: number;
          subtotal_net: number;
          total_taxes: number;
          total_cogs: number;
          total: number;
          points_earned: number;
          points_redeemed: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['receipts']['Row']> & {
          receipt_number: string;
          store_id: string;
          cash_session_id: string;
          employee_id: string;
          type: 'sale' | 'refund';
          status: 'completed' | 'parked';
          subtotal_gross: number;
          total_discounts: number;
          subtotal_net: number;
          total_taxes: number;
          total_cogs: number;
          total: number;
        };
        Update: Partial<Database['public']['Tables']['receipts']['Row']>;
      };
      receipt_lines: {
        Row: {
          id: string;
          receipt_id: string;
          tire_id: string;
          tire_brand: string;
          tire_model: string;
          tire_size: string;
          category_id: string;
          category_name: string;
          modifiers: Json;
          unit_price: number;
          unit_cost: number;
          quantity: number;
          line_discounts: Json;
          line_taxes: Json;
          gross: number;
          net: number;
          total: number;
        };
        Insert: Omit<Database['public']['Tables']['receipt_lines']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['receipt_lines']['Row']>;
      };
      app_features: {
        Row: {
          singleton: boolean;
          cash_shifts: boolean;
          time_clock: boolean;
          open_tickets: boolean;
          customer_display: boolean;
          order_types: boolean;
          low_stock_notifications: boolean;
          negative_stock_alert: boolean;
        };
        Insert: { singleton?: boolean } & Partial<Database['public']['Tables']['app_features']['Row']>;
        Update: Partial<Database['public']['Tables']['app_features']['Row']>;
      };
      loyalty_config: {
        Row: { singleton: boolean; enabled: boolean; earn_percent: number };
        Insert: Partial<Database['public']['Tables']['loyalty_config']['Row']>;
        Update: Partial<Database['public']['Tables']['loyalty_config']['Row']>;
      };
      receipt_config: {
        Row: {
          store_id: string;
          email_logo_url: string | null;
          printed_logo_url: string | null;
          header: string;
          footer: string;
          show_customer_info: boolean;
          show_comments: boolean;
        };
        Insert: { store_id: string } & Partial<Database['public']['Tables']['receipt_config']['Row']>;
        Update: Partial<Database['public']['Tables']['receipt_config']['Row']>;
      };
      open_tickets_config: {
        Row: {
          store_id: string;
          use_predefined: boolean;
          predefined_names: string[];
        };
        Insert: { store_id: string } & Partial<Database['public']['Tables']['open_tickets_config']['Row']>;
        Update: Partial<Database['public']['Tables']['open_tickets_config']['Row']>;
      };
      supplier_invoices: {
        Row: {
          id: string;
          type: 'A' | 'B' | 'C' | 'X';
          number: string;
          supplier: string;
          date: string;
          due_date: string | null;
          items: Json;
          subtotal: number;
          iva: number;
          total: number;
          paid: boolean;
          notes: string | null;
          store_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['supplier_invoices']['Row']> & {
          type: 'A' | 'B' | 'C' | 'X';
          number: string;
          supplier: string;
          date: string;
        };
        Update: Partial<Database['public']['Tables']['supplier_invoices']['Row']>;
      };
      customer_orders: {
        Row: {
          id: string;
          numero: string;
          customer_id: string | null;
          customer_name: string;
          store_id: string | null;
          items: Json;
          payment_method_id: string | null;
          status: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado';
          tipo: 'retiro' | 'entrega_domicilio';
          scheduled_date: string | null;
          scheduled_time: string | null;
          address: string | null;
          notes: string | null;
          internal_notes: string | null;
          client_message: string | null;
          total_amount: number;
          confirmed_by_employee_id: string | null;
          receipt_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['customer_orders']['Row']> & {
          numero: string;
          customer_name: string;
          tipo: 'retiro' | 'entrega_domicilio';
        };
        Update: Partial<Database['public']['Tables']['customer_orders']['Row']>;
      };
      customer_account_movements: {
        Row: {
          id: string;
          customer_id: string;
          type: 'charge' | 'payment';
          amount: number;
          payment_method_id: string | null;
          notes: string | null;
          receipt_id: string | null;
          employee_id: string | null;
          at: string;
        };
        Insert: { id?: string; customer_id: string; type: 'charge' | 'payment'; amount: number; payment_method_id?: string | null; notes?: string | null; receipt_id?: string | null; employee_id?: string | null; at?: string };
        Update: Partial<Database['public']['Tables']['customer_account_movements']['Row']>;
      };
      app_metadata: {
        Row: {
          singleton: boolean;
          schema_version: number;
          last_local_backup_at: string | null;
          migrated_from_local_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['app_metadata']['Row']>;
        Update: Partial<Database['public']['Tables']['app_metadata']['Row']>;
      };
      wholesale_config: {
        Row: {
          singleton: boolean;
          global_discount: number;
          min_units_per_item: number;
          min_order_amount: number;
        };
        Insert: Partial<Database['public']['Tables']['wholesale_config']['Row']>;
        Update: Partial<Database['public']['Tables']['wholesale_config']['Row']>;
      };
      order_config: {
        Row: {
          singleton: boolean;
          enabled: boolean;
          work_days: boolean[];
          blocked_dates: string[];
          min_days_ahead: number;
          max_days_ahead: number;
          time_slots: string[];
          max_orders_per_day: number;
        };
        Insert: Partial<Database['public']['Tables']['order_config']['Row']>;
        Update: Partial<Database['public']['Tables']['order_config']['Row']>;
      };
    };
    Views: {
      daily_sales_summary: {
        Row: {
          day: string;
          store_id: string;
          gross: number | null;
          discounts: number | null;
          net: number | null;
          cogs: number | null;
          sales_count: number;
          refunds_count: number;
        };
      };
      sales_by_item: {
        Row: {
          tire_id: string;
          tire_brand: string;
          tire_model: string;
          tire_size: string;
          category_id: string;
          category_name: string;
          store_id: string;
          day: string;
          quantity: number;
          net: number;
          cogs: number;
        };
      };
      sales_by_payment: {
        Row: {
          payment_method_id: string;
          store_id: string;
          day: string;
          sale_tx: number;
          refund_tx: number;
          sale_amount: number | null;
          refund_amount: number | null;
        };
      };
    };
    Functions: {
      apply_receipt_to_stock: {
        Args: { p_receipt_id: string };
        Returns: void;
      };
      recompute_customer_metrics: {
        Args: { p_customer_id: string };
        Returns: void;
      };
      create_receipt_with_lines: {
        Args: { p_receipt: Json; p_lines: Json };
        Returns: string;
      };
      close_cash_session: {
        Args: { p_session_id: string; p_employee_id: string; p_counted_cash: number };
        Returns: { expected_cash: number; counted_cash: number; variance: number };
      };
      current_employee_id: { Args: Record<string, never>; Returns: string | null };
      current_employee_store_ids: { Args: Record<string, never>; Returns: string[] | null };
      current_employee_role: { Args: Record<string, never>; Returns: string | null };
      current_employee_has_permission: { Args: { p: string }; Returns: boolean };
    };
  };
}
