import { notFound } from "next/navigation";
import { MarketplaceClientPage } from "./worker-marketplace-client";

export default function MarketplacePage() {
  if (process.env.ENABLE_MARKETPLACE !== "1") {
    notFound();
  }

  return <MarketplaceClientPage />;
}
