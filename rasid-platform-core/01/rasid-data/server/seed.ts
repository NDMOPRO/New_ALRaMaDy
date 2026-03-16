/**
 * Seed script — initializes the admin root account
 * Run: npx tsx server/seed.ts
 */
import { getDb, getUserByUserId, saveDb } from "./localDb";
import { hashPassword } from "./localAuth";

export async function seedAdminAccount() {
  const db = await getDb();

  // Check if admin already exists
  const existing = await getUserByUserId("mruhaily");
  if (existing) {
    console.log("[Seed] Admin account already exists, skipping...");
    return;
  }

  const passwordHash = await hashPassword("15001500");

  db.run(
    `INSERT INTO users (userId, passwordHash, displayName, email, mobile, role, department, status, permissions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "mruhaily",
      passwordHash,
      "محمد الرحيلي  - عقل راصد الذكي",
      "prog.muhammed@gmail.com",
      "+966553445533",
      "admin",
      "إدارة المنصة",
      "active",
      JSON.stringify([
        "manage_users", "manage_content", "manage_roles", "view_analytics",
        "manage_settings", "manage_data", "create_reports", "approve_content",
        "manage_system", "full_access"
      ]),
    ]
  );

  saveDb();
  console.log("[Seed] ✅ Admin root account created: mruhaily");
}

// Auto-run when called directly
seedAdminAccount().catch(console.error);
