"use client";

import { useRouter } from "next/navigation";
import { CompanyDetail } from "./company-detail";

/** A company's own page (`/companies/[id]`): after a delete it goes back to the list. */
export function CompanyPage({ companyId }: { companyId: string }) {
  const router = useRouter();
  return (
    <CompanyDetail
      companyId={companyId}
      variant="page"
      onDeleted={() => router.push("/companies")}
    />
  );
}
