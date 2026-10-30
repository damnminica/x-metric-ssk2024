import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ssk, type GroupId, type Member } from "@/data/ssk";
import { compact, idn, ols, pearson, rho } from "@/lib/format";

type Lens = "spearman" | "senbatsu" | "top24" | "inside" | "noFeni";
type AxisId =
  | "uniqueMentions"
  | "followers"
  | "mentionViews"
  | "avgEngagement"
  | "tweets"
  | "hashtagViews"
  | "mentionsFans"
  | "mentionsFanbase";
type SortKey = "rank" | "votes" | "unique" | "followers" | "tweets" | "convert";

const SHORT_METRIC: Record<string, string> = {
  "Akun unik yang mention": "Akun unik mention",
  "Views pada tweet mention": "Views mention",
  "Follower X member": "Follower",
  "Mention dari fans individu": "Mention fans",
  "Rata-rata like per post": "Like / post",
  "Engagement rata-rata per post": "Engagement / post",
  "Views hashtag kampanye": "Views hashtag",
  "Engagement hashtag kampanye": "Engagement hashtag",
  "Akun unik mention saat voting": "Akun unik saat voting",
  "Mention dari akun fanbase": "Mention fanbase",
  "Frekuensi tweet member": "Frekuensi tweet",
  "Tweet member saat fase voting": "Tweet saat voting",
};

const AXES: { id: AxisId; label: string }[] = [
  { id: "uniqueMentions", label: "Akun unik mention" },
  { id: "followers", label: "Follower" },
  { id: "mentionViews", label: "Views mention" },
  { id: "avgEngagement", label: "Engagement / post" },
  { id: "tweets", label: "Jumlah tweet" },
  { id: "hashtagViews", label: "Views hashtag" },
  { id: "mentionsFans", label: "Mention fans" },
  { id: "mentionsFanbase", label: "Mention fanbase" },
];

const LENSES: { id: Lens; label: string; hint: string }[] = [
  { id: "spearman", label: "Peringkat", hint: "Spearman ρ · n=43" },
  { id: "senbatsu", label: "Lolos Senbatsu", hint: "Pearson · n=43" },
  { id: "top24", label: "Lolos Top 24", hint: "Pearson · n=43" },
  { id: "inside", label: "Di dalam Top 24", hint: "Pearson · n=24" },
  { id: "noFeni", label: "Tanpa Feni", hint: "Pearson · n=23" },
];

const TEAMS = ["Passion", "Dream", "Love", "Graduate"] as const;

const GROUP_META: Record<GroupId, { label: string; fill: string }> = {
  senbatsu: { label: "Senbatsu", fill: "var(--color-crimson)" },
  undergirls: { label: "Undergirls", fill: "var(--color-brass)" },
  unranked: { label: "Unranked", fill: "var(--color-muted)" },
};

type TipPayload = {
  name?: string;
  value?: number | string | null;
  payload?: Record<string, unknown>;
};

type TipProps = {
  active?: boolean;
  label?: string | number;
  payload?: TipPayload[];
};

function asTip(props: unknown): TipProps {
  const source = props as {
    active?: boolean;
    label?: string | number;
    payload?: Array<{ name?: unknown; value?: unknown; payload?: unknown }>;
  };
  return {
    active: source.active,
    label: source.label,
    payload: source.payload?.map((item) => ({
      name: item.name == null ? undefined : String(item.name),
      value: typeof item.value === "number" || typeof item.value === "string" ? item.value : null,
      payload:
        item.payload && typeof item.payload === "object"
          ? (item.payload as Record<string, unknown>)
          : undefined,
    })),
  };
}

function useMounted() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

function fillFor(group: GroupId) {
  return GROUP_META[group].fill;
}

function chartName(state: unknown): string | undefined {
  if (!state || typeof state !== "object") return undefined;
  const rec = state as {
    activeLabel?: unknown;
    activePayload?: Array<{ payload?: { name?: unknown } }>;
  };
  const fromPayload = rec.activePayload?.[0]?.payload?.name;
  if (typeof fromPayload === "string") return fromPayload;
  if (typeof rec.activeLabel === "string") return rec.activeLabel;
  return undefined;
}

function axisOf(member: Member, id: AxisId): number {
  const value = member[id];
  return value ?? 0;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "min-h-11 rounded-full border px-3 text-sm font-medium " +
        (active ? "border-crimson bg-crimson text-paper" : "border-line bg-card text-ink hover:bg-mist")
      }
    >
      {children}
    </button>
  );
}

function Frame({
  id,
  kicker,
  title,
  caption,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line py-10">
      <p className="text-xs font-medium tracking-widest text-crimson uppercase">{kicker}</p>
      <h2 className="font-display mt-1 text-3xl text-ink sm:text-4xl">{title}</h2>
      <div className="mt-6">{children}</div>
      {caption ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{caption}</p> : null}
    </section>
  );
}

function Plot({
  ready,
  height,
  label,
  children,
}: {
  ready: boolean;
  height: number;
  label: string;
  children: ReactElement;
}) {
  return (
    <div className="w-full min-w-0" style={{ height }} role="img" aria-label={label}>
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="h-full rounded-2xl bg-mist" />
      )}
    </div>
  );
}

