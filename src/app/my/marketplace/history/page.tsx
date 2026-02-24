import { notFound } from "next/navigation";
import { MyMarketplaceHistoryClientPage } from "./history-client";

export default function MyMarketplaceHistoryPage() {
  if (process.env.ENABLE_MARKETPLACE !== "1") {
    notFound();
  }

  return <MyMarketplaceHistoryClientPage />;
}
