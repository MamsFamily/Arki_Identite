import { pgTable, text, integer } from "drizzle-orm/pg-core";
export const mapCartography=pgTable("site_map_cartography",{
  slug:text("slug").primaryKey(),image:text("image").notNull(),
  revision:integer("revision").notNull(),
});