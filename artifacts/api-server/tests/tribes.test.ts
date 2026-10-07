import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import app from "../src/app";
import { brandingStorage } from "../src/lib/site-branding";
import { discordAccount } from "../src/lib/discord-accounts";
import { changeSiteAccess, siteGrants } from "../src/lib/site-access";
import { database } from "../src/lib/tribe-store";
import { departureChannelId, departureHistory, departureNameKey, matchDeparture, parseDepartureMessage } from "../src/lib/discord-departures";
import { emptyStats, mergeStats } from "../src/lib/dino-records";
import { enrichCatalogue } from "../src/lib/dino-catalogue";
import { defaultDinoSpecies } from "../src/data/dino-catalogue-defaults";
import { dinoVariant } from "../../arki-tribes/src/components/dino-variant-filter";
import { parseMapCoords } from "../src/lib/map-settlements";
import { readShopHistory, shopMessageDto, safeDiscordMedia, shopMedia } from "../src/lib/shop-discord";
import { buildShopProducts, shopPrices } from "../src/lib/shop-products";
import { pointToCoords, coordsToImagePoint, getMapCalibration, clampPan, nudgeCoords, splitTribes, initialMapTab } from "../../arki-tribes/src/lib/map-coordinates";

const OWNER="1200000000000000001",MANAGER="1200000000000000002",OTHER="1200000000000000003",ADMIN="1200000000000000004";
const SITE_OWNER="1200000000000000005",COOWNER="1200000000000000006";
const UNAVAILABLE_ACCOUNT="1200000000000000098";
const accountLookups=new Map<string,number>();
let departurePageReads=0;
let departureRateLimitOnce=true;
let departureHistoryDenied=false;
let adminRoleActive=true;
const missingSearchMembers=new Set<string>();
let searchMembershipUnavailable=false;
const GUILD="1156256997403000874";
const fixtureDir=mkdtempSync(path.join(tmpdir(),"arki-test-"));
const fixture=path.join(fixtureDir,"tribus.db");
let server:Server,base:string,tribeId:number;
const requestFetch=globalThis.fetch;
test("Arki bridge: anonymous and write requests are denied", async () => {
  assert.equal((await request("/arki/account")).status,401);
  assert.equal((await request("/arki/account","POST",{},OWNER)).status,405);
});
test("Arki bridge: uses the session actor, rejects forged upstream subjects, and never exposes credentials", async () => {
  const originalFetch=globalThis.fetch;
  const actor="1200000000000000037";
  const calls: {url:string;actor:string|null}[]=[];
  process.env.ARKI_BRIDGE_URL="https://bridge-fixture.example";
  process.env.ARKI_BRIDGE_TOKEN="isolated-bridge-fixture-not-a-real-secret";
  let forged=false,upstreamStatus=200;
  globalThis.fetch=async(input,init)=>{
    const url=String(input);
    if (!url.startsWith("https://bridge-fixture.example/")) return originalFetch(input,init);
    const headers=new Headers(init?.headers);
    calls.push({url,actor:headers.get("X-Arki-Actor-Id")});
    assert.equal(headers.get("X-Arki-Guild-Id"),GUILD);
    assert.equal(headers.get("Authorization"),"Bearer isolated-bridge-fixture-not-a-real-secret");
    return new Response(JSON.stringify({schemaVersion:1,guildId:GUILD,discordUserId:forged?OWNER:actor,
      fetchedAt:new Date().toISOString(),inventory:[],orders:[],tickets:[],activity:[]}),{status:upstreamStatus});
  };
  try {
    const own=await request(`/arki/account?userId=${OWNER}`,"GET",undefined,actor);
    assert.equal(own.status,200);assert.equal(own.data.discordUserId,actor);
    assert.equal(calls[0].actor,actor);assert.ok(!calls[0].url.includes("userId"));
    forged=true;
    assert.equal((await request("/arki/account","GET",undefined,actor)).status,503);
    forged=false;
    assert.equal((await request("/arki/staff","GET",undefined,actor)).status,403);
    assert.equal(calls.length,2);
    assert.equal((await request("/arki/staff","GET",undefined,SITE_OWNER,true,true)).status,403);
    upstreamStatus=403;
    assert.equal((await request("/arki/staff","GET",undefined,SITE_OWNER)).status,403);
    process.env.ARKI_BRIDGE_URL="http://bridge-fixture.example";
    assert.equal((await request("/arki/account","GET",undefined,actor)).status,503);
    delete process.env.ARKI_BRIDGE_TOKEN;
    const missing=await request("/arki/account","GET",undefined,actor);
    assert.equal(missing.status,503);
    assert.ok(!JSON.stringify(missing.data).includes("isolated-bridge-fixture"));
  } finally {
    globalThis.fetch=originalFetch;
    delete process.env.ARKI_BRIDGE_URL;delete process.env.ARKI_BRIDGE_TOKEN;
  }
});
test("Shop content and media cannot be read without Discord authentication", async () => {
  assert.equal((await request("/shop")).status,401);
  assert.equal((await request("/donations")).status,401);
  assert.equal((await request("/shop/emoji/1366174439003263087/gif")).status,401);
  assert.equal((await request("/shop/media/packs/1485051269977739334/1485051269977739335")).status,401);
});
test("Shop recovers Discord external thumbnails and preserves actual custom emoji tokens", () => {
  const media=shopMedia({id:"1485051269977739334",timestamp:"2026-10-06T12:00:00Z",embeds:[
    {title:"PACK BOSS",thumbnail:{url:"https://i.postimg.cc/example/photo.jpg",proxy_url:"https://images-ext-1.discordapp.net/external/safe/photo.jpg",content_type:"image/jpeg"}},
    {title:"Unsafe",thumbnail:{url:"https://internal.example/photo.jpg",proxy_url:"http://localhost/photo.jpg"}},
  ]});
  assert.equal(media.length,1);
  assert.equal(media[0].id,"embed-0-thumbnail");
  assert.equal(media[0].name,"PACK BOSS");
  const dto=shopMessageDto({id:"1485051269977739334",timestamp:"2026-10-06T12:00:00Z",content:"<a:SparklyCrystal:1366174439003263087>"},"packs","1485051269977739334",GUILD);
  assert.equal(dto.content,"<a:SparklyCrystal:1366174439003263087>");
});
test("Website dino catalogue separates prices, variants and availability without duplicate Discord indexes", () => {
  const make=(id:string,content:string)=>({id,content,authorName:"Test",createdAt:"2026-10-06",updatedAt:"2026-10-06",sourceUrl:"https://discord.com/source",media:[]});
  const prices="**5 000**<a:SparklyCrystal:1366174439003263087> + **1 500**<:fraises:1328148609585123379>";
  const result=buildShopProducts([
    make("1",`# ━━━ 【A】 ━━━\n### ▫️ 𝔸𝕔𝕙𝕒𝕥𝕚𝕟𝕒\n> ${prices}\n> ◦ **𝔸** : **6 000**💎 + **1 800**🍓\n### ▫️ 𝔸𝕤𝕥𝕣𝕠𝕔𝕖𝕥𝕦𝕤\n> *25 000💎 + 7 500🍓 ── 🚫 Pas encore disponible au shop*`),
    make("2",`# ━━━ 【Variant A】 ━━━\n### ▫️ 𝔸𝕔𝕙𝕒𝕥𝕚𝕟𝕒 ─ 𝔸\n> **6 000**💎 + **1 800**🍓`),
  ],"dinos");
  assert.equal(result.length,2);
  assert.equal(result[0].name,"Achatina");
  assert.deepEqual(result[0].prices,[{variant:"Standard",diamonds:5000,strawberries:1500},{variant:"A",diamonds:6000,strawberries:1800}]);
  assert.equal(result[1].available,false);
  assert.equal(result[1].prices[0].diamonds,25000);
  const shoulder=buildShopProducts([
    make("3",`# 【B】\n### ▫️ Bousier\n> -# 🦜 *Dino d'épaule*\n> ${prices}\n> 🦖 *(Un achat via inventaire coûte 🦖 x2)*`),
    make("4",`# 【🦜 ÉPAULE】\n### ▫️ Bousier\n> -# 🦜 *Dino d'épaule*\n> ${prices}`),
  ],"dinos");
  assert.equal(shoulder.length,1);
  assert.deepEqual(shoulder[0].tags,["Épaule"]);
  assert.ok(shoulder[0].description.includes("x2"));
  const info=buildShopProducts([
    make("5","## Shop — Index\nUtilise `/shop` pour commander !"),
    make("6","Bienvenue\n\nChaque commande se paye en double monnaie.\n\nLes dinos sont livrés dans une cryo."),
  ],"infos");
  assert.equal(info.length,2);
  assert.ok(info.every(p=>!p.description.includes("/shop")));
  assert.deepEqual(shopPrices(`**Imprint 100**\n> ${prices}\n**Imprint 200**\n> **10 000**💎 + **3 000**🍓`).map(p=>p.variant),["Imprint 100","Imprint 200"]);
});
test("Shop synchronization paginates the full current history and preserves edits and media", async () => {
  const messages = Array.from({length:102}, (_,i) => ({
    id:String(1485051269977740000n+BigInt(i)), content:`Offre ${i}`, timestamp:"2026-10-05T12:00:00.000Z",
  })).reverse();
  const calls:string[]=[];
  const result=await readShopHistory("1485051269977739334",async path=>{
    calls.push(path);
    return calls.length===1?messages.slice(0,100):messages.slice(100);
  });
  assert.equal(result.length,102);
  assert.equal(result[0].content,"Offre 0");
  assert.ok(calls[1].includes(`before=${messages[99].id}`));
  const dto=shopMessageDto({...result[0],content:"Offre modifiée",edited_timestamp:"2026-10-06T12:00:00.000Z",
    embeds:[{title:"Pack élevage",description:"Tarif fourni",fields:[{name:"Contenu",value:"Deux dinos"}]}],
    attachments:[{id:"1485051269977739335",url:"https://cdn.discordapp.com/attachments/x/photo.png",filename:"photo.png",content_type:"image/png"}],
  },"packs","1485051269977739334",GUILD);
  assert.ok(dto.content.includes("Offre modifiée"));
  assert.ok(dto.content.includes("Pack élevage"));
  assert.ok(dto.content.includes("Deux dinos"));
  assert.equal(dto.media[0].url,`/api/shop/media/packs/${result[0].id}/1485051269977739335`);
  assert.equal(dto.updatedAt,"2026-10-06T12:00:00.000Z");
  assert.equal(safeDiscordMedia("https://cdn.discordapp.com.evil.test/photo.png"),false);
  assert.equal(safeDiscordMedia("http://cdn.discordapp.com/photo.png"),false);
  assert.equal(safeDiscordMedia("https://user:password@cdn.discordapp.com/photo.png"),false);
});
test("Public map edits are persistent, owner-only, and protected against lost updates", async () => {
  const catalogue = await request("/site-maps");
  assert.equal(catalogue.status, 200);
  assert.equal(catalogue.data.length, 12);
  const slug = "the-island";
  const original = (await request(`/site-maps/${slug}`)).data;
  const before = new DatabaseSync(fixture);
  const tribesBefore = before.prepare("SELECT * FROM tribus ORDER BY id").all();
  const optionsBefore = before.prepare("SELECT * FROM maps ORDER BY nom").all();
  before.close();
  const draft = { ...original, name: "The Island — fixture", blurb: "Résumé modifié", description: "Description détaillée\nDeuxième ligne",
    creatures: ["Rex", "Dodo"], zones: ["Plage sud : 80, 30"], rules: ["Règle de test"],
    resourcesUrl: "  https://example.com/resources?map=the-island  ", dinosUrl: "https://example.com/dinos#rex",
    gallery: ["https://example.com/map-fixture.png"] };
  for (const actor of [undefined, OWNER, OTHER, ADMIN]) {
    assert.equal((await request(`/site-maps/${slug}`, "PUT", draft, actor)).status, actor ? 403 : 401);
  }
  assert.equal((await request(`/site-maps/${slug}`, "PUT", draft, SITE_OWNER, false)).status, 403);
  for (const invalid of [
    { name: " " }, { difficulty: 0 }, { difficulty: 2.5 }, { difficulty: 6 },
    { image: "javascript:alert(1)" }, { gallery: ["http://example.com/a.png"] },
    { resourcesUrl: "javascript:alert(1)" }, { dinosUrl: "data:text/html,unsafe" },
    { resourcesUrl: "ftp://example.com/map" }, { dinosUrl: "not-a-url" },
    { resourcesUrl: "https://user:password@example.com/map" }, { dinosUrl: "https://example.com/" + "x".repeat(2048) },
    { gallery: ["https://user:password@example.com/a.png"] }, { zones: [" "] },
    { image: "/api/storage/objects/site-branding/00000000-0000-0000-0000-000000000000" },
    { gallery: Array.from({ length: 25 }, () => "https://example.com/a.png") },
    { image: "/objects/uploads/00000000-0000-0000-0000-000000000000" },
  ]) {
    assert.equal((await request(`/site-maps/${slug}`, "PUT", { ...draft, ...invalid }, SITE_OWNER)).status, 400);
  }
  assert.equal((await request("/site-maps/unknown-map", "PUT", draft, SITE_OWNER)).status, 404);
  const saved = await request(`/site-maps/${slug}`, "PUT", draft, SITE_OWNER);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.revision, original.revision + 1);
  assert.equal(saved.data.slug, slug);
  assert.equal(saved.data.image, original.image);
  assert.equal(saved.data.resourcesUrl, draft.resourcesUrl.trim());
  assert.equal(saved.data.dinosUrl, draft.dinosUrl);
  assert.deepEqual((await request(`/site-maps/${slug}`)).data, saved.data);
  assert.deepEqual((await request("/site-maps")).data.find((m: any) => m.slug === slug), saved.data);
  assert.equal((await request(`/site-maps/${slug}`, "PUT", { ...draft, description: "Outdated edit" }, SITE_OWNER)).status, 409);
  assert.deepEqual((await request(`/site-maps/${slug}`)).data, saved.data);
  assert.equal((await request("/site-access", "PUT", { userId: COOWNER, role: "owner" }, SITE_OWNER)).status, 200);
  const legacyDraft = { ...saved.data };
  delete legacyDraft.resourcesUrl;
  delete legacyDraft.dinosUrl;
  const retained = await request(`/site-maps/${slug}`, "PUT", legacyDraft, SITE_OWNER);
  assert.equal(retained.status, 200);
  assert.equal(retained.data.resourcesUrl, saved.data.resourcesUrl);
  assert.equal(retained.data.dinosUrl, saved.data.dinosUrl);
  const cleared = await request(`/site-maps/${slug}`, "PUT", { ...retained.data, description: "", blurb: "", image: "", creatures: [], zones: [], rules: [], gallery: [], resourcesUrl: "", dinosUrl: "" }, COOWNER);
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.data.gallery, []);
  assert.equal(cleared.data.description, "");
  assert.equal(cleared.data.image, "");
  assert.equal(cleared.data.resourcesUrl, "");
  assert.equal(cleared.data.dinosUrl, "");
  assert.equal((await request(`/site-access/${COOWNER}`, "DELETE", undefined, SITE_OWNER)).status, 200);
  assert.equal((await request(`/site-maps/${slug}`, "PUT", cleared.data, COOWNER)).status, 403);
  assert.equal((await request(`/site-maps/${slug}`, "PUT", { ...original, revision: cleared.data.revision }, SITE_OWNER)).status, 200);
  const afterMapEdits = new DatabaseSync(fixture);
  assert.deepEqual(afterMapEdits.prepare("SELECT * FROM tribus ORDER BY id").all(), tribesBefore);
  assert.deepEqual(afterMapEdits.prepare("SELECT * FROM maps ORDER BY nom").all(), optionsBefore);
  afterMapEdits.close();
});

