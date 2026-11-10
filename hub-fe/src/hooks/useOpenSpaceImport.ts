import { createElement } from 'react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { OverwriteFilesList } from '@/components/OverwriteFilesList';
import { fetchBundleContents } from '@/utils/bundleContents';
import { trackItem } from '@/utils/trackItem';

interface OpenSpaceImportOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// What an import will write, worked out before anything in the user folder is touched
interface ImportPlan {
  // Every file the import writes, for the overwrite check
  destinations: string[];
  // Writes the files (and e.g. adds the asset); only called once overwrites are confirmed
  run: () => Promise<void>;
}

const normalizePath = (path: string) => path.replace(/\\/g, '/');

// file:// URL for an absolute local path (C:\a b\c.json -> file:///C:/a%20b/c.json)
const toFileUrl = (absPath: string) => {
  const path = normalizePath(absPath);
  return encodeURI('file://' + (path.startsWith('/') ? '' : '/') + path);
};

const parentDirectory = (path: string) => path.substring(0, normalizePath(path).lastIndexOf('/') + 1);

// Entries that would unzip outside the destination; older uploads weren't checked for them
const isUnsafeZipPath = (path: string) =>
  /^([a-zA-Z]:|[\\/])/.test(path) || path.split(/[\\/]/).includes('..');

// Ask before overwriting; resolves false if the user cancels or closes the dialog
const confirmOverwrite = (files: string[]) =>
  new Promise<boolean>((resolve) => {
    modals.openConfirmModal({
      title: 'Overwrite existing files?',
      size: 'lg',
      children: createElement(OverwriteFilesList, { files }),
      labels: { confirm: 'Overwrite', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      cancelProps: { variant: 'light' },
      // Match the app's cards; this runs outside React, so use CSS light-dark() like theme.ts
      styles: {
        content: {
          backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-8))',
          border: '1px solid rgba(162, 231, 251, 0.12)',
        },
        header: {
          backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-8))',
        },
        title: {
          color: 'light-dark(var(--mantine-color-dark-7), var(--mantine-color-white))',
          fontWeight: 500,
        },
      },
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
      onClose: () => resolve(false),
    });
  });

