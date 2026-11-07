// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const lock = JSON.parse(readFileSync('upstream.lock.json', 'utf8'));
const brand = JSON.parse(readFileSync('brand.json', 'utf8'));
const updates = JSON.parse(readFileSync('updates.json', 'utf8'));
cpSync('pulse.png', 'assets/pulsecord-logo.png');
cpSync('pulse.png', 'packages/installer/assets/pulsecord-logo.png');
cpSync('assets/fonts', 'packages/installer/assets/fonts', { recursive: true });
cpSync('packages/updates/loader.cjs', 'packages/installer/loader.cjs');
if (!/^[A-Za-z][A-Za-z0-9 -]{1,30}$/.test(brand.name)) throw Error('Invalid brand name');
for (const [name, entry] of Object.entries(lock)) {
    const dir = resolve('upstream', name);
    if (!existsSync(dir + '/.git')) {
        execFileSync('git', ['clone', entry.url, dir], { stdio: 'inherit' });
        execFileSync('git', ['-C', dir, 'checkout', entry.commit], { stdio: 'inherit' });
    }
    const sha = execFileSync('git', ['-c', `safe.directory=${dir.replaceAll('\\', '/')}`, '-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (sha !== entry.commit) throw Error(`${name}: unexpected revision ${sha}`);
}
const base = 'upstream/equicord/';
if (process.argv.includes('--fetch-only')) process.exit(0);
const { restorePluginUi, preparePluginLocalization, prepareCustomPluginLocalization } = await import('./localize-plugins.mjs');
restorePluginUi(base);
function patch(file, changes) {
    // Always derive the small overlay from the pinned source, never mutate an arbitrary revision.
    const dir = resolve(base).replaceAll('\\', '/');
    let text = execFileSync('git', ['-c', `safe.directory=${dir}`, '-C', dir, 'show', `HEAD:${file}`], { encoding: 'utf8' });
    for (const [from, to] of changes) {
        if (!text.includes(from)) throw Error(`Missing upstream anchor: ${file}: ${from}`);
        text = text.replaceAll(from, to);
    }
    writeFileSync(base + file, text);
}
patch('src/plugins/_core/settings.tsx', [
    ['import { BackupRestoreIcon,', 'import { BackupsTab as PulseBackupsTab } from "@pulsecord/backups";\nimport { BackupRestoreIcon,'],
    ['Component: BackupAndRestoreTab,', 'Component: PulseBackupsTab,'],
    ['title: "Backup & Restore",', 'title: "Sauvegarde et restauration",'],
    ['    patches: [', `    patches: [
        {
            // Insert at the user-settings root as well as the shared layout
            // walker. Discord can change the walker independently of this root.
            find: 'analyticsKey:"user_settings"',
            replacement: {
                match: /buildLayout:(\\(\\)=>\\[[^\\]]*\\])(?=,analyticsKey:"user_settings")/,
                replace: 'buildLayout:()=>$self.buildLayout({key:"$Root",buildLayout:$1})'
            }
        },`],
    ['            buildEntry({\n                key: "equicord_main",\n                title: "Equicord",\n                panelTitle: "Equicord Settings",\n                Component: VencordTab,\n                Icon: MainSettingsIcon\n            }),\n', ''],
    ['"Equicord Settings"', `"${brand.name} Settings"`],
    ['            buildEntry({\n                key: "equicord_cloud",\n                title: "Cloud",\n                panelTitle: "Equicord Cloud",\n                Component: CloudTab,\n                Icon: CloudIcon\n            }),\n', ''],
    ['            buildEntry({\n                key: "equicord_changelog",\n                title: "Changelog",\n                Component: ChangelogTab,\n                Icon: LogIcon,\n            }),\n', ''],
    ['const rows = [`Equicord ${gitHashShort}${getVersionInfo()}`];', `const rows = [\`PulseCord ${brand.version} (\${gitHashShort})\${getVersionInfo()}\`];`],
    ['    name: "Settings",', '    name: "Settings",\n    isModified: true,']
]);
patch('src/api/Settings.ts', [['autoUpdate: true,', 'autoUpdate: false,'], ['autoUpdateNotification: true,', 'autoUpdateNotification: false,']]);
patch('src/api/UserArea.tsx', [
    ['import { Logger } from "@utils/Logger";', 'import { Logger } from "@utils/Logger";\nimport { React } from "@webpack/common";'],
    ['export const buttons = new Map<string, ButtonEntry>();', `export const buttons = new Map<string, ButtonEntry>();
let buttonRevision = 0;
const buttonListeners = new Set<() => void>();
function subscribeButtons(listener: () => void) { buttonListeners.add(listener); return () => { buttonListeners.delete(listener); }; }
function notifyButtons() { buttonRevision++; for (const listener of buttonListeners) listener(); }`],
    ['    buttons.set(id, { render, priority });', '    buttons.set(id, { render, priority });\n    notifyButtons();'],
    ['    buttons.delete(id);', '    if (buttons.delete(id)) notifyButtons();'],
    ['function UserAreaButtons({ props }: { props: UserAreaRenderProps; }) {', 'function UserAreaButtons({ props }: { props: UserAreaRenderProps; }) {\n    React.useSyncExternalStore(subscribeButtons, () => buttonRevision);']
]);
patch('src/components/settings/tabs/plugins/PluginCard.tsx', [
    ['import { PluginMeta } from "~plugins";', 'import { PluginMeta } from "~plugins";\nimport { brand } from "@pulsecord/brand";\nimport { translateUi, usePluginLocale } from "@pulsecord/localization";'],
    ['    const settings = Settings.plugins[plugin.name];', '    usePluginLocale();\n    const settings = Settings.plugins[plugin.name];'],
    ['description={plugin.description}', 'description={translateUi(plugin.description)}'],
    ['tooltip={tooltip}', 'tooltip={translateUi(tooltip)}'],
    ['src: "https://equicord.org/assets/icons/equicord/modified.png"', 'src: brand.logo'],
    ['src: "https://equicord.org/assets/favicon.png"', 'src: brand.logo'],
    ['src: "https://equicord.org/assets/icons/vencord/icon-light.png"', 'src: brand.logo'],
    ['src: "https://equicord.org/assets/icons/misc/userplugin.png"', 'src: brand.logo'],
    ['alt: "Equicord"', 'alt: "PulseCord"'], ['alt: "Vencord"', 'alt: "PulseCord"'],
    ['title: "Modified Vencord Plugin"', 'title: "PulseCord Plugin · modified"'],
    ['title: "Equicord Plugin"', 'title: "PulseCord Plugin"'], ['title: "Vencord Plugin"', 'title: "PulseCord Plugin"']
]);
patch('src/components/settings/tabs/plugins/index.tsx', [
    ['export default function PluginSettings() {', 'export default function PluginSettings() {\n    const localeRevision = usePluginLocale();'],
    ['import { PluginCard } from "./PluginCard";', 'import { PluginCard } from "./PluginCard";\nimport { usePluginLocale, cachedUiTranslation } from "@pulsecord/localization";'],
    ['plugin.description.toLowerCase().includes(search)', 'plugin.description.toLowerCase().includes(search) || cachedUiTranslation(plugin.description).toLowerCase().includes(search)'],
    ['}, [searchValue, search]);', '}, [searchValue, search, localeRevision]);'],
    ['Developer version of Equicord', 'Developer version of PulseCord'],
    ['Web Browser version of Equicord', 'Web Browser version of PulseCord'],
    ['This plugin is required for Equicord to function.', 'This plugin is required for PulseCord to function.'],
    ['Show Equicord', 'PulseCord · Extended'], ['Show Vencord', 'PulseCord · Standard']
]);
patch('src/components/settings/tabs/plugins/PluginModal.tsx', [
    ['import { PluginMeta } from "~plugins";', 'import { PluginMeta } from "~plugins";\nimport { translateUi, usePluginLocale } from "@pulsecord/localization";'],
    ['    const pluginSettings = useSettings', '    usePluginLocale();\n    const pluginSettings = useSettings'],
    ['{plugin.description}', '{translateUi(plugin.description)}']
]);
patch('src/components/settings/tabs/plugins/components/Common.tsx', [
    ['import { BaseText } from "@components/BaseText";', 'import { BaseText } from "@components/BaseText";\nimport { PluginText, usePluginLocale } from "@pulsecord/localization";'],
    ['    return (\n        <Tag', '    usePluginLocale();\n    return (\n        <Tag'],
    ['{name ?? wordsToTitle(wordsFromCamel(id))}', '{<PluginText text={name ?? wordsToTitle(wordsFromCamel(id))} />}'],
    ['>{description}</BaseText>', '><PluginText text={description} /></BaseText>']
]);
patch('src/components/settings/tabs/plugins/components/SelectSetting.tsx', [
    ['import { isSettingDisabled } from "@api/PluginManager";', 'import { isSettingDisabled } from "@api/PluginManager";\nimport { translateUi, usePluginLocale } from "@pulsecord/localization";'],
    ['    const def = pluginSettings[id]', '    usePluginLocale();\n    const def = pluginSettings[id]'],
    ['options={setting.options}', 'options={setting.options.map(option => ({ ...option, label: translateUi(option.label) }))}'],
    ['placeholder={setting.placeholder ?? "Select an option"}', 'placeholder={translateUi(setting.placeholder ?? "Select an option")}']
]);
for (const component of ['TextSetting', 'NumberSetting']) patch(`src/components/settings/tabs/plugins/components/${component}.tsx`, [
    ['import { isSettingDisabled } from "@api/PluginManager";', 'import { isSettingDisabled } from "@api/PluginManager";\nimport { translateUi, usePluginLocale } from "@pulsecord/localization";'],
    ['    const [state, setState]', '    usePluginLocale();\n    const [state, setState]'],
    [component === 'TextSetting' ? 'placeholder={setting.placeholder ?? "Enter a value"}' : 'placeholder={setting.placeholder ?? "Enter a number"}', component === 'TextSetting' ? 'placeholder={translateUi(setting.placeholder ?? "Enter a value")}' : 'placeholder={translateUi(setting.placeholder ?? "Enter a number")}']
]);
preparePluginLocalization(base);
patch('src/components/settings/tabs/BaseTab.tsx', [
    ['import ErrorBoundary from "@components/ErrorBoundary";', 'import ErrorBoundary from "@components/ErrorBoundary";\nimport { SettingsBanner } from "@pulsecord/settings-banner";'],
    ['<section className="vc-settings-tab">{children}</section>', '<section className="vc-settings-tab"><SettingsBanner />{children}</section>']
]);
patch('src/main/utils/constants.ts', [['"EquicordData"', '"PulseCordData"'], ['"Equicord", suffix', '"PulseCord", suffix']]);
patch('src/main/patcher.ts', [
    ['import { onceDefined } from "@shared/onceDefined";', 'import { onceDefined } from "@shared/onceDefined";\nimport { PulseWindow, PulseTray, brandDock } from "./pulsecordBrand";\nimport { installStartupCacheCleanup } from "./pulsecordStartupCache";'],
    ['    patchTrayMenu();', '    brandDock();\n    installStartupCacheCleanup(settings.plugins?.PulseCord?.clearCacheOnStartup !== false);\n    patchTrayMenu();'],
    ['class BrowserWindow extends electron.BrowserWindow', 'class BrowserWindow extends PulseWindow'],
    ['        BrowserWindow\n    };', '        BrowserWindow,\n        Tray: PulseTray\n    };'],
    ['require("./persistAfterDiscordUpdates");', ''],
    ['    if (!IS_VESKTOP && !IS_EQUIBOP) {\n        try {\n            require("./hostUpdateHook").installHostUpdateHook();\n        } catch (err) {\n            console.error("[Equicord] Failed to install host update hook", err);\n        }\n    }', '']
]);
patch('src/utils/constants.ts', [['export const Devs = /* #__PURE__*/ Object.freeze({', 'export const Devs = /* #__PURE__*/ Object.freeze({\n    PulseCord: { name: "PulseCord contributors", id: 0n, badge: false },']]);
patch('tsconfig.json', [['"paths": {', '"paths": {\n            "@pulsecord": ["./src/userplugins/pulsecord/index.tsx"],\n            "@pulsecord/brand": ["./src/userplugins/pulsecord/brand.ts"],\n            "@pulsecord/localization": ["./src/userplugins/pulsecord/localization.tsx"],\n            "@pulsecord/backups": ["./src/userplugins/pulsecord/backups.tsx"],\n            "@pulsecord/settings-banner": ["./src/userplugins/pulsecord/settings-banner.tsx"],\n            "@pulsecord/backup-core": ["./src/main/pulsecordBackupCore.mjs"],\n            "@pulsecord/launcher-state": ["./src/main/pulsecordLauncherState.cjs"],\n            "@pulsecord/branding": ["./src/userplugins/pulsecord/branding.ts"],\n            "@pulsecord/update-core": ["./src/main/pulsecordUpdateCore.mjs"],\n            "@pulsecord/update-protocol": ["./src/main/pulsecordUpdateProtocol.mjs"],\n            "electron": ["./node_modules/standalone-electron-types/electron.d.ts"],']]);
mkdirSync(base + 'src/userplugins', { recursive: true });
cpSync('packages/pulsecord', base + 'src/userplugins/pulsecord', { recursive: true });
cpSync('packages/focus', base + 'src/userplugins/pulsecordFocus', { recursive: true });
cpSync('packages/iosEmojis', base + 'src/userplugins/iosEmojis', { recursive: true });
writeFileSync(base + 'src/userplugins/iosEmojis/font.ts', `export const fontUrl = "data:font/woff2;base64,${readFileSync('packages/iosEmojis/apple-emoji.woff2').toString('base64')}";\n`);
cpSync('packages/voicekeeper', base + 'src/plugins/bypassvoc', { recursive: true });
prepareCustomPluginLocalization(base);
cpSync('packages/pulsecord/nativeBrand.ts', base + 'src/main/pulsecordBrand.ts');
cpSync('packages/pulsecord/startup-cache.ts', base + 'src/main/pulsecordStartupCache.ts');
cpSync('packages/backup/core.mjs', base + 'src/main/pulsecordBackupCore.mjs');
cpSync('packages/installer/launcher-state.cjs', base + 'src/main/pulsecordLauncherState.cjs');
cpSync('packages/installer/core.mjs', base + 'src/main/pulsecordUpdateCore.mjs');
cpSync('packages/updates/protocol.mjs', base + 'src/main/pulsecordUpdateProtocol.mjs');
const logo = `data:image/png;base64,${readFileSync('assets/pulsecord-avatar.png').toString('base64')}`;
const splashLogo = `data:image/png;base64,${readFileSync('assets/pulsecord-splash.png').toString('base64')}`;
const inboxBackground = `data:image/jpeg;base64,${readFileSync('assets/pulsecord-inbox-background.jpg').toString('base64')}`;
writeFileSync(base + 'src/userplugins/pulsecord/inbox-background.ts', `export const inboxBackground = ${JSON.stringify(inboxBackground)};\n`);
const fontCss = readFileSync('assets/fonts/cause.css', 'utf8').replace(/url\(([^)]+)\)/g, (_, file) => `url("data:font/woff2;base64,${readFileSync('assets/fonts/' + file).toString('base64')}")`);
writeFileSync(base + 'src/userplugins/pulsecord/brand.ts', `export const brand = ${JSON.stringify({ ...brand, logo, splashLogo, updates, fontCss })};\n`);
cpSync(base + 'LICENSE', 'LICENSE');
console.log(`Prepared ${brand.name} ${brand.version} on Equicord ${lock.equicord.commit}`);
