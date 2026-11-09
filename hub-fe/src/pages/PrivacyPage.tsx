import { Link } from 'react-router-dom';
import { Anchor, Container, List, Stack, Text, Title } from '@mantine/core';

const PRIVACY_CONTACT_EMAIL = 'support@openspaceproject.com';
const headingColor = 'var(--hub-color-heading)';
const textColor = 'var(--hub-color-dimmed)';

export function PrivacyPage() {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Stack gap="xs">
      <Title order={3} c={headingColor}>
        {title}
      </Title>
      <Text component="div" c={textColor}>
        {children}
      </Text>
    </Stack>
  );

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={1} c={headingColor} ta="center">
            Privacy
          </Title>
          <Text ta="center" c={textColor}>
            The OpenSpace Hub is run by the OpenSpace team.
          </Text>
        </Stack>

        <Section title="Browsing">
          You can browse and download items without an account. The Hub doesn't use analytics,
          advertising or tracking cookies. The Hub counts how many times each
          item is downloaded or imported into OpenSpace. These counts are anonymous: they don't
          record who downloaded an item, your address or when.
        </Section>

        <Section title="Signing in">
          The Hub uses Firebase Authentication (a Google service) to let you sign in with Google,
          GitHub or X. When you sign in, the provider you choose shares your name, email address
          and an account ID with Firebase. The Hub uses these to create and recognize your
          account. The Hub never sees your password for those services. Other OpenSpace apps
          share the same sign-in, so one login works across them.
        </Section>

        <Section title="What your account stores">
          <List c={textColor} spacing={4}>
            <List.Item>
              Your email address, which only you and Hub admins can see.
            </List.Item>
            <List.Item>
              Your profile: name, username, institution, link, Slack handle and profile picture.
              These are public.
            </List.Item>
            <List.Item>
              Your contact email, if you add one. Only logged-in Hub users can see it.
            </List.Item>
            <List.Item>
              The items you upload, their files, images and version history. These are public
              once published.
            </List.Item>
            <List.Item>The items you favorite, which are shown on your profile.</List.Item>
          </List>
        </Section>

        <Section title="What your device stores">
          <List c={textColor} spacing={4}>
            <List.Item>
              Your login session, which Firebase keeps in your browser so you stay signed in
              until you log out.
            </List.Item>
          </List>
        </Section>

        <Section title="Managing your data">
          From{' '}
          <Anchor component={Link} to="/profile/me">
            your profile
          </Anchor>{' '}
          you can:
          <List c={textColor} spacing={4} mt={4}>
            <List.Item>Edit your profile at any time.</List.Item>
            <List.Item>
              Download your data as a JSON file containing your profile, sign-in details, items
              with their version history, and favorites.
            </List.Item>
            <List.Item>
              Delete your account. This removes your profile, all your items with their versions
              and files, and your favorites. It can't be undone. Your sign-in record is kept
              because other OpenSpace apps use it. To have it removed as well, contact us
              (below).
            </List.Item>
          </List>
        </Section>

        <Section title="How long data is kept">
          Your data is kept until you delete it or your account. The Hub keeps a few rolling
          backups for disaster recovery, so deleted data can remain in a backup until that
          backup is replaced.
        </Section>

        <Section title="Contact">
          For questions or requests about your data, email{' '}
          <Anchor href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</Anchor>.
        </Section>
      </Stack>
    </Container>
  );
}
