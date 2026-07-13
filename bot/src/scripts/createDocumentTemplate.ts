import "dotenv/config";
import twilio from "twilio";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
};

const run = async (): Promise<void> => {
  const client = twilio(
    requireEnv("TWILIO_ACCOUNT_SID"),
    requireEnv("TWILIO_AUTH_TOKEN"),
  );
  const baseUrl = requireEnv("APP_BASE_URL");

  const content = await client.content.v1.contents.create({
    friendlyName: "quant_document_view",
    language: "en",
    variables: { "1": "GEG 101", "2": "Intro to Engineering", "3": "000000000000000000000000" },
    types: {
      "twilio/call-to-action": {
        body: "*{{1}} - {{2}}*\n\nTap below to view it instantly.",
        actions: [
          {
            type: "URL",
            title: "View Document",
            url: `${baseUrl}/view/{{3}}`,
          },
        ],
      },
    },
  } as unknown as Parameters<typeof client.content.v1.contents.create>[0]);

  console.log("Content template created.");
  console.log(`ContentSid: ${content.sid}`);
  console.log("\nAdd this to your .env:");
  console.log(`TWILIO_DOCUMENT_CONTENT_SID=${content.sid}`);
};

run().catch((err) => {
  console.error("Failed to create content template:", err.message || err);
  process.exit(1);
});
