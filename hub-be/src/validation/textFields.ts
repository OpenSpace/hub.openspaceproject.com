import type { Validate } from 'payload'

// hub-fe/src/utils/fieldLimits.ts and scripts/migration/0-limit-field-lengths.js use the same rules
export const TITLE_MAX_LENGTH = 200
export const DESCRIPTION_MAX_LENGTH = 5000
export const NAME_MAX_LENGTH = 100
export const USERNAME_MAX_LENGTH = 40
export const LINK_MAX_LENGTH = 500

// Lowercase so "Jane" and "jane" can't be two different users
const USERNAME_PATTERN = /^[a-z0-9_](?:[a-z0-9._-]*[a-z0-9_])?$/
// Only web links, so a profile link can never be e.g. `javascript:` or `data:`
const LINK_PATTERN = /^https?:\/\/[^\s/?#]+[^\s]*$/i

export const validateUsername: Validate<string | null | undefined> = (value) => {
  if (!value) {
    return 'This field is required.'
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return `Usernames can be at most ${USERNAME_MAX_LENGTH} characters long.`
  }
  if (!USERNAME_PATTERN.test(value)) {
    return 'Usernames can only use lowercase letters, digits, ".", "_" and "-", and cannot start or end with "." or "-".'
  }
  return true
}

export const validateLink: Validate<string | null | undefined> = (value) => {
  if (!value) {
    return true
  }
  if (value.length > LINK_MAX_LENGTH) {
    return `Links can be at most ${LINK_MAX_LENGTH} characters long.`
  }
  if (!LINK_PATTERN.test(value)) {
    return 'Links must be full web addresses starting with http:// or https://.'
  }
  return true
}
