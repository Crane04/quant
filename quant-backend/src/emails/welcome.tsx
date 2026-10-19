import { Html, Head, Preview, Body, Container, Section, Text } from "@react-email/components";
import EmailHeader from "./components/EmailHeader";
import EmailFooter from "./components/EmailFooter";

// The student's name is a prop, so your backend passes the real name when it sends.
type WelcomeEmailProps = {
  studentName?: string;
};

export default function WelcomeEmail({ studentName = "[Student Name]" }: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      {/* Preview is the grey snippet shown next to the subject line in the inbox. It's invisible inside the email itself. */}
      <Preview>Your Quant account is ready. The journey begins here!</Preview>

      <Body style={body}>
        {/* Container caps the width at 600px, the standard safe width for email */}
        <Container style={container}>
          <EmailHeader
            icon="party-popper.png"
            iconAlt="Celebration"
            title="Welcome on board!"
            subtitle="The journey begins here!"
          />

          <Section style={content}>
            <Text style={text}>Dear {studentName},</Text>

            {/* Bold paragraph, same as the design. Spread the base style, then override the weight. */}
            <Text style={{ ...text, fontWeight: 700 }}>
              Your Quant account is ready. You can now manage your academics directly through WhatsApp 🎉.
            </Text>

            <Text style={text}>
              You can text the assistant to get all academic informations or materials anytime anywhere.
            </Text>

            {/* <br /> keeps "Kind Regards" and "Quant Team." on separate lines inside one paragraph */}
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

// react-email's preview server reads PreviewProps to fill in sample data.
// This is only for the preview and has no effect when sending.
WelcomeEmail.PreviewProps = {
  studentName: "Ahmad",
} satisfies WelcomeEmailProps;

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