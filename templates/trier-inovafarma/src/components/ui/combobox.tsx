import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  type ProductInfo,
  getEffectiveProductPrice,
} from '@/services/googleSheetsService';
import { getProductsFromCache } from '@/cache/productCache';
import { eventBus } from '@/lib/event-bus';

interface ComboboxProps {
  onProductSelect: (product: ProductInfo | null) => void;
}

function parseLooseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;

  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;

  const normalized = trimmed
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  return Number(normalized);
}

function hasPositiveStock(product: ProductInfo): boolean {
  const stock = parseLooseNumber(product.quantidadeEstoque);

  if (Number.isNaN(stock)) return true;

  return stock > 0;
}

function getDisplayPrice(product: ProductInfo): number {
  const effective = getEffectiveProductPrice(product);
  if (effective > 0) return effective;

  const base = parseLooseNumber(product.valorVenda);
  if (!Number.isNaN(base) && base > 0) return base;

  return 0;
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
}

function getPriceSourceLabel(product: ProductInfo): string {
  if (product.origemPreco === 'encarte') return 'Encarte';
  if (product.origemPreco === 'melhor') return 'Melhor';
  if (product.origemPreco === 'promocao') return 'Promocao';
  if (product.origemPreco === 'venda_desconto') return 'Venda c/ desc';
  return 'Venda';
}

export function Combobox({ onProductSelect }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [allProducts, setAllProducts] = useState<ProductInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        setIsLoading(true);
        const products = await getProductsFromCache();
        if (isMounted) {
          setAllProducts(products);
        }
      } catch (error) {
        console.error('Erro ao carregar produtos para o combobox:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    const handleProductsUpdated = () => {
      loadProducts();
    };

    loadProducts();
    eventBus.on('products:updated', handleProductsUpdated);

    return () => {
      isMounted = false;
      eventBus.off('products:updated', handleProductsUpdated);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) {
      return allProducts.filter(hasPositiveStock).slice(0, 50);
    }

    const lowerSearch = searchTerm.toLowerCase();

    const filtered = allProducts.filter((product) => {
      if (!hasPositiveStock(product)) return false;
      const nomeMatch = product.nome.toLowerCase().includes(lowerSearch);
      const barrasMatch = String(product.codigoBarras || '').includes(lowerSearch);
      return nomeMatch || barrasMatch;
    });

    return filtered.slice(0, 50);
  }, [allProducts, searchTerm]);

  const handleSelect = (product: ProductInfo) => {
    if (selectedCode === product.codigo) {
      setSelectedCode(null);
      onProductSelect(null);
    } else {
      setSelectedCode(product.codigo);
      onProductSelect(product);
    }
    setOpen(false);
  };

  const selectedProduct = allProducts.find((p) => p.codigo === selectedCode);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedProduct
            ? selectedProduct.nome
            : 'Selecione ou busque (Nome/EAN)...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome ou codigo de barras..."
            onValueChange={setSearchTerm}
            value={searchTerm}
          />
          <CommandList>
            {isLoading && (
              <CommandEmpty>Carregando lista de produtos...</CommandEmpty>
            )}

            {!isLoading && filteredProducts.length === 0 && (
              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            )}

            <CommandGroup>
              {filteredProducts.map((product) => {
                const basePrice = parseLooseNumber(product.valorVenda);
                const displayPrice = getDisplayPrice(product);
                const hasDiscount =
                  Number.isFinite(basePrice) &&
                  basePrice > 0 &&
                  displayPrice > 0 &&
                  displayPrice < basePrice;

                return (
                  <CommandItem
                    key={product.codigo}
                    value={product.codigo.toString()}
                    onSelect={() => handleSelect(product)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedCode === product.codigo
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    <div className="flex flex-col w-full overflow-hidden">
                      <span className="truncate font-medium">{product.nome}</span>
                      <span className="text-xs text-muted-foreground flex gap-2 items-center">
                        <span>EAN: {product.codigoBarras || '-'}</span>
                        <span>Base: R$ {formatCurrency(basePrice)}</span>
                        {hasDiscount ? (
                          <>
                            <span>{getPriceSourceLabel(product)}</span>
                            <span className="font-semibold text-green-600">
                              R$ {formatCurrency(displayPrice)}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold">R$ {formatCurrency(displayPrice)}</span>
                        )}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