function TipCard({ title, rows }: { title?: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="max-w-xs rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink">
      {title ? <p className="mb-1 font-medium">{title}</p> : null}
      {rows.map((row) => (
        <p key={row.label} className="mt-1 leading-snug">
          <span className="text-muted">{row.label}. </span>
          <span className="tabular-nums">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

function tickStyle(fill = "var(--color-muted)") {
  return { fill, fontSize: 12 };
}

export function Desk() {
  const ready = useMounted();
  const [selected, setSelected] = useState("Feni");
  const [group, setGroup] = useState<"all" | GroupId>("all");
  const [team, setTeam] = useState<(typeof TEAMS)[number] | "all">("all");
  const [query, setQuery] = useState("");
  const [axis, setAxis] = useState<AxisId>("uniqueMentions");
  const [showModel, setShowModel] = useState(false);
  const [hideFeni, setHideFeni] = useState(false);
  const [lens, setLens] = useState<Lens>("spearman");
  const [conv, setConv] = useState<"unique" | "views">("unique");
  const [sortKey, setSortKey] = useState<SortKey>("rank");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("id");
    return ssk.members.filter((member) => {
      if (group !== "all" && member.group !== group) return false;
      if (team !== "all" && member.team !== team) return false;
      if (!q) return true;
      return (
        member.name.toLocaleLowerCase("id").includes(q) ||
        member.fullName.toLocaleLowerCase("id").includes(q) ||
        member.team.toLocaleLowerCase("id").includes(q)
      );
    });
  }, [group, team, query]);

  const focus = ssk.members.find((member) => member.name === selected) ?? ssk.members[0];

  const rankedBars = useMemo(
    () =>
      filtered
        .filter((member) => member.votesFinal != null)
        .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
        .map((member) => ({
          name: member.name,
          votes: member.votesFinal ?? 0,
          group: member.group,
        })),
    [filtered],
  );

  const scatter = useMemo(() => {
    const official: { name: string; x: number; y: number; group: GroupId; kind: string }[] = [];
    const estimated: { name: string; x: number; y: number; group: GroupId; kind: string }[] = [];
    for (const member of filtered) {
      if (hideFeni && member.name === "Feni") continue;
      const x = axisOf(member, axis);
      if (member.votesFinal != null) {
        official.push({ name: member.name, x, y: member.votesFinal, group: member.group, kind: "resmi" });
      } else if (showModel && member.estimatedVotes != null) {
        estimated.push({
          name: member.name,
          x,
          y: member.estimatedVotes,
          group: member.group,
          kind: "estimasi",
        });
      }
    }
    const basis = official.length >= 3 ? official : [...official, ...estimated];
    const fit = ols(basis);
    const decorate = <T extends { x: number; y: number }>(point: T) => {
      const predicted = fit ? fit.a + fit.b * point.x : point.y;
      const residual = point.y - predicted;
      return { ...point, residual, predicted, above: residual >= 0 };
    };
    const off = official.map(decorate);
    const est = estimated.map(decorate);
    let line: { x: number; y: number }[] = [];
    if (fit && basis.length >= 2) {
      const xs = basis.map((point) => point.x);
      const min = Math.min(...xs);
      const max = Math.max(...xs);
      line = [
        { x: min, y: fit.a + fit.b * min },
        { x: max, y: fit.a + fit.b * max },
      ];
    }
    const ranked = [...off, ...est].sort((a, b) => b.residual - a.residual);
    return {
      official: off,
      estimated: est,
      line,
      above: ranked.filter((point) => point.above),
      below: ranked.filter((point) => !point.above).reverse(),
      fitOn: official.length >= 3 ? "suara resmi" : "titik yang tampil",
    };
  }, [filtered, axis, hideFeni, showModel]);

  const liveR = pearson(
    [...scatter.official, ...scatter.estimated].map((point) => ({ x: point.x, y: point.y })),
  );

  const corrRows = useMemo(
    () =>
      ssk.correlations
        .map((row) => ({
          metric: SHORT_METRIC[row.metric] ?? row.metric,
          full: row.metric,
          value: row[lens],
          note: row.note,
        }))
        .sort((a, b) => b.value - a.value),
    [lens],
  );

  const lineRows = useMemo(() => {
    const stages: { key: "rankT1" | "rankT2" | "rank"; label: string }[] = [
      { key: "rankT1", label: "Tahap 1" },
      { key: "rankT2", label: "Tahap 2" },
      { key: "rank", label: "Final" },
    ];
    const board = ssk.members.filter((member) => member.rank != null);
    return stages.map((stage) => {
      const row: Record<string, string | number | null> = { stage: stage.label };
      for (const member of board) row[member.name] = member[stage.key];
      return row;
    });
  }, []);

  const board = ssk.members.filter((member) => member.rank != null);

  const convRows = useMemo(
    () =>
      ssk.members
        .filter((member) => member.votesFinal != null)
        .map((member) => ({
          name: member.name,
          value: conv === "unique" ? (member.votesPerUnique ?? 0) : (member.votesPer1kViews ?? 0),
          group: member.group,
          typology: member.typology ?? "",
        }))
        .sort((a, b) => b.value - a.value),
    [conv],
  );

  const unrankedRows = useMemo(
    () =>
      ssk.members
        .filter((member) => member.estimatedVotes != null)
        .map((member) => ({
          name: member.name,
          votes: member.estimatedVotes ?? 0,
          status: member.potentialStatus ?? "",
        }))
        .sort((a, b) => b.votes - a.votes),
    [],
  );

  const indexRows = useMemo(() => {
    const sen = ssk.groups[0];
    const keys = [
      { key: "followers", label: "Follower" },
      { key: "unique", label: "Akun unik" },
      { key: "engagement", label: "Engagement" },
      { key: "views", label: "Views mention" },
      { key: "hashtagViews", label: "Views tag" },
      { key: "tweets", label: "Tweet" },
    ] as const;
    return keys.map((item) => {
      const base = sen[item.key] || 1;
      const row: Record<string, string | number> = { metric: item.label };
      for (const g of ssk.groups) {
        const raw = g[item.key];
        row[g.label] = raw == null ? 0 : Math.round((raw / base) * 100);
      }
      return row;
    });
  }, []);

  const whale = [...ssk.members]
    .filter((member) => member.votesPerUnique != null)
    .sort((a, b) => (b.votesPerUnique ?? 0) - (a.votesPerUnique ?? 0))[0];
  const reach = [...ssk.members].sort((a, b) => b.mentionViews - a.mentionViews)[0];
  const loud = [...ssk.members].sort((a, b) => b.tweets - a.tweets)[0];
  const strongest = [...ssk.correlations].sort((a, b) => b.spearman - a.spearman)[0];
  const aboveCutoff = unrankedRows.filter((row) => row.votes >= ssk.meta.cutoff).length;

  const tableRows = [...filtered].sort((a, b) => {
    const vote = (member: Member) => member.votesFinal ?? member.estimatedVotes ?? -1;
    if (sortKey === "votes") return vote(b) - vote(a);
    if (sortKey === "unique") return b.uniqueMentions - a.uniqueMentions;
    if (sortKey === "followers") return b.followers - a.followers;
    if (sortKey === "tweets") return b.tweets - a.tweets;
    if (sortKey === "convert") return (b.votesPerUnique ?? -1) - (a.votesPerUnique ?? -1);
    const ar = a.rank ?? 999;
    const br = b.rank ?? 999;
    return ar - br || a.name.localeCompare(b.name, "id");
  });

  const axisLabel = AXES.find((item) => item.id === axis)?.label ?? "";
  const lensMeta = LENSES.find((item) => item.id === lens);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <header className="pt-8 pb-6 sm:pt-12">
        <p className="text-xs font-medium tracking-widest text-crimson uppercase">
          JKT48 · {ssk.meta.election}
        </p>
        <h1 className="font-display mt-2 max-w-3xl text-4xl text-ink sm:text-6xl">
          Suara di kotak, gema di X
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          {idn(ssk.meta.n)} member, voting {ssk.meta.voting}. Keramaian di X tidak sama dengan
          suara yang masuk. Sinyal terkuatnya bukan seberapa sering member nge-tweet — melainkan
          berapa banyak akun berbeda yang menyebut nama mereka.
        </p>
        <div className="no-export mt-5 flex flex-wrap gap-2">
          <a
            href="/ssk-2024-laporan.png"
            download="SSK-2024-X.png"
            className="inline-flex min-h-11 items-center rounded-full bg-crimson px-4 text-sm font-medium text-paper"
          >
            Unduh gambar
          </a>
          <a
            href="/ssk-2024-laporan.pdf"
            download="SSK-2024-X.pdf"
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-medium text-ink"
          >
            Unduh grafik
          </a>
          <a
            href="/ssk-2024-laporan-tertulis.pdf"
            download="Laporan-SSK-2024-X.pdf"
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-medium text-ink"
          >
            Unduh laporan
          </a>
        </div>
        <p className="no-export mt-2 max-w-xl text-sm text-muted">
          Laporan tertulis 9 halaman. Gambar dan PDF grafik adalah papan visualnya. Semuanya laporan lengkap, bukan saringan yang sedang aktif.
        </p>
        <nav className="no-export mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Bagian">
          {[
            ["#suara", "Suara"],
            ["#sebar", "Sebaran"],
            ["#korelasi", "Korelasi"],
            ["#lintasan", "Lintasan"],
            ["#konversi", "Konversi"],
            ["#bayangan", "Unranked"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-card px-3 text-sm font-medium text-ink"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Angka kunci">
        <Kpi k="Suara Top 24" v={idn(ssk.meta.totalVotesTop24)} s="Hanya papan resmi yang diumumkan" />
        <Kpi k="Sinyal terkuat" v={"ρ " + rho(strongest.spearman)} s={strongest.metric} />
        <Kpi
          k="Konversi tertinggi"
          v={idn(whale.votesPerUnique ?? 0, 0)}
          s={`${whale.name} suara tiap akun unik`}
        />
        <Kpi
          k="Sprint akhir"
          v={"ρ " + rho(ssk.stages[2].mentionRho)}
          s="Mention sudah menjauh dari suara"
        />
      </section>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Story
          kicker="Silent whale"
          title={whale.name}
          body={`${whale.typology}. ${idn(whale.votesFinal ?? 0)} suara dari ${idn(whale.uniqueMentions)} akun unik — ${idn(whale.votesPerUnique ?? 0, 1)} suara per akun.`}
          onClick={() => setSelected(whale.name)}
          active={selected === whale.name}
        />
        <Story
          kicker="Jangkauan"
          title={reach.name}
          body={`${compact(reach.mentionViews)} views mention, tertinggi di dataset. Konversinya ${idn(reach.votesPer1kViews ?? 0, 2)} suara per 1.000 views.`}
          onClick={() => setSelected(reach.name)}
          active={selected === reach.name}
        />
        <Story
          kicker="Paling sering nge-tweet"
          title={loud.name}
          body={`${idn(loud.tweets)} tweet, ${GROUP_META[loud.group].label.toLowerCase()}. Frekuensi tweet berkorelasi negatif dengan suara (ρ ${rho(ssk.correlations.find((row) => row.metric.startsWith("Frekuensi"))?.spearman ?? 0)}).`}
          onClick={() => setSelected(loud.name)}
          active={selected === loud.name}
        />
      </div>

      <Frame
        id="suara"
        kicker="Papan resmi"
        title="Siapa yang benar-benar menang suara"
        caption="Batang berwarna merah Senbatsu (1–12), kuningan Undergirls (13–24). Suara di luar Top 24 tidak diumumkan, jadi tidak digambar sebagai nol."
      >
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <Filters
              query={query}
              setQuery={setQuery}
              group={group}
              setGroup={setGroup}
              team={team}
              setTeam={setTeam}
            />
            {rankedBars.length === 0 ? (
              <p className="mt-6 text-sm text-muted">Tidak ada suara resmi pada saringan ini.</p>
            ) : (
              <div className="mt-4">
                <Plot ready={ready} height={Math.max(240, rankedBars.length * 28)} label="Suara akhir Top 24">
                  <BarChart
                  data={rankedBars}
                  layout="vertical"
                  margin={{ left: 4, right: 12, top: 4, bottom: 0 }}
                  onClick={(state) => {
                    const name = chartName(state);
                    if (name) setSelected(name);
                  }}
                >
                    <CartesianGrid horizontal={false} stroke="var(--color-line)" />
                    <XAxis type="number" tickFormatter={compact} tick={tickStyle()} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      tick={tickStyle("var(--color-ink)")}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-mist)" }}
                      content={(props) => {
                        const { active, payload } = asTip(props);
                        if (!active || !payload?.[0]) return null;
                        const row = payload[0].payload as { name: string; votes: number; group: GroupId };
                        return (
                          <TipCard
                            title={row.name}
                            rows={[
                              { label: "Suara akhir", value: idn(row.votes) },
                              { label: "Kelompok", value: GROUP_META[row.group].label },
                            ]}
                          />
                        );
                      }}
                    />
                    <Bar
                      dataKey="votes"
                      radius={[0, 6, 6, 0]}
                      isAnimationActive={false}
                    >
                      {rankedBars.map((row) => (
                        <Cell
                          key={row.name}
                          fill={fillFor(row.group)}
                          opacity={row.name === selected ? 1 : 0.78}
                          cursor="pointer"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </Plot>
              </div>
            )}
          </div>
          <div className="min-w-0 lg:col-span-5 lg:sticky lg:top-4">
            <Dossier
              member={focus}
              onSelect={setSelected}
            />
          </div>
        </div>
      </Frame>

      <Frame
        id="sebar"
        kicker="Sebaran"
        title="Metrik X di sumbu kiri, suara di sumbu atas"
        caption={
          liveR == null
            ? "Butuh sedikitnya tiga titik untuk menggambar garis regresi."
            : `Garis adalah regresi linear pada ${scatter.fitOn}. Titik di atas garis perform lebih baik dari tren: suaranya lebih tinggi daripada yang diprediksi metrik ini. Pearson r = ${rho(liveR)}.`
        }
      >
        <div className="flex flex-wrap gap-2">
          {AXES.map((item) => (
            <Chip key={item.id} active={axis === item.id} onClick={() => setAxis(item.id)}>
              {item.label}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip active={showModel} onClick={() => setShowModel((v) => !v)}>
            {showModel ? "Estimasi unranked: nyala" : "Estimasi unranked: mati"}
          </Chip>
          <Chip active={hideFeni} onClick={() => setHideFeni((v) => !v)}>
            {hideFeni ? "Feni disembunyikan" : "Sembunyikan Feni"}
          </Chip>
        </div>
        <div className="mt-4">
          <Legend
            items={[
              { label: "Garis regresi", swatch: "var(--color-ink)" },
              { label: "Di atas garis", swatch: "var(--color-crimson)" },
              { label: "Di bawah garis", swatch: "var(--color-brass)" },
              ...(showModel ? [{ label: "Estimasi unranked", swatch: "var(--color-muted)" }] : []),
            ]}
          />
          <Plot ready={ready} height={420} label={`Sebaran ${axisLabel} terhadap suara`}>
            <ScatterChart
              margin={{ left: 4, right: 16, top: 16, bottom: 20 }}
              onClick={(state) => {
                const name = chartName(state);
                if (name) setSelected(name);
              }}
            >
              <CartesianGrid stroke="var(--color-line)" />
              <XAxis
                type="number"
                dataKey="x"
                name={axisLabel}
                tickFormatter={compact}
                tick={tickStyle()}
                axisLine={false}
                tickLine={false}
                tickCount={5}
              />
              <YAxis
                type="number"
                dataKey="y"
                tickFormatter={compact}
                tick={tickStyle()}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={(props) => {
                        const { active, payload } = asTip(props);
                  const row = payload?.[0]?.payload as
                    | { name?: string; x: number; y: number; kind?: string; residual?: number; predicted?: number }
                    | undefined;
                  if (!active || !row?.name) return null;
                  const gap = row.residual ?? 0;
                  return (
                    <TipCard
                      title={row.name}
                      rows={[
                        { label: axisLabel, value: compact(row.x) },
                        { label: row.kind === "estimasi" ? "Estimasi suara" : "Suara resmi", value: idn(row.y) },
                        { label: "Prediksi garis", value: idn(row.predicted ?? row.y) },
                        { label: gap >= 0 ? "Di atas garis" : "Di bawah garis", value: (gap >= 0 ? "+" : "−") + compact(Math.abs(gap)) },
                      ]}
                    />
                  );
                }}
              />
              {showModel ? (
                <ReferenceLine
                  y={ssk.meta.cutoff}
                  stroke="var(--color-line)"
                  strokeDasharray="4 4"
                />
              ) : null}
              <Scatter
                data={scatter.official}
                line={scatter.official.length >= 3 ? { stroke: "var(--color-ink)", strokeWidth: 3 } : false}
                lineType="fitting"
                isAnimationActive={false}
              >
                {scatter.official.map((point) => (
                  <Cell
                    key={point.name}
                    fill={point.above ? "var(--color-crimson)" : "var(--color-brass)"}
                    stroke={point.name === selected ? "var(--color-ink)" : "transparent"}
                    strokeWidth={point.name === selected ? 2 : 0}
                  />
                ))}
              </Scatter>
              <Scatter
                data={scatter.estimated}
                shape="diamond"
                line={scatter.official.length >= 3 ? false : { stroke: "var(--color-ink)", strokeWidth: 3 }}
                lineType="fitting"
                isAnimationActive={false}
              >
                {scatter.estimated.map((point) => (
                  <Cell
                    key={point.name}
                    fill="var(--color-muted)"
                    stroke={point.above ? "var(--color-crimson)" : "var(--color-brass)"}
                    strokeWidth={2}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </Plot>
          <p className="mt-2 text-xs text-muted">
            Sumbu mendatar: {axisLabel}. Sumbu tegak: suara. Merah di atas garis regresi, kuningan di bawah. Berlian adalah estimasi, bukan hasil resmi.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ResidualList title="Di atas garis" points={scatter.above} selected={selected} onSelect={setSelected} />
            <ResidualList title="Di bawah garis" points={scatter.below} selected={selected} onSelect={setSelected} />
          </div>
        </div>
      </Frame>

      <Frame
        id="korelasi"
        kicker="Matriks studi"
        title="Apa yang benar-benar sejalan dengan suara"
        caption={corrRows[0] ? corrRows[0].note : undefined}
      >
        <div className="flex flex-wrap gap-2">
          {LENSES.map((item) => (
            <Chip key={item.id} active={lens === item.id} onClick={() => setLens(item.id)}>
              {item.label}
            </Chip>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">{lensMeta?.hint}. Batang merah positif, tinta negatif.</p>
        <div className="mt-4">
          <Plot ready={ready} height={460} label="Korelasi metrik X terhadap suara">
            <BarChart data={corrRows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--color-line)" />
              <XAxis
                type="number"
                domain={[-0.7, 0.9]}
                tick={tickStyle()}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="metric"
                width={148}
                tick={tickStyle("var(--color-ink)")}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine x={0} stroke="var(--color-ink)" />
              <Tooltip
                cursor={{ fill: "var(--color-mist)" }}
                content={(props) => {
                        const { active, payload } = asTip(props);
                  const row = payload?.[0]?.payload as { full: string; value: number; note: string } | undefined;
                  if (!active || !row) return null;
                  return (
                    <TipCard title={row.full} rows={[{ label: "Koefisien", value: rho(row.value) }, { label: "Baca", value: row.note }]} />
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14} isAnimationActive={false}>
                {corrRows.map((row) => (
                  <Cell key={row.metric} fill={row.value < 0 ? "var(--color-ink)" : "var(--color-crimson)"} />
                ))}
              </Bar>
            </BarChart>
          </Plot>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl text-ink">Tiga tahap, lalu senyap</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Korelasi mention dan hashtag terhadap tambahan suara melemah dari tahap 1 ke sprint akhir.
            </p>
            <div className="mt-4">
              <Plot ready={ready} height={280} label="Korelasi per tahap voting">
                <LineChart data={ssk.stages.map((stage) => ({
                  label: stage.label,
                  Mention: stage.mentionRho,
                  Hashtag: stage.hashtagRho,
                  "Mention tanpa Feni": stage.mentionNoFeni,
                }))} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="label" tick={tickStyle("var(--color-ink)")} axisLine={false} tickLine={false} />
                  <YAxis tick={tickStyle()} axisLine={false} tickLine={false} width={36} domain={[-0.2, 0.8]} />
                  <ReferenceLine y={0} stroke="var(--color-line)" />
                  <Tooltip
                    content={(props) => {
                      const { active, payload, label } = asTip(props);
                      if (!active || !payload?.length) return null;
                      return (
                        <TipCard
                          title={String(label)}
                          rows={payload.map((item) => ({
                            label: String(item.name),
                            value: rho(Number(item.value)),
                          }))}
                        />
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="Mention" stroke="var(--color-crimson)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Hashtag" stroke="var(--color-brass)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Mention tanpa Feni" stroke="var(--color-ink)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </Plot>
            </div>
            <Legend
              items={[
                { label: "Mention ρ", swatch: "var(--color-crimson)" },
                { label: "Hashtag ρ", swatch: "var(--color-brass)" },
                { label: "Mention tanpa Feni", swatch: "var(--color-ink)" },
              ]}
            />
          </div>
          <ol className="space-y-4">
            {ssk.stages.map((stage) => (
              <li key={stage.id} className="rounded-2xl border border-line bg-card p-4">
                <p className="text-xs font-medium tracking-widest text-crimson uppercase">{stage.window}</p>
                <p className="font-display mt-1 text-xl text-ink">{stage.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{stage.note}</p>
              </li>
            ))}
          </ol>
        </div>
      </Frame>

      <Frame
        id="lintasan"
        kicker="Tiga pengumuman"
        title="Naik, turun, atau diam di papan"
        caption="Garis tipis adalah seluruh Top 24. Garis merah adalah member yang sedang dipilih. Titik yang putus artinya nama itu belum masuk pengumuman tahap tersebut — Lulu absen di tahap 1, Delynn baru muncul di final."
      >
        <Plot ready={ready} height={440} label="Perubahan peringkat tiga tahap">
          <LineChart data={lineRows} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="stage" tick={tickStyle("var(--color-ink)")} axisLine={false} tickLine={false} />
            <YAxis
              reversed
              domain={[1, 24]}
              ticks={[1, 6, 12, 18, 24]}
              tick={tickStyle()}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              content={(props) => {
                      const { active, payload, label } = asTip(props);
                if (!active || !payload) return null;
                const rows = payload
                  .filter((item) => typeof item.value === "number")
                  .map((item) => ({ name: String(item.name), rank: Number(item.value) }))
                  .sort((a, b) => a.rank - b.rank);
                const head = rows.slice(0, 6);
                const mine = rows.find((row) => row.name === selected);
                const shown = mine && !head.some((row) => row.name === mine.name) ? [...head, mine] : head;
                return (
                  <TipCard
                    title={String(label)}
                    rows={shown.map((row) => ({
                      label: row.name === selected ? `${row.name} · dipilih` : row.name,
                      value: `#${idn(row.rank)}`,
                    }))}
                  />
                );
              }}
            />
            { [...board].sort((a, b) => Number(a.name === selected) - Number(b.name === selected)).map((member) => (
              <Line
                key={member.name}
                type="monotone"
                dataKey={member.name}
                stroke={member.name === selected ? "var(--color-crimson)" : "var(--color-muted)"}
                strokeOpacity={member.name === selected ? 1 : 0.28}
                strokeWidth={member.name === selected ? 3 : 1}
                dot={member.name === selected ? { r: 3, fill: "var(--color-crimson)" } : false}
                activeDot={member.name === selected ? { r: 5 } : false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </Plot>
      </Frame>

      <Frame
        id="konversi"
        kicker="Kelompok dan militansi"
        title="Senbatsu lebih sepi tweet, lebih padat suara"
        caption="Indeks 100 = rata-rata Senbatsu. Undergirls dan unranked tertinggal di follower, akun unik, dan views — tetapi unranked nge-tweet lebih dari dua kali Senbatsu."
      >
        <Plot ready={ready} height={300} label="Indeks rata-rata kelompok terhadap Senbatsu">
          <BarChart data={indexRows} layout="vertical" margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-line)" />
            <XAxis type="number" tick={tickStyle()} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="metric"
              width={108}
              tick={tickStyle("var(--color-ink)")}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={100} stroke="var(--color-line)" />
            <Tooltip
              content={(props) => {
                      const { active, payload, label } = asTip(props);
                if (!active || !payload?.length) return null;
                return (
                  <TipCard
                    title={String(label)}
                    rows={payload.map((item) => ({
                      label: String(item.name),
                      value: idn(Number(item.value)),
                    }))}
                  />
                );
              }}
            />
            <Bar dataKey="Senbatsu" fill="var(--color-crimson)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            <Bar dataKey="Undergirls" fill="var(--color-brass)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            <Bar dataKey="Unranked" fill="var(--color-muted)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </Plot>
        <div className="mt-3">
          <Legend
            items={[
              { label: "Senbatsu = 100", swatch: "var(--color-crimson)" },
              { label: "Undergirls", swatch: "var(--color-brass)" },
              { label: "Unranked", swatch: "var(--color-muted)" },
            ]}
          />
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <Chip active={conv === "unique"} onClick={() => setConv("unique")}>
            Suara per akun unik
          </Chip>
          <Chip active={conv === "views"} onClick={() => setConv("views")}>
            Suara per 1.000 views
          </Chip>
        </div>
        <div className="mt-4">
          <Plot ready={ready} height={640} label="Konversi suara Top 24">
            <BarChart
              data={convRows}
              layout="vertical"
              margin={{ left: 4, right: 12, top: 4, bottom: 0 }}
              onClick={(state) => {
                const name = chartName(state);
                if (name) setSelected(name);
              }}
            >
              <CartesianGrid horizontal={false} stroke="var(--color-line)" />
              <XAxis type="number" tick={tickStyle()} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={72} tick={tickStyle("var(--color-ink)")} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "var(--color-mist)" }}
                content={(props) => {
                        const { active, payload } = asTip(props);
                  const row = payload?.[0]?.payload as { name: string; value: number; typology: string } | undefined;
                  if (!active || !row) return null;
                  return (
                    <TipCard
                      title={row.name}
                      rows={[
                        { label: conv === "unique" ? "Suara / akun" : "Suara / 1.000 views", value: idn(row.value, conv === "unique" ? 1 : 2) },
                        { label: "Tipologi", value: row.typology },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                {convRows.map((row) => (
                  <Cell key={row.name} fill={fillFor(row.group)} opacity={row.name === selected ? 1 : 0.8} />
                ))}
              </Bar>
            </BarChart>
          </Plot>
        </div>
      </Frame>

      <Frame
        id="bayangan"
        kicker="Di luar pengumuman"
        title="Model bayangan untuk 19 nama unranked"
        caption={`Kalibrasi Undergirls: ${ssk.meta.model}. Garis merah adalah cutoff #24 ${ssk.meta.cutoffName} (${idn(ssk.meta.cutoff)} suara). ${idn(aboveCutoff)} nama melewati garis itu di dalam model — bukan di hasil resmi.`}
      >
        <Plot ready={ready} height={560} label="Estimasi potensi suara member unranked">
          <BarChart
            data={unrankedRows}
            layout="vertical"
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
            onClick={(state) => {
              const name = chartName(state);
              if (name) setSelected(name);
            }}
          >
            <CartesianGrid horizontal={false} stroke="var(--color-line)" />
            <XAxis type="number" tickFormatter={compact} tick={tickStyle()} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={72} tick={tickStyle("var(--color-ink)")} axisLine={false} tickLine={false} />
            <ReferenceLine x={ssk.meta.cutoff} stroke="var(--color-crimson)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ fill: "var(--color-mist)" }}
              content={(props) => {
                        const { active, payload } = asTip(props);
                const row = payload?.[0]?.payload as { name: string; votes: number; status: string } | undefined;
                if (!active || !row) return null;
                return (
                  <TipCard
                    title={row.name}
                    rows={[
                      { label: "Estimasi", value: idn(row.votes) },
                      { label: "Vs cutoff", value: `${idn((row.votes / ssk.meta.cutoff) * 100, 0)}%` },
                      { label: "Status", value: row.status },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="votes" radius={[0, 6, 6, 0]} isAnimationActive={false}>
              {unrankedRows.map((row) => (
                <Cell
                  key={row.name}
                  fill={row.votes >= ssk.meta.cutoff ? "var(--color-brass)" : "var(--color-muted)"}
                />
              ))}
            </Bar>
          </BarChart>
        </Plot>
      </Frame>

      <section className="border-t border-line py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl text-ink">Tabel member</h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["rank", "Peringkat"],
                ["votes", "Suara"],
                ["unique", "Akun unik"],
                ["followers", "Follower"],
                ["tweets", "Tweet"],
                ["convert", "Konversi"],
              ] as const
            ).map(([key, label]) => (
              <Chip key={key} active={sortKey === key} onClick={() => setSortKey(key)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-mist text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">#</th>
                <th className="px-3 py-3 font-medium">Member</th>
                <th className="px-3 py-3 font-medium">Tim</th>
                <th className="px-3 py-3 text-right font-medium">Suara</th>
                <th className="px-3 py-3 text-right font-medium">Akun unik</th>
                <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">Follower</th>
                <th className="hidden px-3 py-3 text-right font-medium md:table-cell">Tweet</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((member) => {
                const votes = member.votesFinal ?? member.estimatedVotes;
                const estimated = member.votesFinal == null;
                return (
                  <tr
                    key={member.name}
                    className={member.name === selected ? "bg-mist" : "bg-card"}
                  >
                    <td className="border-t border-line px-3 py-2 tabular-nums text-muted">
                      {member.rank ?? "—"}
                    </td>
                    <td className="border-t border-line px-3 py-2">
                      <button
                        type="button"
                        className="min-h-11 text-left font-medium text-ink"
                        onClick={() => setSelected(member.name)}
                      >
                        {member.name}
                        <span className="mt-0.5 block text-xs font-normal text-muted">{member.fullName}</span>
                      </button>
                    </td>
                    <td className="border-t border-line px-3 py-2 text-muted">{member.team}</td>
                    <td className="border-t border-line px-3 py-2 text-right tabular-nums">
                      {votes == null ? "—" : idn(votes)}
                      {estimated ? <span className="block text-xs text-muted">estimasi</span> : null}
                    </td>
                    <td className="border-t border-line px-3 py-2 text-right tabular-nums">{idn(member.uniqueMentions)}</td>
                    <td className="hidden border-t border-line px-3 py-2 text-right tabular-nums sm:table-cell">
                      {compact(member.followers)}
                    </td>
                    <td className="hidden border-t border-line px-3 py-2 text-right tabular-nums md:table-cell">
                      {idn(member.tweets)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="border-t border-line pt-6 text-sm leading-relaxed text-muted">
        Suara resmi dari{" "}
        <a
          className="underline decoration-line underline-offset-2"
          href="https://id.wikipedia.org/wiki/Pemilihan_Member_Single_ke-26_JKT48"
        >
          Pemilihan Member Single ke-26 JKT48
        </a>
        . Metrik X dari dataset kampanye: tweet member, mention tanpa reply, dan hashtag kampanye.
        Angka unranked adalah model, bukan pengumuman.
      </footer>
    </main>
  );
}

function Kpi({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <article className="rounded-2xl border border-line bg-card px-4 py-4">
      <p className="text-xs font-medium tracking-widest text-muted uppercase">{k}</p>
      <p className="font-display mt-2 text-3xl text-ink tabular-nums">{v}</p>
      <p className="mt-1 text-sm text-muted">{s}</p>
    </article>
  );
}

function Story({
  kicker,
  title,
  body,
  onClick,
  active,
}: {
  kicker: string;
  title: string;
  body: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-2xl border px-4 py-4 text-left " +
        (active ? "border-crimson bg-card" : "border-line bg-card hover:bg-mist")
      }
    >
      <p className="text-xs font-medium tracking-widest text-crimson uppercase">{kicker}</p>
      <p className="font-display mt-1 text-2xl text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </button>
  );
}

function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full" style={{ background: item.swatch }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function ResidualList({
  title,
  points,
  selected,
  onSelect,
}: {
  title: string;
  points: { name: string; residual: number; kind: string }[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card">
      <p className="border-b border-line px-4 py-3 text-sm font-medium text-ink">
        {title}
        <span className="ml-2 tabular-nums text-muted">{idn(points.length)}</span>
      </p>
      {points.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Tidak ada pada saringan ini.</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {points.map((point) => (
            <li key={point.name}>
              <button
                type="button"
                onClick={() => onSelect(point.name)}
                className={
                  "flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-sm " +
                  (point.name === selected ? "bg-mist" : "")
                }
              >
                <span className="font-medium text-ink">
                  {point.name}
                  {point.kind === "estimasi" ? <span className="ml-2 font-normal text-muted">estimasi</span> : null}
                </span>
                <span className="tabular-nums text-muted">
                  {(point.residual >= 0 ? "+" : "−") + compact(Math.abs(point.residual))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Filters({
  query,
  setQuery,
  group,
  setGroup,
  team,
  setTeam,
}: {
  query: string;
  setQuery: (value: string) => void;
  group: "all" | GroupId;
  setGroup: (value: "all" | GroupId) => void;
  team: (typeof TEAMS)[number] | "all";
  setTeam: (value: (typeof TEAMS)[number] | "all") => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm text-muted">
        Cari member
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nama atau tim"
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-card px-3 text-ink"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Chip active={group === "all"} onClick={() => setGroup("all")}>
          Semua kelompok
        </Chip>
        {(Object.keys(GROUP_META) as GroupId[]).map((id) => (
          <Chip key={id} active={group === id} onClick={() => setGroup(id)}>
            {GROUP_META[id].label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip active={team === "all"} onClick={() => setTeam("all")}>
          Semua tim
        </Chip>
        {TEAMS.map((name) => (
          <Chip key={name} active={team === name} onClick={() => setTeam(name)}>
            {name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Dossier({ member, onSelect }: { member: Member; onSelect: (name: string) => void }) {
  const ordered = [...ssk.members].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.name.localeCompare(b.name, "id"));
  const fan = member.mentionsFans;
  const base = member.mentionsFanbase;
  const mix = fan + base || 1;
  const days = member.mentionDay ? [...member.mentionDay] : [];
  const dayMax = Math.max(1, ...days);

  return (
    <article className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <label className="block text-sm text-muted">
        Member yang dibaca
        <select
          value={member.name}
          onChange={(event) => onSelect(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-ink"
        >
          {ordered.map((item) => (
            <option key={item.name} value={item.name}>
              {item.rank ? `#${item.rank} ` : ""}
              {item.name} · {item.team}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-4 text-xs font-medium tracking-widest text-crimson uppercase">
        {GROUP_META[member.group].label}
        {member.generation ? ` · Gen ${member.generation}` : ""} · {member.team}
      </p>
      <h3 className="font-display mt-1 text-3xl text-ink">{member.fullName}</h3>
      <p className="text-sm text-muted">@{member.handle}</p>
      {member.tagline ? <p className="mt-2 text-sm text-ink">{member.tagline}</p> : null}
      {member.typology ? <p className="mt-3 text-sm leading-relaxed text-muted">{member.typology}</p> : null}
      {member.potentialStatus ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{member.potentialStatus}</p>
      ) : null}

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <StageCell label="Tahap 1" rank={member.rankT1} votes={member.votesT1} />
        <StageCell label="Tahap 2" rank={member.rankT2} votes={member.votesT2} />
        <StageCell label="Final" rank={member.rank} votes={member.votesFinal} />
      </dl>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Stat label="Follower" value={compact(member.followers)} />
        <Stat label="Tweet" value={idn(member.tweets)} />
        <Stat label="Akun unik" value={idn(member.uniqueMentions)} />
        <Stat label="Views mention" value={compact(member.mentionViews)} />
        <Stat label="Engagement / post" value={member.avgEngagement == null ? "—" : idn(member.avgEngagement, 0)} />
        <Stat
          label="Suara / akun"
          value={member.votesPerUnique == null ? "—" : idn(member.votesPerUnique, 1)}
        />
        {member.estimatedVotes != null ? (
          <Stat label="Estimasi suara" value={idn(member.estimatedVotes)} />
        ) : null}
        {member.cutoffPct != null ? (
          <Stat label="Terhadap cutoff" value={`${idn(member.cutoffPct * 100, 0)}%`} />
        ) : null}
      </dl>

      <div className="mt-4">
        <p className="text-xs font-medium tracking-widest text-muted uppercase">Asal mention</p>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-mist">
          <div className="h-full bg-crimson" style={{ width: `${(fan / mix) * 100}%` }} />
          <div className="h-full bg-brass" style={{ width: `${(base / mix) * 100}%` }} />
        </div>
        <p className="mt-2 flex justify-between text-xs text-muted tabular-nums">
          <span>Fans {idn(fan)}</span>
          <span>Fanbase {idn(base)}</span>
        </p>
      </div>

      {days.length === 3 ? (
        <div className="mt-4">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Mention per hari</p>
          <div className="mt-2 flex h-16 items-end gap-2">
            {days.map((value, index) => (
              <div key={["t1", "t2", "final"][index]} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-12 w-full items-end">
                  <div
                    className="w-full rounded-t-md bg-crimson"
                    style={{ height: `${Math.max(8, (value / dayMax) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted tabular-nums">{idn(value, 0)}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 flex justify-between text-xs text-muted">
            <span>T1</span>
            <span>T2</span>
            <span>Final</span>
          </p>
        </div>
      ) : null}

      <a
        className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-crimson underline decoration-line underline-offset-2"
        href={`https://x.com/${member.handle}`}
      >
        Buka @{member.handle}
      </a>
    </article>
  );
}

function StageCell({ label, rank, votes }: { label: string; rank: number | null; votes: number | null }) {
  const announced = rank != null;
  return (
    <div className="rounded-xl bg-paper px-2 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-xl text-ink tabular-nums">{announced ? `#${rank}` : "—"}</dd>
      <dd className="text-xs text-muted tabular-nums">
        {announced && votes != null ? idn(votes) : "tak diumumkan"}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}