test("Map photo uploads are immutable, public only while attached, and do not change site branding", { skip: process.env.ARKI_TEST_STORAGE !== "1" }, async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6V0AAAAASUVORK5CYII=", "base64");
  const map = (await request("/site-maps/ragnarok")).data;
  const brandingBefore = (await request("/site-branding")).data;
  const created: string[] = [];
  try {
    const up = await request("/site-branding/uploads", "POST", { kind: "cover", name: "map-fixture.png", size: png.length, contentType: "image/png" }, SITE_OWNER);
    assert.equal(up.status, 200);
    created.push(up.data.objectPath);
    assert.equal((await requestFetch(up.data.uploadURL, { method: "PUT", headers: { "Content-Type": "image/png" }, body: png })).status, 200);
    assert.equal((await request(`/storage${up.data.objectPath}`)).status, 404);
    const saved = await request("/site-maps/ragnarok", "PUT", { ...map, image: up.data.objectPath, gallery: [up.data.objectPath] }, SITE_OWNER);
    assert.equal(saved.status, 200);
    const path = String(saved.data.image).replace(/^\/api\/storage/, "");
    created.push(path);
    assert.match(path, /^\/objects\/site-branding\//);
    assert.deepEqual(saved.data.gallery, [saved.data.image]);
    const shown = await requestFetch(base.replace(/\/api$/, "") + saved.data.image);
    assert.equal(shown.status, 200);
    assert.deepEqual(Buffer.from(await shown.arrayBuffer()), png);
    // A still-valid signed upload URL cannot overwrite the published map photo.
    assert.equal((await requestFetch(up.data.uploadURL, { method: "PUT", headers: { "Content-Type": "image/png" }, body: Buffer.alloc(png.length) })).status, 200);
    const immutable = await requestFetch(base.replace(/\/api$/, "") + saved.data.image);
    assert.deepEqual(Buffer.from(await immutable.arrayBuffer()), png);
    assert.deepEqual((await request("/site-branding")).data, brandingBefore);
    assert.equal((await request("/site-maps/ragnarok", "PUT", { ...map, revision: saved.data.revision }, SITE_OWNER)).status, 200);
    assert.equal((await request(`/storage${path}`)).status, 404);
  } finally {
    for (const objectPath of created) {
      const file = await brandingStorage.getObjectEntityFile(objectPath);
      await file.delete({ ignoreNotFound: true });
    }
  }
});
function cookie(id:string) {
  const data=Buffer.from(JSON.stringify({id,name:"Test player",avatar:"",csrf:"fixture-csrf",expires:Date.now()+3600000})).toString("base64url");
  const sig=createHmac("sha256","isolated-test-fixture-not-a-real-secret").update(data).digest("base64url");
  return `arki_session=${data}.${sig}`;
}
const profile={name:"Test tribe",description:"Fixture only",motto:"Test motto",objective:"Test objective",color:123456,
  logoUrl:"",base:"Test base",map:"The Island",coords:"10,20",tags:"friendly",recruiting:true,recruitmentText:"Join us!"};
async function request(route:string,method="GET",data?:unknown,user?:string,csrf=true,playerView=false) {
  const response=await requestFetch(base+route,{method,headers:{
    ...(data?{"Content-Type":"application/json"}:{}),...(user?{Cookie:cookie(user)}:{}),...(csrf?{"X-CSRF-Token":"fixture-csrf"}:{}),
    ...(playerView ? {"X-Arki-View":"player"} : {}),
  },body:data?JSON.stringify(data):undefined});
  return {status:response.status,data:await response.json() as Record<string,any>};
}
before(async()=>{
  // Tests must work from a source checkout without touching a real tribe database.
  const db=new DatabaseSync(fixture);
  db.exec(readFileSync(path.resolve(import.meta.dirname,"../../tests/tribes-schema.sql"),"utf8"));
  db.prepare("INSERT INTO config(guild_id,cle,valeur) VALUES(?,?,?)").run(BigInt(GUILD),"test","fixture");
  for (const [table,name] of [["maps","The Island"],["boss","Dragon"],["notes","Island notes"]]) {
    db.prepare(`INSERT INTO ${table}(guild_id,nom,created_at) VALUES(0,?,?)`).run(name,new Date().toISOString());
  }
  db.close();process.env.SQLITE_PATH=fixture;
  globalThis.fetch=async(input,init)=>{
    const url=String(input);
    if (url.endsWith("/chat/completions")) {
      return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({
        speciesName:null,pairs:{health:"(1-22)",stamina:"(4-0)",oxygen:"(2-0)",food:"(0-0)",weight:"(0-15)",melee:"(5-11)",speed:"(2-0)"},
        warnings:["Espèce non visible ; choisissez-la manuellement."],
      })}}]}),{status:200});
    }
    if (!url.startsWith("https://discord.com/")) return requestFetch(input,init);
    if (url.endsWith("/oauth2/token")) return new Response(JSON.stringify({access_token:"isolated-oauth-fixture"}),{status:200});
    if (url.endsWith("/users/@me")) return new Response(JSON.stringify({id:OWNER,username:"Test player",global_name:"Test player",avatar:null}),{status:200});
    if (url.includes(`/channels/${departureChannelId}/messages?`)) {
      if (departureHistoryDenied) return new Response("History forbidden",{status:403});
      if (departureRateLimitOnce) {
        departureRateLimitOnce=false;
        return new Response(JSON.stringify({retry_after:0}),{status:429,headers:{"Content-Type":"application/json"}});
      }
      departurePageReads++;
      const before=new URL(url).searchParams.get("before");
      const log=(id:string,name:string,date:string)=>({id,timestamp:date,author:{bot:true},embeds:[{
        title:"Un membre vient de partir… 😢",description:`À plus sur Vénus <a:wave:1322875890807345243> ${name}`,
        footer:{text:"Avait rejoint le serveur il y a 2 ans"},
      }]});
      const messages=before ? [log("1300000000000000001","fixture06","2025-01-02T14:00:00Z")] :
        [log("1400000000000000101","fixture06","2026-08-03T09:10:00Z"),
          ...Array.from({length:99},(_,i)=>({id:String(1400000000000000100n-BigInt(i)),timestamp:"2026-08-01T10:00:00Z",author:{bot:false},content:"Ordinary chat"}))];
      return new Response(JSON.stringify(messages),{status:200});
    }
    if (url.endsWith(`/channels/${departureChannelId}`)) return new Response(JSON.stringify({guild_id:GUILD}),{status:200});
    if (url.endsWith("/roles")) return new Response(JSON.stringify([{id:GUILD,permissions:"0"},{id:"admin-role",permissions:"32"}]),{status:200});
    if (url.includes("/members?") || url.includes("/members/search?")) {
      const members=[OWNER,MANAGER,OTHER,"1200000000000000009"].map((id,i)=>({nick:`Player ${i}`,joined_at:i===2?undefined:"2023-03-03T10:00:00.000Z",user:{id,username:`player${i}`,bot:i===3}}));
      const query=new URL(url).searchParams.get("query");
      return new Response(JSON.stringify(query ? members.filter(m=>m.nick.toLowerCase().includes(query.toLowerCase())) : members),{status:200});
    }
    if (url.includes("/members/")) {
      if (searchMembershipUnavailable) return new Response("Unavailable",{status:503});
      if (missingSearchMembers.has(url.split("/").pop()!)) return new Response("Unknown member",{status:404});
      return new Response(JSON.stringify({roles:url.endsWith(ADMIN) && adminRoleActive?["admin-role"]:[],
        user:{id:url.split("/").pop(),username:"Fixture player",bot:url.endsWith("1200000000000000009")}}),{status:200});
    }
    if (url.includes("/users/")) {
      const id=url.split("/").pop()!;
      accountLookups.set(id,(accountLookups.get(id) || 0)+1);
      if (id===UNAVAILABLE_ACCOUNT) return new Response("Discord unavailable",{status:503});
      return new Response(JSON.stringify({id,bot:false,username:`fixture${id.slice(-2)}`,
        global_name:id===OTHER?null:`Compte fixture ${id.slice(-2)}`,avatar:id===SITE_OWNER?"fixture-avatar":null}),{status:200});
    }
    return new Response(JSON.stringify({owner_id:"1200000000000000099"}),{status:200});
  };
  await new Promise<void>(resolve=>{server=app.listen(0,"127.0.0.1",resolve);});
  const address=server.address();assert.ok(address && typeof address!=="string");base=`http://127.0.0.1:${address.port}/api`;
});
after(async()=>{globalThis.fetch=requestFetch;await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(fixtureDir,{recursive:true,force:true});});

test("departure messages use announcement dates, exclude unrelated IDs and label name-only matches",()=>{
  const message={id:"1400000000000000111",timestamp:"2026-09-29T16:33:05.835Z",author:{bot:true},embeds:[{
    title:"Goodbye my friend 👋🏼",
    description:"À plus sous l’bus **Compte test** ! Merci de ton passage.\n👋 **Départ volontaire** · 📅 Depuis <t:1700000000:D>",
  }]};
  const parsed=parseDepartureMessage(message,GUILD)!;
  assert.equal(parsed.departedAt,message.timestamp);
  assert.equal(parsed.userId,null);
  assert.equal(parsed.name,"Compte test");
  assert.equal(parseDepartureMessage({...message,author:{bot:false}},GUILD),null);
  assert.equal(parseDepartureMessage({...message,timestamp:"invalid"},GUILD),null);
  assert.equal(parseDepartureMessage({...message,embeds:[{title:"Bienvenue",description:message.embeds[0].description}]},GUILD),null);
  const explicit=parseDepartureMessage({...message,content:`<@${COOWNER}>`},GUILD)!;
  assert.equal(explicit.userId,COOWNER);
  assert.equal(parseDepartureMessage({...message,content:`<@${COOWNER}> <@${OTHER}>`},GUILD),null);
  const history={available:true,complete:true,message:"",events:[parsed]};
  const key=departureNameKey("Compte test"),owners=new Map([[key,new Set([COOWNER])]]);
  assert.equal(matchDeparture(COOWNER,["compte TEST"],history,owners)?.match,"pseudo");
  owners.get(key)!.add(OTHER);
  assert.equal(matchDeparture(COOWNER,["Compte test"],history,owners),null,"Ambiguous names never receive a guessed date");
  assert.equal(matchDeparture(COOWNER,[],{...history,events:[explicit]},owners)?.match,"id");
  assert.equal(matchDeparture(COOWNER,[],{...history,available:false,events:[explicit]},owners),null);
});

