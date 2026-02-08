"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CONTEST_START, CONTEST_END, MONTH_GOAL } from "@/lib/content";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

type LeaderRow = {
  user_id: string;
  display_name: string;
  total_burpees: number;
};

function colorForIndex(i: number) {
  // Golden-angle hue spacing gives good separation for up to 100+ contestants
  const hue = (i * 137.508) % 360;
  return `hsl(${hue} 70% 50%)`;
}

function borderForIndex(i: number) {
  const hue = (i * 137.508) % 360;
  return `hsl(${hue} 70% 40%)`;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);

  const [displayName, setDisplayName] = useState("");
  const [date, setDate] = useState("2026-03-01");
  const [burpees, setBurpees] = useState<number>(0);

  const [myTotal, setMyTotal] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) =>
      setSession(sess)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithEmail(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else alert("Check your email for the login link.");
  }

  async function loadData() {
    if (!session?.user) return;

    setLoading(true);

    // My total (only my rows are readable)
    const { data: myRows, error: myErr } = await supabase
      .from("burpee_entries")
      .select("burpees")
      .gte("entry_date", CONTEST_START)
      .lte("entry_date", CONTEST_END);

    if (myErr) console.error(myErr);
    setMyTotal(
      (myRows ?? []).reduce(
        (sum, r: any) => sum + (r.burpees ?? 0),
        0
      )
    );

    // Leaderboard totals via secure function
    const { data: lb, error: lbErr } = await supabase.rpc(
      "leaderboard_totals",
      {
        start_date: CONTEST_START,
        end_date: CONTEST_END
      }
    );

    if (lbErr) console.error(lbErr);
    setLeaderboard(
      (lb ?? []).map((r: any) => ({
        ...r,
        total_burpees: Number(r.total_burpees)
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function saveDisplayName() {
    if (!session?.user) return;

    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      display_name: displayName || "Anonymous"
    });

    if (error) alert(error.message);
    await loadData();
  }

  async function submitBurpees() {
    if (!session?.user) return;

    if (date < CONTEST_START || date > CONTEST_END) {
      alert("Date must be within March 1–31, 2026.");
      return;
    }

    const value = Math.max(0, Number(burpees) || 0);

    const { error } = await supabase.from("burpee_entries").upsert({
      user_id: session.user.id,
      entry_date: date,
      burpees: value
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Saved!");
  }

  const barData = useMemo(() => {
  const labels = leaderboard.map((r) => r.display_name);
  const data = leaderboard.map((r) => r.total_burpees);

  const bg = leaderboard.map((_, i) => colorForIndex(i));
  const border = leaderboard.map((_, i) => borderForIndex(i));

  return {
    labels,
    datasets: [
      {
        label: "Total Burpees (March 2026)",
        data,
        backgroundColor: bg,
        borderColor: border,
        borderWidth: 1
      }
    ]
  };
}, [leaderboard]);

  const myPercent = Math.min(
    100,
    Math.round((myTotal / MONTH_GOAL) * 100)
  );

  const doughnutData = useMemo(() => {
    return {
      labels: ["Completed", "Remaining"],
      datasets: [
        {
          label: "My 3100 Goal Progress",
          data: [myTotal, Math.max(0, MONTH_GOAL - myTotal)]
        }
      ]
    };
  }, [myTotal]);

  if (!session) {
    return <Login onEmailSignIn={signInWithEmail} />;
  }

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: 20,
        fontFamily: "system-ui"
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <h1>March 2026 Burpee Challenge</h1>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16
        }}
      >
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 16
          }}
        >
          <h2>Your entry</h2>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label>
              Burpees
              <input
                type="number"
                min={0}
                value={burpees}
                onChange={(e) => setBurpees(Number(e.target.value))}
              />
            </label>

            <button onClick={submitBurpees} disabled={loading}>
              Save
            </button>
          </div>

          <hr style={{ margin: "16px 0" }} />

          <h3>Display name (leaderboard)</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="e.g., JP"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button onClick={saveDisplayName}>Save name</button>
          </div>

          <p style={{ marginTop: 12 }}>
            <strong>Your total:</strong> {myTotal} burpees
            <br />
            <strong>Goal:</strong> {MONTH_GOAL} (100/day)
            <br />
            <strong>Progress:</strong> {myPercent}%
          </p>

          <div style={{ maxWidth: 420 }}>
            <Doughnut data={doughnutData} />
          </div>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 16
          }}
        >
          <h2>Leaderboard (Totals)</h2>

          <ol>
            {leaderboard.map((r) => {
              const pct = Math.min(
                100,
                Math.round((r.total_burpees / MONTH_GOAL) * 100)
              );
              return (
                <li key={r.user_id} style={{ marginBottom: 8 }}>
                  <strong>{r.display_name}</strong>: {r.total_burpees} ({pct}
                  %)
                </li>
              );
            })}
          </ol>

          <div style={{ marginTop: 16 }}>
            <Bar data={barData} />
          </div>
        </div>
            </section>

      {/* CONTEST RULES START */}
      <section style={{ marginTop: 16 }}>
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 16
          }}
        >
          <h2>Contest Rules</h2>

          <h3>Rule #1. Definition of a burpee</h3>
          <ol>
            <li><strong>Starting Position:</strong> Stand with feet shoulder-width apart.</li>
            <li><strong>Squat:</strong> Lower your hips back and down into a deep squat, placing your hands on the floor in front of you.</li>
            <li><strong>Plank/Push-up:</strong> Kick or step both feet back into a high-plank position. Immediately lower your chest to the floor to perform a push-up (some variations omit the push-up).</li>
            <li><strong>Return:</strong> Jump or step your feet forward back into the deep squat position.</li>
            <li><strong>Jump:</strong> Stand up quickly and perform an explosive jump, bringing your arms overhead.</li>
            <li><strong>Repeat:</strong> Move directly into the next rep.</li>
          </ol>

          <h3>Rule #2. Daily goal</h3>
          <p>
            The goal is to average <strong>100 burpees per day</strong> for the month of March.
            Burpees may be done in one session or throughout the day. This is based on the honor system.
            The contestant may do more or less than 100 burpees per day.
          </p>

          <h3>Rule #3. Contest window</h3>
          <p>
            The contest starts <strong>March 1st at 00:01</strong> and concludes{" "}
            <strong>March 31st at 23:59</strong>.
          </p>

          <h3>Rule #4. Video submissions</h3>
          <p>
            If the burpee session is completed solo, a <strong>time-lapse video</strong> shall be
            submitted to the text thread created by the founder every time a set of burpees is completed.
            If the burpee session is completed with other members involved in this contest, a time-lapse
            video is not needed.
          </p>

          <h3>Rule #5. Buy-in and payout</h3>
          <p>
            A financial buy-in for the contest is <strong>$50</strong> (sent via Venmo). Contestants have
            the <strong>option</strong> to earn their $50 back upon completion of the <strong>3100 burpees</strong>.
            Those who do not finish by March 31st at 23:59 will forfeit their $50 to a not-for-profit
            organization of the founder’s choosing.
          </p>

          <h3>Rule #6. Injury policy</h3>
          <p>
            If a contestant is injured during the contest, a <strong>$25 refund</strong> will be issued
            and the remaining $25 will be donated to a not-for-profit organization of the founder’s choosing.
          </p>
        </div>
      </section>
      {/* CONTEST RULES END */}

      <p style={{ marginTop: 18, color: "#555" }}>
        Privacy note: you can only view your own daily entries. Everyone can see
        totals only.
      </p>

    </main>
  );
}

function Login({
  onEmailSignIn
}: {
  onEmailSignIn: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");

  return (
    <main
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: 20,
        fontFamily: "system-ui"
      }}
    >
      <h1>March 2026 Burpee Challenge</h1>
      <p>Sign in with your email (magic link).</p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          onClick={() => onEmailSignIn(email)}
          disabled={!email}
        >
          Send link
        </button>
      </div>
    </main>
  );
}
