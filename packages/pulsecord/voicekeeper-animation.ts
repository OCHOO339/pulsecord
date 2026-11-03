// SPDX-License-Identifier: GPL-3.0-or-later
// Original circle/slash artwork. The segment ranges follow Discord's mute
// control so the native player handles hover, click, visibility and motion.
export const voiceKeeperMarkers = {
    idle_enabled: { name: "idle_enabled", start: 70, duration: 1 },
    idle_disabled: { name: "idle_disabled", start: 170, duration: 1 },
    enable: { name: "enable", start: 0, duration: 70 },
    disable: { name: "disable", start: 100, duration: 70 },
    hover_disabled: { name: "hover_disabled", start: 180, duration: 40 },
    hover_enabled: { name: "hover_enabled", start: 240, duration: 40 }
};
const fixed = (k: unknown) => ({ a: 0, k });
const animated = (frames: [number, number[]][]) => ({ a: 1, k: frames.map(([t, s], index) => ({ t, s, ...(index === frames.length - 1 ? {} : { i: { x: [.667], y: [1] }, o: { x: [.167], y: [0] } }) })) });
const transform = { ty: "tr", p: fixed([0, 0]), a: fixed([0, 0]), s: fixed([100, 100]), r: fixed(0), o: fixed(100), sk: fixed(0), sa: fixed(0) };
const stroke = { ty: "st", c: fixed([1, 1, 1, 1]), o: fixed(100), w: fixed(2), lc: 2, lj: 2, ml: 4 };
export const voiceKeeperAnimation = {
    v: "5.12.2", fr: 60, ip: 0, op: 300, w: 24, h: 24, nm: "PulseCord VoiceKeeper", ddd: 0, assets: [],
    layers: [{
        ddd: 0, ind: 1, ty: 4, nm: "PrimaryColor", sr: 1, ip: 0, op: 300, st: 0, bm: 0,
        ks: {
            o: fixed(100), p: fixed([12, 12, 0]), a: fixed([0, 0, 0]),
            r: animated([[0, [0]], [12, [-8]], [20, [0]], [40, [0]], [45, [-4]], [60, [0]], [100, [0]], [116, [-8]], [123, [0]], [143, [0]], [148, [-4]], [160, [0]], [180, [0]], [189, [4]], [200, [0]], [209, [-4]], [220, [0]], [240, [0]], [249, [4]], [260, [0]], [269, [-4]], [280, [0]]]),
            s: animated([[0, [100, 100, 100]], [14, [100, 100, 100]], [20, [100, 94, 100]], [26, [100, 100, 100]], [100, [100, 100, 100]], [118, [100, 100, 100]], [123, [100, 94, 100]], [129, [100, 100, 100]]])
        },
        shapes: [
            { ty: "gr", nm: "Ring", it: [{ ty: "el", d: 1, p: fixed([0, 0]), s: fixed([18, 18]) }, stroke, transform] },
            { ty: "gr", nm: "Slash", it: [
                { ty: "sh", ks: fixed({ i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [[-6.35, -6.35], [6.35, 6.35]], c: false }) },
                stroke,
                { ty: "tm", s: fixed(0), e: animated([[0, [0]], [23, [20]], [48, [100]], [100, [100]], [122, [100]], [150, [0]], [180, [0]], [220, [0]], [240, [100]], [280, [100]]]), o: fixed(0), m: 1 },
                transform
            ] }
        ]
    }]
};
