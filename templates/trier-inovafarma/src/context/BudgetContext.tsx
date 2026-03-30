import type { AddressSchema } from "@/zod";
import React, {
  createContext,
  useState,
  Dispatch,
  SetStateAction,
} from "react";

export interface BudgetItem {
  id: string;
  product: {
    code: number;
    name: string;
    price: number;
    quantity: number;
    discount: number;
  };
  total: number;
}

interface BudgetContextType {
  budgetItems: BudgetItem[];
  setBudgetItems: Dispatch<SetStateAction<BudgetItem[]>>;
  hasDelivery: boolean;
  setHasDelivery: Dispatch<SetStateAction<boolean>>;
  addressInfo: AddressSchema | null;
  setAddressInfo: Dispatch<SetStateAction<AddressSchema | null>>;
}

export const BudgetContext = createContext<BudgetContextType | undefined>(
  undefined
);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [addressInfo, setAddressInfo] = useState<AddressSchema | null>(null);

  return (
    <BudgetContext.Provider
      value={{
        budgetItems,
        setBudgetItems,
        hasDelivery,
        setHasDelivery,
        addressInfo,
        setAddressInfo,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}
