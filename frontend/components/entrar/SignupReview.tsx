import { MARITAL_OPTIONS, type TravelyProfile } from "@/lib/profile";

function formatBirthDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function maritalLabel(id: TravelyProfile["maritalStatus"]): string {
  return MARITAL_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

function childrenLabel(profile: TravelyProfile): string {
  if (!profile.hasMinorChildren) return "Não";
  const n = profile.minorChildrenCount;
  return n === 1 ? "Sim, 1" : `Sim, ${n}`;
}

function rows(profile: TravelyProfile): Array<[string, string]> {
  const place = [profile.city, profile.state, profile.country]
    .filter(Boolean)
    .join(", ");
  return [
    ["Nome", profile.name],
    ["Email", profile.email],
    ["Nascimento", formatBirthDate(profile.birthDate)],
    ["Onde mora", place],
    ["Estado civil", maritalLabel(profile.maritalStatus)],
    ["Filhos menores", childrenLabel(profile)],
    ["O que gosta de fazer", profile.hobbies.join(", ")],
  ];
}

export function SignupReview({ profile }: { profile: TravelyProfile }) {
  return (
    <div id="resumo-cadastro" className="flex w-full flex-col text-left">
      <h1 className="font-display text-titulo">Confira os seus dados</h1>
      <p className="mt-3 text-corpo text-suave">
        Se algo estiver errado, é só refazer. Se estiver certo, confirme.
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
