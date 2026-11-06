import { Link } from 'react-router-dom';
import {
  Button,
  Container,
  Group,
  Stack,
  Text,
  Title,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';

export function NotFoundPage() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  return (
    <Container size="xl" py={80}>
      <Stack align="center" gap="sm">
        <Title order={1} size={96} c={theme.colors.gray[colorScheme === 'dark' ? 7 : 3]}>
          404
        </Title>
        <Title order={3} c={colorScheme === 'dark' ? theme.white : theme.colors.dark[7]}>
          Page not found
        </Title>
        <Text ta="center" c={colorScheme === 'dark' ? theme.colors.gray[4] : theme.colors.dark[2]}>
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
