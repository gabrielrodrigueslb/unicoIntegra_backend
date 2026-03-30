import { Navigate, useLocation } from "react-router-dom";
import { useLogin } from "@/hooks/use-login";
import { Spinner } from "./spinner";

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useLogin();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
