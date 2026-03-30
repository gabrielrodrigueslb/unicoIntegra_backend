import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { InputLabel } from '@/components/input-label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BudgetItem } from '../context/BudgetContext';
import { useBudget } from '@/hooks/use-budget';
import { productSchema, type ProductFormData } from '@/zod';
import {
  ProductInfo,
  getEffectiveProductPrice,
} from '@/services/googleSheetsService';

export function BudgetForm() {
  const navigate = useNavigate();
  const { budgetItems, setBudgetItems, hasDelivery, setHasDelivery } =
    useBudget();
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      quantity: 1,
      discount: 0,
    },
  });

  const handleProductSelect = useCallback((product: ProductInfo | null) => {
    setSelectedProduct(product);
  }, []);

  const addProductToBudget = (formData: ProductFormData) => {
    if (!selectedProduct) {
      return;
    }

    const productPrice = Number(getEffectiveProductPrice(selectedProduct).toFixed(2));
    const totalPrice = productPrice * formData.quantity;
    const discountAmount = totalPrice * (formData.discount / 100);
    const finalPrice = Number((totalPrice - discountAmount).toFixed(2));

    const newBudgetItem: BudgetItem = {
      id: uuidv4(),
      product: {
        code: selectedProduct.codigo,
        name: selectedProduct.nome,
        price: productPrice,
        quantity: formData.quantity,
        discount: formData.discount,
      },
      total: finalPrice,
    };

    setBudgetItems((prevItems) => [...prevItems, newBudgetItem]);

    setSelectedProduct(null);
    reset({
      quantity: 1,
      discount: 0,
    });
  };

  const removeItem = (id: string) => {
    setBudgetItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const handleNext = async () => {
    if (hasDelivery) {
      navigate('/address');
    } else {
      navigate('/chats');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <form
        onSubmit={handleSubmit(addProductToBudget)}
        className="p-4 rounded-lg"
      >
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-5 flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-zinc-200">
              Produto
              <span className="text-red-400 ml-1">*</span>
            </Label>
            <Combobox onProductSelect={handleProductSelect} />
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <InputLabel
              label="Quantidade"
              type="number"
              required
              register={register('quantity', { valueAsNumber: true })}
              error={errors.quantity?.message}
            />
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <InputLabel
              label="Desconto (%)"
              type="number"
              placeholder="0"
              step="any"
              register={register('discount', { valueAsNumber: true })}
              error={errors.discount?.message}
            />
          </div>

          <div className="flex items-end justify-center mt-2">
            <Button type="submit" className="h-8" disabled={!selectedProduct}>
              <Plus className="text-black" />
            </Button>
          </div>
        </div>
      </form>

      <hr className="border-zinc-700" />

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-zinc-200">Orçamento</h2>
        <div className="bg-zinc-800 w-full rounded-lg p-4 h-[16rem] max-h-[16rem] overflow-y-auto">
          {budgetItems.length === 0 ? (
            <div className="text-zinc-400 text-center py-8">
              Nenhum item adicionado ao orçamento
            </div>
          ) : (
            <div className="space-y-4">
              {budgetItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-zinc-700 rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{item.product.name}</h3>
                    <p className="text-sm text-zinc-300">
                      Valor: R${item.product.price} | Quantidade:{' '}
                      {item.product.quantity} | Desconto:{' '}
                      {item.product.discount}%
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-zinc-700">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="delivery"
            checked={hasDelivery}
            onCheckedChange={(checked) => setHasDelivery(checked as boolean)}
            className="border-zinc-400"
          />
          <Label htmlFor="delivery" className="text-zinc-200 text-base">
            Delivery
          </Label>
        </div>

        <Button disabled={budgetItems.length === 0} onClick={handleNext}>
          Próximo
        </Button>
      </div>
    </div>
  );
}
