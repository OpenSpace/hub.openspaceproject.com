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
} from '@mantine/core';

interface ItemDetailProps {
  label: string;
  value: string | number;
  isBold?: boolean;
  link?: string;
}

function ItemDetail({ label, value, isBold = true, link }: ItemDetailProps) {
  return (
    <Stack align="center" justify="center" gap="xs">
      <Text
        fw={isBold ? 700 : 500}
        size="sm"
        c="light-dark(var(--mantine-color-dark-1), var(--mantine-color-gray-3))"
      >
        {label}
      </Text>
      <Text size="xs" c="light-dark(var(--mantine-color-dark-6), var(--mantine-color-gray-4))">
        {link ? <Link to={link}>{value}</Link> : value}
      </Text>
    </Stack>
  );
}

export default ItemDetail;
