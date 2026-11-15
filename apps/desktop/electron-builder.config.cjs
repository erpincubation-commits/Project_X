const path = require('node:path');
const required = process.env.ERP_REQUIRE_SIGNING === 'true';
if (required && !process.env.WIN_CSC_LINK && !process.env.CSC_LINK) throw new Error('Signed packaging requires WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD from a protected signing environment.');

module.exports = {
  appId: 'com.smberp.desktop', productName: 'SMB ERP',
  executableName: 'SMB ERP',
  directories: { output: '../../release' },
  electronDist: path.resolve(__dirname, '../../node_modules/electron/dist'),
  files: ['dist/main/**/*', 'dist/renderer/**/*', 'package.json', '!**/*.map', '!**/node_modules/zod/src{,/**/*}'],
  asar: true,
  forceCodeSigning: required,
  win: { target: [{ target: 'nsis', arch: ['x64'] }], requestedExecutionLevel: 'asInvoker' },
  nsis: {
    artifactName: 'SMB-ERP-${version}-${arch}-setup.${ext}',
    oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true, createStartMenuShortcut: true,
    deleteAppDataOnUninstall: false
  },
  afterPack: async context => {
    const { listPackage } = await import('@electron/asar');
    const entries = listPackage(path.join(context.appOutDir, 'resources/app.asar')).map(entry => entry.replaceAll('\\', '/'));
    const disallowed = entries.find(entry => /(^|\/)(\.env(?:\.[^/]*)?|\.local|server|test|tests)(\/|$)|\.(db|sqlite|sqlite3|pfx|p12|pem|key)$/i.test(entry));
    if (disallowed) throw new Error('Desktop archive contains an unexpected server, test, database, or secret file. Packaging stopped.');
    if (!entries.includes('/dist/main/main.js') || !entries.includes('/dist/main/preload.js') || !entries.includes('/dist/renderer/index.html') || !entries.includes('/node_modules/@erp/logging/dist/index.js') || !entries.includes('/node_modules/@erp/contracts/dist/index.js')) throw new Error('Desktop archive is missing a required runtime asset.');
  }
};
