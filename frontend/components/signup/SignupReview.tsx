import { MARITAL_OPTIONS, type TravelyProfile } from "@/lib/profile";

function formatBirthDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${month}/${day}/${year}`;
}

function maritalLabel(id: TravelyProfile["maritalStatus"]): string {
  return MARITAL_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

function childrenLabel(profile: TravelyProfile): string {
  if (!profile.hasMinorChildren) return "No";
  const n = profile.minorChildrenCount;
  return n === 1 ? "Yes, 1" : `Yes, ${n}`;
}

function rows(profile: TravelyProfile): Array<[string, string]> {
  const place = [profile.city, profile.state, profile.country]
    .filter(Boolean)
    .join(", ");
  return [
    ["Name", profile.name],
    ["Email", profile.email],
    ["Date of birth", formatBirthDate(profile.birthDate)],
    ["Lives in", place],
    ["Marital status", maritalLabel(profile.maritalStatus)],
    ["Children under 18", childrenLabel(profile)],
    ["Likes to do", profile.hobbies.join(", ")],
  ];
}

export function SignupReview({ profile }: { profile: TravelyProfile }) {
  return (
    <div id="signup-review" className="flex w-full flex-col text-left">
      <h1 className="font-display text-titulo">Check your details</h1>
      <p className="mt-3 text-corpo text-suave">
        If something is wrong, start over. If it looks right, confirm.
      </p>
      <dl className="tv-placa mt-6">
        {rows(profile).map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-b border-linha px-5 py-3 last:border-b-0"
          >
            <dt className="shrink-0 text-apoio text-suave">{label}</dt>
            <dd className="text-right text-corpo font-semibold">
              {value.trim() ? value : "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
