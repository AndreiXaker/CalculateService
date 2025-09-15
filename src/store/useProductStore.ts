import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Product {
  key: string;
  sku: string;
  vendor?: string;
  description: string;
  price_usd: string;
  loaded_at: string;
  ebay_price?: string;
  quantity?: number;
}

interface ProductStore {
  selectedProducts: Product[];
  rows: Product[];
  setSelectedProducts: (items: Product[]) => void;
  setRows: (items: Product[]) => void;
  clearAll: () => void;
}

export const useProductStore = create<ProductStore>()(
  persist(
    (set) => ({
      selectedProducts: [],
      rows: [],
      setSelectedProducts: (items) => set({ selectedProducts: items }),
      setRows: (items) => set({ rows: items }),
      clearAll: () => set({ selectedProducts: [], rows: [] }),
    }),
    {
      name: 'product-storage', 
    }
  )
);
