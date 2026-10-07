import { pgTable, serial, text, integer, primaryKey } from "drizzle-orm/pg-core";

export const dinoSpecies = pgTable("site_dino_species", {
  id: serial("id").primaryKey(), name: text("name").notNull().unique(),
  origin: text("origin").notNull(), modId: integer("mod_id"),
  maps: text("maps").notNull(), sourceUrl: text("source_url").notNull(),
  active: integer("active").notNull(), revision: integer("revision").notNull().default(1),
});
export const dinoRecords = pgTable("site_dino_records", {
  tribeId: integer("tribe_id").notNull(), tribeKey: text("tribe_key").notNull(),
  speciesId: integer("species_id").notNull().references(() => dinoSpecies.id),
  stats: text("stats").notNull(), revision: integer("revision").notNull(),
  note: text("note").notNull(), source: text("source").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({columns:[t.tribeKey,t.speciesId]})]);
export const dinoHistory = pgTable("site_dino_history", {
  id: serial("id").primaryKey(), tribeKey: text("tribe_key").notNull(),
  tribeId: integer("tribe_id").notNull(), speciesId: integer("species_id").notNull().references(() => dinoSpecies.id),
  action: text("action").notNull(), beforeStats: text("before_stats"), afterStats: text("after_stats"),
  actor: text("actor").notNull(), createdAt: text("created_at").notNull(),
});