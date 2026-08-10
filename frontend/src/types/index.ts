// ============================================================
// TypeScript interfaces matching the backend Pydantic schemas.
// Field names and types derived directly from backend/app/schemas/
// and backend/app/models/enums.py
// ============================================================

// ----- Enums (matching backend str enum .values) --------------------------------

export type UserRole =
  | 'owner'
  | 'production_manager'
  | 'inventory_manager'
  | 'sales_executive';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_production'
  | 'quality_check'
  | 'ready_for_dispatch'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export type OrderPriority = 'low' | 'medium' | 'high' | 'urgent';
export type OrderType = 'small' | 'bulk' | 'repeat';

export type BatchStatus = 'planned' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'delayed' | 'skipped';
export type StageName =
  | 'fabric_allocation'
  | 'cutting'
  | 'printing'
  | 'embroidery'
  | 'stitching'
  | 'quality_check'
  | 'ironing'
  | 'packing'
  | 'dispatch';

export type InventoryCategory =
  | 'fabric'
  | 'thread'
  | 'button'
  | 'zipper'
  | 'label'
  | 'packaging'
  | 'accessory';

export type TransactionType = 'issue' | 'receive' | 'adjustment';

export type PurchaseOrderStatus =
  | 'ordered'
  | 'in_transit'
  | 'delivered'
  | 'delayed'
  | 'cancelled';

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';
export type DeliveryStatus = 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'returned';

// ----- Auth / User (schemas/auth.py) -----------------------------------------

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ----- Customers (schemas/customer.py) ---------------------------------------

export interface Customer {
  id: number;
  name: string;
  company: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedCustomerResponse {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
}


// ----- Orders (schemas/order.py) ---------------------------------------------

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  product: string;
  color: string;
  fabric: string;
  size_breakdown: Record<string, number>;
  quantity: number;
  delivery_deadline: string; // ISO date string
  priority: OrderPriority;
  order_type: OrderType;
  status: OrderStatus;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedOrderResponse {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
}

// ----- Production (schemas/production.py) ------------------------------------

export interface WorkerSlim {
  id: number;
  name: string;
  department: string;
}

export interface ProductionStage {
  id: number;
  stage_name: StageName;
  sequence_order: number;
  status: StageStatus;
  start_time: string | null;
  completion_time: string | null;
  quantity_completed: number;
  delay_reason: string | null;
  notes: string | null;
}

export interface ProductionBatch {
  id: number;
  batch_number: string;
  order_id: number;
  production_line: string | null;
  planned_quantity: number;
  expected_completion_date: string | null;
  status: BatchStatus;
  stages: ProductionStage[];
  assigned_workers: WorkerSlim[];
  remaining_production: number;
  daily_production_target: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedBatchResponse {
  items: ProductionBatch[];
  total: number;
  page: number;
  page_size: number;
}

// ----- Inventory (schemas/inventory.py) --------------------------------------

export interface InventoryTransaction {
  id: number;
  transaction_type: TransactionType;
  quantity: number;
  reference: string | null;
  batch_id: number | null;
  created_by_id: number | null;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: InventoryCategory;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  supplier_id: number | null;
  purchase_cost: number | null;
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemDetail extends InventoryItem {
  recent_transactions: InventoryTransaction[];
}

export interface PaginatedInventoryResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  page_size: number;
}

// ----- Suppliers (schemas/supplier.py) ---------------------------------------

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  materials_supplied: string | null;
  average_delivery_days: number | null;
  quality_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierDetail extends Supplier {
  total_purchase_orders: number;
  on_time_delivery_rate: number | null;
  average_actual_delay_days: number | null;
}

export interface PurchaseOrder {
  id: number;
  supplier_id: number;
  inventory_item_id: number;
  quantity: number;
  unit_cost: number | null;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  status: PurchaseOrderStatus;
  created_at: string;
  updated_at: string;
}

export interface PaginatedSupplierResponse {
  items: Supplier[];
  total: number;
  page: number;
  page_size: number;
}

// ----- Workers (schemas/worker.py) -------------------------------------------

export interface Worker {
  id: number;
  name: string;
  department: string;
  skill: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkerDetail extends Worker {
  attendance_rate: number | null;
  total_output_last_30_days: number | null;
  average_daily_output: number | null;
}

export interface AttendanceRecord {
  id: number;
  worker_id: number;
  date: string;
  status: AttendanceStatus;
  overtime_hours: number;
  output_quantity: number | null;
  created_at: string;
}

export interface PaginatedWorkerResponse {
  items: Worker[];
  total: number;
  page: number;
  page_size: number;
}

// ----- Dispatch (schemas/dispatch.py) ----------------------------------------

export interface Dispatch {
  id: number;
  order_id: number;
  batch_id: number | null;
  invoice_number: string;
  courier: string | null;
  dispatch_date: string;
  tracking_number: string | null;
  delivery_status: DeliveryStatus;
  created_at: string;
  updated_at: string;
}

export interface PaginatedDispatchResponse {
  items: Dispatch[];
  total: number;
  page: number;
  page_size: number;
}

// ----- Dashboard (schemas/dashboard.py) --------------------------------------

export interface DashboardLowStockItem {
  id: number;
  name: string;
  current_stock: number;
  minimum_stock: number;
}

export interface DashboardSummary {
  active_orders_count: number;
  orders_near_deadline: number;
  delayed_orders_count: number;
  pending_dispatch_count: number;
  todays_production: number;
  weekly_production: number;
  monthly_production: number;
  factory_efficiency: number;
  inventory_health: number;
  low_stock_materials: DashboardLowStockItem[];
}

// ----- AI features (schemas/ml.py) -------------------------------------------

export type DelayRisk = 'low' | 'medium' | 'high';

export interface DelayRiskResponse {
  batch_id: number;
  risk: DelayRisk;
  probability: number;
  contributing_factors: string[];
  model_note: string;
}

export interface InventoryForecastResponse {
  item_id: number;
  item_name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  n_issue_transactions: number;
  total_issued: number;
  avg_qty_per_batch: number | null;
  open_batch_count: number;
  estimated_demand: number | null;
  surplus_after_demand: number | null;
  suggested_reorder_qty: number | null;
  has_history: boolean;
  approach: string;
  caveat: string;
}

export interface OrderRecommendation {
  order_id: number;
  order_number: string;
  product: string;
  fabric: string;
  quantity: number;
  priority: string;
  delivery_deadline: string;
  days_to_deadline: number;
  current_status: string;
  score: number;
  deadline_score: number;
  priority_score: number;
  size_score: number;
  fabric_risk_score: number;
  suggested_worker_count: number;
  estimated_completion_date: string;
  days_to_complete: number;
  buffer_days: number;
  existing_batch_id: number | null;
  existing_batch_status: string | null;
  fabric_item_matched: boolean;
  fabric_item_name: string | null;
  fabric_stock_sufficient: boolean | null;
  reason: string;
  caveat: string;
}

export interface PaginatedRecommendationResponse {
  total: number;
  items: OrderRecommendation[];
  approach: string;
}

