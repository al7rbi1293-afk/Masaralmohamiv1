const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/private/defaults/exclusionList").default;

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const appNodeModules = path.resolve(projectRoot, "node_modules");
const reactNativeNodeModules = path.resolve(appNodeModules, "react-native/node_modules");
const workspaceNodeModules = path.resolve(workspaceRoot, "node_modules");
const virtualizedListsRoot = path.resolve(appNodeModules, "@react-native/virtualized-lists");

const config = getDefaultConfig(projectRoot);

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  appNodeModules,
  reactNativeNodeModules,
  workspaceNodeModules,
];
config.resolver.disableHierarchicalLookup = false;
config.resolver.blockList = exclusionList([
  new RegExp(`^${escapeRegExp(path.join(workspaceNodeModules, "react"))}\\/.*$`),
  new RegExp(`^${escapeRegExp(path.join(workspaceNodeModules, "scheduler"))}\\/.*$`),
]);
config.resolver.extraNodeModules = {
  react: path.resolve(appNodeModules, "react"),
  "react/jsx-runtime": path.resolve(appNodeModules, "react/jsx-runtime"),
  "react/jsx-dev-runtime": path.resolve(appNodeModules, "react/jsx-dev-runtime"),
  "react-native": path.resolve(appNodeModules, "react-native"),
  "expo-asset": path.resolve(appNodeModules, "expo-asset"),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@react-native/virtualized-lists") {
    return {
      type: "sourceFile",
      filePath: path.join(virtualizedListsRoot, "index.js"),
    };
  }

  if (moduleName.startsWith("@react-native/virtualized-lists/")) {
    const relativePath = moduleName.slice("@react-native/virtualized-lists/".length);
    return {
      type: "sourceFile",
      filePath: path.join(virtualizedListsRoot, `${relativePath}.js`),
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
