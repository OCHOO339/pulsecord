const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const tooling = createRequire(path.resolve('upstream/equicord/package.json'));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    try {
        const { transform } = tooling('esbuild');
        const base = 'upstream/equicord/src/userplugins/pulsecord/';
        const code = {};
        for (const file of ['index.tsx', 'brand.ts', 'startup.ts', 'branding.ts', 'inbox.tsx', 'home-navigation.ts', 'markdown.tsx', 'dm-section.tsx']) code[file] = (await transform(await fs.readFile(base + file, 'utf8'), { loader: file.endsWith('tsx') ? 'tsx' : 'ts', format: 'cjs' })).code;
        code.publicDmFixture = await fs.readFile('.cache/discord-public/dm-list-fixture.js', 'utf8').catch(() => '');
        const css = await fs.readFile(base + 'style.css', 'utf8');
        const window = new BrowserWindow({ show: false, width: 900, height: 600, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
        await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#202024;color:#eee;font-family:system-ui}main{padding:48px}' + css + '</style></head><body><main id="root"></main></body></html>'));
        const result = await window.webContents.executeJavaScript(`(async () => {
            const code = ${JSON.stringify(code)};
            function load(source, require) { const module = { exports: {} }; new Function('require', 'module', source)(require, module); return module.exports; }
            const brand = load(code['brand.ts'], () => {});
            const startup = load(code['startup.ts'], () => {});
            const branding = load(code['branding.ts'], () => {});
            const routes = []; let pinsEnabled = false;
            const React = { memo: component => component, isValidElement: value => value instanceof Node, useRef: () => ({current:null}), useEffect: () => {}, useSyncExternalStore: (_, get) => get(), createElement(type, props, ...children) {
                props ||= {};
                if (typeof type === 'function') { const node = type({ ...props, children }); if(node && props.key) node.key = props.key; return node; }
                const node = document.createElement(type);
                for (const [key, value] of Object.entries(props)) { if (key === 'onClick') node.addEventListener('click', value); else if (value !== undefined && !['children','key','ref'].includes(key)) node.setAttribute(key === 'className' ? 'class' : key, String(value)); }
                for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : String(child));
                return node;
            } };
            const mocks = {
                './style.css': {}, './brand': brand, './startup': startup, './branding': branding,
                './updates': { startUpdates: () => {}, stopUpdates: () => {}, UpdatesTab: () => null },
                './inbox-store': { subscribeInbox: () => () => {}, getInboxMessages: () => [{id:'welcome',timestamp:1700000000000,text:'Bienvenue sur PulseCord. Retrouvez ici les annonces et les mises à jour officielles de votre client.',read:true}], getInboxUnread: () => 1, isInboxOpen: () => true, setInboxOpen: () => {}, loadInbox: async () => {}, stopInboxStore: () => {}, addInboxUpdate: () => {} },
                '@api/PluginManager': {isPluginEnabled: () => pinsEnabled},
                '@plugins/pinDms': {__esModule:true,default:{sections:[2,3,1]}},
                '@api/Settings': { definePluginSettings: () => ({ store: {}, use: () => ({}) }) },
                '@components/ErrorBoundary': { __esModule: true, default: { wrap: component => component } },
                '@components/Icons': { MainSettingsIcon: () => null },
                '@plugins/_core/settings': { __esModule: true, default: { customEntries: [] } },
                '@utils/constants': { Devs: { PulseCord: { name: 'PulseCord contributors', id: 0n } } },
                '@utils/types': { __esModule: true, default: plugin => plugin, OptionType: { BOOLEAN: 1, SELECT: 2 } },
                '@webpack/common': { React, Parser: {parse(text,inline,options){if(!options.allowHeading || !options.allowList)throw Error('Announcement parser must enable headings and lists');return [text];}}, NavigationRouter: { transitionTo: route => routes.push(route) }, createRoot: container => ({render: node => container.replaceChildren(node), unmount: () => container.replaceChildren()}) }
            };
            mocks['./markdown'] = load(code['markdown.tsx'], name => mocks[name]);
            const inbox = load(code['inbox.tsx'], name => { if (!(name in mocks)) throw Error('Unmocked inbox import: ' + name); return mocks[name]; });
            mocks['./inbox'] = inbox;
            mocks['./dm-section'] = load(code['dm-section.tsx'], name => mocks[name]);
            const homeNavigation = load(code['home-navigation.ts'], name => mocks[name]);
            mocks['./home-navigation'] = homeNavigation;
            const ui = load(code['index.tsx'], name => { if (!(name in mocks)) throw Error('Unmocked import: ' + name); return mocks[name]; });
            let dmSource = 'return new class Host {props=Object.freeze({privateChannelIds:Object.freeze(["real-dm"])});getSectionHeight=e=>24*(0!==e);renderSection=e=>{const h=document.createElement("h2");h.textContent="Messages privés";h.style.cssText="height:24px;margin:0;font-size:12px";return e.section===0?null:h;};getRowHeight=(section,row)=>44;}';
            for (const patch of ui.default.patches[0].replacement) {
                const match = new RegExp(patch.match.source.replaceAll('\\\\i', '[A-Za-z_$][\\\\w$]*'));
                if (!match.test(dmSource)) throw Error('DM section patch did not match fixture');
                if (code.publicDmFixture && !match.test(code.publicDmFixture)) throw Error('DM section patch did not match the public Discord module');
                dmSource = dmSource.replace(match, patch.replace);
            }
            const dmList = new Function('$self', dmSource)(ui.default);
            const section = dmList.renderSection({section:1});
            if (dmList.getSectionHeight(1) !== 64 || dmList.getSectionHeight(0) !== 0 || section.firstElementChild.tagName !== 'H2' || section.lastElementChild.tagName !== 'BUTTON' || dmList.props.privateChannelIds.join(',') !== 'real-dm') throw Error('PulseCord must follow the DM heading with reserved height');
            pinsEnabled = true;
            if(dmList.getSectionHeight(1) !== 24 || dmList.getSectionHeight(2) !== 64 || dmList.renderSection({section:1}).tagName !== 'H2' || !dmList.renderSection({section:2}).querySelector('.pc-dm-row')) throw Error('PulseCord must preserve pinned categories');
            pinsEnabled = false;
            const style = document.createElement('style'); style.textContent = branding.brandingCss(brand.brand.logo, brand.brand.splashLogo, brand.brand.fontCss); document.head.append(style);
            const loadedFonts = await document.fonts.load('400 16px Cause', 'PulseCord éà');
            if (!loadedFonts.length || !document.fonts.check('700 16px Cause')) throw Error('Cause did not load from the bundled font');
            const fixtures = document.createElement('div'); fixtures.id = 'branding-fixtures'; fixtures.innerHTML = '<svg id="home-logo" width="32" height="32"><path d="M19.73 4.87h1v1z" /></svg><svg id="legacy-logo"><path d="M13.545 2.907h1v1z" /></svg><svg id="other-icon"><path d="M4 2.5h1v1z" /></svg><div id="title-wordmark" class="wordmarkWindows__test"><svg></svg></div><div id="auth-logo" class="discordLogo__test"></div><img id="personal-avatar" src="data:image/png;base64,iVBORw0KGgo=" alt="Discord"><div id="splash"><div class="splash-inner"><img id="native-splash-logo" src="data:image/png;base64,iVBORw0KGgo="></div></div><div class="container_a2f514"><video id="loading-video"></video></div>';
            document.querySelector('#root').append(fixtures);
            const home = document.createElement('a'); home.href = '/channels/@me';
            home.dataset.listItemId = 'guildsnav___home'; home.style.cssText = 'display:block;width:48px;height:48px';
            home.innerHTML = '<div class="childWrapper__test discordLogo__home" style="width:48px;height:48px;border-radius:14px"><svg width="24" height="24"><path d="M0 0h24v24z" /></svg></div>';
            fixtures.append(home);
            let homeClicks = 0; home.addEventListener('click', event => { event.preventDefault(); homeClicks++; }); home.click();
            const friends = document.createElement('a'); friends.href = '/channels/@me'; friends.innerHTML = '<svg width="24" height="24"><path d="M1 1h1v1z" /></svg>Amis'; fixtures.append(friends);
            const modernHome = document.createElement('div'); modernHome.dataset.guildsBarHome = 'true';
            modernHome.innerHTML = '<div role="button" aria-owns="guild-list-unread-dms" tabindex="0" style="width:40px;height:40px"><svg width="24" height="24"><path d="M0 0h1v1z" /></svg></div>';
            fixtures.append(modernHome);
            homeNavigation.startHomeNavigation();
            const target = modernHome.querySelector('svg');
            target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
            modernHome.firstElementChild.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
            modernHome.firstElementChild.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));
            friends.addEventListener('click', event => event.preventDefault()); friends.click();
            target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));
            if(routes.length !== 3 || routes.some(route => route !== '/channels/@me')) throw Error('Home mouse/keyboard routing failed or intercepted another link');
            homeNavigation.stopHomeNavigation(); target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
            if(routes.length !== 3) throw Error('Home navigation listener was not removed');
            const primary = document.createElement('button');
            primary.style.cssText = 'background:var(--control-primary-background-default);color:var(--control-primary-text-default)';
            fixtures.append(primary);
            const brandingChecks = {
                dmButtonGold: getComputedStyle(home, '::before').backgroundColor === 'rgb(248, 195, 50)',
                dmOriginalHidden: getComputedStyle(home.querySelector('svg')).opacity === '0',
                dmPulseMask: getComputedStyle(home, '::after').maskImage.includes(brand.brand.logo),
                dmGeometryPreserved: home.getBoundingClientRect().width === 48 && home.firstElementChild.getBoundingClientRect().width === 48 && parseFloat(getComputedStyle(home, '::after').width) <= 32,
                dmClickPreserved: homeClicks === 1 && getComputedStyle(home, '::after').pointerEvents === 'none',
                friendsLinkPreserved: getComputedStyle(friends.querySelector('svg')).opacity === '1' && getComputedStyle(friends, '::after').content === 'none',
                modernHomeBranded: getComputedStyle(modernHome.firstElementChild,'::after').maskImage.includes(brand.brand.logo),
                homeRoutesFromMouseAndKeyboard: routes.length === 3,
                primaryButtonGold: getComputedStyle(primary).backgroundColor === 'rgb(248, 195, 50)',
                primaryTextReadable: getComputedStyle(primary).color === 'rgb(33, 26, 8)',
                linkAccentGold: getComputedStyle(document.documentElement).getPropertyValue('--text-link').trim() === '#f8c332',
                homeReplaced: getComputedStyle(document.querySelector('#home-logo')).backgroundImage.includes(brand.brand.logo),
                oldPathsHidden: getComputedStyle(document.querySelector('#legacy-logo path')).opacity === '0',
                unrelatedIconPreserved: getComputedStyle(document.querySelector('#other-icon path')).visibility === 'visible',
                titleReplaced: getComputedStyle(document.querySelector('#title-wordmark'), '::after').content === '"PulseCord"',
                authReplaced: getComputedStyle(document.querySelector('#auth-logo')).backgroundImage.includes(brand.brand.logo),
                personalAvatarPreserved: getComputedStyle(document.querySelector('#personal-avatar')).content === 'normal',
                nativeSplashReplaced: getComputedStyle(document.querySelector('#native-splash-logo')).content.includes(brand.brand.splashLogo),
                loadingVideoHidden: getComputedStyle(document.querySelector('#loading-video')).visibility === 'hidden'
            };
            const favicon = document.createElement('link'); favicon.rel = 'icon'; favicon.href = 'https://discord.com/original.ico'; document.head.append(favicon);
            branding.brandFavicons(brand.brand.logo); brandingChecks.faviconReplaced = favicon.href === brand.brand.logo;
            branding.restoreBrandFavicons(); brandingChecks.faviconRestored = favicon.href === 'https://discord.com/original.ico';
            window.showPulseHomePreview = () => {
                const root = document.querySelector('#root'); root.replaceChildren(); root.style.cssText = 'padding:32px;display:flex;gap:24px;align-items:flex-start';
                for (const size of [40,48]) { const clone = home.cloneNode(true); clone.style.cssText = 'display:block;position:relative;width:'+size+'px;height:'+size+'px'; clone.firstElementChild.style.width = size+'px'; clone.firstElementChild.style.height = size+'px'; root.append(clone); }
            };
            fixtures.remove();
            document.querySelector('#root').style.cssText = 'display:flex;padding:0;height:100vh';
            const sidebar = document.createElement('aside'); sidebar.className = 'sidebar__preview'; sidebar.style.cssText = 'width:240px;flex-shrink:0;background:#171719;padding-top:24px'; sidebar.append(section);
            const page = document.createElement('div'); page.className = 'page__preview'; page.style.cssText = 'flex:1;position:relative'; page.append(inbox.OfficialConversation());
            document.querySelector('#root').append(sidebar,page);
            inbox.startOfficialInbox();
            window.checkInboxLifecycle = async () => {
                document.querySelector('.pc-dm-row').click(); inbox.handleInboxNavigation(); await new Promise(resolve => setTimeout(resolve, 120));
                if (!document.querySelector('.pc-inbox-root .pc-official-chat')) throw Error('DM click did not open the conversation');
                inbox.handleInboxNavigation();
                if (document.querySelector('.pc-inbox-root')) throw Error('Conversation did not unmount');
                inbox.stopOfficialInbox();
                return true;
            };
            window.startPulseCordSplash = () => startup.showStartup(brand.brand.splashLogo, true);
            return { name: document.querySelector('h1').textContent, badge: document.querySelector('.pc-official').textContent, oldDashboardAbsent: !document.querySelector('.pc-welcome'), avatarLoaded: document.querySelector('.pc-chat-message img').src.startsWith('data:image/png;base64,'), brandingChecks };
        })()`);
        if (result.name !== 'PulseCord' || !result.badge.includes('OFFICIAL') || !result.oldDashboardAbsent || !result.avatarLoaded) throw Error(JSON.stringify(result));
        if (!Object.values(result.brandingChecks).every(Boolean)) throw Error(JSON.stringify(result.brandingChecks));
        await fs.mkdir('dist/qa', { recursive: true });
        await new Promise(resolve => setTimeout(resolve, 150));
        await fs.writeFile('dist/qa/pulsecord-welcome.png', (await window.webContents.capturePage()).toPNG());
        result.inboxLifecycle = await window.webContents.executeJavaScript('window.checkInboxLifecycle()');
        await window.webContents.executeJavaScript('window.startPulseCordSplash(); getComputedStyle(document.querySelector(".pc-startup")).opacity');
        await new Promise(resolve => setTimeout(resolve, 350));
        await window.webContents.executeJavaScript('for (const animation of document.querySelector(".pc-startup").getAnimations({subtree:true})) { animation.pause(); animation.currentTime = 350; }');
        result.splashFrame = await window.webContents.executeJavaScript('({ overlayOpacity: getComputedStyle(document.querySelector(".pc-startup")).opacity, logoOpacity: getComputedStyle(document.querySelector(".pc-startup img")).opacity, blur: getComputedStyle(document.querySelector(".pc-startup")).backdropFilter })');
        if (result.splashFrame.overlayOpacity !== '1' || result.splashFrame.logoOpacity !== '1') throw Error('Splash is not fully visible at its midpoint');
        await fs.writeFile('dist/qa/pulsecord-startup.png', (await window.webContents.capturePage()).toPNG());
        await new Promise(resolve => setTimeout(resolve, 900));
        result.splashRemoved = await window.webContents.executeJavaScript('document.querySelector(".pc-startup") === null');
        if (!result.splashRemoved) throw Error('Startup overlay was not cleaned up');
        await window.webContents.executeJavaScript(`document.querySelector('#root').innerHTML = '<div style="display:flex;gap:32px;align-items:center"><a href="/channels/@me" aria-label="Messages privés"><div class="childWrapper__preview" style="display:grid;place-items:center;width:48px;height:48px;border-radius:14px"><svg width="24" height="24"><path d="M0 0h24v24z" /></svg></div></a><div><h2 style="margin:0 0 16px">PulseCord</h2><a style="color:var(--text-link)">Messages privés</a><div style="margin-top:24px"><button style="padding:12px 20px;border:0;border-radius:8px;background:var(--control-primary-background-default);color:var(--control-primary-text-default)">Ajouter un ami</button><label style="margin-left:24px"><input type="checkbox" checked> Activé</label></div><p><span style="color:var(--mention-foreground);background:var(--mention-background);padding:4px;border-radius:4px">@PulseCord</span></p></div></div>'`);
        await new Promise(resolve => setTimeout(resolve, 100));
        await fs.writeFile('dist/qa/pulsecord-accents.png', (await window.webContents.capturePage()).toPNG());
        await window.webContents.executeJavaScript('window.showPulseHomePreview()');
        await new Promise(resolve => setTimeout(resolve, 100));
        await fs.writeFile('dist/qa/pulsecord-home.png', (await window.webContents.capturePage()).toPNG());
        await fs.writeFile('dist/qa/client-ui.json', JSON.stringify(result, null, 2)); app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});
