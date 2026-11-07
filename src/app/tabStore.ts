/**
 * This tab's sessionStorage, or nothing where the browser refuses it (blocked site data, some private windows, where even
 * reading `sessionStorage` throws): a read gives null and a write does nothing, never an error that stops the page.
 */
export const tabStore: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Refused: what it kept was a convenience for this tab.
    }
  },
  removeItem(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Refused, as above.
    }
  },
};
