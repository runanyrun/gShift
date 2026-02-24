import { notFound } from "next/navigation";
import { MyMarketplaceClientPage } from "./upcoming-client";

export default function MyMarketplacePage() {
  if (process.env.ENABLE_MARKETPLACE !== "1") {
    notFound();
  }

  return <MyMarketplaceClientPage />;
}
