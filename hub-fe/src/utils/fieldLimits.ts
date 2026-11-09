// Same limits as the backend (hub-be/src/validation/textFields.ts)
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 5000;
export const USERNAME_MAX_LENGTH = 40;
export const LINK_MAX_LENGTH = 500;

const USERNAME_PATTERN = /^[a-z0-9_](?:[a-z0-9._-]*[a-z0-9_])?$/;
const LINK_PATTERN = /^https?:\/\/[^\s/?#]+[^\s]*$/i;

export const usernameError = (value: string) => {
  if (!value) {
    return 'Username is required';
  }
  if (!USERNAME_PATTERN.test(value)) {
    return 'Use lowercase letters, digits, ".", "_" and "-", not starting or ending with "." or "-"';
  }
  return null;
};

export const linkError = (value: string) =>
  !value || LINK_PATTERN.test(value)
    ? null
    : 'Enter a full web address starting with http:// or https://';
