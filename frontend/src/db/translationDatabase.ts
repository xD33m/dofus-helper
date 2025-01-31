import Dexie, { Table } from "dexie";
import trans from "../assets/de-fr.i18n.json";

const translations = trans as TranslationJSON;

export interface TranslationJSON {
  entries: {
    [id: string]: {
      fr: string;
      de: string;
      icon: number;
    };
  };
  languages: string[];
}
export interface TranslationEntry {
  id?: string;
  fr: string;
  de: string;
  icon: number;
}

class TranslationDB extends Dexie {
  public translations!: Table<TranslationEntry, string>;

  constructor() {
    super("TranslationDB");

    this.version(1).stores({
      translations: "id, fr, de, icon",
    });
  }
}

export const db = new TranslationDB();

// A function to load the JSON into the DB
export async function initializeDB() {
  const combinedEntries: TranslationEntry[] = Object.entries(translations.entries).map(
    ([id, entry]: [string, any]) => ({
      id,
      fr: entry.fr,
      de: entry.de,
      icon: entry.icon,
    })
  );

  await db.translations.clear();

  await db.translations.bulkPut(combinedEntries);
}

export async function searchFrench(term: string): Promise<TranslationEntry[]> {
  return db.translations
    .filter((item) => item.fr.toLowerCase().includes(term.toLowerCase().trim()))
    .toArray();
}

// that's faster
export async function prefixSearchFrench(term: string): Promise<TranslationEntry[]> {
  return db.translations.where("fr").startsWithIgnoreCase(term.trim()).toArray();
}
