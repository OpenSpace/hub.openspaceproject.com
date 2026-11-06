// The "Upload Instructions" shown on the upload form for each item type
export interface UploadInstructions {
  paragraphs: string[];
  // A zip's layout, as the paths of the files inside it
  example?: { zipName: string; paths: string[] };
}

export const UPLOAD_INSTRUCTIONS: Record<string, UploadInstructions> = {
  asset: {
    paragraphs: [
      'Upload a .asset, .jasset, or .zip file.',
      'If you upload a .zip file, it must contain a folder, and that folder must contain a .asset file. The .zip file, the folder, and the .asset file must all have the same name. For example:'
    ],
    example: {
      zipName: 'voyager.zip',
      paths: [
        'voyager/voyager.asset',
        'voyager/data/voyager.glb',
        'voyager/data/palebluedot.jpg',
        'voyager/palebluedotslide.asset',
      ],
    },
  },
  webpanel: {
    paragraphs: [
      'Upload an index.html file or a .zip file.',
      'If you upload a .zip file, it must contain a folder with an index.html file inside. Other resources are also allowed.',
    ],
    example: {
      zipName: 'starsearch.zip',
      paths: [
        'starsearch/index.html',
        'starsearch/main.css',
        'starsearch/js/openspace-api.js',
      ],
    },
  },
  config: {
    paragraphs: [
      'Upload a .json file or, if your config needs additional resources (such as a warping ' +
        'mesh or blending mask), a .zip file.',
    ],
    example: {
      zipName: 'warped_projection.zip',
      paths: [
        'warped_projection/warped.json',
        'warped_projection/mesh.obj',
        'warped_projection/mask.png',
      ],
    },
  },
  package: {
    paragraphs: [
      'A package can hold any set of files from the user/ folder. For example, one package ' +
        'might contain a profile and 3 assets, while another contains one asset, multiple ' +
        'recordings and a ShowComposer project.',
      'The .zip file should mirror the folder structure of the user/ folder.',
    ],
    example: {
      zipName: 'moonshow.zip',
      paths: [
        'data/assets/lrv/lrv.asset',
        'data/assets/lrv/lrv.gltf',
        'data/assets/MOLAB.asset',
        'data/assets/Lander_Rover_Apollo_Mission.jpg',
        'data/bookmarks/moonbookmarks.csv',
        'data/profiles/moonshow.profile',
        'recordings/shackelton.osrectxt',
        'recordings/a17.osrectxt',
        'showcomposer/projects/moonshow.json',
        'showcomposer/uploads/1753984360546-162119675.png',
        'showcomposer/uploads/1758752154210-725865625.png',
        'webpanels/apollosoundbank/index.html',
        'webpanels/apollosoundbank/sounds/a11landing.mp3',
        'webpanels/apollosoundbank/sounds/a8earthrise.mp3',
      ],
    },
  },
  showcomposer: {
    paragraphs: ['In ShowComposer, use File → Export to create the .zip file, then upload it here.'],
  },
};

interface TreeNode {
  children: Map<string, TreeNode>;
}

// Draw file paths as a tree under the zip's name:
//   voyager.zip
//   └─ voyager/
//      ├─ voyager.asset
//      └─ data/
export const fileTree = (zipName: string, paths: string[]): string => {
  const root: TreeNode = { children: new Map() };
  for (const path of paths) {
    let node = root;
    for (const part of path.split('/')) {
      if (!node.children.has(part)) node.children.set(part, { children: new Map() });
      node = node.children.get(part)!;
    }
  }

  const lines = [zipName];
  const walk = (node: TreeNode, prefix: string) => {
    const entries = [...node.children];
    entries.forEach(([name, child], index) => {
      const last = index === entries.length - 1;
      lines.push(prefix + (last ? '└─ ' : '├─ ') + name + (child.children.size > 0 ? '/' : ''));
      walk(child, prefix + (last ? '   ' : '│  '));
    });
  };
  walk(root, '');
  return lines.join('\n');
};
