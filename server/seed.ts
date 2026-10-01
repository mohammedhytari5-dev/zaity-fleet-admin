import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { settingCatalog } from "../drizzle/schema";

const defaults = [
  ["car_companies", "toyota", "تويوتا"], ["car_companies", "hyundai", "هيونداي"], ["car_companies", "ford", "فورد"],
  ["car_models", "camry", "كامري"], ["car_models", "sonata", "سوناتا"], ["car_models", "rav4", "راف فور"],
  ["colors", "white", "أبيض"], ["colors", "black", "أسود"], ["colors", "gray", "رمادي"],
  ["license_types", "private", "خصوصي"], ["license_types", "light_transport", "نقل خفيف"], ["license_types", "heavy_transport", "نقل ثقيل"],
  ["pm", "periodic", "صيانة دورية"], ["pm", "pre_delivery", "فحص ما قبل التسليم"], ["pm", "tires", "تغيير إطارات"],
  ["attachment_names", "registration", "بطاقة تسجيل السيارة"], ["attachment_names", "insurance", "تأمين السيارة"], ["attachment_names", "license", "رخصة القيادة"],
  ["payment_methods", "bank_transfer", "تحويل بنكي"], ["payment_methods", "cash", "نقدي"], ["payment_methods", "card", "بطاقة"],
] as const;

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required to seed reference settings");
  let inserted = 0;
  for (const [category, key, label] of defaults) {
    const existing = await db.select({ id: settingCatalog.id }).from(settingCatalog)
      .where(and(eq(settingCatalog.category, category), eq(settingCatalog.key, key))).limit(1);
    if (!existing.length) {
      await db.insert(settingCatalog).values({ category, key, label, value: label, active: 1 });
      inserted += 1;
    }
  }
  console.log(`Reference settings ready. Inserted ${inserted} missing values.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
