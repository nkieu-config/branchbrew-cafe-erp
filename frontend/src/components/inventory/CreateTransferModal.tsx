"use client";

import type { Dispatch, SetStateAction } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { FormModal } from "@/components/shared/form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import {
  formFieldInsetClassName,
  formSelectContentClassName,
  formSourceBannerClassName,
} from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { Branch } from "@/types/api";
import type { CreateTransferForm } from "./stock-transfer-types";

type CreateTransferModalProps = {
  isOpen: boolean;
  onClose: () => void;
  branchId: number | undefined;
  branches: Branch[];
  destinationBranches: Branch[];
  ingredientOptions: { id: number; label: string }[];
  modalFormLoading: boolean;
  createForm: CreateTransferForm;
  setCreateForm: Dispatch<SetStateAction<CreateTransferForm>>;
  submitting: boolean;
  onSubmit: () => void | Promise<void>;
};

export function CreateTransferModal({
  isOpen,
  onClose,
  branchId,
  branches,
  destinationBranches,
  ingredientOptions,
  modalFormLoading,
  createForm,
  setCreateForm,
  submitting,
  onSubmit,
}: CreateTransferModalProps) {
  return (
    <FormModal
      busy={submitting}
      title="Request transfer"
      icon={ArrowRightLeft}
      isOpen={isOpen}
      onClose={onClose}
      width={520}
    >
      <div className="space-y-4">
        {!branchId && (
          <div className="space-y-2">
            <Label htmlFor="transfer-from-branch" className={text.secondary}>
              From branch (source)
            </Label>
            <Select
              value={createForm.fromBranchId === 0 ? "" : String(createForm.fromBranchId)}
              onValueChange={(value) => {
                if (value == null) return;
                setCreateForm((prev) => ({ ...prev, fromBranchId: Number(value) }));
              }}
              disabled={modalFormLoading}
            >
              <SelectTrigger
                id="transfer-from-branch"
                className={formFieldInsetClassName("h-11 w-full")}
              >
                <SelectValue
                  placeholder={modalFormLoading ? "Loading branches…" : "Select source branch"}
                />
              </SelectTrigger>
              <SelectContent className={formSelectContentClassName()}>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {branchId ? (
          <p className={cn(formSourceBannerClassName("border-0 px-0 py-0 bg-transparent"), text.muted)}>
            From{" "}
            <span className={text.primary}>
              {branches.find((b) => b.id === branchId)?.name ?? "selected branch"}
            </span>
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="transfer-to-branch" className={text.secondary}>
            To branch (destination)
          </Label>
          <Select
            value={createForm.toBranchId === 0 ? "" : String(createForm.toBranchId)}
            onValueChange={(value) => {
              if (value == null) return;
              setCreateForm((prev) => ({ ...prev, toBranchId: Number(value) }));
            }}
            disabled={modalFormLoading}
          >
            <SelectTrigger id="transfer-to-branch" className={formFieldInsetClassName("h-11 w-full")}>
              <SelectValue
                placeholder={modalFormLoading ? "Loading branches…" : "Select destination branch"}
              />
            </SelectTrigger>
            <SelectContent className={formSelectContentClassName()}>
              {destinationBranches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transfer-ingredient" className={text.secondary}>
            Ingredient
          </Label>
          <Select
            value={createForm.ingredientId === 0 ? "" : String(createForm.ingredientId)}
            onValueChange={(value) => {
              if (value == null) return;
              setCreateForm((prev) => ({ ...prev, ingredientId: Number(value) }));
            }}
            disabled={modalFormLoading}
          >
            <SelectTrigger id="transfer-ingredient" className={formFieldInsetClassName("h-11 w-full")}>
              <SelectValue
                placeholder={modalFormLoading ? "Loading ingredients…" : "Select ingredient"}
              />
            </SelectTrigger>
            <SelectContent className={formSelectContentClassName()}>
              {ingredientOptions.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transfer-quantity" className={text.secondary}>
            Quantity
          </Label>
          <Input
            id="transfer-quantity"
            type="number"
            min="0.1"
            step="0.1"
            className={formFieldInsetClassName("h-11")}
            value={createForm.quantity}
            disabled={modalFormLoading}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, quantity: e.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className={hubCtaClassName("inventory")}
            disabled={submitting || modalFormLoading}
            onClick={() => void onSubmit()}
          >
            {submitting ? (
              <>
                <Loader2
                  className="w-4 h-4 mr-2 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
                Requesting…
              </>
            ) : (
              "Request Transfer"
            )}
          </Button>
        </div>
      </div>
    </FormModal>
  );
}
