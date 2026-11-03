const presets = { Midnight: ['#151519','#202026'], AMOLED: ['#000000','#0b0b0b'], Glass: ['#202428','#2c343b'], Neon: ['#101513','#17241e'], Minimal: ['#202020','#292929'] };
document.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => {
    const colors = presets[button.dataset.theme];
    document.querySelector('#swatch').style.setProperty('--palette', colors[0]);
    document.querySelector('#swatch').style.setProperty('--secondary', colors[1]);
    document.querySelector('#palette-name').textContent = button.dataset.theme;
    document.querySelector('#palette-code').textContent = colors.join(' / ');
    document.querySelectorAll('[data-theme]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
}));
