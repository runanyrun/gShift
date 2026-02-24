import { notFound } from "next/navigation";
import { MarketplaceManageClientPage } from "./manage-client";

export default function MarketplaceManagePage() {
  if (process.env.ENABLE_MARKETPLACE !== "1") {
    notFound();
  }

  return <MarketplaceManageClientPage />;
}
