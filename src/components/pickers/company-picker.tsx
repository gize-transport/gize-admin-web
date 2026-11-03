"use client";

import { useTranslations } from "next-intl";
import { searchCompanies } from "@/features/companies/queries";
import type { components } from "@/lib/api/schema";
import { SearchPicker, type PickerFieldProps } from "./search-picker";

type CompanyRef = components["schemas"]["CompanyRef"];

/**
 * Chooses a company from `companies_list` by the start of its name (SearchPicker). Only active
 * companies are offered (e.g. for a corporate route), unless `includeInactive` (a list filter:
 * an inactive company's routes still exist).
 */
export function CompanyPicker({
  includeInactive = false,
  search,
  ...props
}: PickerFieldProps<CompanyRef> & { includeInactive?: boolean }) {
  const t = useTranslations("CompanyPicker");
  return (
    <SearchPicker
      {...props}
      search={
        search ?? ((q) => searchCompanies(q, { activeOnly: !includeInactive }))
      }
      queryKey={["companies", "picker", includeInactive ? "all" : "active"]}
      labels={{
        placeholder: t("placeholder"),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder"),
        listLabel: t("listLabel"),
        loading: t("loading"),
        noResults: t(includeInactive ? "noResultsAny" : "noResults"),
        moreHint: t("moreHint"),
        clear: (name) => t("clear", { name }),
      }}
    />
  );
}
