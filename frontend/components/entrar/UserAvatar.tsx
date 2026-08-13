import { firstName } from "@/lib/profile";

export function UserAvatar({ name }: { name?: string }) {
  const label = firstName(name ?? "");

  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sand text-ink"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 48 48"
          className="h-10 w-10"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="24" cy="16" r="8" />
          <path d="M8 40c0-8.4 7.2-15.2 16-15.2S40 31.6 40 40v1.2H8V40Z" />
        </svg>
      </span>
      <span className="max-w-16 truncate text-center text-lg font-bold leading-tight">
        {label}
      </span>
    </div>
  );
}
