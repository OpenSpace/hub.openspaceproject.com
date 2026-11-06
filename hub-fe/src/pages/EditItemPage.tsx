import { useEffect, useState } from 'react';
import { IconLock } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { ItemForm } from '../components/ItemForm';
import { useAuthenticatedRequest } from '../hooks/useAuthenticatedRequest';
import { Item } from '../types/items';

export function EditItemPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedRequest();
  const navigate = useNavigate();

  const { user, payloadUser } = useAuth();
  useEffect(() => {
    const fetchItem = async () => {
      try {
        // const data = await makeRequest(`/api/items/${id}`);
        const data = await fetch(`${import.meta.env.VITE_PAYLOAD_API_URL}/api/items/${id}`);
        const item = await data.json();
        setItem(item);
        setError(null);
        // Check if user is logged in
        if (!user || !payloadUser) {
          notifications.show({
            title: 'Authentication Required',
            message: 'You must be logged in to edit items',
            color: 'red',
            icon: <IconLock />,
            autoClose: 5000,
          });
          navigate(`/items/${id}`);
          return;
        }

        // Check if user is the author of the item
        if (item.author.id !== payloadUser.id) {
          notifications.show({
            title: 'Permission Denied',
            message: 'You can only edit items that you created',
            color: 'red',
            icon: <IconLock />,
            autoClose: 5000,
          });
          navigate(`/items/${id}`);
          return;
        }
      } catch (err) {
        console.error('Error fetching item:', err);
        setError('Failed to load item data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchItem();
    }
  }, [id, makeRequest]);

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Text>Loading item data...</Text>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="md" py="xl">
        <Text color="red">{error}</Text>
      </Container>
    );
  }

  if (!item) {
    return (
      <Container size="md" py="xl">
        <Text>Item not found</Text>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <ItemForm item={item} isEdit={true} />
    </Container>
  );
}
