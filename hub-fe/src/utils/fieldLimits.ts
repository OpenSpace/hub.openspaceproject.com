// Same limits as the backend (hub-be/src/validation/textFields.ts)
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 5000;
export const USERNAME_MAX_LENGTH = 40;
export const LINK_MAX_LENGTH = 500;

// Characters that don't show up on screen, so two accounts can't look like the same person:
// control characters, bidi overrides, zero-width spaces, unassigned code points, and any
// whitespace other than a plain space. Anything else is a valid username.
const INVISIBLE_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]|[^\S ]/u;
const LINK_PATTERN = /^https?:\/\/[^\s/?#]+[^\s]*$/i;

export const usernameError = (value: string) => {
  if (!value) {
    return 'Username is required';
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return `Use at most ${USERNAME_MAX_LENGTH} characters`;
  }
  if (INVISIBLE_PATTERN.test(value)) {
    return 'Remove the invisible characters from the username';
  }
  return null;
};

export const linkError = (value: string) =>
  !value || LINK_PATTERN.test(value)
    ? null
    : 'Enter a full web address starting with http:// or https://';
