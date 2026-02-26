-- Create skin catalog table
CREATE TABLE "ww_skin_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_coins" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ww_skin_catalog_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "ww_skin_catalog_is_active_sort_order_idx" ON "ww_skin_catalog"("is_active", "sort_order");

-- Seed default skins
INSERT INTO "ww_skin_catalog" ("id", "name", "description", "price_coins", "sort_order")
VALUES
    ('ember', 'Ember', 'A fiery frame with warm highlights.', 10, 10),
    ('frost', 'Frost', 'A cool blue frame with icy glow.', 20, 20),
    ('neon', 'Neon', 'A neon green frame for high-contrast rivals.', 30, 30),
    ('aurora', 'Aurora Flux', 'Animated northern lights rolling across your rank card.', 45, 40),
    ('plasma', 'Plasma Core', 'Electric magenta-blue plasma with a live pulse.', 55, 50),
    ('synthwave', 'Synthwave', 'Retro sunset stripes with subtle scanline motion.', 65, 60),
    ('crimson', 'Crimson Dominion', 'Royal maroon gradient with molten ruby highlights and battle-ready aura.', 70, 70),
    ('void', 'Event Horizon', 'Deep space skin with drifting starfield glow.', 80, 80),
    ('hologram', 'Hologram', 'Iridescent prism gradient with rotating light sweep.', 95, 90),
    ('gold', 'Gold Supreme', 'The final flex: animated molten gold for top-tier champions.', 100, 100)
ON CONFLICT ("id") DO NOTHING;

-- Normalize old data to satisfy new foreign keys
DO $$
BEGIN
  IF to_regclass('public.ww_user') IS NOT NULL THEN
    UPDATE "ww_user"
    SET "equipped_skin_id" = NULL
    WHERE "equipped_skin_id" IS NOT NULL
      AND "equipped_skin_id" NOT IN (SELECT "id" FROM "ww_skin_catalog");
  END IF;

  IF to_regclass('public.ww_user_skin') IS NOT NULL THEN
    DELETE FROM "ww_user_skin"
    WHERE "skin_id" NOT IN (SELECT "id" FROM "ww_skin_catalog");
  END IF;
END $$;

-- Add foreign keys
ALTER TABLE IF EXISTS "ww_user"
ADD CONSTRAINT "ww_user_equipped_skin_id_fkey"
FOREIGN KEY ("equipped_skin_id") REFERENCES "ww_skin_catalog"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE IF EXISTS "ww_user_skin"
ADD CONSTRAINT "ww_user_skin_skin_id_fkey"
FOREIGN KEY ("skin_id") REFERENCES "ww_skin_catalog"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
