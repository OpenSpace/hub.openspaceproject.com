import { useEffect, useMemo, useState } from 'react';
import { IconChevronDown, IconFile, IconFolder } from '@tabler/icons-react';
import {
  Box,
  Card,
  Group,
  ScrollArea,
  Text,
  Tree,
  TreeNodeData,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { BundleFile, fetchBundleContents } from '@/utils/bundleContents';

const formatBytes = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${unit === 0 ? size : size.toFixed(1)} ${units[unit]}`;
};

// Turn flat zip paths into a folder tree; folders first, each sorted by name, with summed sizes
const buildTree = (files: BundleFile[]): TreeNodeData[] => {
  interface Folder {
    folders: Map<string, Folder>;
    files: BundleFile[];
  }
  const root: Folder = { folders: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    let folder = root;
    for (const part of parts.slice(0, -1)) {
      if (!folder.folders.has(part)) {
        folder.folders.set(part, { folders: new Map(), files: [] });
      }
      folder = folder.folders.get(part)!;
    }
    folder.files.push(file);
  }

  const toNodes = (folder: Folder, prefix: string): TreeNodeData[] => [
    ...[...folder.folders.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, child]) => {
        const children = toNodes(child, `${prefix}${name}/`);
        const size = children.reduce((sum, node) => sum + node.nodeProps!.size, 0);
        return { value: `${prefix}${name}/`, label: name, children, nodeProps: { size } };
      }),
    ...[...folder.files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => ({
        value: file.path,
        label: file.path.substring(prefix.length),
        nodeProps: { size: file.size },
      })),
  ];
  return toNodes(root, '');
};

// Card listing the files of an asset bundle: the contents of a .zip, or the single uploaded file
export function BundleContents({ filename, filesize }: { filename?: string; filesize?: number }) {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [files, setFiles] = useState<BundleFile[] | undefined>();

  useEffect(() => {
    if (!filename) {
      setFiles(undefined);
      return;
    }
    // Only zips have a recorded file list; otherwise the bundle is just its own file
    if (!filename.toLowerCase().endsWith('.zip')) {
      setFiles([{ path: filename, size: filesize ?? 0 }]);
      return;
    }
    setFiles(undefined);
    // Ignore a stale response if the version (and so the filename) changes mid-request
    let cancelled = false;
    fetchBundleContents(filename).then((contents) => {
      if (!cancelled) {
        setFiles(contents);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filename, filesize]);

  const tree = useMemo(() => (files ? buildTree(files) : []), [files]);

  if (!files?.length) {
    return null;
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? theme.colors.gray[3] : theme.colors.dark[7];
  const mutedColor = isDark ? theme.colors.gray[5] : theme.colors.dark[2];

  return (
    <Card
      withBorder
      p="md"
      radius={12}
      style={{
        backgroundColor: isDark ? theme.colors.dark[8] : theme.white,
        borderColor: 'rgba(162, 231, 251, 0.12)',
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500} c={isDark ? theme.white : theme.colors.dark[7]}>
          Files
        </Text>
        <Text size="xs" c={mutedColor}>
          {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(totalSize)}
        </Text>
      </Group>
      <ScrollArea.Autosize mah={400}>
        <Tree
          data={tree}
          levelOffset="md"
          renderNode={({ node, expanded, hasChildren, elementProps }) => (
            <Group gap={6} wrap="nowrap" py={2} {...elementProps}>
              {hasChildren ? (
                <IconChevronDown
                  size={12}
                  color={mutedColor}
                  style={{ transform: expanded ? undefined : 'rotate(-90deg)', flexShrink: 0 }}
                />
              ) : (
                <Box w={12} style={{ flexShrink: 0 }} />
              )}
              {hasChildren ? (
                <IconFolder size={14} color={mutedColor} style={{ flexShrink: 0 }} />
              ) : (
                <IconFile size={14} color={mutedColor} style={{ flexShrink: 0 }} />
              )}
              <Text size="xs" c={textColor} truncate style={{ flex: 1 }}>
                {node.label}
              </Text>
              <Text size="xs" c={mutedColor} style={{ flexShrink: 0 }}>
                {formatBytes(node.nodeProps?.size ?? 0)}
              </Text>
            </Group>
          )}
        />
      </ScrollArea.Autosize>
    </Card>
  );
}
