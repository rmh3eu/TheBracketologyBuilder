
export async function onRequest({ request, env }) {
  const body = await request.json();

  const winners = body.winners || [];
  const losers = body.losers || [];

  const brackets = await env.DB.prepare("SELECT * FROM brackets").all();

  let updated = 0;

  for (const b of brackets.results || []) {
    let bestScore = b.best_score || 0;
    let worstScore = b.worst_score || 0;

    const picks = JSON.parse(b.picks || '{}');
    const picksStr = JSON.stringify(picks);

    for (const team of winners) {
      if (picksStr.includes(team)) {
        bestScore += 10;
      }
    }

    for (const team of losers) {
      if (picksStr.includes(team)) {
        worstScore += 10;
      }
    }

    await env.DB.prepare(
      "UPDATE brackets SET best_score = ?, worst_score = ? WHERE id = ?"
    ).bind(bestScore, worstScore, b.id).run();

    updated++;
  }

  return new Response(JSON.stringify({ success: true, updated }), {
    headers: { "content-type": "application/json" }
  });
}