test("catalogue variants enrich existing data without changing identities, edits or deactivations", async () => {
  const catalogue = await request("/dino-catalogue?all=true", "GET", undefined, SITE_OWNER);
  assert.equal(catalogue.status, 200);
  const names = new Set(catalogue.data.map((s: any) => s.name));
  for (const name of ["Rex", "Tek Rex", "Tek Giganotosaurus", "Aberrant Raptor", "X-Rex", "R-Giganotosaurus",
    "Aberrant Concavenator", "X-Concavenator", "Aberrant Fasolasuchus", "Aberrant Gigantoraptor",
    "X-Acrocanthosaurus", "X-Archelon", "X-Cryolophosaurus", "X-Deinosuchus", "X-Helicoprion", "X-Xiphactinus",
    "Astral Deinosuchus", "Fire Wyvern", "Blood Crystal Wyvern", "Boaratos", "Cerberax"]) assert.ok(names.has(name), name);
  assert.equal(new Set(defaultDinoSpecies.map(s => s.name)).size, defaultDinoSpecies.length);
  const tek = catalogue.data.find((s: any) => s.name === "Tek Rex");
  const x = catalogue.data.find((s: any) => s.name === "X-Rex");
  assert.notEqual(tek.id, x.id);
  assert.equal(dinoVariant("Tek Rex"), "tek");
  assert.equal(dinoVariant("Aberrant Raptor"), "aberrant");
  assert.equal(dinoVariant("X-Rex"), "x");
  assert.equal(dinoVariant("R-Giganotosaurus"), "r");
  assert.equal(dinoVariant("Fire Wyvern"), "other");
  assert.equal(dinoVariant("Rex"), "standard");
  // Simulate an installation with an edited old entry and a missing new variant.
  const edited = await request(`/dino-catalogue/${tek.id}`, "PUT", { ...tek, name: "Tek Rex personnalisé", active: false }, SITE_OWNER);
  assert.equal(edited.status, 200);
  database().prepare("DELETE FROM site_dino_species WHERE id=?").run(x.id);
  try {
    await enrichCatalogue();
    const enriched = await request("/dino-catalogue?all=true", "GET", undefined, SITE_OWNER);
    assert.equal(enriched.data.length, catalogue.data.length);
    assert.deepEqual(enriched.data.find((s: any) => s.id === tek.id), edited.data);
    assert.ok(enriched.data.some((s: any) => s.name === "X-Rex"));
    assert.equal(enriched.data.filter((s: any) => s.sourceUrl === tek.sourceUrl).length, 1);
    await enrichCatalogue();
    assert.equal((await request("/dino-catalogue?all=true", "GET", undefined, SITE_OWNER)).data.length, enriched.data.length);
  } finally {
    await request(`/dino-catalogue/${tek.id}`, "PUT", { ...tek, revision: edited.data.revision }, SITE_OWNER);
  }
});

test("site administrators can add species, not edit existing entries or access private breeding records", async () => {
  const input = { name: "Fixture variante administrateur", origin: "official", modId: null, maps: ["the-island"],
    sourceUrl: "https://ark.wiki.gg/wiki/Rex", active: true, revision: 0 };
  assert.equal((await request("/dino-catalogue", "POST", input, ADMIN)).status, 403, "Discord role alone is insufficient");
  changeSiteAccess(SITE_OWNER, ADMIN, "admin", GUILD);
  let speciesId: number | undefined;
  try {
    assert.equal((await request("/dino-catalogue?all=true", "GET", undefined, ADMIN)).status, 200);
    assert.equal((await request("/dino-catalogue?all=true", "GET", undefined, ADMIN, true, true)).status, 403, "Player view cannot use staff privileges");
    assert.equal((await request("/dino-catalogue", "POST", input, ADMIN, false)).status, 403, "CSRF required");
    assert.equal((await request("/dino-catalogue", "POST", { ...input, maps: ["unknown-map"] }, ADMIN)).status, 400);
    assert.equal((await request("/dino-catalogue", "POST", { ...input, sourceUrl: "http://example.com" }, ADMIN)).status, 400);
    assert.equal((await request("/dino-catalogue", "POST", input, OWNER)).status, 403, "Tribe ownership is not site administration");
    const added = await request("/dino-catalogue", "POST", input, ADMIN);
    assert.equal(added.status, 201);
    speciesId = added.data.id;
    assert.ok((await request("/dino-catalogue", "GET", undefined, OWNER)).data.some((s: any) => s.id === speciesId));
    assert.equal((await request("/dino-catalogue", "POST", { ...input, name: input.name.toUpperCase() }, ADMIN)).status, 400);
    assert.equal((await request(`/dino-catalogue/${speciesId}`, "PUT", { ...added.data, active: false }, ADMIN)).status, 403);
    changeSiteAccess(SITE_OWNER, ADMIN, null, null);
    assert.equal((await request("/dino-catalogue", "POST", { ...input, name: "Fixture accès révoqué" }, ADMIN)).status, 403);
  } finally {
    if (speciesId) database().prepare("DELETE FROM site_dino_species WHERE id=?").run(speciesId);
    if (siteGrants().some(g => g.userId === ADMIN)) changeSiteAccess(SITE_OWNER, ADMIN, null, null);
  }
});

test("base, Tek, X and aberrant species keep separate private tribe records", async () => {
  const created = await request("/tribes", "POST", { ...profile, name: "Variant records fixture" }, OWNER);
  assert.equal(created.status, 201);
  const tribeId = created.data.id;
  try {
    const catalogue = await request("/dino-catalogue", "GET", undefined, OWNER);
    const names = ["Rex", "Tek Rex", "X-Rex", "Aberrant Raptor"];
    for (const [index, name] of names.entries()) {
      const species = catalogue.data.find((s: any) => s.name === name);
      assert.ok(species, name);
      const saved = await request(`/tribes/${tribeId}/dino-records/${species.id}`, "PUT",
        { stats: { ...emptyStats(), health: 40 + index }, revision: 0, confirmed: true, mode: "replace", note: "", source: "manual" }, OWNER);
      assert.equal(saved.status, 200);
    }
    const records = await request(`/tribes/${tribeId}/dino-records`, "GET", undefined, OWNER);
    assert.equal(records.data.length, names.length);
    for (const [index, name] of names.entries())
      assert.equal(records.data.find((r: any) => r.species.name === name)?.stats.health, 40 + index);
    changeSiteAccess(SITE_OWNER, ADMIN, "admin", GUILD);
    assert.equal((await request(`/tribes/${tribeId}/dino-records`, "GET", undefined, ADMIN)).status, 403);
  } finally {
    if (siteGrants().some(g => g.userId === ADMIN)) changeSiteAccess(SITE_OWNER, ADMIN, null, null);
    await request(`/tribes/${tribeId}`, "DELETE", { confirmed: true }, OWNER);
  }
});

test("breeding records isolate tribes, compare base points, preserve unknowns and require fresh confirmation",async()=>{
  const created=await request("/tribes","POST",{...profile,name:"Breeding records fixture"},OWNER);
  const tribeId=created.data.id;
  try {
    const catalogue=await request("/dino-catalogue","GET",undefined,OWNER);
    assert.equal(catalogue.status,200);
    const rex=catalogue.data.find((s:any)=>s.name==="Rex");
    assert.ok(rex && rex.maps.includes("the-island"));
    assert.equal((await request("/dino-catalogue?all=true","GET",undefined,OWNER)).status,403);
    assert.equal((await request("/dino-catalogue?all=true","GET",undefined,SITE_OWNER)).status,200);
    for (const actor of [undefined,OTHER,ADMIN,SITE_OWNER]) {
      const result=await request(`/tribes/${tribeId}/dino-records`,"GET",undefined,actor);
      assert.equal(result.status,actor?403:401);
    }
    const route=`/tribes/${tribeId}/dino-records/${rex.id}`;
    const draft={stats:{...emptyStats(),health:40,stamina:0,melee:30},revision:0,confirmed:true,mode:"best",note:"Fixture",source:"manual"};
    assert.equal((await request(route,"PUT",{...draft,confirmed:false},OWNER)).status,400);
    assert.equal((await request(route,"PUT",draft,OWNER,false)).status,403);
    assert.equal((await request(route,"PUT",{...draft,stats:{...draft.stats,health:1.5}},OWNER)).status,400);
    const initial=await request(route,"PUT",draft,OWNER);
    assert.equal(initial.status,200);
    assert.equal(initial.data.stats.stamina,0);
    assert.equal(initial.data.stats.oxygen,null);
    const revision=initial.data.revision;
    await request(`/tribes/${tribeId}/members`,"PUT",{userId:OTHER,name:"Breeder",role:"Member",manager:false},OWNER);
    assert.equal((await request(`/tribes/${tribeId}/dino-records`,"GET",undefined,OTHER)).status,200,"All tribe members share the records");
    const comparison={...draft,revision,stats:{...emptyStats(),health:45,stamina:0,melee:20}};
    const best=await request(route,"PUT",comparison,OTHER);
    assert.equal(best.status,200);
    assert.equal(best.data.stats.health,45);
    assert.equal(best.data.stats.melee,30,"Best mode cannot downgrade");
    assert.equal((await request(route,"PUT",comparison,OWNER)).status,409);
    const replace=await request(route,"PUT",{...comparison,revision:best.data.revision,mode:"replace"},OWNER);
    assert.equal(replace.status,200);
    assert.equal(replace.data.stats.melee,20);
    assert.equal(replace.data.stats.stamina,0);
    missingSearchMembers.add(OWNER);
    try {assert.equal((await request(`/tribes/${tribeId}/dino-records`,"GET",undefined,OWNER)).status,403);}
    finally {missingSearchMembers.delete(OWNER);}
    const originalSpecies=(await request("/dino-catalogue?all=true","GET",undefined,SITE_OWNER)).data.find((s:any)=>s.id===rex.id);
    assert.equal((await request(`/dino-catalogue/${rex.id}`,"PUT",{...originalSpecies,active:false},OWNER)).status,403);
    assert.equal((await request(`/dino-catalogue/${rex.id}`,"PUT",{...originalSpecies,active:false},SITE_OWNER)).status,200);
    const inactive=(await request(`/tribes/${tribeId}/dino-records`,"GET",undefined,OWNER)).data;
    assert.equal(inactive[0].stats.health,45,"Deactivating catalogue never loses records");
    assert.equal(inactive[0].species.active,false);
    await request(`/dino-catalogue/${rex.id}`,"PUT",{...originalSpecies,revision:originalSpecies.revision+1},SITE_OWNER);
    const photoRoute=`/tribes/${tribeId}/dino-photo`;
    assert.equal((await request(photoRoute,"POST",{image:"data:image/png;base64,YmFk"},OWNER)).status,400);
    const envBase=process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,envKey=process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL="https://fixture-ai.invalid/v1";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY="isolated-fixture";
    try {
      const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6V0AAAAASUVORK5CYII=";
      const photo=await request(photoRoute,"POST",{image:png},OWNER);
      assert.equal(photo.status,503,"Billed AI reading is disabled at the owner's request");
      assert.equal((await request(`/tribes/${tribeId}/dino-records`,"GET",undefined,OWNER)).data[0].stats.health,45,"Photo does not save anything");
    } finally {
      if(envBase===undefined)delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;else process.env.AI_INTEGRATIONS_OPENAI_BASE_URL=envBase;
      if(envKey===undefined)delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;else process.env.AI_INTEGRATIONS_OPENAI_API_KEY=envKey;
    }
    assert.equal((await request(`/tribes/${tribeId}/dino-history`,"GET",undefined,OTHER)).data.length,3);
    assert.equal((await request(route,"DELETE",{revision:replace.data.revision,confirmed:false},OWNER)).status,400);
    assert.equal((await request(route,"DELETE",{revision,confirmed:true},OWNER)).status,409);
    assert.equal((await request(route,"DELETE",{revision:replace.data.revision,confirmed:true},OWNER)).status,200);
    assert.equal((await request(`/tribes/${tribeId}/dino-records`,"GET",undefined,OWNER)).data.length,0);
    const recreated=await request(route,"PUT",draft,OWNER);
    assert.equal(recreated.status,200);
    assert.ok(recreated.data.revision>replace.data.revision);
    assert.equal((await request(route,"PUT",{...draft,revision:replace.data.revision},OWNER)).status,409);
  } finally {await request(`/tribes/${tribeId}`,"DELETE",undefined,OWNER);}
});

