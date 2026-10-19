import { Html, Head, Preview, Body, Container, Section, Text } from "@react-email/components";
import EmailHeader from "./components/EmailHeader";
import EmailFooter from "./components/EmailFooter";

// These three change on every send, so they come in as props.
// The backend generates the OTP and passes it in. Never hardcode it here.
type OtpEmailProps = {
  studentName?: string;
  otp?: string;
  expiresInMinutes?: number;
};

export default function OtpEmail({
  studentName = "[Student Name]",
  otp = "000000",
  expiresInMinutes = 10,
}: OtpEmailProps) {
  return (
    <Html lang="en">
      <Head />
      {/* The grey snippet shown next to the subject line in the inbox.
          It doesn't appear inside the email body. */}
      <Preview>{`Your Quant verification code is ${otp}`}</Preview>

      <Body style={body}>
        {/* Container caps the width at 600px, the standard safe width for email */}
        <Container style={container}>
          {/* Same header as the Welcome email. Only the icon and copy change. */}
          <EmailHeader
            icon="lock.png"
            iconAlt="Lock"
            title="OTP Request"
            subtitle="Here's your OTP!"
          />

          <Section style={content}>
            <Text style={text}>Dear {studentName},</Text>

            <Text style={text}>Here's your One Time Password (OTP)</Text>

            {/* Big centered code, as in the design. letterSpacing spreads the
                digits out so they're easy to read and copy. */}
            <Text style={code}>{otp}</Text>

            {/* expiresInMinutes is a prop so the email can never say "10 minutes"
                while the backend actually expires the code after 5. */}
            <Text style={text}>
              This code expires in {expiresInMinutes} minutes for security reasons.
            </Text>

            <Text style={text}>
              If you didn't request this, please ignore this message.
            </Text>

            {/* <br /> keeps "Kind Regards" and "Quant Team." on separate lines
                inside one paragraph */}
            <Text style={text}>
              Kind Regards
              <br />
              Quant Team.
            </Text>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

// Sample data for the preview server only. It has no effect when the email is sent.
OtpEmail.PreviewProps = {
  studentName: "Ahmad",
  otp: "682892",
  expiresInMinutes: 10,
} satisfies OtpEmailProps;

// Styles are plain objects because react-email inlines them into the HTML.
// Email clients strip <style> blocks and don't understand Tailwind classes.
const body = {
  backgroundColor: "#ffffff",
  fontFamily: "Arial, Helvetica, sans-serif", // email-safe fallback until we confirm the real font
  margin: "0",
};

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "32px 24px",
};

const content = {
  padding: "48px 8px 32px",
};

const text = {
  color: "#212121",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const code = {
  // One tap/click selects the whole code, ready to copy (Apple Mail, iOS, most webmail).
  userSelect: "all" as const,
  WebkitUserSelect: "all" as const,
  color: "#212121",
  fontSize: "32px",
  letterSpacing: "4px",
  textAlign: "center" as const,
  margin: "24px 0",
};