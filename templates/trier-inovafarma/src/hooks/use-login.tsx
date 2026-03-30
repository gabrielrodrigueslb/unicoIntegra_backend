import { LoginContext } from "@/context/LoginContext";
import { useContext } from "react";

export const useLogin = () => {
  const context = useContext(LoginContext);

  if (!context) {
    throw new Error("useLogin must be used within a LoginProvider");
  }

  return context;
};
