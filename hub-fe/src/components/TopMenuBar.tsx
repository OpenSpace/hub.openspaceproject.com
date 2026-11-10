import { useState } from 'react';
import { IconLogout, IconUser, IconUpload } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import {
  Avatar,
  Burger,
  Button,
  Container,
  Drawer,
  Group,
  Menu,
  NavLink,
  rem,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core';
import {
  SIGNIN_DISABLED_MESSAGE,
  UPLOADS_DISABLED_MESSAGE,
  useAuth,
} from '../contexts/AuthContext';
import { apiUrl } from '../utils/api';
import { LoginModal } from './LoginModal';
import OpenSpaceButton from './OpenSpaceButton';

// Avatar placeholder colors: Mantine's `light` variant of blue in dark mode, of dark in light mode
const avatarStyle = {
  '--avatar-bg': 'light-dark(var(--mantine-color-dark-light), var(--mantine-color-blue-light))',
  '--avatar-color':
    'light-dark(var(--mantine-color-dark-light-color), var(--mantine-color-blue-light-color))',
};
const noteColor = 'light-dark(var(--mantine-color-dark-2), var(--mantine-color-gray-3))';

export function TopMenuBar() {
  const { user, payloadUser, logout, uploadsEnabled, signinEnabled } = useAuth();
  const theme = useMantineTheme();
  const [opened, setOpened] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [modalMode, setModalMode] = useState<'login' | 'signup'>('login');

  const toggleNavbar = () => setOpened((o) => !o);
  const openModal = (mode: 'login' | 'signup') => {
    if (!signinEnabled) {
      return;
    }
    setModalMode(mode);
    setModalOpened(true);
  };
  const closeModal = () => setModalOpened(false);

  const displayName = () => {
    if (!user) return '';
    if (payloadUser?.username) return payloadUser.username;
    if (user.email) return user.email;
    return 'User';
  };

  const menuItems: {
    label: string;
    to: string;
    disabledReason?: string;
    // Logged-out users get the login dialog instead of the page
    requiresLogin?: boolean;
    icon?: React.ReactNode;
  }[] = [
    // { label: 'ASSETS', to: '/assets' },
    // { label: 'CONFIG', to: '/config' },
    // { label: 'PROFILES', to: '/profiles' },
    // { label: 'RECORDINGS', to: '/recordings' },
    {
      label: 'Upload Item',
      to: '/items/new',
      icon: <IconUpload size={16} />,
      requiresLogin: true,
      disabledReason: !uploadsEnabled
        ? UPLOADS_DISABLED_MESSAGE
        : !user && !signinEnabled
          ? SIGNIN_DISABLED_MESSAGE
          : undefined,
    },
  ];

  const handleMenuClick =
    (item: (typeof menuItems)[number]) => (event: React.MouseEvent) => {
      if (item.requiresLogin && !user) {
        event.preventDefault();
        openModal('login');
      }
    };

  return (
    <>
      <div
        style={{
          backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-9))',
          borderBottom: '1px solid var(--hub-color-border)',
        }}
      >
      <Container
        size="xl"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '60px',
        }}
      >
        <Group wrap="nowrap" gap="0">
          <Link to="/" style={{ display: 'flex' }}>
            <img src="/horizontal_logo.webp" alt="OpenSpace" height={40} />
          </Link>
          <Text
            component={Link}
            to="/"
            fw={700}
            size="xl"
            c="var(--hub-color-heading)"
            style={{
              textDecoration: 'underline',
              textDecorationColor: theme.colors.yellow[1],
              textUnderlineOffset: '4px',
              wrap: 'nowrap',
            }}
          >
          Hub
          </Text>
        </Group>

        <Group pr={'sm'} gap={8} visibleFrom="md" wrap="nowrap" justify="flex-end" style={{ flex: 1 }}>
          {menuItems.map((item) =>
            item.disabledReason ? (
              // Disabled buttons don't fire mouse events, so the tooltip wraps a span
              <Tooltip key={item.label} label={item.disabledReason}>
                <span>
                  <Button variant="outline" size="sm" disabled>
                    {item.label}
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button
                key={item.label}
                component={Link}
                to={item.to}
                leftSection={item.icon}
                onClick={handleMenuClick(item)}
                variant="outline"
                size="sm"
              >
                {item.label}
              </Button>
            )
          )}
        </Group>

        <Group gap="xs" visibleFrom="md">
          <OpenSpaceButton />
          {user ? (
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <UnstyledButton
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 8px',
                    borderRadius: theme.radius.sm,
                    backgroundColor:
                      'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-9))',
                    transition: 'background-color 150ms ease',
                  }}
                >
                  <Avatar
                    size="sm"
                    radius="xl"
                    style={avatarStyle}
                    src={payloadUser?.thumbnailUrl ? apiUrl(payloadUser.thumbnailUrl) : null}
                  >
                    {displayName().charAt(0).toUpperCase()}
                  </Avatar>
                  <Text size="sm" fw={500} visibleFrom="sm">
                    {displayName()}
                  </Text>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item component={Link} to="/profile" leftSection={<IconUser size={16} />}>
                  Profile
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={logout}>
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            // Disabled buttons don't fire mouse events, so the tooltip wraps the group
            <Tooltip label={SIGNIN_DISABLED_MESSAGE} disabled={signinEnabled}>
              
              <Group gap="xs" visibleFrom="sm">
                <Button
                  onClick={() => openModal('signup')}
                  variant="light"
                  size="sm"
                  disabled={!signinEnabled}
                >
                  Sign Up
                </Button>
                <Button
                  onClick={() => openModal('login')}
                  variant="outline"
                  size="sm"
                  disabled={!signinEnabled}
                  style={{
                    '--button-bd': '1px solid var(--mantine-color-yellow-1)',
                    '--button-hover': 'var(--mantine-color-yellow-1)',
                    '--button-hover-color': 'var(--mantine-color-black)',
                  }}
                >
                  Login
                </Button>
              </Group>
            </Tooltip>
          )}
        </Group>

        <Burger
          opened={opened}
          onClick={toggleNavbar}
          color="var(--hub-color-heading)"
          size="sm"
          hiddenFrom="md"
        />
      </Container>
      </div>

      <Drawer
        opened={opened}
        onClose={toggleNavbar}
        title="Navigation"
        position="right"
        padding="md"
        size="sm"
        styles={{
          title: {
            color: 'var(--hub-color-heading)',
            fontSize: rem(20),
            fontWeight: 700,
          },
          header: {
            padding: '16px',
            borderBottom: '1px solid var(--hub-color-border)',
            backgroundColor: 'var(--hub-color-card)',
          },
          content: {
            backgroundColor: 'var(--hub-color-card)',
          },
          body: {
            backgroundColor: 'var(--hub-color-card)',
          },
        }}
      >
        <Stack gap={4}>
          {user && (
            <>
              <NavLink
                component={Link}
                to="/profile"
                onClick={toggleNavbar}
                label={displayName()}
                leftSection={
                  <Avatar
                    size="sm"
                    radius="xl"
                    style={avatarStyle}
                    src={payloadUser?.thumbnailUrl ? apiUrl(payloadUser.thumbnailUrl) : null}
                  >
                    {displayName().charAt(0).toUpperCase()}
                  </Avatar>
                }
              />
              <NavLink
                label="Logout"
                color="red"
                leftSection={<IconLogout size={18} />}
                onClick={() => {
                  logout();
                  toggleNavbar();
                }}
              />
            </>
          )}
          {menuItems.map((item) => (
            <div key={item.label} style={{ paddingTop: 8 }}>
              <Button
                component={Link}
                to={item.to}
                leftSection={item.icon}
                onClick={(event: React.MouseEvent) => {
                  handleMenuClick(item)(event);
                  toggleNavbar();
                }}
                variant="outline"
                fullWidth
                disabled={Boolean(item.disabledReason)}
              >
                {item.label}
              </Button>
              {item.disabledReason && (
                <Text size="xs" mt={4} c={noteColor}>
                  {item.disabledReason}
                </Text>
              )}
            </div>
          ))}
        </Stack>

        <Stack gap="xs" mt="xl">
          <OpenSpaceButton inMenu />
          {!user && (
            <>
              <Button
                onClick={() => openModal('signup')}
                variant="light"
                fullWidth
                disabled={!signinEnabled}
              >
                Sign Up
              </Button>
              <Button
                onClick={() => openModal('login')}
                variant="outline"
                fullWidth
                disabled={!signinEnabled}
                style={{
                  '--button-bd': '1px solid var(--mantine-color-yellow-1)',
                  '--button-hover': 'var(--mantine-color-yellow-1)',
                  '--button-hover-color': 'var(--mantine-color-black)',
                }}
              >
                Login
              </Button>
              {!signinEnabled && (
                <Text size="sm" ta="center" c={noteColor}>
                  {SIGNIN_DISABLED_MESSAGE}
                </Text>
              )}
            </>
          )}
        </Stack>
      </Drawer>

      <LoginModal opened={modalOpened} onClose={closeModal} mode={modalMode} />
    </>
  );
}
