import * as React from "react";
import { Input } from "./input";

type DataTableToolbarProps = {
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
};

export function DataTableToolbar({
  searchValue = "",
  searchPlaceholder = "Search",
  onSearchChange,
  filters,
  actions,
}: DataTableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
        {onSearchChange ? (
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full md:max-w-sm"
          />
        ) : null}
        {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
