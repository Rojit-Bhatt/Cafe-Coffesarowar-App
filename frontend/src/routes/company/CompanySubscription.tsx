import { SubscriptionPanel } from "../../components/shared/SubscriptionPanel";

export default function CompanySubscription() {
  return (
    <SubscriptionPanel
      queryKey="companySubscription"
      fetchPath="/api/company/subscription"
      redeemPath="/api/company/subscription/redeem-key"
      role="company"
    />
  );
}
