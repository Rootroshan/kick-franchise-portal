// Plain data, not JSX — kept out of AnnouncementsToolbar's "use client" module
// so the server list page can read it directly. Importing a value from a
// client module works in dev but throws in the production server bundle
// ("Attempted to call some() from the server but some is on the client"),
// since Next replaces the client module's exports with a client-reference
// proxy there.
export const FEED_TABS = ["All", "Unread", "Pinned", "Acknowledged"] as const;
export type FeedTab = (typeof FEED_TABS)[number];