test("map residents track principal-base edits and never invent coordinates",async()=>{
  const before=(await request("/site-maps/the-island/settlements")).data;
  const created=await request("/tribes","POST",{...profile,name:"Map residents fixture",coords:"LAT: 23,25 / LON: 26,59"},OWNER);
  assert.equal(created.status,201);
  const id=created.data.id;
  try {
    const result=await request("/site-maps/the-island/settlements");
    assert.equal(result.status,200);
    assert.equal(result.data.count,before.count+1);
    const resident=result.data.tribes.find((t:any)=>t.id===id);
    assert.equal(resident.name,"Map residents fixture");
    assert.equal(resident.latitude,23.25);
    assert.equal(resident.longitude,26.59);
    assert.equal(resident.coords,"LAT: 23,25 / LON: 26,59");
    const movedProfile=await request(`/tribes/${id}`,"PATCH",{...profile,name:"Map residents moved fixture",map:"Valguero",coords:"GPS inconnu"},OWNER);
    assert.equal(movedProfile.status,200);
    assert.equal((await request("/site-maps/the-island/settlements")).data.count,before.count);
    const moved=(await request("/site-maps/valguero/settlements")).data.tribes.find((t:any)=>t.id===id);
    assert.equal(moved.latitude,null);
    assert.equal(moved.coords,"GPS inconnu");
    assert.equal((await request("/site-maps/unknown-map/settlements")).status,404);
  } finally{await request(`/tribes/${id}`,"DELETE",undefined,OWNER);}
  assert.equal((await request("/site-maps/the-island/settlements")).data.count,before.count);
});
test("official map image is owner-only, revision protected, separate from cover and removable",async()=>{
  const route="/site-maps/the-island/cartography";
  const publicRoute="/site-maps/the-island/settlements";
  const originalMap=(await request("/site-maps/the-island")).data;
  const original=(await request(publicRoute)).data.cartography;
  const draft={image:"https://example.com/official-test-map.png",revision:original.revision};
  for(const actor of [undefined,OWNER,ADMIN]) assert.equal((await request(route,"PUT",draft,actor)).status,actor?403:401);
  assert.equal((await request(route,"PUT",draft,SITE_OWNER,false)).status,403);
  assert.equal((await request(route,"PUT",draft,SITE_OWNER,true,true)).status,403);
  for(const image of ["javascript:alert(1)","http://example.com/map.png","https://user:password@example.com/map.png","/api/storage/objects/site-branding/00000000-0000-0000-0000-000000000000"]) {
    assert.equal((await request(route,"PUT",{...draft,image},SITE_OWNER)).status,400);
  }
  const saved=await request(route,"PUT",draft,SITE_OWNER);
  assert.equal(saved.status,200);
  assert.equal(saved.data.image,draft.image);
  assert.equal((await request(publicRoute)).data.cartography.image,draft.image);
  assert.equal((await request("/site-maps/the-island")).data.image,originalMap.image);
  assert.equal((await request(route,"PUT",draft,SITE_OWNER)).status,409);
  const removed=await request(route,"PUT",{image:"",revision:saved.data.revision},SITE_OWNER);
  assert.equal(removed.status,200);
  assert.equal((await request(publicRoute)).data.cartography.image,"");
  const restored=await request(route,"PUT",{image:original.image,revision:removed.data.revision},SITE_OWNER);
  assert.equal(restored.status,200);
  assert.equal((await request(publicRoute)).data.cartography.image,original.image);
});
test("map coordinate parsing rejects unknown and out-of-grid values",()=>{
  assert.deepEqual(parseMapCoords("90.46 56.89"),{latitude:90.46,longitude:56.89});
  assert.deepEqual(parseMapCoords("50,56 - 95,62"),{latitude:50.56,longitude:95.62});
  assert.deepEqual(parseMapCoords("43.3,33.2"),{latitude:43.3,longitude:33.2});
  assert.deepEqual(parseMapCoords("0 / 100"),{latitude:0,longitude:100});
  for(const value of ["Je sais pas lire le GPS","101/20","-1/20","43,3,33,2","12 / 20 / 30"]) {
    assert.deepEqual(parseMapCoords(value),{latitude:null,longitude:null});
  }
});
test("Supplied atlases respect explicit owner removal and restoration",async()=>{
  for(const [slug,image] of [["ragnarok","/map-ragnarok-cartography.webp"],["valguero","/map-valguero-cartography.jpeg"],["astraeos","/map-astraeos-cartography.webp"],["svartalfheim","/map-svartalfheim-cartography.webp"],["genesis","/map-genesis-cartography.jpeg"],["lost-colony","/map-lost-colony-cartography.jpeg"],["aberration","/map-aberration-cartography.webp"],["scorched-earth","/map-scorched-earth-cartography.jpeg"],["the-island","/map-the-island-cartography.jpeg"],["the-center","/map-the-center-cartography.webp"],["extinction","/map-extinction-cartography.webp"]]) {
    const original=(await request(`/site-maps/${slug}/settlements`)).data.cartography;
    assert.equal(original.image,image);
    assert.notEqual((await request(`/site-maps/${slug}`)).data.image,original.image,"Geographic image stays separate from the scenic cover");
    const removed=await request(`/site-maps/${slug}/cartography`,"PUT",{image:"",revision:original.revision},SITE_OWNER);
    assert.equal(removed.status,200);
    assert.equal((await request(`/site-maps/${slug}/settlements`)).data.cartography.image,"","A stored empty image must not fall back to the atlas");
    const restored=await request(`/site-maps/${slug}/cartography`,"PUT",{image:original.image,revision:removed.data.revision},SITE_OWNER);
    assert.equal(restored.status,200);
    assert.equal((await request(`/site-maps/${slug}/settlements`)).data.cartography.image,original.image);
  }
});
test("Genesis photo coordinates follow the printed grid for markers, reading, zoom and pan",()=>{
  const calibration=getMapCalibration("/map-genesis-cartography.jpeg");
  assert.ok(calibration);
  const rect={left:0,top:0,width:1024,height:1024};
  assert.deepEqual(pointToCoords(116,118,rect,calibration),{lat:10,lon:10});
  assert.deepEqual(pointToCoords(926,914,rect,calibration),{lat:90,lon:90});
  assert.deepEqual(pointToCoords(521,516,rect,calibration),{lat:50,lon:50});
  const topLeft=coordsToImagePoint({lat:10,lon:10},calibration);
  assert.deepEqual(topLeft,{x:116/1024*100,y:118/1024*100});
  for(const lat of [10,25.4,50,72.3,90]) {
    for(const lon of [10,31.7,50,81.2,90]) {
      const point=coordsToImagePoint({lat,lon},calibration);
      const zoomed={left:-350,top:-200,width:3072,height:3072};
      assert.deepEqual(pointToCoords(zoomed.left+point.x/100*zoomed.width,zoomed.top+point.y/100*zoomed.height,zoomed,calibration),{lat,lon});
    }
  }
  assert.equal(getMapCalibration("/map-ragnarok-cartography.webp"),null);
  assert.equal(getMapCalibration("/api/storage/objects/site-branding/custom-genesis"),null,"A replacement image must not inherit unrelated calibration");
  assert.deepEqual(coordsToImagePoint({lat:76,lon:73}),{x:73,y:76},"Other maps retain full-image coordinates");
});
test("interactive atlas coordinates use rendered image bounds after zoom and pan",()=>{
  assert.deepEqual(pointToCoords(250,350,{left:50,top:150,width:400,height:400}),{lat:50,lon:50});
  assert.deepEqual(pointToCoords(300,400,{left:-300,top:-100,width:1200,height:1000}),{lat:50,lon:50});
  assert.deepEqual(pointToCoords(50,150,{left:50,top:150,width:400,height:400}),{lat:0,lon:0});
  assert.deepEqual(pointToCoords(450,550,{left:50,top:150,width:400,height:400}),{lat:100,lon:100});
  assert.equal(pointToCoords(10,20,{left:0,top:0,width:0,height:100}),null);
  assert.equal(pointToCoords(Number.NaN,20,{left:0,top:0,width:100,height:100}),null);
  assert.deepEqual(clampPan(-999,90,2,400,300),{x:-400,y:0});
  assert.deepEqual(nudgeCoords({lat:99,lon:0},5,-1),{lat:100,lon:0});
  assert.equal(initialMapTab("?section=residents"),"residents");
  assert.equal(initialMapTab(""),"overview");
  const grouped=splitTribes([
    {id:1,name:"Valid",coords:"25/36",latitude:25,longitude:36},
    {id:2,name:"Unknown",coords:"GPS inconnu",latitude:null,longitude:null},
    {id:3,name:"Outside",coords:"101/20",latitude:101,longitude:20},
  ]);
  assert.deepEqual(grouped.placed.map(t=>t.t.id),[1]);
  assert.deepEqual(grouped.unknown.map(t=>t.t.id),[2,3]);
});
test("Ragnarok residents add, move and disappear from current principal declarations, not outposts",async()=>{
  const baseline=(await request("/site-maps/ragnarok/settlements")).data.count;
  const made=await request("/tribes","POST",{...profile,name:"Ragnarok resident fixture",map:"Ragnarok",coords:"25/36"},OWNER);
  assert.equal(made.status,201);
  const id=made.data.id;
  try {
    assert.equal((await request("/site-maps/ragnarok/settlements")).data.count,baseline+1);
    const moved=await request(`/tribes/${id}`,"PATCH",{...profile,name:"Ragnarok resident fixture",map:"The Island",coords:"10/20"},OWNER);
    assert.equal(moved.status,200);
    assert.equal((await request("/site-maps/ragnarok/settlements")).data.count,baseline);
    const outpost=await request(`/tribes/${id}/places`,"POST",{kind:"outpost",name:"Secondary Ragnarok base",map:"Ragnarok",coords:"25/36"},OWNER);
    assert.equal(outpost.status,201);
    assert.equal((await request("/site-maps/ragnarok/settlements")).data.count,baseline,"A secondary Ragnarok base is not a principal resident");
    const returned=await request(`/tribes/${id}`,"PATCH",{...profile,name:"Ragnarok resident fixture",map:"Ragnarok",coords:"40/55"},OWNER);
    assert.equal(returned.status,200);
    const current=(await request("/site-maps/ragnarok/settlements")).data;
    assert.equal(current.count,baseline+1,"A tribe with a principal base and an outpost on the same map counts once");
    assert.equal(current.tribes.find((t:any)=>t.id===id).coords,"40/55");
  } finally {
    const deleted=await request(`/tribes/${id}`,"DELETE",undefined,OWNER);
    assert.equal(deleted.status,200);
  }
  const after=(await request("/site-maps/ragnarok/settlements")).data;
  assert.equal(after.count,baseline);
  assert.ok(!after.tribes.some((t:any)=>t.id===id));
});
test("point comparison distinguishes zero from unknown and retains omitted stats",()=>{
  assert.deepEqual(mergeStats({...emptyStats(),health:40,weight:20},{...emptyStats(),health:0,stamina:0},"best"),
    {...emptyStats(),health:40,weight:20,stamina:0});
  assert.deepEqual(mergeStats({...emptyStats(),health:40,weight:20},{...emptyStats(),health:0,stamina:0},"replace"),
    {...emptyStats(),health:0,weight:20,stamina:0});
});

test("absent tribes show each player's latest departure evidence and retain staff-only access",async()=>{
  const created=await request("/tribes","POST",{...profile,name:"Departure review fixture"},COOWNER);
  assert.equal(created.status,201);
  const id=created.data.id;
  try {
    assert.equal((await request(`/tribes/${id}/members`,"PUT",{userId:SITE_OWNER,name:"Second absent player",role:"Member",manager:false},COOWNER)).status,200);
    for (const actor of [undefined,OTHER]) assert.equal((await request("/tribe-review","GET",undefined,actor)).status,actor?403:401);
    assert.equal((await request("/tribe-review","GET",undefined,SITE_OWNER,true,true)).status,403);
    const reviewed=await request("/tribe-review","GET",undefined,SITE_OWNER);
    assert.equal(reviewed.status,200);
    assert.equal(reviewed.data.departureLogsAvailable,true);
    assert.equal(reviewed.data.departureLogsComplete,true);
    const tribe=reviewed.data.removable.find((t:{id:number})=>t.id===id);
    assert.ok(tribe);
    assert.equal(tribe.departedPlayers.length,2);
    const player=tribe.departedPlayers.find((p:{userId:string})=>p.userId===COOWNER);
    assert.equal(player.departedAt,"2026-08-03T09:10:00.000Z");
    assert.equal(player.match,"pseudo");
    assert.equal(player.name,"Compte fixture 06");
    assert.match(player.sourceUrl,/1400000000000000101$/);
    const unknown=tribe.departedPlayers.find((p:{userId:string})=>p.userId===SITE_OWNER);
    assert.equal(unknown.departedAt,null);
    assert.equal(unknown.sourceUrl,null);
    assert.equal(departurePageReads,2,"History is paginated");
    await request("/tribe-review","GET",undefined,SITE_OWNER);
    assert.equal(departurePageReads,2,"Repeated reviews use cached history");
    const wrongGuild=await departureHistory("1200000000000000999");
    assert.equal(wrongGuild.available,false);
    assert.deepEqual(wrongGuild.events,[]);
    const originalNow=Date.now;
    departureHistoryDenied=true;
    Date.now=()=>originalNow()+300001;
    try {
      const unavailable=await departureHistory(GUILD);
      assert.equal(unavailable.available,false);
      assert.deepEqual(unavailable.events,[],"A failed refresh does not expose old dates as verified");
    } finally {
      departureHistoryDenied=false;
      Date.now=originalNow;
    }
  } finally {
    assert.equal((await request(`/tribes/${id}`,"DELETE",undefined,COOWNER)).status,200);
  }
});

