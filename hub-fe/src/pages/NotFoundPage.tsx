import { Link } from 'react-router-dom';
import { Button, Container, Group, Stack, Text, Title } from '@mantine/core';

export function NotFoundPage() {
  return (
    <Container size="xl" py={80}>
      <Stack align="center" gap="sm">
        <Title
          order={1}
          size={96}
          c="light-dark(var(--mantine-color-gray-3), var(--mantine-color-gray-7))"
        >
          404
        </Title>
        <Title order={3} c="var(--hub-color-heading)">
          Page not found
        </Title>
        <Text ta="center" c="var(--hub-color-dimmed)">
          The page you're looking for doesn't exist or has been moved.
        </Text>
        <Group mt="sm">
          <Button component={Link} to="/">
            Go home
          </Button>
          <Button component={Link} to="/items" variant="default">
            Browse items
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
