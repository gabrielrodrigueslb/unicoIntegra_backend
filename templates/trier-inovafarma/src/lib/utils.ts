import type { Budget } from "@/services/googleSheetsService";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCPF(cpf: string): string {
  const numericCpf = cpf.replace(/\D/g, '');
  return numericCpf
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

interface AddressInfo {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
}

interface PaymentMethodData {
  paymentMethod: "Pix" | "Crédito" | "Débito";
}

export function formatBudgetMessage(
  budgetItems: Budget[],
  addressInfo: AddressInfo | null,
  data: PaymentMethodData
): string {
  // --- CORREÇÃO APLICADA AQUI ---
  // Se a lista de itens estiver vazia, retorna uma mensagem padrão ou de erro.
  if (budgetItems.length === 0) {
    return "Não há itens no orçamento para formatar.";
  }

  let message = `\n\n📋 *Orçamento*\n\n`;

  if (addressInfo) {
    message += `🏠 *Endereço de Entrega:*\n`;
    message += `${addressInfo.street || "Não informado"}, ${
      addressInfo.number || "S/N"
    }\n`;
    message += `${addressInfo.neighborhood || "Não informado"}\n`;
    message += `${addressInfo.city || "Não informado"} - ${
      addressInfo.state || "Não informado"
    }\n`;
    message += `CEP: ${addressInfo.cep || "Não informado"}\n\n`;
  }

  message += `🛍️ *Itens do Orçamento:*\n`;

  let totalGeral = 0;
  budgetItems.forEach((item, index) => {
    message += `\n*${index + 1}. ${item.productName}*\n`;
    message += `Quantidade: ${item.quantity}\n`;
    message += `Preço Unitário: R$ ${item.price.toFixed(2)}\n`;

    const descontoValor = item.price * (item.discount / 100);

    message += `Desconto: ${item.discount}% (R$ ${descontoValor.toFixed(2)})\n`;
    message += `Subtotal: R$ ${item.total.toFixed(2)}\n`;

    totalGeral += item.total;
  });

  message += `\n💰 *Resumo:*\n`;
  message += `Total Geral: R$ ${totalGeral.toFixed(2)}\n`;
  message += `Método de Pagamento: ${data.paymentMethod}\n`;
  
  // A verificação no início da função garante que budgetItems[0] sempre existirá aqui.
  message += `Entrega: ${
    budgetItems[0].hasDelivery === true ? "Com Entrega" : "Sem Entrega"
  }`;

  return message;
}