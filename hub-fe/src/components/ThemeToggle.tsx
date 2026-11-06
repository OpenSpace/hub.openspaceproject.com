import { IconMoon, IconSun } from '@tabler/icons-react';
import { ActionIcon, useMantineColorScheme } from '@mantine/core';

export function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <ActionIcon
      variant="light"
      onClick={() => toggleColorScheme()}
      aria-label="Toggle color scheme"
    >
      {colorScheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
    </ActionIcon>
  );
}
