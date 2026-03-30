import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { useLogin } from "@/hooks/use-login";
import { useBudget } from "@/hooks/use-budget";
import {
  sendToGoogleSheets,
  type Budget,
} from "@/services/googleSheetsService";
import { paymentMethodSchema, type PaymentMethodSchema } from "@/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import {
  AlertTriangle,
  Check,
  CreditCard,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { formatBudgetMessage, formatCPF } from "@/lib/utils";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";

interface Chat {
  chatId: number;
  clientId: string;
  pageId: string;
  pageName: string;
  clientName: string;
  userId: number;
  queueId: number;
  apiKey: string;
}

export function Chats() {
  const navigate = useNavigate();
  const { token, userId } = useLogin();
  const {
    budgetItems,
    addressInfo,
    setBudgetItems,
    setAddressInfo,
    hasDelivery,
    setHasDelivery,
  } = useBudget();

  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PaymentMethodSchema>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      paymentMethod: "Pix",
      cpfClient: "",
    },
  });

  const fetchChats = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setRefreshLoading(true);
      }
      setError(null);

      const queuesResponse = await axios.get(
        `${import.meta.env.VITE_INSTANCE_URL}users/${userId}/queues`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const allChats: Chat[] = [];

      for (const queue of queuesResponse.data) {
        try {
          const chatsResponse = await axios.post(
            `${import.meta.env.VITE_INSTANCE_URL}int/getAllOpenChats`,
            { queueId: queue.id, apiKey: queue.apikey }
          );
          const validChats = chatsResponse.data.chats
            .map((chat: Chat) => ({ ...chat, queueId: queue.id, apiKey: queue.apikey }))
            .filter((chat: Chat) => chat.userId === userId);
          allChats.push(...validChats);
        } catch (queueError) {
          console.error(`Erro ao buscar chats para fila ${queue.id}:`, queueError);
        }
      }
      setChats(allChats);
      if (allChats.length === 0) setSelectedChat(null);
    } catch (error) {
      console.error("Erro ao carregar chats:", error);
      setError("Não foi possível carregar os chats");
    } finally {
      setLoading(false);
      setRefreshLoading(false);
    }
  };

  useEffect(() => {
    if (userId && token) {
      fetchChats();
    }
  }, [userId, token]);

  const handleRefresh = () => {
    fetchChats(true);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCpf = formatCPF(e.target.value);
    form.setValue("cpfClient", formattedCpf);
  };

  async function handleChat(data: PaymentMethodSchema) {
    if (!selectedChat) return;

    try {
      const budgetItemsToSend: Budget[] = budgetItems.map((item) => ({
        productName: item.product.name,
        productCode: item.product.code,
        quantity: item.product.quantity,
        price: item.product.price,
        discount: item.product.discount,
        total: item.total,
        hasDelivery: !!hasDelivery,
        cep: addressInfo?.cep,
        street: addressInfo?.street,
        number: addressInfo?.number,
        neighborhood: addressInfo?.neighborhood,
        city: addressInfo?.city,
        state: addressInfo?.state,
        clientName: selectedChat.clientName,
        chatId: selectedChat.chatId,
        paymentMethod: data.paymentMethod,
        taxEntrega: addressInfo?.taxEntrega,
        cpfClient: data.cpfClient,
      }));

      const budgetMessage = formatBudgetMessage(budgetItemsToSend, addressInfo, data);

      await axios.post(
        `${import.meta.env.VITE_INSTANCE_URL}int/sendMessageToChat`,
        {
          queueId: selectedChat.queueId,
          apiKey: selectedChat.apiKey,
          chatId: selectedChat.chatId,
          text: budgetMessage,
          info: true,
        }
      );

      await sendToGoogleSheets(budgetItemsToSend);

      setBudgetItems([]);
      setAddressInfo(null);
      setHasDelivery(false);
      toast.success("Orçamento concluído!", { position: "top-center", duration: 4000 });
      navigate("/");
    } catch (error) {
      toast.error("Erro ao concluir o orçamento.", { position: "top-center", duration: 4000 });
      if (axios.isAxiosError(error)) {
        console.error("Erro detalhado da API:", error.response?.data);
      } else {
        console.error("Erro ao enviar dados e selecionar chat:", error);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] w-full max-w-[450px] mx-auto text-white p-4">
        <RefreshCw className="w-12 h-12 animate-spin text-green-500 mb-4" />
        <p className="text-xl">Carregando chats...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] w-full max-w-[450px] mx-auto text-white p-4">
        <div className="bg-red-600/20 border border-red-500 p-6 rounded-lg text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-2xl font-bold text-red-400 mb-4">Ops!</p>
          <p className="text-red-300 mb-6">{error}</p>
          <Button onClick={handleRefresh} className="bg-green-600 hover:bg-green-700 text-white" disabled={refreshLoading}>
            {refreshLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <RotateCcw className="w-5 h-5 mr-2" />}
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto bg-zinc-900 p-4 h-full flex flex-col">
      <form onSubmit={form.handleSubmit(handleChat)} className="flex flex-col flex-1 overflow-y-auto">
        <div className="flex items-center mb-6 space-x-4">
          <MessageCircle className="w-8 h-8 text-green-500" />
          <h1 className="text-2xl font-bold text-white">Selecione um Chat</h1>
          <Button type="button" variant="ghost" size="icon" className="ml-auto text-green-400 hover:text-green-300" onClick={handleRefresh} disabled={refreshLoading}>
            {refreshLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
          </Button>
        </div>

        {chats.length === 0 ? (
          <div className="bg-zinc-800 rounded-lg p-6 text-center mb-8">
            <User className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400 text-lg">Nenhum chat disponível no momento</p>
          </div>
        ) : (
          <div className="space-y-4 p-1.5 mb-8">
            {chats.map((chat) => (
              <div key={chat.chatId} className={`bg-zinc-800 rounded-lg shadow-md transition-all duration-300 ${selectedChat?.chatId === chat.chatId ? "border-2 border-blue-500" : "hover:shadow-lg hover:-translate-y-1"}`}>
                <Button type="button" variant="ghost" className="w-full h-full flex flex-col items-start p-4 space-y-2 hover:bg-zinc-700" onClick={() => setSelectedChat(chat)}>
                  <div className="flex items-center space-x-3 w-full">
                    <div className={`bg-blue-500/20 p-2 rounded-full ${selectedChat?.chatId === chat.chatId ? "bg-blue-500/50" : ""}`}>
                      <User className={`w-5 h-5 ${selectedChat?.chatId === chat.chatId ? "text-blue-500" : "text-blue-400"}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <h2 className="text-base font-semibold text-white truncate">{chat.clientName}</h2>
                      <p className="text-xs text-zinc-400 truncate">ID: {chat.chatId}</p>
                    </div>
                    {selectedChat?.chatId === chat.chatId && <Check className="text-blue-500" />}
                  </div>
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center mb-6 space-x-4">
          <CreditCard className="w-8 h-8 text-green-500" />
          <h1 className="text-2xl font-bold text-white">Forma de pagamento</h1>
        </div>
        <div className="w-full mb-10 text-white">
          <NativeSelect form={form} options={[{ value: "Pix", label: "Pix" }, { value: "Crédito", label: "Crédito" }, { value: "Débito", label: "Débito" }]} placeholder="Selecione uma opção..." />
        </div>

        <div className="flex items-center mb-6 space-x-4">
          <CreditCard className="w-8 h-8 text-green-500" />
          <h1 className="text-2xl font-bold text-white">CPF do Cliente</h1>
        </div>
        <div className="w-full mb-10 text-white">
          <Input
            name="cpfClient"
            value={form.watch("cpfClient")}
            onChange={handleCpfChange}
            placeholder="Digite o CPF do cliente"
            className="w-full"
            maxLength={14}
          />
          {form.formState.errors.cpfClient && (
            <p className="text-red-500 text-sm mt-1">{form.formState.errors.cpfClient.message}</p>
          )}
        </div>

        <div className="flex justify-between pt-3 border-t border-zinc-700 mt-auto">
          <Button type="button" variant="secondary" onClick={() => (hasDelivery ? navigate("/address") : navigate("/"))}>
            Anterior
          </Button>
          <Button type="submit" disabled={!selectedChat}>
            Finalizar
          </Button>
        </div>
      </form>
    </div>
  );
}