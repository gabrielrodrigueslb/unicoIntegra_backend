import { Controller, UseFormReturn } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PaymentMethodSchema } from "@/zod";

interface NativeSelectProps {
  form: UseFormReturn<PaymentMethodSchema>;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export function NativeSelect({
  form,
  options,
  placeholder = "Selecione uma opção",
  className,
}: NativeSelectProps) {
  const {
    control,
    formState: { errors },
  } = form;

  return (
    <div className="relative w-full">
      <Controller
        name="paymentMethod"
        control={control}
        render={({ field }) => (
          <>
            <div className="relative">
              <select
                {...field}
                className={cn(
                  `w-full h-9 appearance-none 
                  rounded-md border border-zinc-400 bg-zinc-300 px-3 py-2 
                  text-sm shadow-sm text-zinc-800
                  focus:outline-none focus:ring-1 focus:ring-ring
                  disabled:cursor-not-allowed disabled:opacity-50`,
                  className
                )}
              >
                <option value="" disabled hidden>
                  {placeholder}
                </option>
                {options.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-popover text-popover-foreground"
                  >
                    {option.label}
                  </option>
                ))}
              </select>

              <div
                className="pointer-events-none 
                absolute inset-y-0 right-0 
                flex items-center pr-3 
                text-gray-400"
              >
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>

            {errors.paymentMethod && (
              <p className="text-red-500 text-sm mt-1">
                {errors.paymentMethod.message}
              </p>
            )}
          </>
        )}
      />
    </div>
  );
}