test("site access shows Discord accounts without changing rights and tolerates unavailable profiles",async()=>{
  const primaryList=await request("/site-access","GET",undefined,SITE_OWNER);
  assert.equal(primaryList.status,200);
  const primary=primaryList.data.find((g:{userId:string})=>g.userId===SITE_OWNER);
  assert.equal(primary.name,"Compte fixture 05");
  assert.equal(primary.username,"fixture05");
  assert.equal(primary.avatar,`https://cdn.discordapp.com/avatars/${SITE_OWNER}/fixture-avatar.png?size=80`);
  assert.equal(primary.primary,true);
  assert.equal(primary.eligible,true);
  const actorId="1200000000000000097";
  const profiles=await Promise.all([discordAccount(actorId),discordAccount(actorId)]);
  assert.deepEqual(profiles[0],profiles[1]);
  await discordAccount(actorId);
  assert.equal(accountLookups.get(actorId),1);
  const noGlobalName=await discordAccount(OTHER);
  assert.equal(noGlobalName.name,"fixture03");
  assert.equal(noGlobalName.avatar,null);
  // Seed only the isolated fixture: a stored grant must stay manageable even
  // if Discord no longer returns the account.
  changeSiteAccess(SITE_OWNER,UNAVAILABLE_ACCOUNT,"owner",GUILD);
  const unavailableList=await request("/site-access","GET",undefined,SITE_OWNER);
  assert.equal(unavailableList.status,200);
  const unavailable=unavailableList.data.find((g:{userId:string})=>g.userId===UNAVAILABLE_ACCOUNT);
  assert.equal(unavailable.name,null);
  assert.equal(unavailable.username,null);
  assert.equal(unavailable.avatar,null);
  assert.equal(unavailable.role,"owner");
  assert.equal(unavailable.eligible,true);
  await request("/site-access","GET",undefined,SITE_OWNER);
  assert.equal(accountLookups.get(UNAVAILABLE_ACCOUNT),1);
  assert.equal((await request(`/site-access/${UNAVAILABLE_ACCOUNT}`,"DELETE",undefined,SITE_OWNER)).status,200);
});

test("community join requires identification, accepts newcomers and binds the OAuth return safely",async()=>{
  const inviteUrl="https://discord.gg/Bt4ht8fMzA";
  const guest=await request("/community-invite");
  assert.equal(guest.status,401);
  assert.equal(JSON.stringify(guest.data).includes(inviteUrl),false);
  missingSearchMembers.add(OWNER);
  try {
    const joined=await request("/community-invite","GET",undefined,OWNER);
    assert.equal(joined.status,200,"A logged-in newcomer can get the invitation without guild membership");
    assert.deepEqual(joined.data,{url:inviteUrl});
    const response=await requestFetch(`${base}/community-invite`,{headers:{Cookie:cookie(OWNER)}});
    assert.equal(response.headers.get("cache-control"),"private, no-store");
    assert.match(response.headers.get("vary") || "",/Cookie/i);
    assert.equal((await request("/player-search?q=Player","GET",undefined,OWNER)).status,403,"The invitation does not grant player-search access");
  } finally {missingSearchMembers.delete(OWNER);}

  const previousId=process.env.DISCORD_CLIENT_ID,previousSecret=process.env.DISCORD_CLIENT_SECRET;
  process.env.DISCORD_CLIENT_ID="isolated-client";
  process.env.DISCORD_CLIENT_SECRET="isolated-client-fixture-not-a-real-secret";
  try {
    for (const [suffix,expected] of [
      ["?retour=rejoindre","/rejoindre"],
      ["","/mon-espace"],
      ["?retour=https%3A%2F%2Fexample.com","/mon-espace"],
      ["?retour=%2F%2Fexample.com","/mon-espace"],
    ]) {
      const start=await requestFetch(`${base}/auth/discord${suffix}`,{redirect:"manual"});
      assert.equal(start.status,302);
      const destination=new URL(start.headers.get("location")!);
      const nonce=destination.searchParams.get("state")!;
      const stateCookie=start.headers.getSetCookie().find(value=>value.startsWith("arki_oauth_state="))!.split(";")[0];
      const callback=await requestFetch(`${base}/auth/discord/callback?code=fixture&state=${encodeURIComponent(nonce)}&retour=https%3A%2F%2Fexample.com`,{
        redirect:"manual",headers:{Cookie:stateCookie},
      });
      assert.equal(callback.status,302);
      assert.equal(callback.headers.get("location"),expected,"Only the signed, allowlisted destination is used");
      assert.equal(callback.headers.getSetCookie().some(value=>value.startsWith("arki_session=")),true);
      if (expected==="/rejoindre") {
        const invalid=await requestFetch(`${base}/auth/discord/callback?code=fixture&state=wrong`,{
          redirect:"manual",headers:{Cookie:stateCookie},
        });
        assert.equal(invalid.headers.get("location"),"/connexion?retour=rejoindre&erreur=discord");
        assert.equal(invalid.headers.getSetCookie().some(value=>value.startsWith("arki_session=")),false);
      }
    }
  } finally {
    if (previousId===undefined) delete process.env.DISCORD_CLIENT_ID;else process.env.DISCORD_CLIENT_ID=previousId;
    if (previousSecret===undefined) delete process.env.DISCORD_CLIENT_SECRET;else process.env.DISCORD_CLIENT_SECRET=previousSecret;
  }
});

test("tribe transition parity: self-service name, safe departure and complete private history",async()=>{
  const first=await request("/tribes","POST",{...profile,name:"Transition first"},OWNER);
  const second=await request("/tribes","POST",{...profile,name:"Transition second"},OWNER);
  assert.equal(first.status,201);assert.equal(second.status,201);
  const ids=[first.data.id,second.data.id];
  try {
    for (const id of ids) {
      assert.equal((await request(`/tribes/${id}/members`,"PUT",{userId:MANAGER,name:"Original name",role:"Builder",manager:true},OWNER)).status,200);
      assert.equal((await request(`/tribes/${id}/members`,"PUT",{userId:OTHER,name:"Another player",role:"Visitor",manager:false},OWNER)).status,200);
    }
    assert.equal((await request("/my-tribes/name","PUT",{name:"New name"})).status,401);
    assert.equal((await request("/my-tribes/name","PUT",{name:"New name"},MANAGER,false)).status,403);
    assert.equal((await request("/my-tribes/name","PUT",{name:"   "},MANAGER)).status,400);
    assert.equal((await request("/my-tribes/name","PUT",{name:"x".repeat(101)},MANAGER)).status,400);
    assert.equal((await request("/my-tribes/name","PUT",{name:" New name ",userId:OTHER},MANAGER)).status,200);
    for (const id of ids) {
      const tribe=(await request(`/tribes/${id}`,"GET",undefined,OWNER)).data;
      const member=tribe.members.find((m:any)=>m.userId===MANAGER);
      assert.equal(member.name,"New name");assert.equal(member.manager,true);assert.equal(member.role,"Builder");
      assert.equal(tribe.members.find((m:any)=>m.userId===OTHER).name,"Another player");
    }
    assert.equal((await request(`/tribes/${ids[0]}/history`)).status,401);
    assert.equal((await request(`/tribes/${ids[0]}/history`,"GET",undefined,OTHER)).status,403);
    assert.equal((await request(`/tribes/${ids[0]}/history?before=invalid`,"GET",undefined,OWNER)).status,400);
    const db=new DatabaseSync(fixture);
    for (let i=0;i<25;i++) db.prepare("INSERT INTO historique(tribu_id,user_id,action,details,created_at) VALUES(?,?,?,?,?)").run(ids[0],BigInt(MANAGER),"Historical fixture",`Entry ${i}`,"2023-01-01T12:00:00");
    db.close();
    const page=(await request(`/tribes/${ids[0]}/history`,"GET",undefined,MANAGER)).data;
    assert.equal(page.entries.length,20);assert.ok(page.nextBefore);
    assert.equal(page.entries[0].actorId,MANAGER,"Discord IDs must not lose precision");
    const next=(await request(`/tribes/${ids[0]}/history?before=${page.nextBefore}`,"GET",undefined,MANAGER)).data;
    assert.ok(next.entries.length>=5);assert.equal(next.nextBefore,null);
    assert.equal(new Set([...page.entries,...next.entries].map((entry:any)=>entry.id)).size,page.entries.length+next.entries.length);
    const response=await requestFetch(`${base}/tribes/${ids[0]}/history`,{headers:{Cookie:cookie(OWNER)}});
    assert.equal(response.headers.get("cache-control"),"private, no-store");
    assert.equal((await request(`/tribes/${ids[0]}/leave`,"POST")).status,401);
    assert.equal((await request(`/tribes/${ids[0]}/leave`,"POST",undefined,MANAGER,false)).status,403);
    assert.equal((await request(`/tribes/${ids[0]}/leave`,"POST",undefined,OWNER)).status,400);
    assert.equal((await request(`/tribes/${ids[0]}/leave`,"POST",undefined,MANAGER)).status,200);
    assert.equal((await request(`/tribes/${ids[0]}`,"GET",undefined,MANAGER)).data.canEdit,false);
    assert.equal((await request(`/tribes/${ids[0]}/history`,"GET",undefined,MANAGER)).status,403);
    assert.equal((await request(`/tribes/${ids[0]}/leave`,"POST",undefined,MANAGER)).status,404);
    assert.equal((await request(`/tribes/${ids[1]}`,"GET",undefined,MANAGER)).data.canEdit,true);
    assert.equal((await request(`/tribes/${ids[0]}/leave`,"POST",undefined,OTHER)).status,200,"Ordinary members can leave without management rights");
    const scoped=new DatabaseSync(fixture);
    scoped.prepare("UPDATE tribus SET guild_id=? WHERE id=?").run(BigInt(GUILD)+1n,ids[1]);scoped.close();
    assert.equal((await request(`/tribes/${ids[1]}/leave`,"POST",undefined,MANAGER)).status,403);
    assert.equal((await request(`/tribes/${ids[1]}/history`,"GET",undefined,OWNER)).status,403);
    assert.equal((await request("/my-tribes/name","PUT",{name:"Foreign rename"},MANAGER)).status,404);
    const restored=new DatabaseSync(fixture);
    assert.equal(restored.prepare("SELECT nom_in_game FROM membres WHERE tribu_id=? AND user_id=?").get(ids[1],BigInt(MANAGER))?.nom_in_game,"New name");
    restored.prepare("UPDATE tribus SET guild_id=? WHERE id=?").run(BigInt(GUILD),ids[1]);restored.close();
  } finally {
    for (const id of ids) await request(`/tribes/${id}`,"DELETE",undefined,OWNER);
  }
});

test("player search protects server membership and returns only public, guild-scoped associations",async()=>{
  assert.equal((await request("/player-search?q=Player")).status,401);
  assert.equal((await request("/player-search?q=P","GET",undefined,OWNER)).status,400);
  assert.equal((await request("/player-search?q=%20%20","GET",undefined,OWNER)).status,400);
  assert.equal((await request(`/player-search?q=${"a".repeat(81)}`,"GET",undefined,OWNER)).status,400);
  const created=await request("/tribes","POST",{...profile,name:"Player search fixture"},OWNER);
  assert.equal(created.status,201);
  const id=created.data.id;
  try {
    assert.equal((await request(`/tribes/${id}/members`,"PUT",{userId:MANAGER,name:"Manager",role:"Bâtisseur",manager:true},OWNER)).status,200);
    let found=await request("/player-search?q=Player","GET",undefined,OWNER);
    assert.equal(found.status,200);
    assert.equal(found.data.players.length,3,"Bots are excluded");
    const owner=found.data.players.find((p:any)=>p.id===OWNER);
    const manager=found.data.players.find((p:any)=>p.id===MANAGER);
    const unlinked=found.data.players.find((p:any)=>p.id===OTHER);
    assert.equal(owner.joinedAt,"2023-03-03T10:00:00.000Z");
    assert.equal(owner.tribes.find((t:any)=>t.id===id).isOwner,true);
    assert.equal(manager.tribes.find((t:any)=>t.id===id).role,"Bâtisseur");
    assert.equal(manager.tribes.find((t:any)=>t.id===id).manager,true);
    assert.equal(unlinked.joinedAt,null);
    assert.deepEqual(unlinked.tribes,[]);
    assert.deepEqual(Object.keys(owner).sort(),["avatar","id","joinedAt","name","tribes","username"]);
    assert.equal(found.data.hasMore,false);
    const headers=await requestFetch(`${base}/player-search?q=Player`,{headers:{Cookie:cookie(OWNER)}});
    assert.equal(headers.headers.get("cache-control"),"private, no-store");
    assert.match(headers.headers.get("vary") || "",/Cookie/i);
    assert.deepEqual((await request("/player-search?q=Nonexistent","GET",undefined,OWNER)).data,{players:[],hasMore:false});
    // An owning player still has an association even if their member row is absent.
    const db=new DatabaseSync(fixture);
    db.prepare("DELETE FROM membres WHERE tribu_id=? AND user_id=?").run(id,BigInt(OWNER));
    db.close();
    found=await request("/player-search?q=Player","GET",undefined,OWNER);
    assert.equal(found.data.players.find((p:any)=>p.id===OWNER).tribes.find((t:any)=>t.id===id).isOwner,true);
    // Cached directory results must not bypass a fresh access check.
    for (const denied of [OWNER,ADMIN,SITE_OWNER]) {
      missingSearchMembers.add(denied);
      try {
        const result=await request("/player-search?q=Player","GET",undefined,denied);
        assert.equal(result.status,403,"Login, administrator and site owner never bypass server membership");
        assert.equal(result.data.players,undefined);
      } finally {missingSearchMembers.delete(denied);}
    }
    searchMembershipUnavailable=true;
    try {assert.equal((await request("/player-search?q=Player","GET",undefined,OWNER)).status,503);}
    finally {searchMembershipUnavailable=false;}
    const otherGuild=new DatabaseSync(fixture);
    otherGuild.prepare("UPDATE tribus SET guild_id=? WHERE id=?").run(BigInt(GUILD)+1n,id);
    otherGuild.close();
    try {
      found=await request("/player-search?q=Player","GET",undefined,OWNER);
      assert.equal(found.data.players.some((p:any)=>p.tribes.some((t:any)=>t.id===id)),false,"Another guild's tribes are never included");
    } finally {
      const restore=new DatabaseSync(fixture);restore.prepare("UPDATE tribus SET guild_id=? WHERE id=?").run(BigInt(GUILD),id);restore.close();
    }
  } finally {await request(`/tribes/${id}`,"DELETE",undefined,OWNER);}
});

