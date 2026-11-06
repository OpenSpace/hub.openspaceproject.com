import { Link } from 'react-router-dom';
import {
  Button,
  Container,
  Divider,
  Grid,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';

interface ItemDetailProps {
  label: string;
  value: string | number;
  isBold?: boolean;
  link?: string;
}

function ItemDetail({ label, value, isBold = true, link }: ItemDetailProps) {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  return (
    <Stack align="center" justify="center" gap="xs">
      <Text
        fw={isBold ? 700 : 500}
        size="sm"
        c={colorScheme === 'dark' ? theme.colors.gray[3] : theme.colors.dark[1]}
      >
        {label}
      </Text>
      <Text size="xs" c={colorScheme === 'dark' ? theme.colors.gray[4] : theme.colors.dark[6]}>
        {link ? <Link to={link}>{value}</Link> : value}
      </Text>
    </Stack>
  );
}

export default ItemDetail;
