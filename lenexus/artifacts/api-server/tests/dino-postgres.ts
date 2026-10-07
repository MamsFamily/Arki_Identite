// Run through dino-postgres.mjs against the development database only.
// Two independent processes verify survival of a complete application restart.
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { listSpecies } from "../src/lib/dino-catalogue";
import { emptyStats, saveRecord, listRecords, deleteRecord } from "../src/lib/dino-records";

const key=process.argv[3];
assert.ok(key?.startsWith("isolated-dino-test:"),"The runner must provide an isolated fixture scope");
const id=900001;
try {
  const rex=(await listSpecies()).find(s=>s.name==="Rex")!;
  assert.ok(rex);
  const draft={stats:{...emptyStats(),health:40,weight:0},revision:0,confirmed:true,mode:"best" as const,note:"Temporary integration fixture",source:"manual" as const};
  if (process.argv[2]==="write") {
    const saved=await saveRecord(id,key,rex.id,"fixture",draft);
    assert.equal(saved.stats.health,40);
    assert.equal(saved.stats.weight,0);
    console.log("PostgreSQL write committed; independent read process follows.");
  } else {
    const saved=(await listRecords(id,key))[0];
    assert.equal(saved.stats.health,40,"Records survive termination of the write process");
    const outcomes=await Promise.allSettled([45,50].map(health=>saveRecord(id,key,rex.id,"fixture",{
      ...draft,stats:{...draft.stats,health},revision:saved.revision,
    })));
    assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1,"Only one simultaneous revision can commit");
    const failed=outcomes.find(x=>x.status==="rejected") as PromiseRejectedResult;
    assert.equal(failed.reason.status,409);
    const latest=(await listRecords(id,key))[0];
    await deleteRecord(id,key,rex.id,"fixture",latest.revision,true);
    const recreated=await saveRecord(id,key,rex.id,"fixture",draft);
    assert.ok(recreated.revision>latest.revision,"Delete/recreate cannot resurrect an old revision");
    await assert.rejects(()=>saveRecord(id,key,rex.id,"fixture",{...draft,revision:latest.revision}),{status:409});
    console.log("PostgreSQL restart persistence, concurrent confirmation, deletion and recreation verified.");
  }
} finally {
  if(process.argv[2]!=="write") {
    await pool.query("DELETE FROM site_dino_records WHERE tribe_key=$1",[key]);
    await pool.query("DELETE FROM site_dino_history WHERE tribe_key=$1",[key]);
  }
  await pool.end();
}