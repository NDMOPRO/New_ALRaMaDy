// App constants
export const APP_NAME = "راصد البيانات";

/**
 * Get the login URL — local auth, no external OAuth.
 */
export function getLoginUrl(returnPath?: string): string {
  return "/login";
}
