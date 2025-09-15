import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CalculationParams {
  inn: string;
  customerName: string;
  planned_start_date: string;
  slaIds: string[];
  description: string;
}

interface CalculationStore {
  params: CalculationParams;
  setParams: (params: Partial<CalculationParams>) => void;
  resetParams: () => void;
}

export const useCalculationStore = create<CalculationStore>()(
  persist(
    (set) => ({
      params: {
        inn: "",
        customerName: "",
        planned_start_date: "",
        slaIds: [],
        description: "",
      },
      setParams: (params) =>
        set((state) => ({
          params: { ...state.params, ...params }, 
        })),
      resetParams: () =>
        set({
          params: {
            inn: "",
            customerName: "",
            planned_start_date: "",
            slaIds: [],
            description: "",
          },
        }),
    }),
    {
      name: "calculation-storage", 
    }
  )
);
