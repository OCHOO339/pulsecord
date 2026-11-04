# Startup cache cleanup

Enabled by default. Disable it in PulseCord → Performance to retain Discord's HTTP cache on future launches.

The main process schedules `session.defaultSession.clearCache()` after Electron becomes ready, once per process, without waiting before loading Discord. It never calls `clearStorageData`, deletes profile directories, clears cookies, or removes IndexedDB/localStorage. Sign-in, settings and the local plugin translation cache remain intact. Cleanup errors are logged and do not prevent startup.

This targets disk space. The cache can grow again during the current session; clearing it does not guarantee lower RAM usage and can increase the first loading time or network traffic. There is no periodic cleanup during calls or navigation.

The translation cache is separately bounded to 2,000 entries and 1.5 million source-plus-result characters in memory and persisted data. Old entries are evicted when either limit is reached.

Electron API reference: https://www.electronjs.org/docs/latest/api/session#sesclearcache
