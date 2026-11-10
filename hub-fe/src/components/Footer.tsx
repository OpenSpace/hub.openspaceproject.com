import { Link } from 'react-router-dom';
import { Anchor, Container, Group, Stack, Text } from '@mantine/core';

const Footer = () => {
  return (
    <Container size="xl" py="xl" style={{ borderTop: '1px solid var(--hub-color-border)' }}>
      <Group gap="xl">
        <Group justify="flex-start" style={{ flex: 1 }}>
          <Stack gap="xs">
            <Text size="sm" fw={500} c="var(--hub-color-heading)">
              OpenSpace Hub
            </Text>
            <Text size="xs" c="var(--hub-color-dimmed)">
              The community platform for OpenSpace assets and resources
            </Text>
          </Stack>
        </Group>

        <Group justify="flex-end" style={{ flex: 1 }}>
          <Text size="xs" c="var(--hub-color-dimmed)">
            © {new Date().getFullYear()} OpenSpace Team. All rights reserved.
          </Text>
          <Anchor component={Link} to="/privacy" size="xs">
            Privacy
          </Anchor>
        </Group>

      </Group>
    </Container>
  );
};

export default Footer;
