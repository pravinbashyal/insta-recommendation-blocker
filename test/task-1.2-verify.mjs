import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const extensionDir = path.join(repoRoot, 'extension');
const safariDir = path.join(repoRoot, 'safari');
const pbxprojPath = path.join(
  safariDir,
  'Instagram Recommendation Blocker',
  'Instagram Recommendation Blocker.xcodeproj',
  'project.pbxproj',
);

const REQUIRED_SHARED_ENTRIES = ['manifest.json', 'popup', 'content', 'lib'];

const BLOCKING_LOGIC_FILES = [
  'content/content.js',
  'content/home-for-you-block.js',
  'popup/popup.html',
  'popup/popup.js',
  'popup/popup.css',
  'lib/browser-storage.js',
  'lib/switch-logic.js',
  'lib/home-for-you-block.js',
];

/** Xcode SRCROOT: directory that contains the .xcodeproj bundle. */
const srcRoot = path.dirname(path.dirname(pbxprojPath));

const RESOURCES_GROUP_ID = '5F5A42403097967A00EEE301';
const SHARED_FILE_REF_IDS = {
  popup: '5F5A42413097967A00EEE301',
  content: '5F5A42423097967A00EEE301',
  'manifest.json': '5F5A42433097967A00EEE301',
  lib: '5F5A42443097967A00EEE301',
};

function parsePbxGroups(pbxproj) {
  /** @type {Map<string, { path?: string, sourceTree: string, children: string[] }>} */
  const groups = new Map();
  const groupRe =
    /([A-F0-9]{24}) \/\* ([^*]+) \*\/ = \{\s*isa = PBXGroup;([\s\S]*?)\n\t\t\};/g;
  for (const match of pbxproj.matchAll(groupRe)) {
    const [, id, , body] = match;
    const pathMatch = body.match(/\n\t\t\tpath = ([^;]+);/);
    const sourceTreeMatch = body.match(/\n\t\t\tsourceTree = ([^;]+);/);
    const children = [...body.matchAll(/\n\t\t\t\t([A-F0-9]{24})/g)].map((m) => m[1]);
    groups.set(id, {
      path: pathMatch?.[1]?.replace(/^"|"$/g, ''),
      sourceTree: sourceTreeMatch?.[1] ?? '<group>',
      children,
    });
  }
  return groups;
}

function parsePbxFileRefs(pbxproj) {
  /** @type {Map<string, { path: string, sourceTree: string, name?: string }>} */
  const refs = new Map();
  const refRe =
    /([A-F0-9]{24}) \/\* ([^*]+) \*\/ = \{isa = PBXFileReference;([^}]+)\};/g;
  for (const match of pbxproj.matchAll(refRe)) {
    const [, id, , body] = match;
    const pathMatch = body.match(/path = ([^;]+);/);
    const sourceTreeMatch = body.match(/sourceTree = ([^;]+);/);
    const nameMatch = body.match(/name = ([^;]+);/);
    if (!pathMatch || !sourceTreeMatch) {
      continue;
    }
    refs.set(id, {
      path: pathMatch[1],
      sourceTree: sourceTreeMatch[1],
      name: nameMatch?.[1],
    });
  }
  return refs;
}

/**
 * Resolve a PBX group directory the way Xcode joins sourceTree + path.
 * @param {string} groupId
 * @param {Map<string, { path?: string, sourceTree: string, children: string[] }>} groups
 * @param {Map<string, { path?: string, sourceTree: string }>} groupPathCache
 */
function resolveGroupDir(groupId, groups, groupPathCache = new Map()) {
  if (groupPathCache.has(groupId)) {
    return groupPathCache.get(groupId);
  }
  const group = groups.get(groupId);
  assert.ok(group, `unknown PBXGroup ${groupId}`);
  let base = srcRoot;
  if (group.sourceTree === 'SOURCE_ROOT') {
    base = srcRoot;
  } else if (group.sourceTree === '"<group>"') {
    base = srcRoot;
  } else {
    throw new Error(`unsupported group sourceTree: ${group.sourceTree}`);
  }
  const dir = group.path ? path.resolve(base, group.path) : base;
  groupPathCache.set(groupId, dir);
  return dir;
}

/**
 * Resolve a PBXFileReference path using its sourceTree and parent group directory.
 */
function resolveFileRefPath(fileRef, parentGroupId, groups) {
  const parentDir = resolveGroupDir(parentGroupId, groups);
  if (fileRef.sourceTree === 'SOURCE_ROOT') {
    return path.resolve(srcRoot, fileRef.path);
  }
  if (fileRef.sourceTree === '"<group>"') {
    return path.resolve(parentDir, fileRef.path);
  }
  throw new Error(`unsupported fileRef sourceTree: ${fileRef.sourceTree}`);
}

