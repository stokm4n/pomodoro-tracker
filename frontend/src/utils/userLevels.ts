export interface UserLevel {
  id: string;
  name: string;
  minimumPomodoros: number;
  avatar: string;
}

export const userLevels: UserLevel[] = [
  { id: "seed", name: "Семечко", minimumPomodoros: 0, avatar: "•" },
  { id: "germ", name: "Проросток", minimumPomodoros: 5, avatar: "🌱" },
  { id: "sprout", name: "Росток", minimumPomodoros: 15, avatar: "🌿" },
  { id: "seedling", name: "Рассада", minimumPomodoros: 30, avatar: "🪴" },
  { id: "strong-bush", name: "Крепкий куст", minimumPomodoros: 50, avatar: "🌳" },
  { id: "flowering", name: "Цветущий томат", minimumPomodoros: 75, avatar: "🌼" },
  { id: "first-fruit", name: "Первый плод", minimumPomodoros: 100, avatar: "🍅" },
  { id: "green-tomato", name: "Зелёный томат", minimumPomodoros: 150, avatar: "●" },
  { id: "ripe-tomato", name: "Спелый томат", minimumPomodoros: 250, avatar: "🍅" },
  { id: "golden-tomato", name: "Золотой томат", minimumPomodoros: 500, avatar: "🍅" },
  { id: "great-harvest", name: "Великий урожай", minimumPomodoros: 1000, avatar: "🧺" },
];

export interface UserLevelProgress {
  level: UserLevel;
  nextLevel: UserLevel | null;
  completedPomodoros: number;
  progressPercent: number;
}

export function getUserLevelProgress(completedPomodoros: number): UserLevelProgress {
  const total = Math.max(0, completedPomodoros);
  let levelIndex = 0;

  userLevels.forEach((level, index) => {
    if (total >= level.minimumPomodoros) levelIndex = index;
  });

  const level = userLevels[levelIndex];
  const nextLevel = userLevels[levelIndex + 1] ?? null;
  const progressPercent = nextLevel
    ? ((total - level.minimumPomodoros)
      / (nextLevel.minimumPomodoros - level.minimumPomodoros)) * 100
    : 100;

  return {
    level,
    nextLevel,
    completedPomodoros: total,
    progressPercent: Math.max(0, Math.min(100, progressPercent)),
  };
}
