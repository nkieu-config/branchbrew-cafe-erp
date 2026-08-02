"use client";

import { useState, useEffect, useMemo } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/domains/useSettingsQueries";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { HubListPage } from "@/components/shared/hub-list-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { parseVatRatePercent } from "@/lib/vat";
import { hubCtaClassName, statusInlineAlertClassName } from "@/lib/theme/hub-primitives";
import { settingsSectionLabelClassName } from "@/lib/theme/settings-form-section";
import { settingsSectionPanelClassName } from "@/lib/theme/settings-hub-chrome";
import { formFieldInsetClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { QueryLoadingPanel } from "@/components/shared/query-states";

const EMPTY_FORM: Record<string, string> = {
  companyName: "",
  taxId: "",
  vatRate: "7",
  currency: "THB",
  receiptFooter: "Thank you for visiting BranchBrew",
};

function settingsToForm(settings: Record<string, string | undefined>): Record<string, string> {
  return {
    companyName: settings.companyName || "",
    taxId: settings.taxId || "",
    vatRate: settings.vatRate || "7",
    currency: settings.currency || "THB",
    receiptFooter: settings.receiptFooter || "Thank you for visiting BranchBrew",
  };
}

export default function SettingsPageClient() {
  const { data: settings, isLoading, isError, error, refetch, isFetching } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  const [formData, setFormData] = useState<Record<string, string>>(EMPTY_FORM);
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, string>>(EMPTY_FORM);

  useEffect(() => {
    if (settings) {
      const next = settingsToForm(settings);
      setFormData(next);
      setSavedSnapshot(next);
    }
  }, [settings]);

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(savedSnapshot),
    [formData, savedSnapshot],
  );

  useUnsavedChangesGuard(isDirty);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const vatRate = parseVatRatePercent(formData.vatRate);
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      toast.error("VAT rate must be between 0 and 100");
      return;
    }
    if (!formData.currency.trim()) {
      toast.error("Default currency is required");
      return;
    }

    updateSettingsMutation.mutate(formData, {
      onSuccess: () => setSavedSnapshot(formData),
    });
  };

  return (
    <div className="space-y-4 max-w-2xl w-full mx-auto">
      <div className="flex justify-end">
        <Button
          className={hubCtaClassName("settings", "min-h-[44px]")}
          onClick={handleSave}
          disabled={isLoading || isError || updateSettingsMutation.isPending || !isDirty}
        >
          <Save className="w-4 h-4 mr-2" aria-hidden />
          {updateSettingsMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      {isDirty && (
        <div role="status" className={statusInlineAlertClassName("warning")}>
          Unsaved changes — save before leaving.
        </div>
      )}

      <div className={settingsSectionPanelClassName()}>
        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load settings.") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        {isLoading ? (
          <QueryLoadingPanel message="Loading settings" minHeightClassName="h-48" />
        ) : !isError ? (
          <div className="space-y-8">
            <section>
              <h2 className={settingsSectionLabelClassName()}>Company</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="settings-company-name" className={text.secondary}>
                    Company name
                  </Label>
                  <Input
                    id="settings-company-name"
                    value={formData.companyName}
                    onChange={(event) => handleChange("companyName", event.target.value)}
                    placeholder="e.g. BranchBrew Co., Ltd."
                    className={formFieldInsetClassName()}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-tax-id" className={text.secondary}>
                    Tax ID
                  </Label>
                  <Input
                    id="settings-tax-id"
                    value={formData.taxId}
                    onChange={(event) => handleChange("taxId", event.target.value)}
                    placeholder="13-digit tax ID"
                    className={formFieldInsetClassName()}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className={settingsSectionLabelClassName()}>Finance &amp; tax</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="settings-vat-rate" className={text.secondary}>
                    VAT rate (%)
                  </Label>
                  <Input
                    id="settings-vat-rate"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={formData.vatRate}
                    onChange={(event) => handleChange("vatRate", event.target.value)}
                    placeholder="e.g. 7"
                    className={formFieldInsetClassName()}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-currency" className={text.secondary}>
                    Default currency
                  </Label>
                  <Input
                    id="settings-currency"
                    value={formData.currency}
                    onChange={(event) => handleChange("currency", event.target.value)}
                    placeholder="e.g. THB"
                    className={formFieldInsetClassName()}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className={settingsSectionLabelClassName()}>POS</h2>
              <div className="space-y-2">
                <Label htmlFor="settings-receipt-footer" className={text.secondary}>
                  Receipt footer
                </Label>
                <Input
                  id="settings-receipt-footer"
                  value={formData.receiptFooter}
                  onChange={(event) => handleChange("receiptFooter", event.target.value)}
                  placeholder="e.g. Thank you for visiting BranchBrew"
                  className={formFieldInsetClassName()}
                />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
