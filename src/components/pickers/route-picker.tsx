"use client";

import { useTranslations } from "next-intl";
import { searchRoutes } from "@/features/routes/queries";
import type { components } from "@/lib/api/schema";
import { SearchPicker, type PickerFieldProps } from "./search-picker";

type RouteRef = components["schemas"]["RouteRef"];
type Option = { id: string; name: string };

type RoutePickerProps = Omit<PickerFieldProps<Option>, "value" | "onChange"> & {
  value: RouteRef | null;
  onChange: (route: RouteRef | null) => void;
  /**
   * Names a `search` other than the default (e.g. "running-public"): results are cached by the
   * search text under it, so two pickers with different searches never share them.
   */
  scope?: string;
};

/** Chooses a route from `routes_list` by the start of its code (SearchPicker), e.g. for requests. */
export function RoutePicker({
  value,
  onChange,
  search = searchRoutes,
  scope = "all",
  ...props
}: RoutePickerProps) {
  const t = useTranslations("RoutePicker");
  return (
    <SearchPicker
      {...props}
      value={value ? { id: value.id, name: value.code } : null}
      onChange={(option) =>
        onChange(option ? { id: option.id, code: option.name } : null)
      }
      search={search}
      queryKey={["routes", "picker", scope]}
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
