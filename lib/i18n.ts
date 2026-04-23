// ---------------------------------------------------------------------------
// Lightweight i18n for the logged-in UI.
// Landing page and /join pages are intentionally kept in Swedish.
// ---------------------------------------------------------------------------

const sv = {
  // ── Shared save states ────────────────────────────────────────────────────
  save: "Spara",
  saving: "Sparar…",
  saved: "Sparat ✓",
  saveError: "Fel — försök igen",
  cancel: "Avbryt",
  loading: "Laddar…",
  youSuffix: "(du)",

  // ── Match card ────────────────────────────────────────────────────────────
  drawNotAllowedInPenalties: "Oavgjort är inte tillåtet i straffar",
  matchLive: "Pågår",
  yourPick: "Ditt tips:",
  noPick: "Inget tips",
  extraTime: "Förlängning",
  penalties: "Straffar",
  showAllPicks: "Visa alla tips",
  noPicksPlaced: "Inga tips lagda.",

  // ── Bracket round compact labels ──────────────────────────────────────────
  roundOf32Label: "Sextondels",
  roundOf16Label: "Åttondels",
  quarterFinalLabel: "Kvartsfinal",
  semiFinalLabel: "Semifinal",
  finalBronzeLabel: "Final/brons",
  bronzeMatchLabel: "Bronsmatch",

  // ── Bracket TBD notices ───────────────────────────────────────────────────
  tbdR32: "Lag är ännu inte klara — tippa vilket resultat du tror. Namnen uppdateras när gruppspelet är klart.",
  tbdR16: "Tippa klart sextondelsfinalen för att se vilka lag som möts.",
  tbdQF: "Tippa klart åttondelsfinalerna för att se vilka lag som möts.",
  tbdSF: "Tippa klart kvartsfinalen för att se vilka lag som möts.",
  tbdFinal: "Tippa klart semifinalen för att se vilka lag som möts.",
  noMatchesInRound: "Inga matcher i den här rundan.",
  match: "match",
  matches: "matcher",
  winnerChanged: "Vinnaren ändrades",
  subsequentCleared: "efterföljande",
  clearedAutomatically: "rensades automatiskt.",

  // ── Slot labels (bracket) ─────────────────────────────────────────────────
  slotWinnerMatchPrefix: "V. match",
  slotWinnerQFPrefix: "V. kvartsfinal",
  slotWinnerSFPrefix: "V. semifinal",
  slotLoserSFPrefix: "F. semifinal",
  slotFirst: "Etta",
  slotSecond: "Tvåa",
  slotThird: "Trea",

  // ── League sub-nav ────────────────────────────────────────────────────────
  navStandings: "Tabell",
  navGroupPicks: "Grupptips",
  navKnockout: "Slutspel",
  navBonusPicks: "Bonustips",
  navCompare: "Jämför",
  navChat: "Chatt",

  // ── Leaderboard ───────────────────────────────────────────────────────────
  noPointsYet: "Inga poäng ännu. Poäng beräknas när matchresultat bekräftas.",

  // ── Compare view ──────────────────────────────────────────────────────────
  participantsHeader: "Deltagare",
  noPicksYetCompare: "Inga tips gjorda ännu — var först med att sätta ditt VM-tips!",
  multiplePickedSame: "Flera deltagare tippar samma",

  // ── Member predictions section ────────────────────────────────────────────
  allPicksTitle: "Allas tips",
  wcTop3Label: "VM Top 3",
  nearestLabel: "Närmast",
  groupsLabel: "Grupper",
  setYourWCPick: "+ Sätt ditt VM-tips (1:a, 2:a, 3:a)",
  yourWCPickTitle: "Ditt VM-tips",
  selectTeamOption: "Välj lag",
  noPicksYetTable: "Inga tips ännu.",
  changeButton: "Ändra",
  noPicksCard: "Inga tips",
  noMatchesFound: "Inga matcher hittades.",
  noMatchesInGroup: "Inga matcher i denna grupp.",
  noMatchesInRoundShort: "Inga matcher i denna runda.",

  // ── Chat room ─────────────────────────────────────────────────────────────
  noMessagesYet: "Inga meddelanden ännu. Säg hej!",
  youChat: "Du",
  writeMessage: "Skriv ett meddelande...",
  send: "Skicka",

  // ── Bonus view ────────────────────────────────────────────────────────────
  topScorerTitle: "Skyttekung",
  mostYellowTitle: "Flest gula kort",
  enterPlayerName: "Skriv spelarens namn…",
  searchTeam: "Sök lag…",
  noTeamsFound: "Inga lag hittades.",

  // ── Dashboard ─────────────────────────────────────────────────────────────
  wcCountdownPrefix: "VM 2026 startar 11 juni —",
  daysLeft: "dagar kvar",
  greeting: "Hej",
  welcomeTitle: "Välkommen! ⚽",
  dashSubNoLeague: "Skapa ett tipslag och bjud in dina vänner — se vem som har koll på fotboll.",
  dashSubHasLeague: "Tippa matcherna, följ tabellen och se vem som leder i dina tipslag.",
  createLeagueCta: "+ Skapa tipslag",
  joinByCode: "Gå med via kod",
  yourLeagues: "Dina tipslag",
  leagues: "lag",
  notInAnyLeague: "Du är inte med i något tipslag ännu",
  notInAnyLeagueDesc: "Skapa ett lag och bjud in vänner, eller gå med i ett befintligt lag via en inbjudningskod.",
  createLeagueShort: "Skapa tipslag",

  // ── Profile page ──────────────────────────────────────────────────────────
  editProfileTitle: "Redigera profil",
  predictionsStat: "Tips",
  leaguesStat: "Tipslag",
  bestRankStat: "Bästa rank",
  displayNameLabel: "Visningsnamn",
  yourNamePlaceholder: "Ditt namn",
  signOut: "Logga ut",
  tryAgainLater: "Försök igen senare",
  languageLabel: "Språk / Language",

  // ── Bottom nav ────────────────────────────────────────────────────────────
  navHome: "Tippa",
  navNotifs: "Notiser",
  navProfile: "Profil",

  // ── App nav ───────────────────────────────────────────────────────────────
  back: "Tillbaka",

  // ── League page ───────────────────────────────────────────────────────────
  membersLabel: "deltagare",
  inviteButton: "Bjud in",
  rulesButton: "Regler",

  // ── League card list ──────────────────────────────────────────────────────
  matchesPlayed: "matcher spelade",
  predictNow: "Tippa nu!",
  place: "Plats",
  deleteLeagueTitle: "Ta bort tipslag",
  deleteLeagueWarning: "Detta går inte att ångra. Alla medlemmar, poäng och chattar raderas permanent.",
  deleteLeagueConfirmLabel: "Skriv",
  deleteLeagueConfirmSuffix: "för att bekräfta",
  deleting: "Tar bort...",
  deleteLeaguePermanent: "Ta bort permanent",

  // ── Notifications ─────────────────────────────────────────────────────────
  notificationsTitle: "Notifikationer",
  clearAll: "Rensa alla",
  today: "Idag",
  yesterday: "Igår",
  earlier: "Tidigare",
  viewChat: "Visa chatten →",
  viewStandings: "Visa tabellen →",
  justNow: "nyss",
  minuteAgo: "min sedan",
  hourAgo: "timme sedan",
  hoursAgo: "timmar sedan",
};

