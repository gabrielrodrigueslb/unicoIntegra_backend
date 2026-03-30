import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import logo from "/src/assets/logo.png";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { useLogin } from "@/hooks/use-login";
import { forceProductsSyncNow } from "@/lib/products-sync-runtime";

export function Header() {
  const { logout } = useLogin();
  const location = useLocation();
  const [isForceSyncing, setIsForceSyncing] = useState(false);

  const isLoginPage = location.pathname === "/login";

  async function handleForceSync() {
    if (isForceSyncing) {
      return;
    }

    const toastId = toast.loading("Sincronizando dados...");
    setIsForceSyncing(true);

    try {
      await forceProductsSyncNow();
      toast.success("Sincronizacao concluida.", { id: toastId });
    } catch (error) {
      console.error("Falha ao executar sync manual.", error);
      toast.error("Falha ao sincronizar dados.", { id: toastId });
    } finally {
      setIsForceSyncing(false);
    }
  }

  return (
    <header className="flex items-center justify-between pr-5">
      {isLoginPage ? (
        <div className="partner-area w-full flex gap-4 justify-center items-center text-white">
          <img src={logo} alt="Logo Unico Contato" className="w-40 " />
          x
          <img
            src="/trier-sistemas.png"
            alt="Logo Trier Sistemas"
            className="w-40"
          />
        </div>
      ) : (
        <div className="flex justify-between w-full items-center">
          <img src={logo} alt="Logo Unico Contato" className="w-40 " />

          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Sincronizar dados agora"
              aria-label="Sincronizar dados agora"
              className="p-2 rounded-md border border-amber-300/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleForceSync}
              disabled={isForceSyncing}
            >
              <RefreshCw
                className={isForceSyncing ? "animate-spin" : ""}
                size={18}
              />
            </button>

            <button
              type="button"
              className="p-2 hover:bg-zinc-800/50 hover:text-accent-foreground rounded-md"
              onClick={logout}
            >
              <LogOut color="white" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
