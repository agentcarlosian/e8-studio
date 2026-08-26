import { loadProgress, localDateKey, recordQuizResult, claimDailyProgress, recordPostcardCreated, unlockBackground, recordExplorationBadge, setLessonComplete as persistLessonCompletion, setExperimentStepComplete as persistExperimentStep } from './progress.js';
import { LEARNING_PATHS, learningLessonById, learningLessonForView, learningPathById, adjacentLearningLesson } from '../content/curriculum.js';
import { QUIZ_MODULES, REWARD_BACKGROUNDS, dailyFactForDate } from '../content/learning.js';

// Owns all mutation of persisted learning/progress state. UI presentation and
// scene changes are supplied by main.js, keeping this service DOM-free.
export class LearningProgressService {
  constructor(initialProgress = loadProgress()) {
    this.progress = initialProgress;
  }

  rewardById(id) {
    return REWARD_BACKGROUNDS.find(reward => reward.id === id) || null;
  }

  quizById(id) {
    return QUIZ_MODULES.find(quiz => quiz.id === id) || null;
  }

  paths() { return LEARNING_PATHS; }

  pathById(id) { return learningPathById(id); }

  lessonById(id) { return learningLessonById(id); }

  adjacentLesson(id, direction = 1) { return adjacentLearningLesson(id, direction); }

  lessonComplete(id) { return !!this.progress.lessons?.[id]; }

  experimentState(id) {
    const lesson = this.lessonById(id);
    const steps = lesson?.experiment?.steps || [];
    const completed = new Set(this.progress.experiments?.[id]?.completedSteps || []);
    return {
      completedSteps: completed,
      completedCount: steps.filter(step => completed.has(step.id)).length,
      total: steps.length,
      complete: steps.length > 0 && steps.every(step => completed.has(step.id)),
      nextStep: steps.find(step => !completed.has(step.id)) || steps.at(-1) || null,
    };
  }

  setExperimentStepComplete(lessonId, stepId, complete = true) {
    const lesson = this.lessonById(lessonId);
    if (!lesson?.experiment?.steps?.some(step => step.id === stepId)) return this.progress;
    this.progress = persistExperimentStep(this.progress, lessonId, stepId, complete);
    if (this.experimentState(lessonId).complete) {
      this.progress = recordExplorationBadge(this.progress, 'explore:first-experiment').progress;
      if (LEARNING_PATHS.flatMap(path => path.lessons).every(entry => this.experimentState(entry.id).complete)) {
        this.progress = recordExplorationBadge(this.progress, 'explore:all-experiments').progress;
      }
    }
    return this.progress;
  }

  recommendedLesson(view) {
    return learningLessonForView(view, Object.keys(this.progress.lessons || {}));
  }

  setLessonComplete(id, complete = true) {
    if (!this.lessonById(id)) return this.progress;
    this.progress = persistLessonCompletion(this.progress, id, complete);
    if (complete && LEARNING_PATHS.flatMap(path => path.lessons).every(lesson => this.lessonComplete(lesson.id))) {
      this.progress = recordExplorationBadge(this.progress, 'explore:curriculum-complete').progress;
    }
    return this.progress;
  }

  awardBadge(badgeId) {
    const result = recordExplorationBadge(this.progress, badgeId);
    if (result.granted) this.progress = result.progress;
    return result;
  }

  summary() {
    return {
      quizPassed: QUIZ_MODULES.filter(quiz => this.progress.quiz?.[quiz.id]?.passedAt).length,
      quizTotal: QUIZ_MODULES.length,
      lessonsComplete: LEARNING_PATHS.flatMap(path => path.lessons).filter(lesson => this.lessonComplete(lesson.id)).length,
      lessonsTotal: LEARNING_PATHS.flatMap(path => path.lessons).length,
      experimentsComplete: LEARNING_PATHS.flatMap(path => path.lessons).filter(lesson => this.experimentState(lesson.id).complete).length,
      experimentsTotal: LEARNING_PATHS.flatMap(path => path.lessons).length,
      unlockedBackgrounds: this.progress.unlocked?.backgrounds?.length || 0,
      postcardsCreated: this.progress.postcardsCreated || 0,
      streak: this.progress.daily?.streak || 0,
    };
  }

  state(view, curiosityCards) {
    const today = localDateKey();
    const fact = dailyFactForDate();
    return {
      progress: this.progress,
      summary: this.summary(),
      quizzes: QUIZ_MODULES,
      rewards: REWARD_BACKGROUNDS,
      dailyFact: fact,
      dailyClaimedToday: this.progress.daily?.lastCompletedDate === today,
      curiosity: curiosityCards[view] || curiosityCards.e8coxeter,
      recommendedLesson: this.recommendedLesson(view),
    };
  }

  completeQuiz(moduleId, score, total) {
    const quiz = this.quizById(moduleId);
    const result = recordQuizResult(
      this.progress,
      moduleId,
      score,
      total || quiz?.questions.length || 3,
      quiz?.rewardId,
    );
    this.progress = result.progress;
    return { ...result, quiz };
  }

  claimDaily(fact = dailyFactForDate()) {
    const result = claimDailyProgress(this.progress, fact);
    this.progress = result.progress;
    return { ...result, fact };
  }

  recordPostcard(rewardId = 'postcard-prime') {
    this.progress = recordPostcardCreated(this.progress, rewardId);
    return this.progress;
  }

  unlock(rewardId) {
    this.progress = unlockBackground(this.progress, rewardId);
    return this.progress;
  }
}
