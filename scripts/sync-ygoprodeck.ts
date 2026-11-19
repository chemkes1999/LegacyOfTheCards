import fs from 'fs';
import path from 'path';
import { CURATED_YGO_MANIFEST } from '../src/data/ygoprodeckManifest';
import { mapYgoCardToDefinition, YgoApiCard } from '../src/services/ygoprodeckAdapter';
import { CardDefinition } from '../src/types/tcg';

const API_BASE = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const PUBLIC_CARDS_DIR = path.resolve(process.cwd(), 'public/cards');
const OUTPUT_JSON_PATH = path.resolve(process.cwd(), 'src/data/ygoprodeckCards.json');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    return true;
  }
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  [warn] Failed to download ${url} (HTTP ${res.status})`);
    return false;
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
  return true;
}

async function main() {
  fs.mkdirSync(PUBLIC_CARDS_DIR, { recursive: true });

  const ids = CURATED_YGO_MANIFEST.map((c) => c.ygoprodeckId).join(',');
  const url = `${API_BASE}?id=${ids}`;
  console.log(`Fetching ${CURATED_YGO_MANIFEST.length} curated cards from YGOPRODeck API...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YGOPRODeck API request failed: HTTP ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: YgoApiCard[] };
  const rawList = json.data ?? [];
  const rawById = new Map<number, YgoApiCard>();
  for (const item of rawList) {
    rawById.set(item.id, item);
  }

  const definitions: CardDefinition[] = [];
  let downloaded = 0;

  for (const spec of CURATED_YGO_MANIFEST) {
    const raw = rawById.get(spec.ygoprodeckId);
    if (!raw) {
      console.warn(`  [warn] Missing card ID ${spec.ygoprodeckId} (${spec.nameEs}) in API response`);
      continue;
    }

    const remoteArtUrl =
      raw.card_images?.[0]?.image_url_cropped ??
      raw.card_images?.[0]?.image_url_small ??
      raw.card_images?.[0]?.image_url;

    let localImagePath: string | undefined;
    if (remoteArtUrl) {
      const filename = `${spec.ygoprodeckId}.jpg`;
      const destPath = path.join(PUBLIC_CARDS_DIR, filename);
      const ok = await downloadImage(remoteArtUrl, destPath);
      if (ok) {
        localImagePath = `/cards/${filename}`;
        downloaded++;
      }
      await sleep(120);
    }

    definitions.push(
      mapYgoCardToDefinition(raw, {
        internalId: spec.internalId,
        nameOverride: spec.nameEs,
        descriptionOverride: spec.descriptionEs,
        rarity: spec.rarity,
        localImagePath,
        effects: spec.effects,
      })
    );
  }

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(definitions, null, 2) + '\n', 'utf-8');
  console.log(
    `Done! Saved ${definitions.length} cards to ${path.relative(process.cwd(), OUTPUT_JSON_PATH)} and cached ${downloaded} images in public/cards/.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
