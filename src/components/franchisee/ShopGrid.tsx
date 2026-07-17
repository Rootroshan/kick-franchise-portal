"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { useCart } from "@/components/franchisee/CartContext";

type Variant = {
  variantId: string;
  name: string;
  priceCents: number;
  currency: string;
  inStock: boolean;
};

type Product = {
  productId: string;
  productName: string;
  variants: Variant[];
};

export function ShopGrid({ products }: { products: Product[] }) {
  const { addItem, items } = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const cartCount = items.reduce((sum, i) => sum + i.qty, 0);

  function handleAdd(product: Product, variant: Variant) {
    addItem({ variantId: variant.variantId, productName: product.productName, variantName: variant.name, priceCents: variant.priceCents });
    setJustAdded(variant.variantId);
    setTimeout(() => setJustAdded(null), 1200);
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/cart"
        className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
      >
        <span className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" /> View cart
        </span>
        <span className="font-medium">{cartCount} item{cartCount === 1 ? "" : "s"}</span>
      </Link>

      {products.length === 0 && <p className="text-sm text-muted-foreground">No products available.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {products.map((product) => (
          <Card key={product.productId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <Link href={`/shop/${product.productId}`} className="hover:underline">{product.productName}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {product.variants.map((variant) => (
                <div key={variant.variantId} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{variant.name}</p>
                    <p className="text-sm text-muted-foreground">{formatCents(variant.priceCents, variant.currency)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={justAdded === variant.variantId ? "secondary" : "default"}
                    disabled={!variant.inStock}
                    onClick={() => handleAdd(product, variant)}
                  >
                    {!variant.inStock ? "Out of stock" : justAdded === variant.variantId ? "Added" : "Add"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
