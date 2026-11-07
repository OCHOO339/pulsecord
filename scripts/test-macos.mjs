import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
if(process.platform!=='darwin')throw Error('macOS build verification must run on macOS');
const app=resolve('release/mac-universal/PulseCord Installer.app');
const binary=app+'/Contents/MacOS/PulseCord Installer';
const architectures=execFileSync('lipo',['-archs',binary],{encoding:'utf8'}).trim().split(/\s+/);
if(!architectures.includes('x86_64')||!architectures.includes('arm64'))throw Error('The DMG must contain both Intel and Apple Silicon slices');
execFileSync('codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});
console.log('Universal macOS installer and ad-hoc code signatures verified.');
