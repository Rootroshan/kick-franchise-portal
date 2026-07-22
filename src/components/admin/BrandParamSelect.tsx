"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";

/**
 * KICK_ADMIN brand picker that drives a `?brand=<tenantId>` URL param, so the
 * server page can load that brand's stores — the store multi-select must only
 * ever contain stores of the chosen brand.
 */
export function BrandParamSelect({ brands, value }: { brands: Array<{ id: string; name: string }>; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        Brand <span className="text-status-error">*</span>
      </span>
      <span className="relative sm:max-w-xs">
        <Select
          aria-label="Brand"
          value={value}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) params.set("brand", e.target.value);
            else params.delete("brand");
            start(() => router.replace(`${pathname}?${params.toString()}`));
          }}
          className="h-10 w-full"
        >
          <option value="">Select a brand…</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        {pending && <Loader2 className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </span>
    </label>
  );
}
