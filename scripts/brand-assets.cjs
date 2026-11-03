const { app, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    try {
        const image = nativeImage.createFromPath(path.resolve('pulse.png'));
        if (image.isEmpty()) throw Error('PulseCord logo could not be loaded');
        await fs.mkdir('build', { recursive: true });
        const sizes = [256, 128, 64, 48, 32, 16];
        const images = sizes.map(size => image.resize({ width: size, height: size, quality: 'best' }).toPNG());
        const header = Buffer.alloc(6 + images.length * 16);
        header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
        let offset = header.length;
        images.forEach((png, index) => {
            const entry = 6 + index * 16;
            header[entry] = sizes[index] === 256 ? 0 : sizes[index];
            header[entry + 1] = header[entry];
            header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
            header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
            offset += png.length;
        });
        await fs.writeFile('build/icon.ico', Buffer.concat([header, ...images]));
        await fs.writeFile('build/icon.png', image.resize({ width: 512, height: 512, quality: 'best' }).toPNG());
        await fs.writeFile('assets/pulsecord-avatar.png', image.resize({ width: 64, height: 64, quality: 'best' }).toPNG());
        await fs.writeFile('assets/pulsecord-splash.png', image.resize({ width: 256, height: 256, quality: 'best' }).toPNG());
        console.log('PulseCord Windows ICO and PNG generated from the supplied logo.'); app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});
