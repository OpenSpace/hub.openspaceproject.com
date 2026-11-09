import {
  Icon,
  IconPencil,
  IconAdjustmentsHorizontal,
  IconBrowser,
  IconFile,
  IconVideo ,
  IconPackage,
  IconPhotoOff,
  IconPresentationAnalytics ,
} from '@tabler/icons-react';
import { Center } from '@mantine/core';

const ITEM_TYPE_ICONS: Record<string, Icon> = {
  asset: IconFile,
  profile: IconPresentationAnalytics ,
  recording: IconVideo,
  webpanel: IconBrowser,
  config: IconAdjustmentsHorizontal,
  showcomposer: IconPencil,
  package: IconPackage,
};

interface ItemTypePlaceholderProps {
  type: string;
  height: number | string;
  iconSize: number;
  radius?: number | string;
}

// Stand-in for an item's screenshot when none was uploaded: an icon for the item's type
export function ItemTypePlaceholder({ type, height, iconSize, radius }: ItemTypePlaceholderProps) {
  const TypeIcon = ITEM_TYPE_ICONS[type] ?? IconPhotoOff;

  return (
    <Center
      aria-label={`${type} item, no image`}
      style={{
        height,
        borderRadius: radius,
        backgroundColor: 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-6))',
      }}
    >
      <TypeIcon
        size={iconSize}
        stroke={1.25}
        style={{ color: 'light-dark(var(--mantine-color-gray-5), var(--mantine-color-gray-6))' }}
      />
    </Center>
  );
}
