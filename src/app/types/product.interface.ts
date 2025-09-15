

export interface ICalculation {
  id : string,
  name: string
  customerName: string
  status: string
  statusColor: string
  createdBy: string
  actions: string
  createdAt : string
}

export interface INewProduct {
  sku : string,
  manufacturer : string,
  price_ebay? : number | null,
  price_gpl? : number | null,
}

