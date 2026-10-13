/**
 * Dev helper: prints a Flutterwave checkout link for a student, without going
 * through WhatsApp. Paying it runs the real flow — webhook → verify → credit.
 *
 *   npm run topup:link -- <phone|email> [amountNGN]
 *   npm run topup:link -- +2348012345678 1000
 */
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { Student } from "../models/Student";
import { createTopupLink, TOPUP_AMOUNTS_NGN } from "../services/quantService";

async function main() {
  const [who, amountArg] = process.argv.slice(2);
  const amount = Number(amountArg ?? 1000);

  if (!who) {
    console.error("Usage: npm run topup:link -- <phone|email> [amountNGN]");
    process.exit(1);
  }
  if (!(TOPUP_AMOUNTS_NGN as readonly number[]).includes(amount)) {
    console.error(`Amount must be one of: ${TOPUP_AMOUNTS_NGN.join(", ")}`);
    process.exit(1);
  }

  await connectDB();
  const student = await Student.findOne({
    $or: [{ phone: who }, { email: who.toLowerCase() }],
  });
  if (!student) {
    console.error(`No student with phone/email "${who}"`);
    process.exit(1);
  }

  const link = await createTopupLink(student, amount);
  console.log(`\n${student.fullName} — current balance ${student.quants} quants`);
  console.log(`Pay ₦${amount} for ${amount} quants:\n\n${link}\n`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
