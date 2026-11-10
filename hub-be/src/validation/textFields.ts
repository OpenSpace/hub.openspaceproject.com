import type { Validate } from 'payload'

// hub-fe/src/utils/fieldLimits.ts and scripts/migration/0-limit-field-lengths.js use the same rules
export const TITLE_MAX_LENGTH = 200
export const DESCRIPTION_MAX_LENGTH = 5000
export const NAME_MAX_LENGTH = 100
export const USERNAME_MAX_LENGTH = 40
export const LINK_MAX_LENGTH = 500

// Usernames are display names: they aren't used in URLs (profile routes use the id) and never
// to log in (that goes through Firebase), so almost any text is fine. What isn't allowed is
// characters that don't show up on screen - control characters, bidi overrides, zero-width
// spaces, unassigned code points - because two accounts could then look like the same person.
const INVISIBLE_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u
// Any whitespace other than a plain space: tabs, newlines, non-breaking and ideographic spaces
const ODD_SPACE_PATTERN = /[^\S ]/u
// Only web links, so a profile link can never be e.g. `javascript:` or `data:`
const LINK_PATTERN = /^https?:\/\/[^\s/?#]+[^\s]*$/i

// Uniqueness is checked against this stored copy (`usernameLower` on Users), so that "Jane" and
// "jane" can't be two different users. NFKC first, so that compatibility forms of the same
// letters ("Ｊane") fold onto the plain one instead of counting as a free name.
export const usernameKey = (value: string) => value.normalize('NFKC').toLowerCase()

export const validateUsername: Validate<string | null | undefined> = (value) => {
  if (!value) {
    return 'This field is required.'
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return `Usernames can be at most ${USERNAME_MAX_LENGTH} characters long.`
  }
  if (value !== value.trim()) {
    return 'Usernames cannot start or end with a space.'
  }
  if (INVISIBLE_PATTERN.test(value) || ODD_SPACE_PATTERN.test(value)) {
    return 'Usernames cannot contain invisible characters.'
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
