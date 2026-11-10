import { useEffect, useRef, useState } from 'react';
import { IconEdit } from '@tabler/icons-react';
import { stringify } from 'qs-esm';
import { useLocation, useParams } from 'react-router-dom';
import {
  Avatar,
  Button,
  Container,
  Grid,
  Group,
  Modal,
  Pagination,
  Paper,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { AccountData } from '../components/AccountData';
import Item from '../components/Item';
import { UserProfileForm } from '../components/UserProfileForm';
import { useAuth } from '../contexts/AuthContext';
import { Populated } from '../types/items';
import { User } from '../types/users';
import { apiFetch, apiUrl } from '../utils/api';
import { ItemCard, itemCardQuery } from '../utils/itemCardQuery';

const ITEMS_PER_PAGE = 12;

interface ItemCardsPage {
  docs: ItemCard[];
  totalDocs: number;
  totalPages: number;
}

// One page of item cards matching `where` (none while it's null), newest first. Sends the
// login token, so your own profile also lists your unpublished items
function useItemCardsPage(where: Record<string, unknown> | null, page: number) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ItemCardsPage | null>(null);
  const [error, setError] = useState(false);
  const whereKey = JSON.stringify(where);

  useEffect(() => {
    const parsedWhere = JSON.parse(whereKey);
    if (!parsedWhere || authLoading) {
      return;
    }
    let cancelled = false;
    const fetchPage = async () => {
      try {
        const query = stringify(
          { ...itemCardQuery, where: parsedWhere, sort: '-createdAt', limit: ITEMS_PER_PAGE, page },
          { addQueryPrefix: true }
        );
        const result = await apiFetch<ItemCardsPage>(`/api/items${query}`, { user });
        if (!cancelled) {
          setData(result);
          setError(false);
        }
      } catch (err) {
        console.error('Error fetching items:', err);
        if (!cancelled) {
          setError(true);
        }
      }
    };
    fetchPage();
    return () => {
      cancelled = true;
    };
  }, [whereKey, page, user, authLoading]);

  return { data, error };
}

// Prefix bare domains (e.g. "example.com") with https:// so they aren't treated as relative paths
const toExternalHref = (link: string) => {
  const trimmed = link.trim();
  return /^[a-z][a-z\d+\-.]*:/i.test(trimmed) || trimmed.startsWith('//')
    ? trimmed
    : `https://${trimmed}`;
};

// Keyed by :userId so moving between profiles (e.g. from an item's author link) remounts the
// page and starts with fresh state, instead of reusing the previous user's data and errors
export function ProfilePage() {
  const { userId } = useParams();
  return <ProfileContent key={userId} />;
}

