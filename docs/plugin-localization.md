# Plugin localization

PulseCord follows `LocaleStore.locale`, including changes while the plugin list or a settings modal is open. All 32 Discord locale identifiers are recognized; regional Spanish, English, Swedish and Portuguese identifiers map to the corresponding Google translation language.

Common French interface strings are bundled. Other static plugin UI strings use Google Translate on demand. Requests omit credentials and referrers and time out after ten seconds. At most two requests run concurrently. The source string and target locale form the cache key, so changed plugin descriptions cannot reuse an old translation. Results are stored locally, bounded in memory and on disk. Unavailable translations leave the original text visible, with a retry cooldown.

Only descriptions, labels, placeholders, select labels and statically authored JSX text are translated. Plugin names, setting IDs, stored option values, URLs, code examples, author identities, message contents and user input retain their original values. Dynamic text assembled by custom plugins may need an explicit `PluginText` or `translateUi` call. Do not pass private or user-provided content to those functions.

The build applies a syntax-aware UI overlay, rather than observing or rewriting Discord's DOM. This preserves input, focus, events and React ownership. The translated plugin list also searches descriptions already available in the local cache, without fetching translations for hidden search results.

Machine translation can be imperfect. Google availability is required for a string's first translation; previously cached translations continue working offline.
