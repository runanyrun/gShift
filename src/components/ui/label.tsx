import * as React from "react";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className = "", ...props }, ref) {
    return (
      <label
        ref={ref}
        className={`block text-sm font-medium text-slate-700 ${className}`.trim()}
        {...props}
      />
    );
  },
);
