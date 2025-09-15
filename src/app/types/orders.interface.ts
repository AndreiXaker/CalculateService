interface IOrderFile {
  sla_name: string
  kind: string
  file_url: string
}

export interface IOrder {
  id: string
  name: string
  status: string
  status_display: string
  user_email: string
  order_files: IOrderFile[]
  inn: string
  customer_name: string
  total_zip_qty : number
  planned_start_date: string | null
  description: string
  created_at: string
  approved_at: string | null
  engineer_hours?: string
  service_manager_hours?: string
  totals: {
    total_gpl_price: string
    total_rma_cost: string
    total_pid_count: string
  }
  support_costs?: Record<
    string,
    {
      "12_months"?: string
      "24_months"?: string
      "36_months"?: string
    }
  >
  excel_url?: string | null
  order_items: {
    price_ebay?: string
    loaded_at: number
    ebay_price: null
    description: string
    sku: string
    manufacturer: string | null
    quantity: number
    price_gpl?: string
    zip_quantity: number
    rma_cost: string
  }[]
  total_zip_cost: number
}
