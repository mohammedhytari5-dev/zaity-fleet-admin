export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Open the first-party username/password login screen.
export const startLogin = () => {
  window.location.href = "/login";
};
