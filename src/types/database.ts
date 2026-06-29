// Hand-written types selaras ERD — akan di-replace dengan `supabase gen types typescript`
// setelah migration di-push ke Supabase.

export type Database = {
  public: {
    Tables: {
      // ── M0 ────────────────────────────────────────────────────────────────
      branches: {
        Row: { id: string; name: string; address: string | null; phone: string | null; qris_image_url: string | null; active: boolean; created_at: string }
        Insert: { id?: string; name: string; address?: string | null; phone?: string | null; qris_image_url?: string | null; active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; address?: string | null; phone?: string | null; qris_image_url?: string | null; active?: boolean; created_at?: string }
        Relationships: []
      }
      staff: {
        Row: { id: string; branch_id: string | null; auth_user_id: string; name: string; role: 'owner' | 'admin' | 'cashier' | 'perfumer' | 'stock_keeper'; active: boolean; created_at: string }
        Insert: { id?: string; branch_id?: string | null; auth_user_id: string; name: string; role: 'owner' | 'admin' | 'cashier' | 'perfumer' | 'stock_keeper'; active?: boolean; created_at?: string }
        Update: { id?: string; branch_id?: string | null; auth_user_id?: string; name?: string; role?: 'owner' | 'admin' | 'cashier' | 'perfumer' | 'stock_keeper'; active?: boolean; created_at?: string }
        Relationships: []
      }
      // ── M1 ────────────────────────────────────────────────────────────────
      raw_materials: {
        Row: { id: string; name: string; unit: string; reorder_level: number; active: boolean; created_at: string }
        Insert: { id?: string; name: string; unit: string; reorder_level?: number; active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; unit?: string; reorder_level?: number; active?: boolean; created_at?: string }
        Relationships: []
      }
      products: {
        Row: { id: string; sku: string; name: string; category: string | null; type: 'ready_stock' | 'custom_racik'; price: number; image_url: string | null; active: boolean; created_at: string }
        Insert: { id?: string; sku: string; name: string; category?: string | null; type: 'ready_stock' | 'custom_racik'; price?: number; image_url?: string | null; active?: boolean; created_at?: string }
        Update: { id?: string; sku?: string; name?: string; category?: string | null; type?: 'ready_stock' | 'custom_racik'; price?: number; image_url?: string | null; active?: boolean; created_at?: string }
        Relationships: []
      }
      product_recipes: {
        Row: { id: string; product_id: string; raw_material_id: string; qty_per_unit: number }
        Insert: { id?: string; product_id: string; raw_material_id: string; qty_per_unit: number }
        Update: { id?: string; product_id?: string; raw_material_id?: string; qty_per_unit?: number }
        Relationships: []
      }
      suppliers: {
        Row: { id: string; name: string; phone: string | null; address: string | null; created_at: string }
        Insert: { id?: string; name: string; phone?: string | null; address?: string | null; created_at?: string }
        Update: { id?: string; name?: string; phone?: string | null; address?: string | null; created_at?: string }
        Relationships: []
      }
      customers: {
        Row: { id: string; name: string | null; phone: string | null; email: string | null; created_at: string }
        Insert: { id?: string; name?: string | null; phone?: string | null; email?: string | null; created_at?: string }
        Update: { id?: string; name?: string | null; phone?: string | null; email?: string | null; created_at?: string }
        Relationships: []
      }
      drivers: {
        Row: { id: string; name: string; phone: string | null; type: 'travel_driver' | 'tour_guide'; fee_type: 'percentage'; fee_value: number; referral_code: string | null; qr_token: string | null; active: boolean; created_at: string }
        Insert: { id?: string; name: string; phone?: string | null; type: 'travel_driver' | 'tour_guide'; fee_type?: 'percentage'; fee_value?: number; referral_code?: string | null; qr_token?: string | null; active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; phone?: string | null; type?: 'travel_driver' | 'tour_guide'; fee_type?: 'percentage'; fee_value?: number; referral_code?: string | null; qr_token?: string | null; active?: boolean; created_at?: string }
        Relationships: []
      }
      // ── M6 ────────────────────────────────────────────────────────────────
      edc_machines: {
        Row: { id: string; branch_id: string; bank_name: string; terminal_id: string | null; label: string; active: boolean; created_at: string }
        Insert: { id?: string; branch_id: string; bank_name: string; terminal_id?: string | null; label: string; active?: boolean; created_at?: string }
        Update: { id?: string; branch_id?: string; bank_name?: string; terminal_id?: string | null; label?: string; active?: boolean; created_at?: string }
        Relationships: []
      }
      // ── M2 ────────────────────────────────────────────────────────────────
      raw_material_batches: {
        Row: { id: string; branch_id: string; raw_material_id: string; po_item_id: string | null; qty_received: number; qty_remaining: number; unit_cost: number; received_at: string; created_at: string }
        Insert: { id?: string; branch_id: string; raw_material_id: string; po_item_id?: string | null; qty_received: number; qty_remaining: number; unit_cost: number; received_at?: string; created_at?: string }
        Update: { id?: string; branch_id?: string; raw_material_id?: string; po_item_id?: string | null; qty_received?: number; qty_remaining?: number; unit_cost?: number; received_at?: string; created_at?: string }
        Relationships: []
      }
      product_stock: {
        Row: { id: string; branch_id: string; product_id: string; current_stock: number; updated_at: string }
        Insert: { id?: string; branch_id: string; product_id: string; current_stock?: number; updated_at?: string }
        Update: { id?: string; branch_id?: string; product_id?: string; current_stock?: number; updated_at?: string }
        Relationships: []
      }
      stock_movements: {
        Row: { id: string; branch_id: string; item_type: 'raw_material' | 'product'; item_id: string; batch_id: string | null; qty_change: number; unit_cost: number | null; movement_type: 'purchase_in' | 'production_consume' | 'production_output' | 'sale_out' | 'adjustment'; reference_type: string | null; reference_id: string | null; notes: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; branch_id: string; item_type: 'raw_material' | 'product'; item_id: string; batch_id?: string | null; qty_change: number; unit_cost?: number | null; movement_type: 'purchase_in' | 'production_consume' | 'production_output' | 'sale_out' | 'adjustment'; reference_type?: string | null; reference_id?: string | null; notes?: string | null; created_by?: string | null; created_at?: string }
        Update: never
        Relationships: []
      }
      // ── M4 + M7 + M10 ─────────────────────────────────────────────────────
      orders: {
        Row: { id: string; branch_id: string; order_number: string; queue_number: number; customer_id: string | null; staff_id: string | null; driver_id: string | null; status: 'draft' | 'awaiting_payment' | 'paid' | 'in_production' | 'ready' | 'completed' | 'cancelled'; subtotal: number; discount: number; total: number; paid_at: string | null; created_at: string }
        Insert: { id?: string; branch_id: string; order_number: string; queue_number: number; customer_id?: string | null; staff_id?: string | null; driver_id?: string | null; status?: 'draft' | 'awaiting_payment' | 'paid' | 'in_production' | 'ready' | 'completed' | 'cancelled'; subtotal?: number; discount?: number; total?: number; paid_at?: string | null; created_at?: string }
        Update: { status?: 'draft' | 'awaiting_payment' | 'paid' | 'in_production' | 'ready' | 'completed' | 'cancelled'; paid_at?: string | null }
        Relationships: []
      }
      order_items: {
        Row: { id: string; order_id: string; product_id: string; qty: number; unit_price: number; line_total: number; is_custom: boolean; customization_notes: string | null; recipe_snapshot: Record<string, unknown> | null; created_at: string }
        Insert: { id?: string; order_id: string; product_id: string; qty: number; unit_price: number; line_total: number; is_custom?: boolean; customization_notes?: string | null; recipe_snapshot?: Record<string, unknown> | null; created_at?: string }
        Update: never
        Relationships: []
      }
      driver_fees: {
        Row: { id: string; driver_id: string; order_id: string; base_amount: number; fee_amount: number; fee_scheme_snapshot: Record<string, unknown> | null; status: 'accrued' | 'paid'; payout_id: string | null; accrued_at: string }
        Insert: { id?: string; driver_id: string; order_id: string; base_amount: number; fee_amount: number; fee_scheme_snapshot?: Record<string, unknown> | null; status?: 'accrued' | 'paid'; payout_id?: string | null; accrued_at?: string }
        Update: { status?: 'accrued' | 'paid'; payout_id?: string | null }
        Relationships: []
      }
      driver_payouts: {
        Row: { id: string; driver_id: string; period_start: string | null; period_end: string | null; total: number; status: 'pending' | 'paid'; paid_at: string | null; created_at: string }
        Insert: { id?: string; driver_id: string; period_start?: string | null; period_end?: string | null; total?: number; status?: 'pending' | 'paid'; paid_at?: string | null; created_at?: string }
        Update: { id?: string; status?: 'pending' | 'paid'; paid_at?: string | null }
        Relationships: []
      }
      outbound_messages: {
        Row: { id: string; channel: string; to_phone: string; purpose: 'invoice' | 'booking_confirm' | 'order_ready'; reference_type: string | null; reference_id: string | null; payload: Record<string, unknown> | null; provider: string | null; provider_ref: string | null; status: 'queued' | 'sent' | 'failed'; error: string | null; sent_at: string | null; created_at: string }
        Insert: { id?: string; channel?: string; to_phone: string; purpose: 'invoice' | 'booking_confirm' | 'order_ready'; reference_type?: string | null; reference_id?: string | null; payload?: Record<string, unknown> | null; provider?: string | null; provider_ref?: string | null; status?: 'queued' | 'sent' | 'failed'; error?: string | null; sent_at?: string | null; created_at?: string }
        Update: { status?: 'queued' | 'sent' | 'failed'; provider?: string | null; provider_ref?: string | null; error?: string | null; sent_at?: string | null }
        Relationships: []
      }
      // ── M11 ────────────────────────────────────────────────────────────────
      label_templates: {
        Row: { id: string; branch_id: string | null; name: string; content: Record<string, unknown>; active: boolean; created_at: string }
        Insert: { id?: string; branch_id?: string | null; name: string; content?: Record<string, unknown>; active?: boolean; created_at?: string }
        Update: { id?: string; branch_id?: string | null; name?: string; content?: Record<string, unknown>; active?: boolean; created_at?: string }
        Relationships: []
      }
      // ── M6 Production / Kanban ────────────────────────────────────────────
      production_orders: {
        Row: {
          id: string
          branch_id: string
          order_id: string
          order_item_id: string
          product_id: string
          status: 'antri' | 'diracik' | 'packing' | 'selesai' | 'diambil'
          notes: string | null
          assigned_to: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          order_id: string
          order_item_id: string
          product_id: string
          status?: 'antri' | 'diracik' | 'packing' | 'selesai' | 'diambil'
          notes?: string | null
          assigned_to?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: never  // semua update harus lewat advance_production_status()
        Relationships: [
          { foreignKeyName: 'production_orders_branch_id_fkey';   columns: ['branch_id'];     referencedRelation: 'branches';    referencedColumns: ['id'] },
          { foreignKeyName: 'production_orders_order_id_fkey';    columns: ['order_id'];      referencedRelation: 'orders';      referencedColumns: ['id'] },
          { foreignKeyName: 'production_orders_order_item_id_fkey'; columns: ['order_item_id']; referencedRelation: 'order_items'; referencedColumns: ['id'] },
          { foreignKeyName: 'production_orders_product_id_fkey';  columns: ['product_id'];    referencedRelation: 'products';    referencedColumns: ['id'] },
          { foreignKeyName: 'production_orders_assigned_to_fkey'; columns: ['assigned_to'];   referencedRelation: 'staff';       referencedColumns: ['id'] },
        ]
      }
      // ── M3 Procurement ─────────────────────────────────────────────────────
      purchase_orders: {
        Row: {
          id:          string
          branch_id:   string
          supplier_id: string
          po_number:   string
          status:      'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
          notes:       string | null
          total:       number
          ordered_at:  string | null
          received_at: string | null
          created_by:  string | null
          created_at:  string
        }
        Insert: {
          id?:          string
          branch_id:    string
          supplier_id:  string
          po_number:    string
          status?:      'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
          notes?:       string | null
          total?:       number
          ordered_at?:  string | null
          received_at?: string | null
          created_by?:  string | null
          created_at?:  string
        }
        Update: {
          status?:      'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
          notes?:       string | null
          total?:       number
          ordered_at?:  string | null
          received_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'purchase_orders_branch_id_fkey';   columns: ['branch_id'];   referencedRelation: 'branches';   referencedColumns: ['id'] },
          { foreignKeyName: 'purchase_orders_supplier_id_fkey'; columns: ['supplier_id']; referencedRelation: 'suppliers';  referencedColumns: ['id'] },
          { foreignKeyName: 'purchase_orders_created_by_fkey';  columns: ['created_by'];  referencedRelation: 'staff';      referencedColumns: ['id'] },
        ]
      }
      purchase_order_items: {
        Row: {
          id:              string
          po_id:           string
          raw_material_id: string
          qty_ordered:     number
          qty_received:    number
          unit_cost:       number
          notes:           string | null
          created_at:      string
        }
        Insert: {
          id?:              string
          po_id:            string
          raw_material_id:  string
          qty_ordered:      number
          qty_received?:    number
          unit_cost:        number
          notes?:           string | null
          created_at?:      string
        }
        Update: {
          qty_received?: number
          unit_cost?:    number
          notes?:        string | null
        }
        Relationships: [
          { foreignKeyName: 'purchase_order_items_po_id_fkey';           columns: ['po_id'];           referencedRelation: 'purchase_orders'; referencedColumns: ['id'] },
          { foreignKeyName: 'purchase_order_items_raw_material_id_fkey'; columns: ['raw_material_id']; referencedRelation: 'raw_materials';   referencedColumns: ['id'] },
        ]
      }
      // ── M8 Booking ─────────────────────────────────────────────────────────
      consultation_slots: {
        Row: { id: string; branch_id: string; date: string; start_time: string; end_time: string; max_bookings: number; price: number; notes: string | null; is_active: boolean; calendar_event_id: string | null; created_at: string }
        Insert: { id?: string; branch_id: string; date: string; start_time: string; end_time: string; max_bookings?: number; price?: number; notes?: string | null; is_active?: boolean; calendar_event_id?: string | null; created_at?: string }
        Update: { date?: string; start_time?: string; end_time?: string; max_bookings?: number; price?: number; notes?: string | null; is_active?: boolean; calendar_event_id?: string | null }
        Relationships: []
      }
      consultation_bookings: {
        Row: { id: string; slot_id: string; customer_name: string; customer_phone: string; customer_email: string | null; qty: number; status: 'pending_payment' | 'confirmed' | 'cancelled' | 'expired'; queue_number: number; expires_at: string | null; payment_external_id: string | null; paid_at: string | null; amount: number; notes: string | null; created_at: string }
        Insert: { id?: string; slot_id: string; customer_name: string; customer_phone: string; customer_email?: string | null; qty?: number; status?: 'pending_payment' | 'confirmed' | 'cancelled' | 'expired'; queue_number: number; expires_at?: string | null; payment_external_id?: string | null; paid_at?: string | null; amount?: number; notes?: string | null; created_at?: string }
        Update: { status?: 'pending_payment' | 'confirmed' | 'cancelled' | 'expired'; qty?: number; expires_at?: string | null; payment_external_id?: string | null; paid_at?: string | null; amount?: number; notes?: string | null }
        Relationships: []
      }
      // ── M9 Notifications ───────────────────────────────────────────────────
      notifications: {
        Row: {
          id:             string
          branch_id:      string
          type:           'low_stock' | 'po_status' | 'system'
          severity:       'low' | 'critical'
          title:          string
          body:           string
          target_roles:   string[]
          reference_type: string | null
          reference_id:   string | null
          resolved_at:    string | null
          created_at:     string
        }
        Insert: {
          id?:             string
          branch_id:       string
          type:            'low_stock' | 'po_status' | 'system'
          severity?:       'low' | 'critical'
          title:           string
          body:            string
          target_roles:    string[]
          reference_type?: string | null
          reference_id?:   string | null
          resolved_at?:    string | null
          created_at?:     string
        }
        Update: {
          resolved_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'notifications_branch_id_fkey'; columns: ['branch_id']; referencedRelation: 'branches'; referencedColumns: ['id'] }
        ]
      }
      notification_reads: {
        Row: {
          id:              string
          notification_id: string
          staff_id:        string
          read_at:         string
        }
        Insert: {
          id?:              string
          notification_id:  string
          staff_id:         string
          read_at?:         string
        }
        Update: never
        Relationships: [
          { foreignKeyName: 'notification_reads_notification_id_fkey'; columns: ['notification_id']; referencedRelation: 'notifications'; referencedColumns: ['id'] },
          { foreignKeyName: 'notification_reads_staff_id_fkey';        columns: ['staff_id'];        referencedRelation: 'staff';         referencedColumns: ['id'] },
        ]
      }
      // ── M5 ─────────────────────────────────────────────────────────────────
      payments: {
        Row: { id: string; order_id: string; method: 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'qris'; amount: number; edc_machine_id: string | null; gateway: string | null; external_id: string | null; qris_string: string | null; status: 'pending' | 'settlement' | 'expired' | 'failed'; paid_at: string | null; created_at: string }
        Insert: { id?: string; order_id: string; method: 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'qris'; amount: number; edc_machine_id?: string | null; gateway?: string | null; external_id?: string | null; qris_string?: string | null; status?: 'pending' | 'settlement' | 'expired' | 'failed'; paid_at?: string | null; created_at?: string }
        Update: { status?: 'pending' | 'settlement' | 'expired' | 'failed'; paid_at?: string | null }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_staff_id:            { Args: Record<string, never>; Returns: string }
      get_my_role:                { Args: Record<string, never>; Returns: string }
      get_my_branch_id:           { Args: Record<string, never>; Returns: string }
      is_manager:                 { Args: Record<string, never>; Returns: boolean }
      in_branch:                  { Args: { p_branch_id: string }; Returns: boolean }
      consume_raw_material_fifo:  { Args: { p_branch_id: string; p_raw_material_id: string; p_qty: number; p_reference_type: string; p_reference_id: string; p_created_by: string }; Returns: number }
      upsert_product_stock:       { Args: { p_branch_id: string; p_product_id: string; p_qty_delta: number; p_movement_type: string; p_reference_type?: string; p_reference_id?: string; p_created_by?: string }; Returns: void }
      get_branch_raw_stock:       { Args: { p_branch_id: string }; Returns: RawStockRow[] }
      create_order_tx:            { Args: { p_branch_id: string; p_staff_id: string; p_driver_id?: string | null; p_customer_name?: string | null; p_customer_phone?: string | null; p_discount?: number; p_items: Record<string, unknown>[]; p_tz?: string }; Returns: CreateOrderResult }
      finalize_cash_payment:      { Args: { p_order_id: string; p_staff_id: string }; Returns: void }
      finalize_payment:           { Args: { p_order_id: string; p_staff_id: string; p_method: string; p_edc_machine_id?: string | null }; Returns: void }
      cancel_order_tx:               { Args: { p_order_id: string; p_staff_id: string }; Returns: void }
      process_midtrans_settlement:   { Args: { p_external_id: string; p_amount: number; p_gateway_ref: string }; Returns: string }
      enqueue_wa_invoice:            { Args: { p_order_id: string }; Returns: void }
      // M6 Production
      create_production_orders:      { Args: { p_order_id: string }; Returns: void }
      advance_production_status:     { Args: { p_production_order_id: string; p_new_status: 'antri' | 'diracik' | 'packing' | 'selesai' | 'diambil'; p_staff_id: string }; Returns: AdvanceProductionResult }
      // M3 Procurement
      receive_po_items:              { Args: { p_po_id: string; p_staff_id: string; p_items: Record<string, unknown>[] }; Returns: ReceivePoResult }
      // M7 Driver payout
      create_driver_payout:          { Args: { p_driver_id: string; p_period_start: string; p_period_end: string }; Returns: CreatePayoutResult }
      // M12 Reporting
      get_sales_report:              { Args: { p_branch_id: string; p_from: string; p_to: string }; Returns: SalesReport }
      get_driver_fee_report:         { Args: { p_from: string; p_to: string }; Returns: DriverFeeReportRow[] }
      get_production_report:         { Args: { p_branch_id: string; p_from: string; p_to: string }; Returns: ProductionReport }
      // M8 Booking
      check_and_create_booking:      { Args: { p_slot_id: string; p_customer_name: string; p_customer_phone: string; p_customer_email?: string | null; p_notes?: string | null }; Returns: CheckBookingResult }
    }
    Enums: Record<string, never>
  }
}

