import { List, Stack, Text } from '@mantine/core';

// How many files to list before summarizing the rest
const MAX_LISTED_FILES = 10;

const textColor = 'var(--hub-color-text)';
const mutedColor = 'light-dark(var(--mantine-color-dark-2), var(--mantine-color-gray-5))';

// Body of the "overwrite existing files?" confirmation shown before an OpenSpace import
export function OverwriteFilesList({ files }: { files: string[] }) {
  return (
    <Stack gap="xs">
      <Text size="sm" c={textColor}>
        This import will replace {files.length} existing file{files.length === 1 ? '' : 's'}:
      </Text>
      <List size="sm" c={mutedColor} style={{ wordBreak: 'break-all' }}>
        {files.slice(0, MAX_LISTED_FILES).map((file) => (
          <List.Item key={file}>{file}</List.Item>
        ))}
      </List>
      {files.length > MAX_LISTED_FILES && (
        <Text size="sm" c={mutedColor}>
          ...and {files.length - MAX_LISTED_FILES} more
        </Text>
      )}
      {/* Different hub items can share file names (e.g. two people's mars.profile) */}
      <Text size="sm" c={textColor}>
        These may be from a different item with the same name, or an earlier version of this
        one. Overwriting replaces them with this item's files.
      </Text>
    </Stack>
  );
}
