// progress.js - local-only learning/reward progress for E8 Studio.
//
// No network, accounts, analytics, or third-party SDKs. This state exists only
// in localStorage and can be cleared by clearing app data.

const PROGRESS_KEY = 'e8_progress_v1';

const DEFAULT_PROGRESS = {
  unlocked: {
    backgrounds: ['default'],
  },
  badges: [],
  quiz: {},
  lessons: {},
  daily: {
    lastCompletedDate: null,
    streak: 0,
    completedDates: [],
  },
  postcardsCreated: 0,
  firstLaunchComplete: false,
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
}

function todayKey(date = new Date()) {
  return date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
}

function yesterdayKey(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : new Date(String(date));
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function uniqStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(v => typeof v === 'string'))];
}

export function normalizeProgress(value) {
  const base = cloneDefault();
  const p = value && typeof value === 'object' ? value : {};
  const daily = p.daily && typeof p.daily === 'object' ? p.daily : {};
  const lessons = {};
  for (const [id, entry] of Object.entries(p.lessons && typeof p.lessons === 'object' ? p.lessons : {})) {
    if (typeof id !== 'string' || !id) continue;
    if (entry === true) lessons[id] = { completedAt: null };
    else if (entry && typeof entry === 'object') {
      lessons[id] = {
        completedAt: typeof entry.completedAt === 'string' ? entry.completedAt : null,
      };
    }
  }
  return {
    unlocked: {
      backgrounds: uniqStrings([
        ...base.unlocked.backgrounds,
        ...(p.unlocked?.backgrounds || []),
      ]),
    },
    badges: uniqStrings(p.badges),
    quiz: p.quiz && typeof p.quiz === 'object' ? p.quiz : {},
    lessons,
    daily: {
      lastCompletedDate: typeof daily.lastCompletedDate === 'string' ? daily.lastCompletedDate : null,
      streak: Number.isFinite(Number(daily.streak)) ? Math.max(0, Math.floor(Number(daily.streak))) : 0,
      completedDates: uniqStrings(daily.completedDates),
    },
    postcardsCreated: Number.isFinite(Number(p.postcardsCreated)) ? Math.max(0, Math.floor(Number(p.postcardsCreated))) : 0,
    firstLaunchComplete: !!p.firstLaunchComplete,
  };
}

export function setLessonComplete(progress, lessonId, complete = true, completedAt = new Date().toISOString()) {
  const next = normalizeProgress(progress);
  if (!lessonId || typeof lessonId !== 'string') return next;
  if (complete) next.lessons[lessonId] = { completedAt: typeof completedAt === 'string' ? completedAt : null };
  else delete next.lessons[lessonId];
  return saveProgress(next);
}

export function loadProgress() {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return cloneDefault();
  try {
    return normalizeProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null'));
  } catch (e) {
    console.warn('Progress load failed:', e);
    return cloneDefault();
  }
}

export function saveProgress(progress) {
  const normalized = normalizeProgress(progress);
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.warn('Progress save failed:', e);
    }
  }
  return normalized;
}

export function unlockBackground(progress, rewardId) {
  const next = normalizeProgress(progress);
  if (!rewardId) return next;
  if (!next.unlocked.backgrounds.includes(rewardId)) {
    next.unlocked.backgrounds.push(rewardId);
  }
  return saveProgress(next);
}

export function markFirstLaunchComplete(progress) {
  const next = normalizeProgress(progress);
  next.firstLaunchComplete = true;
  return saveProgress(next);
}

export function recordQuizResult(progress, moduleId, score, total, rewardId) {
  const next = normalizeProgress(progress);
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const safeTotal = Math.max(1, Math.floor(Number(total) || 1));
  const previous = next.quiz[moduleId] || { attempts: 0, bestScore: 0, total: safeTotal, passedAt: null };
  const passed = safeScore >= Math.ceil(safeTotal * 0.67);
  next.quiz[moduleId] = {
    attempts: (previous.attempts || 0) + 1,
    bestScore: Math.max(previous.bestScore || 0, safeScore),
    total: safeTotal,
    passedAt: passed ? (previous.passedAt || new Date().toISOString()) : previous.passedAt || null,
  };
  if (passed) {
    const badge = `quiz:${moduleId}`;
    if (!next.badges.includes(badge)) next.badges.push(badge);
    if (rewardId && !next.unlocked.backgrounds.includes(rewardId)) {
      next.unlocked.backgrounds.push(rewardId);
    }
  }
  return { progress: saveProgress(next), passed };
}

export function claimDailyProgress(progress, fact, date = new Date()) {
  const next = normalizeProgress(progress);
  const today = todayKey(date);
  if (next.daily.lastCompletedDate === today) {
    return { progress: next, claimed: false, alreadyClaimed: true };
  }
  const yesterday = yesterdayKey(date);
  next.daily.streak = next.daily.lastCompletedDate === yesterday ? next.daily.streak + 1 : 1;
  next.daily.lastCompletedDate = today;
  if (!next.daily.completedDates.includes(today)) next.daily.completedDates.push(today);
  const badge = `daily:${fact?.id || today}`;
  if (!next.badges.includes(badge)) next.badges.push(badge);
  if (fact?.rewardId && !next.unlocked.backgrounds.includes(fact.rewardId)) {
    next.unlocked.backgrounds.push(fact.rewardId);
  }
  return { progress: saveProgress(next), claimed: true, alreadyClaimed: false };
}

export function recordPostcardCreated(progress, rewardId = 'postcard-prime') {
  const next = normalizeProgress(progress);
  next.postcardsCreated += 1;
  if (!next.badges.includes('created:first-postcard')) next.badges.push('created:first-postcard');
  if (rewardId && !next.unlocked.backgrounds.includes(rewardId)) {
    next.unlocked.backgrounds.push(rewardId);
  }
  return saveProgress(next);
}

/**
 * Award an exploration (activity-based) badge. Idempotent: returns the same
 * progress object if the badge is already present (and `granted` = false so the
 * caller can decide whether to toast). Used for non-quiz achievements like
 * "visited all views", "finished the tour", "opened the command palette".
 *
 * Unlike the quiz/daily paths this does NOT unlock a reward background — these
 * are intrinsic milestones, not cosmetic unlocks.
 */
export function recordExplorationBadge(progress, badgeId) {
  if (!badgeId || typeof badgeId !== 'string') return { progress, granted: false };
  const next = normalizeProgress(progress);
  if (next.badges.includes(badgeId)) return { progress: next, granted: false };
  next.badges.push(badgeId);
  return { progress: saveProgress(next), granted: true };
}

export function resetProgress() {
  const next = cloneDefault();
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch {}
  }
  return next;
}
