import type { CSSProperties } from 'react';
import { Tag } from '@/types/items';

// Tags are a dark tint of one color with text and a thin border in that color: teal for the
// type, violet for the version, amber for the license, gray for the rest. Each is a
// [tint, text, border] triple of light-dark() values so they follow the color scheme
const tagPalettes: Record<string, [string, string, string]> = {
  itemType: [
    'light-dark(rgba(255, 255, 0, 0.12), #005560)',
    'light-dark(#0f766e, #d0f4ea)',
    'light-dark(rgba(15, 118, 110, 0.4), #22b3c4)',
  ],
  openspaceVersion: [
    'light-dark(rgba(124, 92, 230, 0.12), #4a1fb8)',
    'light-dark(#5b3fd0, #e6deff)',
    'light-dark(rgba(91, 63, 208, 0.4), #8466f2)',
  ],
  license: [
    'light-dark(rgba(217, 119, 6, 0.12), #6a4000)',
    'light-dark(#a16207, #e8fbc2)',
    'light-dark(rgba(161, 98, 7, 0.4), #c98a1a)',
  ],
  custom: [
    'light-dark(rgba(100, 116, 139, 0.12), rgba(148, 163, 184, 0.35))',
    'light-dark(#475569, #cbd5e1)',
    'light-dark(rgba(71, 85, 105, 0.4), rgba(148, 163, 184, 0.3))',
  ],
};

// Style for a tag's Badge, e.g. <Badge style={getTagStyle(tag.type)}>
export const getTagStyle = (type: Tag['type']): CSSProperties => {
  const [background, color, border] = tagPalettes[type] ?? tagPalettes.custom;
  return {
    backgroundColor: background,
    color,
    border: `1px solid ${border}`,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontWeight: 400,
    textTransform: 'none',
  };
};

// Type first, then version, then license, then everything else (each group keeps its order)
const tagTypeOrder = ['itemType', 'openspaceVersion', 'license'];

export const sortTags = <T extends { type: Tag['type'] }>(tags: T[]): T[] => {
  const rank = (tag: T) => {
    const index = tagTypeOrder.indexOf(tag.type);
    return index === -1 ? tagTypeOrder.length : index;
  };
  return [...tags].sort((a, b) => rank(a) - rank(b));
};

// Pretty labels for item types - the CMS site-config only stores the raw
// type value, so this is the one place that maps it to display text.
export const ITEM_TYPE_LABELS: Record<string, string> = {
  asset: 'Asset',
  profile: 'Profile',
  recording: 'Recording',
  webpanel: 'Web Panel',
  config: 'Config',
  package: 'Package',
  showcomposer: 'ShowComposer Panel',
};

// The text shown on a tag: item types get their pretty label, the rest show their name as is
export const getTagDisplayName = (tag: { name: string; type: Tag['type'] }) =>
  tag.type === 'itemType'
    ? (ITEM_TYPE_LABELS[tag.name] ?? tag.name.charAt(0).toUpperCase() + tag.name.slice(1))
    : tag.name;

export const getTagLabel = (type: Tag['type']) => {
  switch (type) {
    case 'openspaceVersion':
      return 'OpenSpace Version';
    case 'license':
      return 'License';
    case 'itemType':
      return 'Type';
    case 'custom':
      return 'Custom';
    default:
      return 'Other';
  }
};