test("mods catalogue is public while only site owners can manage it",async()=>{
  const draft={name:"Isolated mod fixture",category:"Divers",description:"Fixture only",image:"",sourceUrl:""};
  const publicCatalogue=await request("/site-mods");
  assert.equal(publicCatalogue.status,200);
  assert.equal(publicCatalogue.data.length,31);
  assert.ok(publicCatalogue.data.some((m:any)=>m.name==="Klinger Additional Structures"));
  assert.ok(publicCatalogue.data.every((m:any)=>m.sourceUrl.startsWith("https://www.curseforge.com/")));
  assert.equal((await request("/site-mods","GET",undefined,OTHER)).status,200);
  assert.equal((await request("/site-mods","POST",draft,OTHER)).status,403);
  const grant=await request("/site-access","PUT",{userId:ADMIN,role:"admin"},SITE_OWNER);
  assert.equal(grant.status,200);
  assert.equal((await request("/site-mods","GET",undefined,ADMIN)).status,200);
  assert.equal((await request("/site-mods","POST",draft,ADMIN)).status,403);
  const bad=await request("/site-mods","POST",{...draft,image:"javascript:alert(1)"},SITE_OWNER);
  assert.equal(bad.status,400);
  const made=await request("/site-mods","POST",draft,SITE_OWNER);
  assert.equal(made.status,201);
  const id=made.data.id;
  assert.equal((await request("/site-mods","POST",draft,SITE_OWNER)).status,409);
  assert.ok((await request("/site-mods","GET",undefined,SITE_OWNER)).data.some((m:any)=>m.id===id));
  assert.equal((await request(`/site-mods/${id}`,"PUT",{...draft,name:"Changed mod fixture"},ADMIN)).status,403);
  assert.equal((await request(`/site-mods/${id}`,"PUT",{...draft,name:"Changed mod fixture",image:"https://example.com/image.png"},SITE_OWNER)).status,200);
  assert.equal((await request("/site-mods","GET",undefined,ADMIN)).data.find((m:any)=>m.id===id).name,"Changed mod fixture");
  assert.equal((await request(`/site-mods/${id}`,"DELETE",undefined,ADMIN)).status,403);
  assert.equal((await request(`/site-mods/${id}`,"DELETE",undefined,SITE_OWNER)).status,200);
  assert.equal((await request(`/site-mods/${id}`,"DELETE",undefined,SITE_OWNER)).status,404);
  assert.equal((await request(`/site-access/${ADMIN}`,"DELETE",undefined,SITE_OWNER)).status,200);
});

test("anonymous directory is real and Discord is explicitly unconfigured",async()=>{
  const s=await request("/session");assert.equal(s.status,200);assert.equal(s.data.user,null);assert.equal(s.data.oauthConfigured,false);
  const result=await request("/tribes");assert.deepEqual(result.data,[]);
  assert.equal((await request("/tribes","POST",profile)).status,401);
  assert.equal((await request("/session","GET",undefined,OTHER)).data.isOwner,false);
  assert.equal((await request("/site-access")).status,401);
  assert.equal((await request("/site-access","GET",undefined,OTHER)).status,403);
});
test("branding is public, but only site owners may save or request an image upload",async()=>{
  const initial=await request("/site-branding");
  assert.equal(initial.data.logoUrl,"/server-logo.png");assert.equal(initial.data.coverUrl,"");
  assert.equal((await request("/site-branding","PATCH",{coverPath:null})).status,401);
  assert.equal((await request("/site-branding","PATCH",{coverPath:null},OWNER)).status,403);
  assert.equal((await request("/site-branding/uploads","POST",{kind:"logo",name:"a.png",size:1,contentType:"image/png"},ADMIN)).status,403);
  assert.equal((await request("/site-branding","PATCH",{logoPath:"/objects/uploads/00000000-0000-0000-0000-000000000000"},SITE_OWNER)).status,400);
  assert.equal((await request("/site-branding","PATCH",{logoPath:"https://example.org/a.png"},SITE_OWNER)).status,400);
  assert.equal((await request("/site-branding","PATCH",{},SITE_OWNER)).status,400);
  assert.equal((await request("/site-branding/uploads","POST",{kind:"logo",name:"a.svg",size:100,contentType:"image/svg+xml"},SITE_OWNER)).status,400);
  assert.equal((await request("/site-branding/uploads","POST",{kind:"logo",name:"a.png",size:6*1024*1024,contentType:"image/png"},SITE_OWNER)).status,400);
  assert.equal((await request("/storage/objects/uploads/00000000-0000-0000-0000-000000000000")).status,404);
  assert.equal((await request("/site-branding","PATCH",{logoPath:null,coverPath:null},SITE_OWNER)).status,200);
});
test("real storage upload publishes only validated images, persists logo and cover independently, and resets them",{skip:process.env.ARKI_TEST_STORAGE!=="1"},async()=>{
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6V0AAAAASUVORK5CYII=","base64");
  const created:string[]=[];
  try {
    const upload=await request("/site-branding/uploads","POST",{kind:"logo",name:"fixture.png",size:png.length,contentType:"image/png"},SITE_OWNER);
    assert.equal(upload.status,200,"Real storage must issue a signed upload URL");
    const up=upload.data;created.push(up.objectPath);
    assert.equal((await requestFetch(up.uploadURL,{method:"PUT",headers:{"Content-Type":"image/png"},body:png})).status,200);
    assert.equal((await request(`/storage${up.objectPath}`)).status,404);
    assert.equal((await request("/site-branding","PATCH",{coverPath:up.objectPath},SITE_OWNER)).status,400,"Wrong slot must not publish the upload");
    const saved=await request("/site-branding","PATCH",{logoPath:up.objectPath},SITE_OWNER);
    assert.equal(saved.status,200);
    created.push(saved.data.logoPath);
    assert.notEqual(saved.data.logoPath,up.objectPath,"Published bytes must be protected from reuse of the write URL");
    const publicImage=await requestFetch(`${base}/storage${saved.data.logoPath}`);
    assert.equal(publicImage.status,200);
    assert.equal(publicImage.headers.get("content-type"),"image/png");
    assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()),png);
    assert.equal((await request("/site-branding")).data.logoUrl,saved.data.logoUrl);
    // A still-valid write URL cannot corrupt the published image.
    assert.equal((await requestFetch(up.uploadURL,{method:"PUT",headers:{"Content-Type":"image/png"},body:Buffer.alloc(png.length)})).status,200);
    assert.deepEqual(Buffer.from(await (await requestFetch(`${base}/storage${saved.data.logoPath}`)).arrayBuffer()),png);
    const cover=await request("/site-branding/uploads","POST",{kind:"cover",name:"cover.png",size:png.length,contentType:"image/png"},SITE_OWNER);
    assert.equal(cover.status,200);created.push(cover.data.objectPath);
    assert.equal((await requestFetch(cover.data.uploadURL,{method:"PUT",headers:{"Content-Type":"image/png"},body:png})).status,200);
    const both=await request("/site-branding","PATCH",{coverPath:cover.data.objectPath},SITE_OWNER);
    assert.equal(both.status,200);created.push(both.data.coverPath);
    assert.equal(both.data.logoPath,saved.data.logoPath);
    assert.ok(both.data.coverUrl);
    const bad=await request("/site-branding/uploads","POST",{kind:"logo",name:"fake.png",size:16,contentType:"image/png"},SITE_OWNER);
    assert.equal(bad.status,200);created.push(bad.data.objectPath);
    assert.equal((await requestFetch(bad.data.uploadURL,{method:"PUT",headers:{"Content-Type":"image/png"},body:Buffer.alloc(16)})).status,200);
    assert.equal((await request("/site-branding","PATCH",{logoPath:bad.data.objectPath},SITE_OWNER)).status,400);
    assert.equal((await request("/site-branding")).data.logoPath,saved.data.logoPath);
    const reset=await request("/site-branding","PATCH",{logoPath:null,coverPath:null},SITE_OWNER);
    assert.equal(reset.data.logoUrl,"/server-logo.png");assert.equal(reset.data.coverUrl,"");
    assert.equal((await request(`/storage${saved.data.logoPath}`)).status,404);
  } finally {
    for (const objectPath of created) {
      const file=await brandingStorage.getObjectEntityFile(objectPath);
      await file.delete();
    }
  }
});
test("player image tickets require authentication, CSRF, valid sizes and owned uploads",async()=>{
  const input={kind:"logo",size:50,contentType:"image/png"};
  assert.equal((await request("/tribe-images/uploads","POST",input)).status,401);
  assert.equal((await request("/tribe-images/uploads","POST",input,OWNER,false)).status,403);
  assert.equal((await request("/tribe-images/uploads","POST",{...input,contentType:"image/svg+xml"},OWNER)).status,400);
  assert.equal((await request("/tribe-images/uploads","POST",{...input,size:6*1024*1024},OWNER)).status,400);
  assert.equal((await request("/tribe-images/publish","POST",{objectPath:"/objects/uploads/11111111-1111-1111-1111-111111111111"},OWNER)).status,400);
});

test("real player uploads survive save and reload, enforce rights, and stop serving after removal",{skip:process.env.ARKI_TEST_STORAGE!=="1"},async()=>{
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6V0AAAAASUVORK5CYII=","base64");
  const objects:string[]=[];
  let createdId:number|undefined;
  const publicImage=(url:string)=>requestFetch(base.replace(/\/api$/,"")+url);
  async function upload(kind:"logo"|"cover"|"gallery",bytes=png) {
    const ticket=await request("/tribe-images/uploads","POST",{kind,size:bytes.length,contentType:"image/png"},OWNER);
    assert.equal(ticket.status,200);objects.push(ticket.data.objectPath);
    assert.equal((await requestFetch(ticket.data.uploadURL,{method:"PUT",headers:{"Content-Type":"image/png"},body:bytes})).status,200);
    return ticket.data;
  }
  try {
    const logo=await upload("logo");
    assert.equal((await request("/tribe-images/publish","POST",{objectPath:logo.objectPath},OTHER)).status,400);
    const published=await request("/tribe-images/publish","POST",{objectPath:logo.objectPath},OWNER);
    assert.equal(published.status,200);const logoUrl=published.data.url;
    objects.push(logoUrl.slice("/api/storage".length));
    assert.equal((await publicImage(logoUrl)).status,404,"An unattached upload stays private");
    assert.equal((await request("/tribes","POST",{...profile,name:"Foreign file fixture",logoUrl},OTHER)).status,400);
    const created=await request("/tribes","POST",{...profile,name:"Player images fixture",logoUrl},OWNER);
    assert.equal(created.status,201);createdId=created.data.id;
    const image=await publicImage(logoUrl);assert.equal(image.status,200);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
    assert.equal((await request(`/tribes/${createdId}`)).data.logoUrl,logoUrl);
    await requestFetch(logo.uploadURL,{method:"PUT",headers:{"Content-Type":"image/png"},body:Buffer.alloc(png.length)});
    assert.deepEqual(Buffer.from(await (await publicImage(logoUrl)).arrayBuffer()),png,"Write URL cannot overwrite the published original");
    const photo=await upload("gallery");
    const photoPublished=await request("/tribe-images/publish","POST",{objectPath:photo.objectPath},OWNER);
    assert.equal(photoPublished.status,200);const photoUrl=photoPublished.data.url;
    objects.push(photoUrl.slice("/api/storage".length));
    assert.equal((await request(`/tribes/${createdId}/gallery`,"PUT",{urls:[logoUrl]},OWNER)).status,400,"Logo ticket cannot be reused as a gallery ticket");
    assert.equal((await request(`/tribes/${createdId}/gallery`,"PUT",{urls:[photoUrl]},OTHER)).status,403);
    assert.equal((await request(`/tribes/${createdId}/gallery`,"PUT",{urls:[photoUrl]},OWNER)).status,200);
    assert.deepEqual((await request(`/tribes/${createdId}`)).data.gallery,[photoUrl]);
    assert.equal((await publicImage(photoUrl)).status,200);
    const cover=await upload("cover");
    const coverPublished=await request("/tribe-images/publish","POST",{objectPath:cover.objectPath},OWNER);
    assert.equal(coverPublished.status,200);
    const coverUrl=coverPublished.data.url;
    objects.push(coverUrl.slice("/api/storage".length));
    assert.equal((await publicImage(coverUrl)).status,404,"Unattached cover must not be public");
    const coverProfile={...profile,name:"Player images fixture",logoUrl,coverUrl};
    assert.equal((await request(`/tribes/${createdId}`,"PATCH",coverProfile,OTHER)).status,403);
    assert.equal((await request(`/tribes/${createdId}`,"PATCH",{...coverProfile,coverUrl:photoUrl},OWNER)).status,400,"Gallery ticket cannot be used as a cover");
    assert.equal((await request(`/tribes/${createdId}`,"PATCH",coverProfile,OWNER)).status,200);
    assert.equal((await request(`/tribes/${createdId}`)).data.coverUrl,coverUrl);
    assert.equal((await publicImage(coverUrl)).status,200);
    const invalid=await upload("gallery",Buffer.alloc(png.length));
    assert.equal((await request("/tribe-images/publish","POST",{objectPath:invalid.objectPath},OWNER)).status,400);
    assert.deepEqual((await request(`/tribes/${createdId}`)).data.gallery,[photoUrl],"Invalid file leaves the saved gallery intact");
    assert.equal((await request(`/tribes/${createdId}/gallery`,"PUT",{urls:[]},OWNER)).status,200);
    assert.equal((await publicImage(photoUrl)).status,404);
    assert.equal((await request(`/tribes/${createdId}`)).data.coverUrl,coverUrl);
    assert.equal((await request(`/tribes/${createdId}`,"PATCH",{...coverProfile,coverUrl:""},OWNER)).status,200);
    assert.equal((await publicImage(coverUrl)).status,404,"Removed cover must stop serving");
    assert.equal((await request(`/tribes/${createdId}`,"PATCH",{...profile,name:"Player images fixture",logoUrl:""},OWNER)).status,200);
    assert.equal((await publicImage(logoUrl)).status,404);
  } finally {
    if (createdId) await request(`/tribes/${createdId}`,"DELETE",undefined,OWNER);
    for (const object of objects) {
      const file=await brandingStorage.getObjectEntityFile(object).catch(()=>null);
      if (file) await file.delete().catch(()=>{});
    }
  }
});

