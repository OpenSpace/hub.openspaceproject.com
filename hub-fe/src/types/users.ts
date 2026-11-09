import type { User } from '@payload-types';

export type { Media, User } from '@payload-types';

// How other docs show a user, e.g. an item's author in item cards or the users from /favorite
export type UserRef = Pick<User, 'id' | 'username'>;