function ProfileContent() {
  const { userId } = useParams();
  const location = useLocation();
  const { user, payloadUser } = useAuth();
  const [profileData, setProfileData] = useState<Populated<User, 'thumbnail'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [currentItemsPage, setCurrentItemsPage] = useState(1);
  const [currentFavoritesPage, setCurrentFavoritesPage] = useState(1);

  // Id of the user last fetched. The page stays mounted when only :userId changes (e.g. from
  // your own favorites to another author), so this has to be per user, not a plain flag
  const fetchedRef = useRef<string | null>(null);

  const isOwnProfile = location.pathname === '/profile/me' || userId === payloadUser?.id;
  const profileUserId = isOwnProfile ? payloadUser?.id : userId;
  const authoredItems = useItemCardsPage(
    profileUserId ? { author: { equals: profileUserId } } : null,
    currentItemsPage
  );
  const favoriteItems = useItemCardsPage(
    profileUserId ? { favoritedBy: { equals: profileUserId } } : null,
    currentFavoritesPage
  );

  useEffect(() => {
    const fetchUserData = async () => {
      // Determine which ID to use
      const targetUserId = isOwnProfile ? payloadUser?.id : userId;
      if (targetUserId && fetchedRef.current === targetUserId) return;

      try {
        setLoading(true);
        // Don't show the previous user's items or pages while this one loads
        setProfileData(null);
        setCurrentItemsPage(1);
        setCurrentFavoritesPage(1);

        if (!targetUserId) {
          throw new Error('No user ID available');
        }

        // For /profile/me, we need authentication
        if (isOwnProfile && !user) {
          setError('You must be logged in to view your profile');
          setLoading(false);
          return;
        }

        // Public profiles work without a token; send one when logged in so the API includes
        // fields only the user themselves (or an admin) may see, such as email. Their items and
        // favorites are paged separately
        const userData = await apiFetch<Populated<User, 'thumbnail'>>(
          `/api/users/${targetUserId}?depth=1&joins[items]=false&joins[favorites]=false`,
          { user }
        );
        setProfileData(userData);

        setError(null);
        fetchedRef.current = targetUserId;
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    // For own profile, only fetch if logged in and we have payloadUser
    if (isOwnProfile) {
      if (user && payloadUser?.id) {
        fetchUserData();
      } else if (!user) {
        setLoading(false);
        setError('You must be logged in to view your profile');
      }
    }
    // For other profiles, always try to fetch
    else if (userId) {
      fetchUserData();
    }
  }, [isOwnProfile, userId, payloadUser?.id, user]);

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Text>Loading profile...</Text>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Text c="red">{error}</Text>
      </Container>
    );
  }

  // If viewing own profile or another user's profile
  return (
    <Container size="xl" py="xl">
      <Paper
        shadow="sm"
        p="xl"
        radius="md"
        style={{
          backgroundColor: 'var(--hub-color-card)',
          color: 'var(--hub-color-heading)',
        }}
      >
        <Group mb="md" justify="space-between">
          <Group>
            <Avatar
              size="xl"
              radius="xl"
              src={
                profileData?.thumbnail?.url ? apiUrl(profileData.thumbnail.url) : null
              }
            />
            <div>
              <Title order={1} c="var(--hub-color-heading)">
                {profileData?.username || 'User'}
              </Title>
              <Text c="var(--hub-color-dimmed)">
                {profileData?.email}
              </Text>
            </div>
          </Group>

          {/* Add Edit Button - only show for own profile */}
          {isOwnProfile && (
            <Button
              leftSection={<IconEdit size={16} />}
              onClick={() => setEditModalOpened(true)}
              variant="outline"
            >
              Edit Profile
            </Button>
          )}
        </Group>

        <Stack gap="md" mt="md">
          {/* Institution */}
          <div>
            <Text fw={500} c="var(--hub-color-heading)">
              Institution
            </Text>
            <Text c="var(--hub-color-dimmed)">
              {profileData?.institution || 'Not specified'}
            </Text>
          </div>

          {/* Link */}
          <div>
            <Text fw={500} c="var(--hub-color-heading)">
              Link
            </Text>
            <Text c="var(--hub-color-dimmed)">
              {isOwnProfile && payloadUser?.link ? (
                <a
                  href={toExternalHref(payloadUser.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--mantine-color-anchor)' }}
                >
                  {payloadUser.link}
                </a>
              ) : profileData?.link ? (
                <a
                  href={toExternalHref(profileData.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--mantine-color-anchor)' }}
                >
                  {profileData.link}
                </a>
              ) : (
                'Not specified'
              )}
            </Text>
          </div>

          {/* Slack Handle */}
          <div>
            <Text fw={500} c="var(--hub-color-heading)">
              Slack Handle
            </Text>
            <Text c="var(--hub-color-dimmed)">
              {profileData?.slackHandle || 'Not specified'}
            </Text>
          </div>

          {/* Name */}
          <div>
            <Text fw={500} c="var(--hub-color-heading)">
              Name
            </Text>
            <Text c="var(--hub-color-dimmed)">
              {profileData?.name || 'Not specified'}
            </Text>
          </div>

          {/* Email: only returned on your own profile (or to admins) */}
          {profileData?.email && (
            <div>
              <Text fw={500} c="var(--hub-color-heading)">
                Email
              </Text>
              <Text c="var(--hub-color-dimmed)">
                {profileData.email}
              </Text>
            </div>
          )}

          {/* Contact email: the API only returns it to logged-in users, so bots can't collect it */}
          {user && profileData?.contactEmail && (
            <div>
              <Text fw={500} c="var(--hub-color-heading)">
                Contact Email
              </Text>
              <Text c="var(--hub-color-dimmed)">
                <a
                  href={`mailto:${profileData.contactEmail}`}
                  style={{ color: 'var(--mantine-color-anchor)' }}
                >
                  {profileData.contactEmail}
                </a>
              </Text>
            </div>
          )}

          {/* Member Since */}
          <div>
            <Text fw={500} c="var(--hub-color-heading)">
              Member Since
            </Text>
            <Text c="var(--hub-color-dimmed)">
              {new Date(profileData?.createdAt || '').toLocaleDateString()}
            </Text>
          </div>
        </Stack>

        {isOwnProfile && profileData && (
          <AccountData user={profileData} itemCount={authoredItems.data?.totalDocs ?? 0} />
        )}

        {/* Add Modal */}
        <Modal
          opened={editModalOpened}
          onClose={() => setEditModalOpened(false)}
          title="Edit Profile"
          size="lg"
          styles={{
            title: { color: 'var(--hub-color-heading)' },
            content: { backgroundColor: 'var(--hub-color-panel)' },
          }}
        >
          {profileData && <UserProfileForm user={profileData} />}
        </Modal>

        <Tabs
          defaultValue="items"
          color="#d0f884"
          mt="xl"
          styles={{
            tab: { color: 'light-dark(var(--mantine-color-dark-4), var(--mantine-color-gray-4))' },
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="items">{isOwnProfile ? 'My Items' : 'User Items'}</Tabs.Tab>
            <Tabs.Tab value="favorites">Favorites</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="items" pt="xl">
            <Grid>
              {authoredItems.error ? (
                <Grid.Col>
                  <Text c="red">Failed to load items.</Text>
                </Grid.Col>
              ) : !authoredItems.data ? (
                <Grid.Col>
                  <Text>Loading items...</Text>
                </Grid.Col>
              ) : authoredItems.data.docs.length > 0 ? (
                <>
                  {authoredItems.data.docs.map((item) => (
                    <Grid.Col key={item.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <Item
                        id={item.id}
                        title={item.title}
                        type={item.type}
                        author={item.author}
                        license={item.license}
                        openspaceVersion={item.openspaceVersion}
                        description={item.description}
                        updatedAt={item.updatedAt}
                        createdAt={item.createdAt}
                        favoritedBy={item.favoritedBy}
                        tags={item.tags}
                        image={{
                          url: item.image?.url || '',
                          alt: item.title || 'Item image',
                        }}
                        assetBundle={
                          item.assetBundle?.url
                            ? {
                                url: item.assetBundle.url,
                                filename: item.assetBundle.filename,
                                entryPath: item.assetBundle.entryPath,
                              }
                            : undefined
                        }
                      />
                    </Grid.Col>
                  ))}
                  {authoredItems.data.totalPages > 1 && (
                    <Grid.Col span={12}>
                      <Group justify="center" mt="md">
                        <Pagination
                          total={authoredItems.data.totalPages}
                          value={currentItemsPage}
                          onChange={setCurrentItemsPage}
                          color="blue"
                        />
                      </Group>
                    </Grid.Col>
                  )}
                </>
              ) : (
                <Grid.Col>
                  <Text>No items found.</Text>
                </Grid.Col>
              )}
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="favorites" pt="xl">
            <Grid>
              {favoriteItems.error ? (
                <Grid.Col>
                  <Text c="red">Failed to load favorites.</Text>
                </Grid.Col>
              ) : !favoriteItems.data ? (
                <Grid.Col>
                  <Text>Loading favorites...</Text>
                </Grid.Col>
              ) : favoriteItems.data.docs.length > 0 ? (
                <>
                  {favoriteItems.data.docs.map((item) => (
                    <Grid.Col key={item.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <Item
                        id={item.id}
                        title={item.title}
                        type={item.type}
                        author={item.author}
                        license={item.license}
                        openspaceVersion={item.openspaceVersion}
                        description={item.description}
                        updatedAt={item.updatedAt}
                        createdAt={item.createdAt}
                        favoritedBy={item.favoritedBy}
                        tags={item.tags}
                        image={{
                          url: item.image?.url || '',
                          alt: item.title || 'Item image',
                        }}
                        assetBundle={
                          item.assetBundle?.url
                            ? {
                                url: item.assetBundle.url,
                                filename: item.assetBundle.filename,
                                entryPath: item.assetBundle.entryPath,
                              }
                            : undefined
                        }
                      />
                    </Grid.Col>
                  ))}
                  {favoriteItems.data.totalPages > 1 && (
                    <Grid.Col span={12}>
                      <Group justify="center" mt="md">
                        <Pagination
                          total={favoriteItems.data.totalPages}
                          value={currentFavoritesPage}
                          onChange={setCurrentFavoritesPage}
                          color="blue"
                        />
                      </Group>
                    </Grid.Col>
                  )}
                </>
              ) : (
                <Grid.Col>
                  <Text>No favorites found.</Text>
                </Grid.Col>
              )}
            </Grid>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
}
