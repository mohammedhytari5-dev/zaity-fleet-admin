import { createLocalUser, getUserByUsername, listUsers } from "./db";

async function main() {
  const users = await listUsers();
  if (!users) throw new Error("DATABASE_URL is required to bootstrap the preview administrator");
  if (users.some(user => user.role === "admin" && user.isActive === 1)) {
    console.log("An active administrator already exists; bootstrap skipped.");
    return;
  }

  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "مدير بيئة الاختبار";
  if (!username || !password) {
    throw new Error("Set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD for the initial preview admin.");
  }
  if (await getUserByUsername(username)) {
    throw new Error("Bootstrap username exists but is not an active administrator; choose another username.");
  }
  const admin = await createLocalUser({ username, password, name, role: "admin" });
  if (!admin) throw new Error("Could not create the preview administrator.");
  console.log(`Created the initial preview administrator: ${username}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
