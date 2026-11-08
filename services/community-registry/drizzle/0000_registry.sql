CREATE TABLE installations (public_key TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, seen_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX installations_seen ON installations(seen_at);