// Return type untuk create_order_tx
export interface CreateOrderResult {
  id:           string
  order_number: string
  queue_number: number
  subtotal:     number
  discount:     number
  total:        number
  status:       string
}

// Return type untuk get_branch_raw_stock
export interface RawStockRow {
  raw_material_id: string
  name: string
  unit: string
  reorder_level: number
  active: boolean
  current_stock: number
  valuation: number
  stock_status: 'aman' | 'rendah' | 'habis'
}

// Return type untuk advance_production_status
export interface AdvanceProductionResult {
  id:           string
  status:       'antri' | 'diracik' | 'packing' | 'selesai' | 'diambil'
  assigned_to:  string
  completed_at: string | null
}

export interface CreatePayoutResult {
  payout_id:  string
  total:      number
  fee_count:  number
  status:     'pending'
}

export interface ReceivePoResult {
  po_id:          string
  items_received: number
  po_status:      'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
}

export interface AppNotification {
  id:             string
  type:           'low_stock' | 'po_status' | 'system'
  severity:       'low' | 'critical'
  title:          string
  body:           string
  reference_type: string | null
  reference_id:   string | null
  resolved_at:    string | null
  created_at:     string
  is_read:        boolean
  read_at:        string | null
}

// ── M12 Reporting ─────────────────────────────────────────────────────────────

