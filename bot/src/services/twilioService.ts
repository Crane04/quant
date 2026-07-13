import twilio from "twilio";
import { IDocument } from "../models/Document";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

const FROM = process.env.TWILIO_WHATSAPP_NUMBER as string;
const DOCUMENT_CONTENT_SID = process.env.TWILIO_DOCUMENT_CONTENT_SID as string;

const assertTwilioConfig = (): void => {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !FROM
  ) {
    throw new Error(
      "Missing Twilio config. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER.",
    );
  }
};

export const sendText = async (to: string, body: string): Promise<void> => {
  assertTwilioConfig();
  await client.messages.create({ from: FROM, to, body });
};

export const sendPDF = async (to: string, doc: IDocument): Promise<void> => {
  assertTwilioConfig();

  if (!DOCUMENT_CONTENT_SID) {
    throw new Error(
      "Missing TWILIO_DOCUMENT_CONTENT_SID. Run `npm run create:document-template` once and add the printed ContentSid to .env.",
    );
  }

  await client.messages.create({
    from: FROM,
    to,
    contentSid: DOCUMENT_CONTENT_SID,
    contentVariables: JSON.stringify({
      "1": doc.courseCode,
      "2": doc.title,
      "3": doc.id,
    }),
  });
};
