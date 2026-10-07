import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { objectStorageClient, ObjectStorageService } from "../lib/objectStorage";
import { sourceMediaType } from "../lib/guide-source-media";

// Read-only Discord scan -> durable media -> bundled seed. Never writes to Discord.
const scan = JSON.parse(readFileSync(process.argv[2] || "/tmp/discord-guides-scan.json","utf8"));
if (scan.channelId!=="1391888422964170792") throw new Error("Unexpected guide source channel.");
const storage = new ObjectStorageService();
const directory = storage.getPrivateObjectDir().replace(/^\/+/,"");
const slash = directory.indexOf("/");
if (slash<1) throw new Error("Guide media storage is not configured.");
const bucket = objectStorageClient.bucket(directory.slice(0,slash));
const prefix = directory.slice(slash+1);
const users = new Map<string,string>();
for (const r of scan.records) for (const m of r.messages)
  users.set(m.author.id,m.author.global_name || m.author.username);
// Prefer current server display names when available; retain the recorded Discord
// name for a former/deleted member. No names are fabricated.
let formerMembers=0;
for (const id of users.keys()) {
  const response = await fetch(`https://discord.com/api/v10/guilds/${scan.guildId}/members/${id}`,{
    headers:{Authorization:`Bot ${process.env.DISCORD_TOKEN}`},signal:AbortSignal.timeout(15000),
  });
  if (response.status===404) {formerMembers++;continue;}
  if (!response.ok) throw new Error(`Discord member lookup failed: ${response.status}`);
  const member = await response.json() as any;
  users.set(id,member.nick || member.user.global_name || member.user.username);
  await new Promise(r => setTimeout(r,250));
}
const saved = new Map<string,string>();
const mediaTypes = new Map<string,string>();
let files=0,bytesSaved=0,changedEncodings=0;
async function asset(url: string, contentType: string, expectedSize?: number, dimensions?: {width?:number;height?:number}) {
  const parsed = new URL(url);
  if (parsed.protocol!=="https:" || !["cdn.discordapp.com","media.discordapp.net","images-ext-1.discordapp.net","images-ext-2.discordapp.net"].includes(parsed.hostname))
    throw new Error("Untrusted media origin; guide import stopped.");
  if (saved.has(url)) return saved.get(url)!;
  const response = await fetch(url,{signal:AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error(`Source media unavailable (${response.status}); nothing was omitted.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const mime = sourceMediaType(bytes,{...dimensions,contentType});
  if (expectedSize!==undefined && bytes.length!==expectedSize) {
    if (!mime.startsWith("image/")) throw new Error("Source video size mismatch.");
    changedEncodings++;
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  const file = bucket.file(`${prefix}/guide-media/${digest}`);
  try {await file.save(bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:mime}});}
  catch(e:any) {if (Number(e.code)!==412) throw new Error("Durable guide media storage failed.");}
  const [meta] = await file.getMetadata();
  if (Number(meta.size)!==bytes.length) throw new Error("Stored guide media size mismatch.");
  const path = `/api/storage/objects/guide-media/${digest}`;
  saved.set(url,path);files++;bytesSaved+=bytes.length;
  mediaTypes.set(url,mime);
  return path;
}
const guides: any[] = [];
for (const r of scan.records) {
  const messages:any[] = [];
  for (const m of r.messages) {
    const media:any[] = [],embeds:any[] = [];
    for (const a of m.attachments || []) {
      const url = await asset(a.url,a.content_type || "",a.size,{width:a.width,height:a.height});
      media.push({url,name:a.filename,contentType:mediaTypes.get(a.url)!});
    }
    for (const e of m.embeds || []) {
      const photo = e.image || e.thumbnail;
      const image = photo ? await asset(photo.proxy_url || photo.url,"") : "";
      embeds.push({title:e.title || "",description:e.description || "",url:e.url || "",image,
        fields:(e.fields || []).map((f:any) => ({name:f.name,value:f.value}))});
    }
    messages.push({id:m.id,authorId:m.author.id,authorName:users.get(m.author.id)!,content:m.content || "",
      createdAt:m.timestamp,media,embeds,system:m.type!==0});
  }
  const ownerId = r.thread.owner_id;
  if (!users.has(ownerId)) throw new Error("Creator attribution missing; import stopped.");
  const createdAt = new Date(Number((BigInt(r.thread.id)>>22n)+1420070400000n)).toISOString();
  guides.push({id:r.thread.id,title:r.thread.name,content:"",authorId:ownerId,authorName:users.get(ownerId),
    images:[],messages,sourceUrl:`https://discord.com/channels/${scan.guildId}/${r.thread.id}`,source:"discord",
    createdAt,updatedAt:messages.at(-1)?.createdAt || createdAt,revision:1,canEdit:false,
    starterMissing:!messages.some(m => m.id===r.thread.id)});
}
// The seed contains only stable site media URLs, never signed Discord attachment URLs.
writeFileSync(process.argv[3] || "src/data/discord-guides.json",JSON.stringify(guides,null,2)+"\n");
console.log(JSON.stringify({guides:guides.length,messages:guides.reduce((n,g)=>n+g.messages.length,0),files,bytesSaved,
  formerMembers,changedEncodings,missingOpeningMessages:guides.filter(g=>g.starterMissing).length}));