test("tribe profile and cover are independently persisted and restricted to editors",async()=>{
  const draft={...profile,name:"Independent tribe cover fixture",coverUrl:"https://example.com/cover.png"};
  const result=await request("/tribes","POST",draft,OWNER);
  assert.equal(result.status,201);
  const id=result.data.id;
  try {
    assert.equal((await request(`/tribes/${id}`)).data.coverUrl,draft.coverUrl);
    assert.equal((await request(`/tribes/${id}`,"PATCH",{...draft,coverUrl:""},OTHER)).status,403);
    assert.equal((await request(`/tribes/${id}`,"PATCH",{...draft,coverUrl:""},OWNER,false)).status,403);
    assert.equal((await request(`/tribes/${id}`,"PATCH",{...draft,coverUrl:"javascript:alert(1)"},OWNER)).status,400);
    assert.equal((await request(`/tribes/${id}`)).data.coverUrl,draft.coverUrl);
    assert.equal((await request(`/tribes/${id}`,"PATCH",{...profile,name:draft.name,logoUrl:"https://example.com/logo.png"},OWNER)).status,200);
    assert.equal((await request(`/tribes/${id}`)).data.coverUrl,draft.coverUrl,"Omitted cover must not be cleared by profile edits");
    assert.equal((await request(`/tribes/${id}/gallery`,"PUT",{urls:["https://example.com/photo.png"]},OWNER)).status,200);
    assert.equal((await request(`/tribes/${id}/gallery`,"PUT",{urls:[]},OWNER)).status,200);
    assert.equal((await request(`/tribes/${id}`)).data.coverUrl,draft.coverUrl,"Gallery must not replace or remove the cover");
    assert.equal((await request(`/tribes/${id}`,"PATCH",{...draft,logoUrl:"https://example.com/logo.png",coverUrl:""},OWNER)).status,200);
    const saved=await request(`/tribes/${id}`);
    assert.equal(saved.data.coverUrl,"");
    assert.equal(saved.data.logoUrl,"https://example.com/logo.png","Clearing cover must not clear profile image");
  } finally {await request(`/tribes/${id}`,"DELETE",undefined,OWNER);}
});

test("owner creates a persisted tribe; CSRF and duplicate names are enforced",async()=>{
  assert.equal((await request("/tribes","POST",profile,OWNER,false)).status,403);
  const result=await request("/tribes","POST",profile,OWNER);assert.equal(result.status,201);tribeId=result.data.id;
  assert.equal(result.data.canManage,true);assert.equal(result.data.members[0].userId,OWNER);
  assert.equal(result.data.recruitmentText,"Join us!");
  assert.equal((await request("/overview","GET",undefined,SITE_OWNER)).data.recruiting,1);
  assert.equal((await request("/tribes","POST",{...profile,name:"test TRIBE"},OWNER)).status,409);
  const pub=await request(`/tribes/${tribeId}`);assert.equal(pub.data.name,profile.name);assert.equal(pub.data.canEdit,false);
  assert.equal("userId" in pub.data.members[0],false);
  assert.equal((await request("/tribes?mine=true")).status,401);
  const filtered=await request("/tribes?recruiting=false");assert.deepEqual(filtered.data,[]);
  assert.equal((await request("/tribes?q=Test%20motto")).data.length,1);
});
test("complete creation is atomic and preserves members, places, gallery and progression",async()=>{
  const complete={...profile,name:"Complete draft fixture",
    members:[{userId:OWNER,name:"Owner in game",role:"Référent",manager:false},{userId:MANAGER,name:"Builder in game",role:"Builder",manager:true}],
    places:[{kind:"outpost",name:"North",map:"The Island",coords:"10,20"},{kind:"premium",name:"Premium base",map:"Premium",coords:"30,40"}],
    gallery:["https://example.com/creation.png"],
    progression:{boss:["Dragon"],pendingBoss:[],notes:[],pendingNotes:["Island notes"]}};
  const count=(await request("/overview","GET",undefined,SITE_OWNER)).data.tribes;
  const invalid=await request("/tribes","POST",{...complete,progression:{...complete.progression,pendingBoss:["Dragon"]}},OWNER);
  assert.equal(invalid.status,400);
  assert.equal((await request("/overview","GET",undefined,SITE_OWNER)).data.tribes,count,"Failed extras must roll back the profile and all child rows");
  assert.equal((await request("/tribes","POST",{...complete,members:[...complete.members,complete.members[1]]},OWNER)).status,400);
  assert.equal((await request("/tribes","POST",{...complete,members:[{userId:"1200000000000000009",name:"Bot",role:"",manager:false}]},OWNER)).status,400);
  const created=await request("/tribes","POST",complete,OWNER);
  assert.equal(created.status,201);const id=created.data.id;
  const read=(await request(`/tribes/${id}`,"GET",undefined,OWNER)).data;
  assert.equal(read.members.find((m:any)=>m.userId===OWNER).name,"Owner in game");
  assert.equal(read.members.find((m:any)=>m.userId===OWNER).manager,true,"Owner cannot lose management rights during creation");
  assert.equal(read.members.find((m:any)=>m.userId===MANAGER).manager,true);
  assert.equal(read.places.length,2);
  assert.deepEqual(read.gallery,complete.gallery);assert.deepEqual(read.progression,complete.progression);
  assert.equal((await request(`/tribes/${id}`,"GET",undefined,MANAGER)).data.canEdit,true);
  assert.equal((await request(`/tribes/${id}/members`,"PUT",{userId:"1200000000000000009",name:"Bot",role:"",manager:false},OWNER)).status,400);
  assert.equal((await request(`/tribes/${id}`,"DELETE",undefined,OWNER)).status,200);
});
test("Discord player directory is authenticated, searchable and excludes bots",async()=>{
  assert.equal((await request("/discord-players")).status,401);
  assert.equal((await request(`/discord-players?tribeId=${tribeId}`,"GET",undefined,OTHER)).status,403);
  const list=await request("/discord-players","GET",undefined,OWNER);
  assert.equal(list.status,200);assert.equal(list.data.players.length,3);assert.equal(list.data.nextAfter,null);
  assert.equal(list.data.players[0].id,OWNER);
  const result=await request("/discord-players?q=Player%201","GET",undefined,OWNER);
  assert.deepEqual(result.data.players.map((p:any)=>p.id),[MANAGER]);
  assert.equal((await request("/discord-players?after=123","GET",undefined,OWNER)).status,400);
  assert.equal((await request(`/discord-players?tribeId=${tribeId}`,"GET",undefined,OWNER)).status,200);
});

test("import provenance is exposed without private snapshot paths",async()=>{
  const db=new DatabaseSync(fixture);
  db.exec(`CREATE TABLE IF NOT EXISTS site_data_import (
    id INTEGER PRIMARY KEY,source_retrieved_at TEXT,imported_at TEXT,
    tribe_count INTEGER,member_count INTEGER,source_sha256 TEXT
  );
  INSERT OR REPLACE INTO site_data_import VALUES(1,'2026-10-02T12:00:00Z','2026-10-02T13:00:00Z',114,201,'fixture-digest');`);
  try {
    const result=await request("/options");
    assert.equal(result.status,200);
    assert.deepEqual(result.data.dataImport,{
      sourceRetrievedAt:"2026-10-02T12:00:00.000Z",importedAt:"2026-10-02T13:00:00.000Z",
      tribeCount:114,memberCount:201,
    });
    assert.equal(JSON.stringify(result.data).includes("fixture-digest"),false);
  } finally { db.exec("DROP TABLE site_data_import");db.close(); }
});

test("an unchanged legacy logo does not block profile edits; new unsafe URLs are rejected",async()=>{
  const legacy="file:///private/unavailable.png";
  const db=new DatabaseSync(fixture);
  db.prepare("UPDATE tribus SET logo_url=? WHERE id=?").run(legacy,tribeId);
  db.close();
  assert.equal((await request(`/tribes/${tribeId}`,"PATCH",{...profile,logoUrl:legacy},OWNER)).status,200);
  assert.equal((await request(`/tribes/${tribeId}`,"PATCH",{...profile,logoUrl:"file:///private/new.png"},OWNER)).status,400);
  assert.equal((await request(`/tribes/${tribeId}`,"PATCH",{...profile,logoUrl:""},OWNER)).status,200);
});

test("recovered media renders, survives unchanged edits and stops serving after removal",async()=>{
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6V0AAAAASUVORK5CYII=","base64");
  const digest=createHash("sha256").update(png).digest("hex");
  const source="https://example.com/original-logo.png",photo="https://example.com/original-photo.png";
  const url=`/api/tribes/${tribeId}/images/${digest}`;
  const db=new DatabaseSync(fixture);
  db.prepare("UPDATE tribus SET logo_url=? WHERE id=?").run(source,tribeId);
  db.prepare("INSERT INTO site_tribe_media VALUES(?,?,?,?,?,?)").run(tribeId,"logo",source,`/objects/tribe-media/${digest}`,digest,"image/png");
  const getFile=brandingStorage.getObjectEntityFile,download=brandingStorage.downloadObject;
  brandingStorage.getObjectEntityFile=(async()=>({})) as typeof getFile;
  brandingStorage.downloadObject=async()=>new Response(new Uint8Array(png),{headers:{"Content-Type":"image/png"}});
  const image=()=>requestFetch(base.replace(/\/api$/,"")+url);
  try {
    assert.equal((await request(`/tribes/${tribeId}`)).data.logoUrl,url);
    const rendered=await image();assert.equal(rendered.status,200);
    assert.equal(rendered.headers.get("content-type"),"image/png");
    assert.deepEqual(Buffer.from(await rendered.arrayBuffer()),png);
    assert.equal((await request(`/tribes/${tribeId}`,"PATCH",{...profile,logoUrl:url},OWNER)).status,200);
    assert.equal(db.prepare("SELECT logo_url FROM tribus WHERE id=?").get(tribeId)?.logo_url,source);
    assert.equal((await request(`/tribes/${tribeId}`,"PATCH",{...profile,logoUrl:""},OWNER)).status,200);
    assert.equal((await image()).status,404);
    assert.equal((await request(`/tribes/${tribeId}/gallery`,"PUT",{urls:[photo]},OWNER)).status,200);
    db.prepare("INSERT INTO site_tribe_media VALUES(?,?,?,?,?,?)").run(tribeId,"gallery",photo,`/objects/tribe-media/${digest}`,digest,"image/png");
    assert.deepEqual((await request(`/tribes/${tribeId}`)).data.gallery,[url]);
    assert.equal((await request(`/tribes/${tribeId}/gallery`,"PUT",{urls:[url]},OWNER)).status,200);
    assert.equal(db.prepare("SELECT url FROM photos_tribu WHERE tribu_id=?").get(tribeId)?.url,photo);
    assert.equal((await image()).status,200);
    assert.equal((await request(`/tribes/${tribeId}/gallery`,"PUT",{urls:[]},OWNER)).status,200);
    assert.equal((await image()).status,404);
    assert.equal((await request(`/tribes/${tribeId}/images/${"x".repeat(64)}`)).status,404);
  } finally {
    brandingStorage.getObjectEntityFile=getFile;brandingStorage.downloadObject=download;
    db.prepare("DELETE FROM site_tribe_media WHERE tribu_id=?").run(tribeId);db.close();
  }
});

