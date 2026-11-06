import React, { useState } from 'react';
import { IconCheck, IconPlug, IconX } from '@tabler/icons-react';
import openspaceApi from 'openspace-api-js';
import { Button, useMantineColorScheme, useMantineTheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';

interface OpenSpaceButtonProps {
  // For the mobile menu: full width, and shown at every size (it's hidden below `md` otherwise)
  inMenu?: boolean;
}

const OpenSpaceButton: React.FC<OpenSpaceButtonProps> = ({ inMenu = false }) => {
  const [isConnected, setIsConnected] = useState(false);
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  async function connectToOpenSpace() {
    // setup the api params
    const host = '127.0.0.1';
    const api = openspaceApi(host, 4682);
    let retry = 0;

    // Show connecting notification
    notifications.show({
      id: 'openspace-connect',
      loading: true,
      title: 'Connecting to OpenSpace',
      message: 'Attempting to connect to OpenSpace...',
      autoClose: false,
      withCloseButton: false,
    });

    // notify users on disconnect
    api.onDisconnect(() => {
      if (retry < 2) {
        api.connect();
        retry++;
        notifications.update({
          id: 'openspace-connect',
          loading: true,
          title: 'Reconnecting to OpenSpace',
          message: `Retry attempt ${retry} of 2...`,
          autoClose: false,
        });
      } else {
        notifications.update({
          id: 'openspace-connect',
          color: 'red',
          title: 'Connection Failed',
          message: 'Please start OpenSpace software and try again.',
          icon: <IconX size={16} />,
          loading: false,
          autoClose: 5000,
        });
        setIsConnected(false);
        window.openspace = null;
      }
    });

    // notify users and map buttons when connected
    api.onConnect(async () => {
      window.openspace = await api.library();
      setIsConnected(true);
      retry = 0;
      notifications.update({
        id: 'openspace-connect',
        color: 'green',
        title: 'Connected to OpenSpace',
        message: 'Successfully connected to OpenSpace!',
        icon: <IconCheck size={16} />,
        loading: false,
        autoClose: 3000,
      });
    });

    // connect
    api.connect();
  }

  return (
    <>
      {isConnected ? (
        <Button
          disabled
          variant="light"
          size="sm"
          leftSection={<IconPlug size={16} />}
          visibleFrom={inMenu ? undefined : 'md'}
          fullWidth={inMenu}
          styles={{
            root: {
              backgroundColor: colorScheme === 'dark' ? theme.colors.dark[6] : undefined,
              '&:hover': {
                backgroundColor: colorScheme === 'dark' ? theme.colors.dark[5] : undefined,
              },
            },
          }}
        >
          Connected
        </Button>
      ) : (
        <Button
          onClick={connectToOpenSpace}
          variant="light"
          size="sm"
          leftSection={<IconPlug size={16} />}
          visibleFrom={inMenu ? undefined : 'md'}
          fullWidth={inMenu}
          styles={{
            root: {
              backgroundColor: colorScheme === 'dark' ? theme.colors.dark[6] : undefined,
              '&:hover': {
                backgroundColor: colorScheme === 'dark' ? theme.colors.dark[5] : undefined,
              },
            },
          }}
        >
          Connect to OpenSpace
        </Button>
      )}
    </>
  );
};

export default OpenSpaceButton;
