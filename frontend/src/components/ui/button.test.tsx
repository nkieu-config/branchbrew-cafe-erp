import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./button";
import { ButtonLink } from "./button-link";

const isDisabled = (html: string) => /\sdisabled=""/.test(html);

describe("Button loading", () => {
  it("renders spinner, disables itself and sets aria-busy", () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>);
    expect(isDisabled(html)).toBe(true);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("animate-spin");
    expect(html).toContain("Save");
  });

  it("is unchanged when loading is not passed", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(isDisabled(html)).toBe(false);
    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain("animate-spin");
    expect(html).toContain("Save");
  });

  it("keeps an explicit disabled button disabled", () => {
    const html = renderToStaticMarkup(<Button disabled>Save</Button>);
    expect(isDisabled(html)).toBe(true);
    expect(html).not.toContain("aria-busy");
  });

  it("still forwards children through the render prop", () => {
    const html = renderToStaticMarkup(<ButtonLink href="/pos">Terminal</ButtonLink>);
    expect(html).toContain("Terminal");
    expect(html).toContain('href="/pos"');
  });
});
