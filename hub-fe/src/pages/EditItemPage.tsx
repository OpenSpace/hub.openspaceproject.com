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

  const { payloadUser } = useAuth();
  const userId = payloadUser?.id;
  const isAdmin = Boolean(payloadUser?.role?.includes('admin'));
  useEffect(() => {
    if (!id || !userId) {
      return;
    }
    const fetchItem = async () => {
      try {
        const item = await makeRequest<Item>(`/api/items/${id}`);
        if (!isAdmin && item.author?.id !== userId) {
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
        setItem(item);
        setError(null);
      } catch (err) {
        console.error('Error fetching item:', err);
        setError('Failed to load item data');
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [id, userId, isAdmin, makeRequest, navigate]);

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
