// Domain types — selaras dengan ERD

export type Role = 'owner' | 'admin' | 'cashier' | 'perfumer' | 'stock_keeper'

export type OrderStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'paid'
  | 'in_production'
  | 'ready'
  | 'completed'
  | 'cancelled'

export type PaymentMethod = 'qris' | 'cash'
export type PaymentStatus = 'pending' | 'settlement' | 'expired' | 'failed'

export type ProductType = 'ready_stock' | 'custom_racik'
export type DriverType = 'travel_driver' | 'tour_guide'

export type StockMovementType =
  | 'purchase_in'
  | 'production_consume'
  | 'production_output'
  | 'sale_out'
  | 'adjustment'

export type ItemType = 'raw_material' | 'product'

export type MessagePurpose = 'invoice' | 'booking_confirm' | 'order_ready'
export type MessageStatus = 'queued' | 'sent' | 'failed'

export type NotificationSeverity = 'low' | 'critical'

export interface Branch {
  id: string
  name: string
  address: string | null
  phone: string | null
  active: boolean
  created_at: string
}

export interface Staff {
  id: string
  branch_id: string | null
  auth_user_id: string
  name: string
  role: Role
  active: boolean
  created_at: string
}
