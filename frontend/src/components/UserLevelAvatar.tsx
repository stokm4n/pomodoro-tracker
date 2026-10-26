import type { UserLevel } from "../utils/userLevels";

interface UserLevelAvatarProps {
  level: UserLevel;
  size?: "small" | "medium" | "large";
}

export function UserLevelAvatar({ level, size = "medium" }: UserLevelAvatarProps) {
  return (
    <span
      className={`level-avatar level-avatar-${size} level-avatar-${level.id}`}
      title={`Уровень «${level.name}»`}
      aria-label={`Аватар уровня «${level.name}»`}
    >
      <span className="level-avatar-symbol" aria-hidden="true">{level.avatar}</span>
    </span>
  );
}
