import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Trash2 } from "lucide-react";
import { TableActionButton } from "./table-action-button";

const isDisabled = (html: string) => /\sdisabled=""/.test(html);
const spinnerCount = (html: string) => html.match(/animate-spin/g)?.length ?? 0;

describe("TableActionButton loading", () => {
  it("swaps the icon for a single spinner and blocks re-entry", () => {
    const html = renderToStaticMarkup(
      <TableActionButton icon={Trash2} label="Delete order" iconOnly loading />,
    );
    expect(isDisabled(html)).toBe(true);
    expect(html).toContain('aria-busy="true"');
    // exactly one spinner — the row icon is replaced, not accompanied
    expect(spinnerCount(html)).toBe(1);
    expect(html).toContain('aria-label="Delete order"');
  });

  it("renders its icon and stays enabled when idle", () => {
    const html = renderToStaticMarkup(
      <TableActionButton icon={Trash2} label="Delete order" iconOnly />,
    );
    expect(isDisabled(html)).toBe(false);
    expect(html).not.toContain("aria-busy");
    expect(spinnerCount(html)).toBe(0);
  });

  it("keeps the label visible while loading when not icon-only", () => {
    const html = renderToStaticMarkup(
      <TableActionButton icon={Trash2} label="Void" loading />,
    );
    expect(html).toContain("Void");
    expect(spinnerCount(html)).toBe(1);
  });

  it("honours an explicit disabled without claiming to be busy", () => {
    const html = renderToStaticMarkup(
      <TableActionButton icon={Trash2} label="Void" disabled />,
    );
    expect(isDisabled(html)).toBe(true);
    expect(html).not.toContain("aria-busy");
  });
});
