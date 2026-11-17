"use client";

import { useTranslations } from "next-intl";
import { searchDrivers, type DriverOption } from "@/features/drivers/queries";
import { SearchPicker, type PickerFieldProps } from "./search-picker";

/**
 * Chooses an active driver from `drivers_list` by the start of their name or plate
 * (SearchPicker), shown as "Name · Plate". Only active drivers can drive a route.
 */
export function DriverPicker({
  search,
  ...props
}: PickerFieldProps<DriverOption>) {
  const t = useTranslations("DriverPicker");
  return (
    <SearchPicker
      {...props}
      search={search ?? searchDrivers}
      queryKey={["drivers", "picker"]}
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
