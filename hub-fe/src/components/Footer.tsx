import { IconBrandGithub, IconBrandSlack } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import {
  Anchor,
  Container,
  Group,
  Stack,
  Text,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { ThemeToggle } from './ThemeToggle';

const Footer = () => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  return (
    <Container
      size="xl"
      py="xl"
      style={{
        borderTop: `1px solid ${colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]}`,
      }}
    >
      <Group gap="xl">
        <Group justify="flex-start" style={{ flex: 1 }}>
          <Stack gap="xs">
            <Text size="sm" fw={500} c={colorScheme === 'dark' ? theme.white : theme.colors.dark[7]}>
              OpenSpace Hub
            </Text>
            <Text size="xs" c={colorScheme === 'dark' ? theme.colors.gray[4] : theme.colors.dark[2]}>
              The community platform for OpenSpace assets and resources
            </Text>
          </Stack>
        </Group>

        <Group justify="flex-end" style={{ flex: 1 }}>
          <Text size="xs" c={colorScheme === 'dark' ? theme.colors.gray[4] : theme.colors.dark[2]}>
            © {new Date().getFullYear()} OpenSpace Team. All rights reserved.
          </Text>
          <Anchor component={Link} to="/privacy" size="xs" style={{color: colorScheme === 'dark' ? theme.colors.blue[4] : theme.colors.blue[6]}}>
            Privacy
          </Anchor>
          {/* <ThemeToggle /> */}
        </Group>

      </Group>
    </Container>
  );
};

export default Footer;
