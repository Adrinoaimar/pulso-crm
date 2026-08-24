import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { seed } from "./data";
import type { Store } from "./types";
type Ctx = {
  data: Store;
  setData: React.Dispatch<React.SetStateAction<Store>>;
};
const StoreContext = createContext<Ctx | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Store>(() => {
    try {
      return JSON.parse(localStorage.getItem("pulso.crm") || "null") || seed;
    } catch {
      return seed;
    }
  });
  useEffect(
    () => localStorage.setItem("pulso.crm", JSON.stringify(data)),
    [data],
  );
  return (
    <StoreContext.Provider value={{ data, setData }}>
      {children}
    </StoreContext.Provider>
  );
}
export const useStore = () => {
  const value = useContext(StoreContext);
  if (!value) throw Error("StoreProvider requerido");
  return value;
};
