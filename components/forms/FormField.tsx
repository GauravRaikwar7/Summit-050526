
import React from 'react';

interface FormFieldProps {
  label: string;
  id: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  options?: { value: string | number; label: string }[]; // For select
  rows?: number; // For textarea
  min?: string | number; // For number/date input
  step?: string | number; // For number input
  disabled?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error,
  options,
  rows,
  min,
  step,
  disabled = false,
}) => {
  // Ensure value is not NaN to avoid React console warning
  const safeValue = typeof value === 'number' && isNaN(value) ? '' : value;

  const commonProps = {
    id,
    name: id,
    value: safeValue,
    onChange,
    placeholder,
    required,
    disabled,
    className: `mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400
                focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
                disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
                ${error ? 'border-danger' : 'border-slate-600'}`,
  };

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {type === 'select' && options ? (
        <select {...commonProps}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea {...commonProps} rows={rows || 3}></textarea>
      ) : (
        <input type={type} {...commonProps} min={min} step={step} />
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
};

export default FormField;
    