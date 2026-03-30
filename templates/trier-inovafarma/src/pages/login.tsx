import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/hooks/use-login";
import { loginSchema, type LoginSchema } from "@/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Lock, User, LogIn } from "lucide-react";
import toast from "react-hot-toast";
export function Login() {
  const { login } = useLogin();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const handleLogin = async (data: LoginSchema) => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_INSTANCE_URL}login`, {
        username: data.user,
        password: data.password,
      });

      if (response.data.user.type === 0) {
        toast.error(
          "Acesso não autorizado. Administradores não podem fazer login por este portal.",
          {
            position: "top-center",
            duration: 4000,
          }
        );
        setValue("user", "");
        setValue("password", "");
        return;
      }

      login(response.data.token, response.data.user.id);
      navigate("/");
    } catch (error) {
      toast.error("Erro ao fazer login. Verifique suas credenciais.", {
        position: "top-center",
        duration: 4000,
      });
      setValue("user", "");
      setValue("password", "");
      console.error(error);
    }
  };

  return (
    <div className="flex w-full min-h-[450px] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-zinc-700 p-4 rounded-full">
                <Lock className="w-10 h-10 text-blue-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo</h1>
            <p className="text-zinc-400">Faça login para continuar</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(handleLogin)}>
            <div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Usuário"
                  type="text"
                  className="pl-10 h-12 bg-zinc-700 border-none text-white 
                             focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  {...register("user")}
                />
              </div>
              {errors.user && (
                <span className="text-red-400 text-sm ml-1 mt-1 block">
                  {errors.user.message}
                </span>
              )}
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Senha"
                  type="password"
                  className="pl-10 h-12 bg-zinc-700 border-none text-white 
                             focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <span className="text-red-400 text-sm ml-1 mt-1 block">
                  {errors.password.message}
                </span>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 
                         hover:from-green-600 hover:to-emerald-700 
                         text-white font-semibold flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Acessar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
