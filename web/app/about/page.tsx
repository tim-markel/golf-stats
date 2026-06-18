import type { Metadata } from "next";

export const metadata: Metadata = { title: "About · Bogey Book" };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="mb-2 text-lg font-bold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

function Feature({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <li>
      <span className="font-semibold text-ink">{name}</span> — {children}
    </li>
  );
}

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">⛳ Bogey Book</h1>
        <p className="mt-1 text-gray-500">
          A personal golf journal that tracks your game hole by hole — far beyond
          just a score — and turns it into stats you can actually learn from.
        </p>
      </div>

      <Section title="What it does">
        <p>
          Bogey Book records every shot detail of your rounds and rolls them up
          into per-round scorecards and per-golfer trends: scoring, putting,
          accuracy off the tee and into greens, an estimated handicap index, and
          even your on-course beer/nicotine/weed log. Courses (with real tee
          ratings and yardages) are pulled from the web so the numbers are
          accurate.
        </p>
      </Section>

      <Section title="Getting started">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Open the <span className="font-semibold">⚙ Settings</span> menu
            (top-right) → <span className="font-semibold">Change or create golfer</span>
            , and add yourself (name + optional handicap).
          </li>
          <li>
            That golfer becomes the active golfer — the home page opens straight
            to their stats. Use Settings to switch golfers or rename / edit a
            handicap anytime.
          </li>
          <li>
            From a golfer&apos;s page, tap <span className="font-semibold">+ New round</span>{" "}
            to start logging.
          </li>
        </ol>
      </Section>

      <Section title="Logging a round">
        <p>On the setup screen you pick:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <Feature name="Course">
            a searchable dropdown (search by name or city). Courses are added via
            the scraper.
          </Feature>
          <Feature name="Tees">the tee set you played (drives slope/rating).</Feature>
          <Feature name="Date & time of day">morning / afternoon / twilight.</Feature>
          <Feature name="Holes played">
            18, or 9 with a Front / Back choice — the round only includes that nine.
          </Feature>
        </ul>
        <p className="pt-1">
          Then you go hole by hole. A mini scorecard at the top tracks your
          running total. For each hole:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <Feature name="Score">
            buttons from eagle to triple bogey (with circle/square markers), or
            &quot;Other&quot; to type any number. A score is required to advance.
          </Feature>
          <Feature name="Driving">
            a directional pad — center = fairway, arrows for left/right/short/long
            (par 4s &amp; 5s only).
          </Feature>
          <Feature name="Approach + GIR">
            a 3×3 pad — center = on the green, plus the 8 miss directions. GIR is a
            check/✗; a miss reveals an up-&amp;-down toggle.
          </Feature>
          <Feature name="Putts / Balls lost">0–4+ selectors.</Feature>
          <Feature name="Penalty">location (off tee / approach, multi-select) + a stroke count.</Feature>
          <Feature name="Hazards">water, greenside/fairway bunker, natural area, OB (multi-select).</Feature>
          <Feature name="Consumption">
            log beers, hotdogs, nicotine, and weed — searchable pickers for type
            and amount (beers add new ones to a shared catalog via &quot;Other&quot;;
            hotdogs are a simple count).
          </Feature>
        </ul>
      </Section>

      <Section title="The scorecard">
        <p>Tap any round to open its scorecard:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <Feature name="Paper scorecard">
            Yards / Par / Hdcp / Score per hole with classic markers (circle =
            under par, square = over). Use <span className="font-semibold">Edit scorecard</span>{" "}
            to fix scores.
          </Feature>
          <Feature name="Hole-by-hole cards">
            per hole: fairway, GIR, approach (✓ / arrows), putts, and any hazards,
            lost balls, beers, nicotine, or weed recorded.
          </Feature>
          <Feature name="Round totals">
            Approach &amp; Fairways shown as spatial &quot;target&quot; heatmaps
            (with GIR and FW counts), score &amp; putt distributions with per-par
            and putting averages, plus consumption totals.
          </Feature>
        </ul>
      </Section>

      <Section title="Your golfer page">
        <ul className="list-disc space-y-1.5 pl-5">
          <Feature name="Stat tiles">handicap index, average score, average putts, GIR %, fairway %.</Feature>
          <Feature name="Scores chart">
            a bar per round — hover for the score, click a bar to open that round&apos;s scorecard.
          </Feature>
          <Feature name="Rounds list">every round with its total; tap to view.</Feature>
        </ul>
      </Section>

      <Section title="Handicap index">
        <p>
          The handicap index is an estimate: each rated 18-hole round gets a score
          differential of <code>(113 ÷ slope) × (score − course rating)</code>,
          and the index is the average of your best recent differentials
          (WHS-style). It needs at least 3 rated 18-hole rounds.{" "}
          <span className="font-semibold">It is not an official USGA/GHIN handicap.</span>
        </p>
      </Section>

      <Section title="Good to know">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>It&apos;s a personal tracker — your rounds and golfers live in your own database.</li>
          <li>9-hole rounds are excluded from the 18-hole scoring/putting averages and the handicap index.</li>
          <li>New courses are added with the scraper; each comes with its tees, ratings, slopes, and yardages.</li>
        </ul>
      </Section>
    </div>
  );
}
