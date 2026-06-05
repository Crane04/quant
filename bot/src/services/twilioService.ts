import twilio from "twilio";
import { IDocument } from "../models/Document";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_NUMBER as string;

export const sendText = async (to: string, body: string): Promise<void> => {
  await client.messages.create({ from: FROM, to, body });
};

export const sendPDF = async (
  to: string,
  doc: IDocument
): Promise<void> => {
  // Send a text first so the student knows what's coming
  await sendText(to, `📤 Sending *${doc.title}*\nCourse: *${doc.courseCode}*`);

  // Send the actual PDF via Cloudinary URL
  await client.messages.create({
    from: FROM,
    to,
    body: `📄 *${doc.title}*`,
    mediaUrl: [doc.cloudinaryUrl],
  });
};
