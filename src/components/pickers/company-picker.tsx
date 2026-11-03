"use client";

import { useTranslations } from "next-intl";
import { searchActiveCompanies } from "@/features/companies/queries";
import type { components } from "@/lib/api/schema";
import { SearchPicker, type PickerFieldProps } from "./search-picker";

type CompanyRef = components["schemas"]["CompanyRef"];

/**
 * Chooses an active company from `companies_list` by the start of its name (SearchPicker), e.g.
 * for a corporate route. Inactive companies aren't offered.
 */
export function CompanyPicker({
  search = searchActiveCompanies,
  ...props
}: PickerFieldProps<CompanyRef>) {
  const t = useTranslations("CompanyPicker");
  return (
    <SearchPicker
      {...props}
      search={search}
      queryKey={["companies", "picker"]}
      labels={{
        placeholder: t("placeholder"),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder"),
        listLabel: t("listLabel"),
        loading: t("loading"),
        noResults: t("noResults"),
        moreHint: t("moreHint"),
        clear: (name) => t("clear", { name }),
      }}
    />
  );
}
