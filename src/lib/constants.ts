export const SITE = {
  name: "The Punters' Club",
  url: "https://punters.club",
  homePath: "/",
  showsPath: "/shows/",
  latestShowHash: "/#latest-show",
  playlistsHash: "/#playlists",
  aboutHash: "/#about",
  homeTitle: "The Punters' Club | Radio Waters",
  homeDescription:
    "The Punters' Club: disco and modern electronic selections from a husband-and-wife DJ duo on Radio Waters.",
  showsTitle: "Shows | The Punters' Club | Radio Waters",
  showsDescription:
    "Browse archived episodes of The Punters' Club, from disco to modern electronic selections broadcast on Radio Waters.",
  showDetailDescription:
    "Listen to this episode of The Punters' Club on Radio Waters.",
} as const;

export const RADIO_WATERS = {
  name: "Radio Waters",
  url: "https://www.radiowaters.co.uk/",
  mixcloudUrl: "https://www.mixcloud.com/radiowaters/",
} as const;

export const SCHEMA = {
  context: "https://schema.org",
  listenAction: "https://schema.org/ListenAction",
  eventScheduled: "https://schema.org/EventScheduled",
  onlineEventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
} as const;

export const NEXT_SHOW = {
  upcomingStatus: "upcoming",
  noneStatus: "none",
  source: "tribe/events/v1",
  guestLabel: "Guest appearance",
  showLabel: "Punters Club show",
  sectionTitle: "Next show",
  posterAlt: "The Punters' Club Next Show Poster",
  ctaLabel: "View on Radio Waters",
  emptyText: "Nothing pinned to the running order yet. We’re digging in the crates.",
} as const;

export const SHOW_ARCHIVE = {
  visibleCount: 6,
  profileUrl: RADIO_WATERS.mixcloudUrl,
  moreButtonLabel: "More shows",
  profileLabel: `${RADIO_WATERS.name} on Mixcloud - more DJs and other shows`,
} as const;
