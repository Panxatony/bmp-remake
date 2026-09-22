export { Cipher, KEY_STEP } from "./cipher.ts";
export {
  SaveFile,
  SaveError,
  dosText,
  toDosText,
  SIGNATURE,
  HDR_LEN,
  CHK1_OFF,
  FIXED_END,
  type Message,
} from "./savefile.ts";
export {
  GameState,
  TableView,
  Record,
  Club,
  Player,
  Manager,
  Loan,
  Standing,
  Lineup,
  Advertising,
  TABLES,
  SCALARS,
  type Table,
} from "./records.ts";
export { strength, chanceCounts, chanceMinutes, goalDice, simulateMatch, mulberryRng, type TeamStrength, type Rng, type MatchResult } from "./sim/match.ts";
export { teamStrength, strengthInput, type StrengthInput } from "./sim/strength.ts";
export { postponementCount, replays, addReplay, removeReplays, scheduleReplays, replayDay, REPLAY_OFFSET, REPLAY_SLOTS, type Replay } from "./sim/postpone.ts";
export { fixtures, LEAGUES } from "./sim/fixtures.ts";
export { applyResult, tableOrder, updatePositions } from "./sim/standings.ts";
export { setTexte, texte, text, texteGeladen, type Textkatalog } from "./data/texte.ts";
export { AI_OFFSET, aiMask, isAi, setAi, aiList } from "./sim/ki.ts";
export { DEBT_LIMIT, DEBT_POINTS, BLOCK_OFFSET, blockMask, isBlocked, setBlocked, checkDebt, type DebtResult } from "./sim/schulden.ts";
export { DERBY_OFFSET, DERBY_STAKES, stakeLevel, setStakeLevel, stakeOf, derbyStake, playDerby, type DerbyResult } from "./sim/derby.ts";
export { bidScore, bestBid, type FreeAgent, type FreeBid } from "./sim/abloesefrei.ts";
export { highestBid, resolveAuction, sureBid, type Bid, type AuctionResult } from "./sim/auktion.ts";
export { POACH_MAX_BONUS, POACH_MIN_SQUAD, POACH_MAX_PER_OWNER, POACH_COUNT_OFFSET, poachCount, poachLeft, resetPoachCounts, poachPrice, poachAmount, poachChance, poachCheck, poachAllowedFrom, poach, raiseSalary, POACH_COUNTER_MAX, type PoachResult } from "./sim/abwerben.ts";
export { RULES_OFFSET, RULES_ORIGINAL, RULES_2026, ruleSet, setRuleSet, is2026, winPoints, substitutionLimits, ruleName, type SubstitutionLimits } from "./sim/regeln.ts";
export { seasonDay, isSaturday, dateOfSeasonDay, calendarFlag, dayIndex, seasonStartYear, setDayIndex, CALENDAR_DAYS, setCalendarFlag, FLAG_LEAGUE, FLAG_CUP, FLAG_EUROPE } from "./sim/calendar.ts";
export { playMatchday, playReplays, matrixFor, matchStrength, writeResult, writePairings, afterMatch, bookEvents, type LiveBooking } from "./sim/matchday.ts";
export { pickPlayer, bookGoal, bookMissedChance, bookDefence } from "./sim/goals.ts";
export { DOPING_BONUS, DOPING_FRESH, DOPING_RISK, DOPING_RISK_STEP, DOPING_RISK_MAX, DOPING_BAN, DOPING_FINE_BASE, DOPING_FINE_PERCENT, DOPING_MAX_CURES, dopeCures, DOPING_MALUS, DOPING_APPS_MAX, DOPE_NONE, DOPE_ON, DOPE_BANNED, dopeState, dopeApps, dopeBonus, dopeFresh, isDoped, isDopeBanned, dopingRisk, dopingFine, dopeStart, dopeStop, dopeMatchday, dopingCleanup, dopingRows, type DopingEvent } from "./sim/doping.ts";
export { JUGEND_KENNUNG, JUGEND_FASSUNG, JUGEND_TEAMS, JUGEND_PLAETZE, JUGEND_SATZ, JUGEND_NAMEN, JUGEND_ALTER, JUGEND_AUFSTIEGE, JUGEND_KOSTEN, JUGEND_MAX_FOERDERUNG, JUGEND_CHANCE, wirdGefoerdert, gefoerderte, jugendHerkunft, jugendLesen, jugendSchreiben, jugendVorhanden, jugendAnlegen, jugendStaerke, neuerJugendspieler, foerdern, jugendKosten, jugendMonat, jugendChance, jugendRisiko, jugendSprung, JUGEND_TRAINING, JUGEND_SPITZE, jugendSaison, istReif, aufruecker, jugendAbwerbungen, jugendZaehlerLeeren, jugendAufruecken, jugendAbwerben, jugendPreis, JUGEND_MAX_AUFRUECKER, JUGEND_MAX_ABWERBEN, JUGEND_AUFRUECKER_OFFSET, JUGEND_ABWERB_OFFSET, type Jugendspieler, type JugendEreignis, type AufrueckErgebnis, type JugendAbwerbung } from "./sim/jugend.ts";
export { baueSzene, alsFassung, pruefeBeschreibung, SZENE_GRENZEN, TOR_LINKS, TOR_RECHTS, UNSICHTBAR, type Beschreibung, type Figur, type Abschnitt, type Kamera, type Fassung, type Szene, type SzenenBild, type SzenenSprite } from "./tore/szene.ts";
export { MED_LEVELS, MED_SETBACK, MED_LONG, injuryKind, medLevel, setMedLevel, isInjured, injuryFloor, medWeek, medRows, medCost, medSet, type MedEvent } from "./sim/medizin.ts";
export { dailyTraining, trainingInput, trainingInjuries, injurePlayer, injuries, trainingSettings, setTraining, trainingBars, trainingCamp, campCost, camps, INJURY_WEEKS, campTraits, CAMP_OPEN_START, advanceCampOpen, campCountdown, TRAINING_BUDGET, type TrainingSettings, type CampResult } from "./sim/training.ts";
export { attendance, bookAttendance, bookGate } from "./sim/attendance.ts";
export { monthlyIncome, monthlyExpenses, loanTotal, lenderDebt, bookMonth, dailyFinance, riotCheck, DAYS_IN_MONTH, INTEREST_CAP, sponsorSubsidy, acceptSubsidy, christmasPresents, christmasLines, type ChristmasResult } from "./sim/finance.ts";
export { playCupDay, cupPairs, cupRound, CUP_OUT } from "./sim/cup.ts";
export { playEuropaDay, playPlayoffDay, afterCupDay, playCupMatch, shootout, extraTime, initialDraw, nextRoundDraw, decideTie, tieBreak, europeanParticipants, currentPairs, cupRoundOf, legPlayed, orderList, clearCupResults, cupNames, CUP_TABLE, CUP_ROUND, LEG_FLAG, FIRST_LEG, PLAYOFF_FIRST_LEG, HOLDER, DFB_WINNER, PLAYOFF_RESULT, ROUND_PAIRS, type CupMatch, type CupFinal, type Elfmeter, type Nachspiel, type NachspielQuelle } from "./sim/europa.ts";
export { generateOffers, stadiumValue, signShirt, signBoard, monthlyAdvertising, seasonEndAdvertising, offerAmount, offerYears, shirtContract, boardContract, advertisingAmount, SHIRT_OFFSET, BOARDS_OFFSET, CAT_OFFSET, OFFERS_OFFSET, ADV_OFFSET, LEVEL_OFFSET } from "./sim/werbung.ts";
export { newSeason, swapClubs, promoteRelegate, shuffleLeagues, writeHistory, CALENDAR_TEMPLATE } from "./sim/season.ts";
export { playerValue } from "./sim/value.ts";
export { seasonEvents, releaseExpiring } from "./sim/seasonEvents.ts";
export { contractOffers, contractCooldown, contractScore, acceptOffer, declineOffer, rejectOffer, salaryDemand, contractCheck, contractRefusals, contractRefusalAnnouncements, MAX_CONTRACT_YEARS, tooLongText, type ContractOffer } from "./sim/contracts.ts";
export { LiveMatch, SUBSTITUTIONS, type LiveChance, type MatchSim } from "./sim/live.ts";
export { parseMana, type ManaData } from "./data/mana.ts";
export { createGame, fillMarket, addToSquad, type NewGameOptions, type NewGameManager } from "./sim/newgame.ts";
export { stadiumKinds, stadiumMessages, sizeNames, statusNames, TOTAL_CAPACITY, TICKET_RANGE, stadiumState, stadiumCapacity, extendStadium, buildDays, buildWeeks, dailyConstruction, setTicketPrice, BANK, LOAN_MAX_BANK, LOAN_MAX_MANAGER, LOAN_MONTHS, LOAN_MONTHS_MAX, LOAN_RATE_MIN, LOAN_RATE_MAX, loanRate, driftInterest, takeLoan, loanRequestCheck, type StadiumState } from "./sim/stadium.ts";
export { marketEntries, listedCount, listPlayer, takeBack, saleOffer, decideSale, buyOffer, cancelPurchase, completePurchase, completeLoan, aiAccepts, refreshMarket, dailyTransfers, removePlace, assignNumber, addBalance, chooseOfferClub, strengthenClub, MARKET_MANAGER, MARKET_SIZE, MAX_LISTED, OFFER_SQUAD, OFFER_MARKET, LOAN_FLAG, type MarketEntry, type SaleOffer, type BuyResult, type TransferEvent, type MarketResult } from "./sim/transfer.ts";
export { squadHelp, tendencyWords, liveTexts, shootoutTexts, clubStrength, strengthTable, strengthModes, matchdayView, matchdayDate, leagueScorers, playerScorers, squadScorers, cupView, cupRoundName, nextCupDate, roundNames, statistics, allTimeTable, allTimeBalance, type StrengthRow, type MatchdayRow, type ScorerRow, type CupPairRow, type Statistics, type AllTimeBalance } from "./sim/display.ts";
export { HISTORY, seriesRows, recordRows, seriesCurrent, seriesRecord, clubRecords, resultsAgainst, bookHistory, type ClubRecord } from "./sim/history.ts";

