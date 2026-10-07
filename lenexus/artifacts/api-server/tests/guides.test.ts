import { test } from "node:test";
import assert from "node:assert/strict";
import imported from "../src/data/discord-guides.json";
import { validateGuide, mediaPaths, type CommunityGuide } from "../src/lib/guide-store";
import { guideImageType } from "../src/lib/guide-uploads";
import { sourceMediaType } from "../src/lib/guide-source-media";

const input = {title:"Guide",content:"Contenu",images:[],revision:1};
test("all 11 imported topics retain 64 messages, 44 attachments and 9 embeds", () => {
  assert.equal(imported.length,11);
  assert.equal(imported.flatMap(g=>g.messages).length,64);
  assert.equal(imported.flatMap(g=>g.messages).flatMap(m=>m.media).length,44);
  assert.equal(imported.flatMap(g=>g.messages).flatMap(m=>m.embeds).length,9);
  assert.equal(imported.filter(g=>g.starterMissing).length,1);
  for (const g of imported) {
    assert.ok(g.authorName && g.authorId);
    for (const m of g.messages) {
      assert.ok(m.authorName && m.authorId);
      for (const f of m.media) assert.match(f.url,/^\/api\/storage\/objects\/guide-media\/[a-f0-9]{64}$/);
    }
  }
});
test("empty or whitespace-only guides fail explicitly", () => {
  assert.throws(()=>validateGuide({...input,title:"   "}),/titre/);
  assert.throws(()=>validateGuide({...input,content:" "}),/texte ou une photo/);
});
test("a guide with only photos is permitted", () => {
  assert.equal(validateGuide({...input,content:"",images:["/image"]}).content,"");
});
test("unauthorized changes and stale revisions are refused", () => {
  const existing = {...imported[0],canEdit:false} as CommunityGuide;
  assert.throws(()=>validateGuide(input,existing),/ne pouvez pas/);
  assert.throws(()=>validateGuide({...input,revision:0},{...existing,canEdit:true}),/Rechargez/);
});
test("an imported transcript can retain an empty introduction", () => {
  const existing = {...imported[0],canEdit:true} as CommunityGuide;
  assert.equal(validateGuide({...input,content:""},existing).content,"");
});
test("all original attachments and link previews remain attached to storage", () => {
  for (const g of imported) {
    const paths = mediaPaths(g.images,g.messages);
    for (const m of g.messages) {
      for (const a of m.media) assert.ok(paths.includes(a.url.slice("/api/storage".length)));
      for (const e of m.embeds) if (e.image) assert.ok(paths.includes(e.image.slice("/api/storage".length)));
    }
  }
});
test("fake images cannot pass native format detection", () => {
  assert.equal(guideImageType(Buffer.from("<svg onload=alert(1)>")),"");
  assert.throws(()=>sourceMediaType(Buffer.from("<html>error</html>")),/not a supported/);
});
test("source PNG dimensions are checked even when Discord advertises JPEG", () => {
  const bytes = Buffer.alloc(24);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
  bytes.writeUInt32BE(882,16);bytes.writeUInt32BE(726,20);
  assert.equal(sourceMediaType(bytes,{width:882,height:726,contentType:"image/jpeg"}),"image/png");
  assert.throws(()=>sourceMediaType(bytes,{width:800,height:726}),/dimensions changed/);
});