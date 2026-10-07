import { pgTable, text, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const communityGuides = pgTable("site_guides", {
  id: text("id").primaryKey(), title: text("title").notNull(), content: text("content").notNull(),
  authorId: text("author_id").notNull(), authorName: text("author_name").notNull(),
  images: jsonb("images").notNull(), messages: jsonb("messages").notNull(),
  mediaPaths: text("media_paths").array().notNull(),
  sourceUrl: text("source_url").notNull(), source: text("source").notNull(),
  starterMissing: boolean("starter_missing").notNull(),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
  revision: integer("revision").notNull(), deletedAt: text("deleted_at"),
});
export const guideUploads = pgTable("site_guide_uploads", {
  objectPath: text("object_path").primaryKey(), actorId: text("actor_id").notNull(),
  size: integer("size").notNull(), contentType: text("content_type").notNull(),
  createdAt: text("created_at").notNull(), publishedPath: text("published_path"),
});