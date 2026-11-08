// SPDX-License-Identifier: GPL-3.0-or-later
import { PluginNative } from "@utils/types";
import { registryUrl } from "./community-core";

export const communityFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const operation = url === `${registryUrl}/v1/users` && method === "GET" ? "users"
        : url === `${registryUrl}/v1/installations` && method === "POST" ? "register"
        : url === `${registryUrl}/v1/installations` && method === "DELETE" ? "remove" : undefined;
    if (!operation || (init?.body !== undefined && typeof init.body !== "string")) throw Error("Invalid registry request");
    init?.signal?.throwIfAborted();
    const native = VencordNative.pluginHelpers.PulseCord as PluginNative<typeof import("./native")>;
    const result = await native.communityRequest(operation, init?.body as string | undefined);
    init?.signal?.throwIfAborted();
    return new Response(result.body, { status: result.status, headers: { "Content-Type": "application/json" } });
};
