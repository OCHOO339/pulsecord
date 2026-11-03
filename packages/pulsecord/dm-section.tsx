// SPDX-License-Identifier: GPL-3.0-or-later
import { isPluginEnabled } from "@api/PluginManager";
import PinDMs from "@plugins/pinDms";
import { React } from "@webpack/common";
import { OfficialDmRow } from "./inbox";

function dmSection() {
    return isPluginEnabled("PinDMs") && PinDMs.sections?.length ? PinDMs.sections.length - 1 : 1;
}
export function wrapDmSection(render: (props: { section: number; }) => React.ReactNode) {
    return (props: { section: number; }) => {
        const header = render(props);
        return props.section === dmSection()
            ? <div className="pc-dm-section">{header}<OfficialDmRow /></div> : header;
    };
}
export function wrapDmSectionHeight(height: (section: number) => number) {
    return (section: number) => height(section) + (section === dmSection() ? 40 : 0);
}
