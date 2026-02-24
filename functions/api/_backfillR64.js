
/* ===== R64 BACKFILL (transition brackets) =====
   Writes base snapshot into brackets missing base.
   Safe: only runs for brackets without base.
*/
export async function backfillMissingBase(db){
  const rows = await db.prepare("SELECT id, data_json FROM brackets").all();
  for(const r of rows.results){
    try{
      const data = JSON.parse(r.data_json || "{}");
      if(!data.base){
        data.base = {
          EAST: R64_SNAPSHOT.EAST,
          WEST: R64_SNAPSHOT.WEST,
          MIDWEST: R64_SNAPSHOT.MIDWEST,
          SOUTH: R64_SNAPSHOT.SOUTH
        };
        await db.prepare("UPDATE brackets SET data_json=? WHERE id=?")
          .bind(JSON.stringify(data), r.id).run();
      }
    }catch(e){
      console.log("backfill skip", r.id);
    }
  }
}
