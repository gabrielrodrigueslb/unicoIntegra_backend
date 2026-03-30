import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface InputLabelProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  placeholder?: string;
  disable?: boolean;
  required?: boolean;
  register?: UseFormRegisterReturn;
  error?: string;
}

export function InputLabel({
  label,
  placeholder,
  disable = false,
  required = false,
  register,
  error,
  ...props
}: InputLabelProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-white">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </Label>
      <Input
        placeholder={placeholder}
        disabled={disable}
        {...register}
        {...props}
      />
      {error && <span className="text-red-400 text-sm">{error}</span>}
    </div>
  );
}
