import { Container } from '@mantine/core';
import { ItemForm } from '../components/ItemForm';

export function NewItemPage() {
  return (
    <Container size="md" py="xl">
      <ItemForm />
    </Container>
  );
}
