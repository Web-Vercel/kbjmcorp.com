// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import MobileNavigation from "@/components/MobileNavigation";
afterEach(cleanup);
it("opens localized navigation and closes after a destination is selected", async () => {
  render(<MobileNavigation locale="zh" />); const user = userEvent.setup();
  const toggle = screen.getByRole("button", { name: /菜单/ }); expect(toggle.getAttribute("aria-expanded")).toBe("false");
  await user.click(toggle); const link = screen.getByRole("link", { name: /常见问题/ });
  expect(link.getAttribute("href")).toBe("/zh#faq"); link.addEventListener("click", event => event.preventDefault()); await user.click(link);
  expect(toggle.getAttribute("aria-expanded")).toBe("false"); expect(screen.queryByRole("navigation")).toBeNull();
});
it("closes on Escape and returns keyboard focus to the toggle", async () => {
  render(<MobileNavigation locale="en" />); const user = userEvent.setup();
  const toggle = screen.getByRole("button", { name: /Menu/ }); await user.click(toggle);
  await user.tab(); await user.keyboard("{Escape}");
  expect(screen.queryByRole("navigation")).toBeNull(); expect(document.activeElement).toBe(toggle);
});