export { minuteIncidents, matchIncidents, newIncidentState, pickStarter, fitStarters, isForfeit, bookForfeit, FORFEIT_FINE, FOULS_PER_MATCH, type Incident, type IncidentState } from "./sim/incidents.ts";
export { creditAiGoals, bookBaseBonus, driftClubs } from "./sim/ai.ts";
export { poolTargets, seasonPlayerPool, distributePlayers, pickPoolClub } from "./sim/pool.ts";
export { placementPoints, highscoreEntry, decodeHighscore, encodeHighscore, insertHighscore, highscoreFile, HIGHSCORE_MAX, type HighscoreEntry } from "./sim/highscore.ts";
export { composeZeitung, reportFromMatch, expandTemplate, gameToCp437, schlagzeilen, artikel, HEADLINE_GROUPS, ARTICLE_GROUPS, type MatchReport, type Zeitung, type ReportSource } from "./sim/zeitung.ts";
export { playerInfo, sideLabel, ageLabels, dataLabels, type PlayerInfo } from "./sim/playerinfo.ts";
export { standingsMessages, relegationMessage, relegationLines, isWinterBreakDay, winterBreakLines, bookChampion, bookCupTitle, POINTS_PER_WIN } from "./sim/messages.ts";
export { autoLineup, autoLineupIfEnabled, sortIntoSquad, sortSquad, selectPlace, systemOf, setSystem, backupSystem, groupOf, SYSTEM_OFFSET, SYSTEM_MANUAL, SYSTEM_NAMES, FORMATIONS } from "./sim/lineup.ts";