export interface SalesReportDaily {
  day:             string
  order_count:     number
  revenue:         number
  total_discount:  number
  avg_order_value: number
}

export interface SalesReportProduct {
  product_name: string
  category:     string | null
  revenue:      number
  units_sold:   number
}

export interface SalesReportTotals {
  total_revenue:    number
  total_orders:     number
  total_discount:   number
  avg_order_value:  number
}

export interface SalesReport {
  daily:        SalesReportDaily[]
  top_products: SalesReportProduct[]
  totals:       SalesReportTotals
}

export interface StockValuationRow {
  raw_material_id: string
  name:            string
  unit:            string
  total_qty:       number
  total_value:     number
}

export interface ProductionStatusCount {
  status: string
  cnt:    number
}

export interface ProductionReport {
  by_status:               ProductionStatusCount[]
  avg_lead_time_minutes:   number
}

export interface CheckBookingResult {
  booking_id:   string
  queue_number: number
  slot_date:    string
  start_time:   string
  end_time:     string
  max_bookings: number
  filled:       number
}

export interface DriverFeeReportRow {
  driver_id:     string
  driver_name:   string
  driver_type:   string
  fee_value:     number
  order_count:   number
  total_base:    number
  total_fee:     number
  total_accrued: number
  total_paid:    number
}

// Convenience row types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