function realpathSafe(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

const APP_BUNDLE_ID = 'dev.local.instagram-recommendation-blocker';
const EXTENSION_BUNDLE_ID = `${APP_BUNDLE_ID}.Extension`;
const viewControllerPath = path.join(
  safariDir,
  'Instagram Recommendation Blocker',
  'Instagram Recommendation Blocker',
  'ViewController.swift',
);

function assertSafariProjectExists() {
  assert.ok(fs.existsSync(pbxprojPath), `missing Xcode project: ${pbxprojPath}`);
}

function assertEmbeddedBundleIdentifierPrefix() {
  const pbxproj = fs.readFileSync(pbxprojPath, 'utf8');
  assert.doesNotMatch(
    pbxproj,
    /Instagram-Recommendation-Blocker/,
    'parent app bundle ID must not use mismatched casing or hyphens',
  );

  const appIdMatches = [
    ...pbxproj.matchAll(
      new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = "${APP_BUNDLE_ID.replace(/\./g, '\\.')}";`, 'g'),
    ),
  ];
  const extensionIdMatches = [
    ...pbxproj.matchAll(
      new RegExp(
        `PRODUCT_BUNDLE_IDENTIFIER = "${EXTENSION_BUNDLE_ID.replace(/\./g, '\\.')}";`,
        'g',
      ),
    ),
  ];
  assert.equal(
    appIdMatches.length,
    2,
    'parent app PRODUCT_BUNDLE_IDENTIFIER must be set in Debug and Release',
  );
  assert.equal(
    extensionIdMatches.length,
    2,
    'extension PRODUCT_BUNDLE_IDENTIFIER must be set in Debug and Release',
  );
  assert.ok(
    EXTENSION_BUNDLE_ID.startsWith(`${APP_BUNDLE_ID}.`),
    'embedded extension bundle ID must be prefixed with parent app bundle ID',
  );

  const viewController = fs.readFileSync(viewControllerPath, 'utf8');
  assert.match(
    viewController,
    new RegExp(
      `extensionBundleIdentifier = "${EXTENSION_BUNDLE_ID.replace(/\./g, '\\.')}"`,
    ),
    'ViewController.swift must reference the extension bundle identifier',
  );
}

function assertPbxprojReferencesSharedExtension() {
  const pbxproj = fs.readFileSync(pbxprojPath, 'utf8');
  assert.match(
    pbxproj,
    /Instagram Recommendation Blocker Extension/,
    'Safari web-extension target must exist',
  );
  assert.match(
    pbxproj,
    /com\.apple\.product-type\.app-extension/,
    'extension target product type',
  );

  const groups = parsePbxGroups(pbxproj);
  const fileRefs = parsePbxFileRefs(pbxproj);
  const resourcesGroup = groups.get(RESOURCES_GROUP_ID);
  assert.ok(resourcesGroup, 'extension Resources PBXGroup must exist');

  for (const entry of REQUIRED_SHARED_ENTRIES) {
    const refId = SHARED_FILE_REF_IDS[entry];
    const fileRef = fileRefs.get(refId);
    assert.ok(fileRef, `missing PBXFileReference for shared extension/${entry}`);

    const resolved = resolveFileRefPath(fileRef, RESOURCES_GROUP_ID, groups);
    const expected = path.join(extensionDir, entry);
    assert.equal(
      realpathSafe(resolved),
      realpathSafe(expected),
      `Safari reference for ${entry} must canonicalize to repo extension/${entry} (got ${resolved})`,
    );
    assert.ok(fs.existsSync(resolved), `resolved shared path must exist: ${resolved}`);

    const groupRelative = path.resolve(
      resolveGroupDir(RESOURCES_GROUP_ID, groups),
      fileRef.path,
    );
    assert.notEqual(
      realpathSafe(groupRelative),
      realpathSafe(expected),
      `must not resolve only via Resources group dir (safari/extension): ${groupRelative}`,
    );
  }
}

function collectFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) {
      continue;
    }
    if (stat.isDirectory()) {
      if (name.endsWith('.xcodeproj') || name === 'xcuserdata') {
        continue;
      }
      collectFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function assertNoDuplicateBlockingLogic() {
  const safariFiles = collectFiles(safariDir);
  const duplicateCandidates = safariFiles.filter((file) => {
    const rel = path.relative(safariDir, file);
    if (rel.endsWith('.swift') || rel.endsWith('.storyboard')) {
      return false;
    }
    if (rel.includes('Assets.xcassets')) {
      return false;
    }
    if (rel.endsWith('.plist') || rel.endsWith('.png') || rel.endsWith('.html')) {
      if (rel.includes('Instagram Recommendation Blocker/Resources/')) {
        return false;
      }
    }
    if (rel.endsWith('.js') || rel.endsWith('.css')) {
      if (rel.includes('Instagram Recommendation Blocker/Resources/')) {
        return false;
      }
      return true;
    }
    return false;
  });

  assert.deepEqual(
    duplicateCandidates,
    [],
    `Safari wrapper must not copy blocking logic files: ${duplicateCandidates.join(', ')}`,
  );

  for (const rel of BLOCKING_LOGIC_FILES) {
    const shared = path.join(extensionDir, rel);
    assert.ok(fs.existsSync(shared), `shared file missing: ${shared}`);
  }
}

function assertSharedManifestMatchesSafariBundleLayout() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'),
  );
  assert.equal(manifest.action.default_popup, 'popup/popup.html');
  assert.deepEqual(manifest.content_scripts[0].js, [
    'content/home-for-you-block.js',
    'content/content.js',
  ]);
}

assertSafariProjectExists();
assertEmbeddedBundleIdentifierPrefix();
assertPbxprojReferencesSharedExtension();
assertNoDuplicateBlockingLogic();
assertSharedManifestMatchesSafariBundleLayout();

console.log('task-1.2-verify: all checks passed');