export const useOpenSpaceImport = (options: OpenSpaceImportOptions = {}) => {
  const importToOpenSpace = async (
    url: string,
    type: string,
    fileName?: string | null,
    entryPath?: string | null,
    itemId?: string
  ) => {
    const openspace = window.openspace;
    if (!openspace) {
      const error = new Error('Connect to OpenSpace first');
      notifications.show({
        id: 'openspace-connect',
        title: 'Error',
        message: error.message,
        color: 'red',
      });
      options.onError?.(error);
      return;
    }

    try {
      const fullUrl = url;
      // Prefer the stored filename; fall back to the (URL-encoded) last path segment
      const filePath = fileName || decodeURIComponent(url.substring(url.lastIndexOf('/') + 1));
      const dotIndex = filePath.lastIndexOf('.');
      const noextension = dotIndex > 0 ? filePath.substring(0, dotIndex) : filePath;
      const extension = dotIndex > 0 ? filePath.substring(dotIndex).toLowerCase() : '';
      const tempDir = await openspace.absPath('${TEMPORARY}/');

      // Zip file list recorded by the hub at upload. Bundles uploaded before that was added
      // (and not backfilled) have none, so the zip gets staged locally to find out instead
      const recordedContents =
        extension === '.zip' && fileName ? await fetchBundleContents(fileName) : undefined;
      const unsafeFile = recordedContents?.find((file) => isUnsafeZipPath(file.path));
      if (unsafeFile) {
        throw new Error(`ZIP contains an unsafe path: ${unsafeFile.path}`);
      }

      // Download and unzip into a fresh staging folder. OpenSpace clears ${TEMPORARY} on
      // startup, so staging folders don't pile up. Memoized so the zip is staged at most once
      let staging: Promise<{ zipPath: string; contentsDir: string; files: string[] }> | undefined;
      const stageZip = () =>
        (staging ??= (async () => {
          const stagingName = `import-${Date.now()}`;
          const stagingDir = tempDir + stagingName + '/';
          const zipPath = stagingDir + filePath;
          const contentsDir = stagingDir + 'contents/';
          await openspace.createDirectory(stagingDir, true);
          await openspace.downloadFile(fullUrl, zipPath, true);
          await openspace.unzipFile(zipPath, contentsDir, false);
          // The library returns Lua tables as either an array or a { 1: ..., 2: ... } object
          const staged: string[] = Object.values(
            (await openspace.walkDirectoryFiles(contentsDir, true)) ?? {}
          );
          const marker = `/${stagingName}/contents/`;
          // Paths inside the zip, always with /
          const files = staged.map((abs) => {
            const path = normalizePath(abs);
            return path.substring(path.indexOf(marker) + marker.length);
          });
          return { zipPath, contentsDir, files };
        })());

      // Paths of the files inside the zip, relative to its root
      const zipFiles = async () =>
        recordedContents ? recordedContents.map((file) => file.path) : (await stageZip()).files;

      // Download a file, creating its folder first (curl's fopen won't), and make sure it landed
      const copyFile = async (src: string, dest: string) => {
        await openspace.createDirectory(parentDirectory(dest), true);
        await openspace.downloadFile(src, dest, true);
        if (!(await openspace.fileExists(dest))) {
          throw new Error(`Could not write ${dest}`);
        }
      };

      // Unzip over destDir, which mirrors the zip's layout
      const planUnzip = async (destDir: string): Promise<ImportPlan> => ({
        destinations: (await zipFiles()).map((path) => destDir + path),
        run: async () => {
          let zipPath: string;
          if (staging) {
            zipPath = (await staging).zipPath;
          } else {
            zipPath = tempDir + `import-${Date.now()}-` + filePath;
            await openspace.downloadFile(fullUrl, zipPath, true);
          }
          await openspace.unzipFile(zipPath, destDir, true);
        },
      });

      // Download a single file straight from the hub
      const planDownload = (dest: string): ImportPlan => ({
        destinations: [dest],
        run: () => copyFile(fullUrl, dest),
      });

      // Run `after` once the plan's files are written
      const andThen = (plan: ImportPlan, after: () => Promise<void>): ImportPlan => ({
        destinations: plan.destinations,
        run: async () => {
          await plan.run();
          await after();
        },
      });

      let plan: ImportPlan;
      switch (type) {
        case 'asset': {
          if (extension === '.zip') {
            const scenePath = await openspace.absPath('${USER_ASSETS}/');
            // entryPath (e.g. "foo/foo.asset") is recorded at upload. Without it, guess from the
            // filename, dropping the -1/-2 suffix Payload adds to de-duplicate (foo-1.zip -> foo)
            const baseName = noextension.replace(/-\d+$/, '');
            const assetPath = scenePath + (entryPath || `${baseName}/${baseName}.asset`);
            plan = andThen(await planUnzip(scenePath), async () => {
              await openspace.asset.add(assetPath);
            });
          } else if (extension === '.asset' || extension === '.jasset') {
            const absPath = await openspace.absPath('${USER_ASSETS}/' + filePath);
            plan = andThen(planDownload(absPath), async () => {
              await openspace.asset.add(absPath);
            });
          } else {
            throw new Error(`Unsupported asset file type: ${extension || filePath}`);
          }
          break;
        }
        case 'profile': {
          plan = planDownload(await openspace.absPath('${USER_PROFILES}/' + filePath));
          break;
        }
        case 'recording': {
          plan = planDownload(await openspace.absPath('${RECORDINGS}/' + filePath));
          break;
        }
        case 'config': {
          if (extension === '.zip') {
            // Config zips hold their own folder with the .json and its resources (e.g.
            // warped_projection/warped.json + mesh.obj + mask.png), so unzip into the config root
            plan = await planUnzip(await openspace.absPath('${USER_CONFIG}/'));
          } else if (extension === '.json') {
            plan = planDownload(await openspace.absPath('${USER_CONFIG}/' + filePath));
          } else {
            throw new Error(`Unsupported config file type: ${extension || filePath}`);
          }
          break;
        }
        case 'webpanel': {
          if (extension === '.zip') {
            // The zip already contains its own top-level folder (e.g. apc40/index.html), so unzip
            // into the webpanels root rather than a folder named after the (possibly de-duplicated) zip
            plan = await planUnzip(await openspace.absPath('${USER_WEBPANELS}/'));
          } else if (extension === '.html') {
            plan = planDownload(await openspace.absPath('${USER_WEBPANELS}/' + filePath));
          } else {
            throw new Error(`Unsupported webpanel file type: ${extension || filePath}`);
          }
          break;
        }
        case 'showcomposer': {
          if (extension !== '.zip') {
            throw new Error(`Unsupported ShowComposer file type: ${extension || filePath}`);
          }
          // ShowComposer exports are <showname>-<Date.now()>.zip holding data.json + uploads/*.
          // OpenSpace has no move/rename, so "copy" the staged files into place by downloading
          // them from file:// URLs (downloadFile is plain curl)
          const showName = noextension.replace(/-\d{10,}(-\d+)?$/, '');
          const projectsPath = await openspace.absPath('${USER_SHOWCOMPOSER_PROJECTS}/');
          const uploadsPath = await openspace.absPath('${USER_SHOWCOMPOSER_UPLOADS}/');
          const files = await zipFiles();
          if (!files.includes('data.json')) {
            throw new Error('ShowComposer zip is missing data.json');
          }
          // [path inside the zip, destination]
          const copies: [string, string][] = [['data.json', projectsPath + showName + '.json']];
          for (const path of files) {
            if (path.startsWith('uploads/')) {
              copies.push([path, uploadsPath + path.substring('uploads/'.length)]);
            }
          }
          plan = {
            destinations: copies.map(([, dest]) => dest),
            run: async () => {
              const { contentsDir } = await stageZip();
              for (const [path, dest] of copies) {
                await copyFile(toFileUrl(contentsDir + path), dest);
              }
            },
          };
          break;
        }
        case 'package': {
          if (extension !== '.zip') {
            throw new Error(`Unsupported package file type: ${extension || filePath}`);
          }
          // Packages mirror the user/ folder (data/assets/..., recordings/..., showcomposer/...)
          plan = await planUnzip(await openspace.absPath('${USER}/'));
          break;
        }
        default:
          throw new Error(`Unhandled import type: ${type}`);
      }

      const existing = (
        await Promise.all(
          plan.destinations.map(async (dest) => ((await openspace.fileExists(dest)) ? dest : null))
        )
      ).filter((dest): dest is string => dest !== null);
      if (existing.length > 0) {
        // Show paths relative to the user folder where possible
        const userPath = normalizePath(await openspace.absPath('${USER}/'));
        const labels = existing.map((dest) => {
          const path = normalizePath(dest);
          return path.startsWith(userPath) ? 'user/' + path.substring(userPath.length) : path;
        });
        if (!(await confirmOverwrite(labels))) {
          notifications.show({ title: 'Import cancelled', message: 'No files were changed', color: 'gray' });
          return;
        }
      }

      await plan.run();
      // Only successful imports count
      if (itemId) trackItem(itemId, 'import');

      notifications.show({
        title: 'Success',
        message: 'Item imported successfully',
        color: 'green',
      });
      options.onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({
        title: 'Error',
        message: `Error importing item: ${errorMessage}`,
        color: 'red',
      });
      options.onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  };

  return {
    importToOpenSpace,
  };
};
