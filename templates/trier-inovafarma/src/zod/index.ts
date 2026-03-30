import { z } from "zod";

export const addressSchema = z.object({
  cep: z.string().length(8, "CEP deve ter 8 dígitos"),
  street: z.string().min(1, "Obrigatório"),
  number: z.string().min(1, "Obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Obrigatório"),
  state: z.string().length(2, "Obrigatório"),
  city: z.string().min(1, "Obrigatório"),
  taxEntrega: z.string().min(4, "Taxa deve ser maior que 0 no formato EX: 0.00"),
});

export type AddressSchema = z.infer<typeof addressSchema>;

export const productSchema = z.object({
  quantity: z.number().min(1, "Quantidade deve ser maior que 0"),
  discount: z
    .number()
    .min(0, "Desconto não pode ser negativo")
    .max(100, "Desconto não pode ser maior que 100%")
    .nullish()
    .transform((val) => val ?? 0),
});

export type ProductFormData = z.infer<typeof productSchema>;

export const loginSchema = z.object({
  user: z.string().min(1, "Este campo é obrigatório"),
  password: z.string().min(1, "Este campo é obrigatório"),
});

export type LoginSchema = z.infer<typeof loginSchema>;

export const paymentMethodSchema = z.object({
  paymentMethod: z.enum(["Pix", "Crédito", "Débito"], {
    errorMap: () => ({ message: "Selecione uma forma de pagamento válida" }),
  }),

  cpfClient: z.string().min(14, "Por favor digite um CPF válido"),
});

export type PaymentMethodSchema = z.infer<typeof paymentMethodSchema>;
