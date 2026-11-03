"use client";

import { useTranslations } from "next-intl";
import { searchAreas } from "@/features/areas/queries";
import type { components } from "@/lib/api/schema";
import { SearchPicker, type PickerFieldProps } from "./search-picker";

type AreaRef = components["schemas"]["AreaRef"];

/** Chooses an area from `areas_list` by the start of its name (SearchPicker). */
export function AreaPicker({
  search = searchAreas,
  ...props
}: PickerFieldProps<AreaRef>) {
  const t = useTranslations("AreaPicker");
  return (
    <SearchPicker
      {...props}
      search={search}
      queryKey={["areas", "picker"]}
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
