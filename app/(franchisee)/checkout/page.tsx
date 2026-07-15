import { CheckoutFlow } from "@/components/franchisee/CheckoutFlow";

export default function CheckoutPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Checkout</h1>
      <CheckoutFlow />
    </div>
  );
}