const en: Partial<typeof sv> = {
  // ── Shared save states ────────────────────────────────────────────────────
  save: "Save",
  saving: "Saving…",
  saved: "Saved ✓",
  saveError: "Error — try again",
  cancel: "Cancel",
  loading: "Loading…",
  youSuffix: "(you)",

  // ── Match card ────────────────────────────────────────────────────────────
  drawNotAllowedInPenalties: "Draw not allowed in penalties",
  matchLive: "Live",
  yourPick: "Your pick:",
  noPick: "No pick",
  extraTime: "Extra time",
  penalties: "Penalties",
  showAllPicks: "Show all picks",
  noPicksPlaced: "No picks placed.",

  // ── Bracket round compact labels ──────────────────────────────────────────
  roundOf32Label: "Round of 32",
  roundOf16Label: "Round of 16",
  quarterFinalLabel: "Quarter-final",
  semiFinalLabel: "Semi-final",
  finalBronzeLabel: "Final/bronze",
  bronzeMatchLabel: "Bronze match",

  // ── Bracket TBD notices ───────────────────────────────────────────────────
  tbdR32: "Teams not yet decided — predict the result you think. Names update when the group stage is complete.",
  tbdR16: "Complete your Round of 32 picks to see which teams meet.",
  tbdQF: "Complete your Round of 16 picks to see which teams meet.",
  tbdSF: "Complete your Quarter-final picks to see which teams meet.",
  tbdFinal: "Complete your Semi-final picks to see which teams meet.",
  noMatchesInRound: "No matches in this round.",
  match: "match",
  matches: "matches",
  winnerChanged: "Winner changed",
  subsequentCleared: "subsequent",
  clearedAutomatically: "cleared automatically.",

  // ── Slot labels (bracket) ─────────────────────────────────────────────────
  slotWinnerMatchPrefix: "W. match",
  slotWinnerQFPrefix: "W. quarter-final",
  slotWinnerSFPrefix: "W. semi-final",
  slotLoserSFPrefix: "L. semi-final",
  slotFirst: "1st",
  slotSecond: "2nd",
  slotThird: "3rd",

  // ── League sub-nav ────────────────────────────────────────────────────────
  navStandings: "Standings",
  navGroupPicks: "Groups",
  navKnockout: "Knockout",
  navBonusPicks: "Bonus",
  navCompare: "Compare",
  navChat: "Chat",

  // ── Leaderboard ───────────────────────────────────────────────────────────
  noPointsYet: "No points yet. Points are calculated when match results are confirmed.",

  // ── Compare view ──────────────────────────────────────────────────────────
  participantsHeader: "Participants",
  noPicksYetCompare: "No picks yet — be the first to set your World Cup pick!",
  multiplePickedSame: "Multiple participants picked the same",

  // ── Member predictions section ────────────────────────────────────────────
  allPicksTitle: "Everyone's picks",
  wcTop3Label: "World Cup Top 3",
  nearestLabel: "Nearest",
  groupsLabel: "Groups",
  setYourWCPick: "+ Set your WC pick (1st, 2nd, 3rd)",
  yourWCPickTitle: "Your World Cup pick",
  selectTeamOption: "Select team",
  noPicksYetTable: "No picks yet.",
  changeButton: "Edit",
  noPicksCard: "No picks",
  noMatchesFound: "No matches found.",
  noMatchesInGroup: "No matches in this group.",
  noMatchesInRoundShort: "No matches in this round.",

  // ── Chat room ─────────────────────────────────────────────────────────────
  noMessagesYet: "No messages yet. Say hi!",
  youChat: "You",
  writeMessage: "Write a message...",
  send: "Send",

  // ── Bonus view ────────────────────────────────────────────────────────────
  topScorerTitle: "Top scorer",
  mostYellowTitle: "Most yellow cards",
  enterPlayerName: "Enter player name…",
  searchTeam: "Search team…",
  noTeamsFound: "No teams found.",

  // ── Dashboard ─────────────────────────────────────────────────────────────
  wcCountdownPrefix: "World Cup 2026 starts June 11 —",
  daysLeft: "days left",
  greeting: "Hi",
  welcomeTitle: "Welcome! ⚽",
  dashSubNoLeague: "Create a league and invite your friends — see who knows football.",
  dashSubHasLeague: "Predict matches, follow the standings and see who leads your leagues.",
  createLeagueCta: "+ Create league",
  joinByCode: "Join by code",
  yourLeagues: "Your leagues",
  leagues: "leagues",
  notInAnyLeague: "You're not in any league yet",
  notInAnyLeagueDesc: "Create a league and invite friends, or join an existing one with an invite code.",
  createLeagueShort: "Create league",

  // ── Profile page ──────────────────────────────────────────────────────────
  editProfileTitle: "Edit profile",
  predictionsStat: "Predictions",
  leaguesStat: "Leagues",
  bestRankStat: "Best rank",
  displayNameLabel: "Display name",
  yourNamePlaceholder: "Your name",
  signOut: "Sign out",
  tryAgainLater: "Try again later",
  languageLabel: "Språk / Language",

  // ── Bottom nav ────────────────────────────────────────────────────────────
  navHome: "Home",
  navNotifs: "Notifs",
  navProfile: "Profile",

  // ── App nav ───────────────────────────────────────────────────────────────
  back: "Back",

  // ── League page ───────────────────────────────────────────────────────────
  membersLabel: "members",
  inviteButton: "Invite",
  rulesButton: "Rules",

  // ── League card list ──────────────────────────────────────────────────────
  matchesPlayed: "matches played",
  predictNow: "Predict now!",
  place: "Rank",
  deleteLeagueTitle: "Delete league",
  deleteLeagueWarning: "This cannot be undone. All members, points and chats are permanently deleted.",
  deleteLeagueConfirmLabel: "Type",
  deleteLeagueConfirmSuffix: "to confirm",
  deleting: "Deleting...",
  deleteLeaguePermanent: "Delete permanently",

  // ── Notifications ─────────────────────────────────────────────────────────
  notificationsTitle: "Notifications",
  clearAll: "Clear all",
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
  viewChat: "View chat →",
  viewStandings: "View standings →",
  justNow: "just now",
  minuteAgo: "min ago",
  hourAgo: "hour ago",
  hoursAgo: "hours ago",
};

export type Locale = "sv" | "en";

export function t(key: keyof typeof sv, locale: Locale): string {
  return locale === "en" ? (en[key] ?? sv[key]) : sv[key];
}
