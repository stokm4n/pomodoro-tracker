interface TomatoMarkProps {
  light?: boolean;
}

export function TomatoMark({ light = false }: TomatoMarkProps) {
  return (
    <span
      className={`brand-mark${light ? " brand-mark-light" : ""}`}
      aria-hidden="true"
    >
      <svg className="tomato-icon" viewBox="0 0 32 32" focusable="false">
        <path
          className="tomato-body"
          d="M27 17.3c0 7-4.7 11.2-11 11.2S5 24.3 5 17.3c0-5.2 4.7-8.4 11-8.4s11 3.2 11 8.4Z"
        />
        <path
          className="tomato-leaf"
          d="M16 10.8c-2.1-1.9-4.7-2.7-7.1-2.1 1.1 1.7 2.4 2.9 4.1 3.6-2.2.2-4.1 1.1-5.5 2.6 2.9.5 5.7-.1 8.5-2 2.8 1.9 5.6 2.5 8.5 2-1.4-1.5-3.3-2.4-5.5-2.6 1.7-.7 3-1.9 4.1-3.6-2.4-.6-5 .2-7.1 2.1Z"
        />
        <path className="tomato-stem" d="M15 10V5h2v5Z" />
      </svg>
    </span>
  );
}
