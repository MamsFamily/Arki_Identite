import {test} from "node:test";
import assert from "node:assert/strict";
import {spyglassTriple,spyglassCells,readSpyglassCells,type SpyglassLine} from "./dino-photo-spyglass";

// Coordinates from the supplied Diplodocus photo, enlarged 3x. The point
// groups below are test inputs, not values baked into the reader.
const line = (text:string,x0:number,y0:number,x1:number,y1:number):SpyglassLine =>
  ({text,confidence:90,bbox:{x0,y0,x1,y1}});
const rows = [
  line("56 68 80 94 29 30",30,528,1121,624), // colour regions: never stats
  {...line("3.6K (5600) 800 (0-0-0)",50,649,1114,738),words:[
    {text:"(5600)",bbox:{x0:370,y0:682,x1:562,y1:727}},
    {text:"(0-0-0)",bbox:{x0:917,y0:682,x1:1114,y1:737}}]},
  {...line("300 (0-0-0) 125.6% (0-0-0)",125,759,1115,865),words:[
    {text:"(0-0-0)",bbox:{x0:363,y0:778,x1:561,y1:833}},
    {text:"(0-0-0)",bbox:{x0:918,y0:778,x1:1115,y1:835}}]},
  {...line("10K (0-0-0) 100% (0-0-0)",168,853,1115,968),words:[
    {text:"(0-0-0)",bbox:{x0:364,y0:875,x1:561,y1:930}},
    {text:"(0-0-0)",bbox:{x0:917,y0:853,x1:1115,y1:968}}]},
  line("324.6/1.7K Health (0-0-0)",257,998,912,1056),
  line("0/13.1K Torpor (0-0-0)",304,1270,865,1328),
];
const cells = () => spyglassCells(rows,1164,1545)!;
const reading = (key:string) => ({text:key==="stamina" ? "(56-0-0)" : "(0-0-0)",confidence:90});

test("only one exact three-number group is accepted, never guessed dashes",()=>{
  assert.deepEqual(spyglassTriple("3.6K (56-0-0)"),[56,0,0]);
  assert.deepEqual(spyglassTriple("Health: 324.6/1.7K (0-0-0)"),[0,0,0]);
  for(const text of ["(5600)","(56-0)","(56--0-0)","(56.1-0-0)","(65536-0-0)","(56-0-0) (0-0-0)"])
    assert.equal(spyglassTriple(text),null,text);
});
test("real HUD layout gives seven distinct cells and ignores colour region numbers",()=>{
  assert.deepEqual(cells().map(c=>c.key),["stamina","weight","oxygen","melee","food","speed","health"]);
  for(const c of cells()) {
    assert.ok(c.rectangle.width>0 && c.rectangle.height>0);
    assert.ok(c.rectangle.left+c.rectangle.width<=1164);
    assert.ok(c.rectangle.top+c.rectangle.height<=1545);
  }
  assert.equal(spyglassCells(rows.filter(r=>!r.text.includes("Health")),1164,1545),null);
  assert.equal(spyglassCells(rows.filter(r=>!r.text.includes("Torpor")),1164,1545),null);
  assert.equal(spyglassCells(rows.slice(1).map(r=>({...r,text:r.text.replaceAll("-0-0","-0")})),1164,1545),null);
});
test("a separately segmented raw amount does not hide the remaining two-column points row",()=>{
  const segmented = rows.map(r=>r.text.startsWith("300") ?
    {...r,text:"(0-0-0) @ 125.6% (0-0-0)",bbox:{...r.bbox,x0:363}} : r);
  segmented.push(line("300",125,774,273,822));
  assert.deepEqual(spyglassCells(segmented,1164,1545)?.map(c=>c.key),cells().map(c=>c.key));
});
test("Diplodocus base points agree with level 57; amounts and percentages are not points",async()=>{
  const result = await readSpyglassCells(cells(),"(Juvenile) Diplodocus 57\nTamed (57)",async c=>reading(c.key));
  assert.deepEqual(result.stats,{health:0,stamina:56,oxygen:0,food:0,weight:0,melee:0,speed:0});
  assert.equal(result.observations.length,7);
});
test("inconsistent or missing level never permits guessed base points",async()=>{
  for(const text of ["Tamed (58)","Tamed (57)\nTamed (58)","Nickname: 57"])
    assert.equal((await readSpyglassCells(cells(),text,async c=>reading(c.key))).stats,null);
});
test("nonzero extra counters stay separate and are not summed into base points",async()=>{
  const result = await readSpyglassCells(cells(),"Tamed (57)",async c=>({...reading(c.key),text:c.key==="stamina" ? "(56-2-0)" : "(0-0-0)"}));
  assert.equal(result.stats,null);
  assert.ok(result.observations.some(o=>o.includes("(56-2-0)")));
});
test("low-confidence cell cannot become zero or another base point",async()=>{
  const result = await readSpyglassCells(cells(),"Tamed (57)",async c=>({...reading(c.key),confidence:c.key==="health" ? 50 : 90}));
  assert.equal(result.stats,null);
});
test("contrast fallback reads a complete group without correcting an OCR error",async()=>{
  let attempts=0;
  const result = await readSpyglassCells(cells(),"Tamed (57)",async(c,contrast)=>{
    attempts++;
    return !contrast && c.key==="stamina" ? {text:"(5600)",confidence:95} : reading(c.key);
  });
  assert.equal(result.stats?.stamina,56);
  assert.equal(attempts,8);
});