test("personal tribes include ordinary members and exclude unrelated site-wide administrators",async()=>{
  assert.deepEqual((await request("/tribes?mine=true","GET",undefined,OWNER)).data.map((t:any)=>t.id),[tribeId]);
  assert.deepEqual((await request("/tribes?mine=true","GET",undefined,OTHER)).data,[]);
  const member=await request(`/tribes/${tribeId}/members`,"PUT",{userId:OTHER,name:"Ordinary member",role:"Survivant",manager:false},OWNER);
  assert.equal(member.status,200);
  const mine=await request("/tribes?mine=true","GET",undefined,OTHER);
  assert.deepEqual(mine.data.map((t:any)=>t.id),[tribeId]);
  assert.equal(mine.data[0].canEdit,false);
  assert.equal(mine.data[0].canManage,false);
  assert.deepEqual((await request("/tribes?mine=true&q=Absent","GET",undefined,OTHER)).data,[]);
  assert.deepEqual((await request("/tribes?mine=true","GET",undefined,SITE_OWNER)).data,[]);
  const publicDirectory=await request("/tribes","GET",undefined,SITE_OWNER);
  assert.equal(publicDirectory.data[0].canManage,true);
  assert.equal((await request(`/tribes/${tribeId}/members/${OTHER}`,"DELETE",undefined,OWNER)).status,200);
  assert.deepEqual((await request("/tribes?mine=true","GET",undefined,OTHER)).data,[]);
});
test("Discord callback opens the player space and rejects a mismatched OAuth state",async()=>{
  const previousId=process.env.DISCORD_CLIENT_ID,previousSecret=process.env.DISCORD_CLIENT_SECRET;
  process.env.DISCORD_CLIENT_ID="isolated-client";
  process.env.DISCORD_CLIENT_SECRET="isolated-client-fixture-not-a-real-secret";
  try {
    const start=await requestFetch(base+"/auth/discord",{redirect:"manual"});
    assert.equal(start.status,302);
    const destination=new URL(start.headers.get("location")!);
    assert.equal(destination.origin,"https://discord.com");
    const state=destination.searchParams.get("state");
    assert.ok(state);
    const stateCookie=start.headers.getSetCookie().find(value=>value.startsWith("arki_oauth_state="))!.split(";")[0];
    const invalid=await requestFetch(base+"/auth/discord/callback?code=fixture&state=invalid",{
      redirect:"manual",headers:{Cookie:stateCookie},
    });
    assert.equal(invalid.headers.get("location"),"/connexion?erreur=discord");
    assert.equal(invalid.headers.getSetCookie().some(value=>value.startsWith("arki_session=")),false);
    const callback=await requestFetch(base+"/auth/discord/callback?code=fixture&state="+encodeURIComponent(state),{
      redirect:"manual",headers:{Cookie:stateCookie},
    });
    assert.equal(callback.status,302);
    assert.equal(callback.headers.get("location"),"/mon-espace");
    const userCookie=callback.headers.getSetCookie().find(value=>value.startsWith("arki_session="))!.split(";")[0];
    const s=await requestFetch(base+"/session",{headers:{Cookie:userCookie}});
    assert.equal((await s.json()).user.id,OWNER);
    const mine=await requestFetch(base+"/tribes?mine=true",{headers:{Cookie:userCookie}});
    assert.deepEqual((await mine.json()).map((tribe:{id:number})=>tribe.id),[tribeId]);
  } finally {
    if (previousId===undefined) delete process.env.DISCORD_CLIENT_ID;else process.env.DISCORD_CLIENT_ID=previousId;
    if (previousSecret===undefined) delete process.env.DISCORD_CLIENT_SECRET;else process.env.DISCORD_CLIENT_SECRET=previousSecret;
  }
});
test("principal site owner is recognized by trusted configuration and has rights over every tribe",async()=>{
  const s=await request("/session","GET",undefined,SITE_OWNER);
  assert.equal(s.data.isOwner,true);assert.equal(s.data.isPrimaryOwner,true);assert.equal(s.data.siteRole,"owner");
  const detail=await request(`/tribes/${tribeId}`,"GET",undefined,SITE_OWNER);
  assert.equal(detail.data.canEdit,true);assert.equal(detail.data.canManage,true);
  assert.equal((await request("/site-access","PUT",{userId:SITE_OWNER,role:"admin"},SITE_OWNER)).status,403);
  assert.equal((await request(`/site-access/${SITE_OWNER}`,"DELETE",undefined,SITE_OWNER)).status,403);
});
test("co-owners receive full site rights and can delegate them, but cannot remove the principal",async()=>{
  assert.equal((await request("/site-access","PUT",{userId:COOWNER,role:"owner"},SITE_OWNER)).status,200);
  const s=await request("/session","GET",undefined,COOWNER);assert.equal(s.data.isOwner,true);assert.equal(s.data.isPrimaryOwner,false);
  assert.equal((await request(`/tribes/${tribeId}`,"GET",undefined,COOWNER)).data.canManage,true);
  assert.equal((await request(`/site-access/${SITE_OWNER}`,"DELETE",undefined,COOWNER)).status,403);
  assert.equal((await request("/site-access","PUT",{userId:OTHER,role:"owner"},COOWNER)).status,200);
  assert.equal((await request("/session","GET",undefined,OTHER)).data.isOwner,true);
  assert.equal((await request(`/site-access/${OTHER}`,"DELETE",undefined,SITE_OWNER)).status,200);
  assert.equal((await request(`/site-access/${COOWNER}`,"DELETE",undefined,SITE_OWNER)).status,200);
  assert.equal((await request("/session","GET",undefined,COOWNER)).data.isOwner,false);
  assert.equal((await request("/site-access","PUT",{userId:OTHER,role:"owner"},COOWNER)).status,403);
});
test("owner player view is reversible, request-local, and leaves ordinary tribe rights intact",async()=>{
  assert.equal((await request("/site-access","PUT",{userId:COOWNER,role:"owner"},SITE_OWNER)).status,200);
  for (const owner of [SITE_OWNER, COOWNER]) {
    const before = (await request(`/tribes/${tribeId}`, "GET", undefined, owner)).data;
    assert.equal(before.canEdit, true);
    const [preview, normal, session] = await Promise.all([
      request(`/tribes/${tribeId}`, "GET", undefined, owner, true, true),
      request(`/tribes/${tribeId}`, "GET", undefined, owner),
      request("/session", "GET", undefined, owner, true, true),
    ]);
    assert.equal(preview.status, 200);
    assert.equal(preview.data.canEdit, false);
    assert.equal(preview.data.canManage, false);
    assert.equal(normal.data.canManage, true);
    assert.equal(session.data.isOwner, false);
    assert.equal(session.data.isAdmin, false);
    assert.equal(session.data.isPrimaryOwner, false);
    assert.equal(session.data.siteRole, "member");
    assert.equal((await request("/session", "GET", undefined, owner)).data.isOwner, true);
    assert.equal((await request("/site-access", "GET", undefined, owner, true, true)).status, 403);
    assert.equal((await request("/site-mods", "GET", undefined, owner, true, true)).status, 200);
    const map = (await request("/site-maps/ragnarok")).data;
    assert.equal((await request("/site-maps/ragnarok", "PUT", map, owner, true, true)).status, 403);
    assert.equal((await request(`/tribes/${tribeId}`, "DELETE", undefined, owner, true, true)).status, 403);
    assert.equal((await request(`/tribes/${tribeId}`, "GET", undefined, owner)).data.canManage, true);
    assert.deepEqual((await request("/site-maps/ragnarok")).data, map);
  }
  // A player still has their normal rights on their own tribe, not site-wide rights.
  assert.equal((await request(`/tribes/${tribeId}`, "GET", undefined, OWNER, true, true)).data.canManage, true);
  assert.equal((await request("/session", "GET", undefined, OTHER, true, true)).data.isOwner, false);
  assert.equal((await request(`/site-access/${COOWNER}`,"DELETE",undefined,SITE_OWNER)).status,200);
});

test("non-owner cannot modify; manager can edit but cannot escalate rights or delete",async()=>{
  assert.equal((await request(`/tribes/${tribeId}`,"PATCH",profile,OTHER)).status,403);
  assert.equal((await request(`/tribes/${tribeId}/members`,"PUT",{userId:MANAGER,name:"Manager",role:"Builder",manager:true},OWNER)).status,200);
  const managed=await request(`/tribes/${tribeId}`, "GET",undefined,MANAGER);assert.equal(managed.data.canEdit,true);assert.equal(managed.data.canManage,false);
  assert.equal((await request(`/tribes/${tribeId}`,"PATCH",{...profile,name:"Renamed"},MANAGER)).status,200);
  assert.equal((await request(`/tribes/${tribeId}/members`,"PUT",{userId:OTHER,name:"Other",role:"Builder",manager:true},MANAGER)).status,403);
  assert.equal((await request(`/tribes/${tribeId}/members/${OWNER}`,"DELETE",undefined,MANAGER)).status,400);
  assert.equal((await request(`/tribes/${tribeId}`,"DELETE",undefined,MANAGER)).status,403);
});
test("places, gallery and progression persist and invalid input rolls back",async()=>{
  const first=await request(`/tribes/${tribeId}/places`,"POST",{kind:"outpost",name:"Outpost",map:"The Island",coords:"1,2"},MANAGER);
  assert.equal(first.status,201);const place=first.data.places[0];
  assert.equal((await request(`/tribes/${tribeId}/places/premium/${place.id}`,"DELETE",undefined,MANAGER)).status,404);
  assert.equal((await request(`/tribes/${tribeId}/places/outpost/${place.id}`,"DELETE",undefined,MANAGER)).status,200);
  assert.equal((await request(`/tribes/${tribeId}/gallery`,"PUT",{urls:["https://example.com/photo.png"]},MANAGER)).status,200);
  assert.equal((await request(`/tribes/${tribeId}/gallery`,"PUT",{urls:["javascript:alert(1)"]},MANAGER)).status,400);
  assert.deepEqual((await request(`/tribes/${tribeId}`)).data.gallery,["https://example.com/photo.png"]);
  assert.equal((await request(`/tribes/${tribeId}/gallery`,"PUT",{urls:Array(11).fill("https://example.com/x.png")},MANAGER)).status,400);
  const progression={boss:["Dragon"],notes:[],pendingBoss:[],pendingNotes:["Island notes"]};
  assert.equal((await request(`/tribes/${tribeId}/progression`,"PUT",progression,MANAGER)).status,200);
  assert.equal((await request(`/tribes/${tribeId}/progression`,"PUT",{...progression,pendingBoss:["Dragon"]},MANAGER)).status,400);
  assert.deepEqual((await request(`/tribes/${tribeId}`)).data.progression,progression);
});
test("admin options can be added/removed without granting normal users admin rights",async()=>{
  assert.equal((await request("/session","GET",undefined,ADMIN)).data.isAdmin,false);
  assert.equal((await request("/options","POST",{kind:"maps",name:"Test map"},ADMIN)).status,403);
  assert.equal((await request("/site-access","PUT",{userId:ADMIN,role:"admin"},OTHER)).status,403);
  assert.equal((await request("/site-access","PUT",{userId:OTHER,role:"admin"},SITE_OWNER)).status,403);
  assert.equal((await request("/site-access","PUT",{userId:ADMIN,role:"admin"},SITE_OWNER)).status,200);
  assert.equal((await request("/session","GET",undefined,ADMIN)).data.isAdmin,true);
  assert.equal((await request("/site-access","GET",undefined,ADMIN)).status,403);
  assert.equal((await request("/site-access","PUT",{userId:OTHER,role:"owner"},ADMIN)).status,403);
  assert.equal((await request("/options","POST",{kind:"maps",name:"Test map"},OTHER)).status,403);
  assert.equal((await request("/options","POST",{kind:"maps",name:"Test map"},ADMIN)).status,201);
  assert.ok((await request("/options")).data.maps.includes("Test map"));
  assert.equal((await request("/options","DELETE",{kind:"maps",name:"Test map"},ADMIN)).status,200);
  assert.equal((await request("/options","DELETE",{kind:"maps",name:"The Island"},ADMIN)).status,200);
  assert.deepEqual((await request("/options")).data.maps,[]);
});
test("manually granted admin loses site powers when their Discord role is lost",async()=>{
  const clock=Date.now;
  adminRoleActive=false;
  Date.now=()=>clock()+31000;
  try {
    assert.equal((await request("/session","GET",undefined,ADMIN)).data.isAdmin,false);
    assert.equal((await request("/options","POST",{kind:"maps",name:"Forbidden"},ADMIN)).status,403);
    const list=await request("/site-access","GET",undefined,SITE_OWNER);
    assert.equal(list.data.find((g:{userId:string})=>g.userId===ADMIN).eligible,false);
    assert.equal((await request(`/site-access/${ADMIN}`,"DELETE",undefined,SITE_OWNER)).status,200);
  } finally {Date.now=clock;adminRoleActive=true;}
});
test("transfer removes former owner's rights; deleting cascades only the selected tribe",async()=>{
  assert.equal((await request(`/tribes/${tribeId}/owner`,"PUT",{userId:MANAGER},MANAGER)).status,403);
  const transferred=await request(`/tribes/${tribeId}/owner`,"PUT",{userId:MANAGER},OWNER);assert.equal(transferred.status,200);assert.equal(transferred.data.canEdit,false);
  assert.equal((await request(`/tribes/${tribeId}`,"PATCH",profile,OWNER)).status,403);
  assert.equal((await request(`/tribes/${tribeId}`,"DELETE",undefined,MANAGER)).status,200);
  assert.equal((await request(`/tribes/${tribeId}`)).status,404);
  assert.equal((await request("/overview","GET",undefined,SITE_OWNER)).data.tribes,0);
});