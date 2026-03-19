export async function onRequest({ env }) {
  const winners = ["TCU","Nebraska","Louisville","High Point","Duke","Vanderbilt"];
  const losers = ["Ohio St","Troy","USF","Wisconsin","Siena","McNeese"];

  const brackets = await env.DB.prepare("SELECT * FROM brackets").all();
  let updated = 0;

  for (const b of brackets.results || []) {
    let bestScore = b.best_score || 0;
    let worstScore = b.worst_score || 0;

    const picks = JSON.parse(b.picks || '{}');
    const picksStr = JSON.stringify(picks);

    for (const team of winners) {
      if (picksStr.includes(team)) bestScore += 10;
    }

    for (const team of losers) {
      if (picksStr.includes(team)) worstScore += 10;
    }

    await env.DB.prepare(
      "UPDATE brackets SET best_score = ?, worst_score = ? WHERE id = ?"
    ).bind(bestScore, worstScore, b.id).run();

    updated++;
  }

  return new Response(
    [
      "Round of 64 scoring applied.",
      "Winners: TCU, Nebraska, Louisville, High Point, Duke, Vanderbilt",
      "Losers: Ohio St, Troy, USF, Wisconsin, Siena, McNeese",
      `Updated brackets: ${updated}`,
      "",
      "IMPORTANT: Do not run this twice or scores will double."
    ].join("\n"),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
}
