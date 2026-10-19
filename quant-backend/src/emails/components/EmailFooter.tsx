import { Section, Img, Link, Text, Row, Column } from "@react-email/components";

import { assetUrl } from "./assets";

// One array drives all three icons, so adding or removing a social later is a one-line change.
// Order matches the Figma: X, Instagram, LinkedIn.
const socials = [
  { name: "X", href: "https://x.com/getquant_app", icon: "icon-x.png" },
  { name: "Instagram", href: "https://www.instagram.com/getquant.app", icon: "icon-instagram.png" },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/getquant-app/", icon: "icon-linkedin.png" },
];

export default function EmailFooter() {
  return (
    // Section renders as a table under the hood, which is what email clients need.
    // The light blue bg and centered text match the footer block in the design.
    <Section style={footer}>
      <Img
        src={assetUrl("quant-logo.png")}
        alt="Quant"
        width="120"
        style={{ margin: "0 auto" }}
      />

      {/* Row + Column is the email-safe way to put the icons side by side.
          Flexbox is unreliable in Outlook. width "auto" lets the row shrink to fit
          and the auto margins center it. */}
      <Row style={{ width: "auto", margin: "24px auto 0" }}>
        {socials.map((social) => (
          <Column key={social.name} style={{ padding: "0 10px" }}>
            <Link href={social.href}>
              <Img src={assetUrl(social.icon)} alt={social.name} width="24" height="24" />
            </Link>
          </Column>
        ))}
      </Row>

      {/* getFullYear() keeps "© 2026" from going stale next year */}
      <Text style={copyright}>
        © {new Date().getFullYear()} Quant App. All rights reserved.
      </Text>
    </Section>
  );
}

// Styles are plain objects because react-email inlines them into the HTML.
// Email clients strip <style> blocks, and Tailwind classes won't survive.
const footer = {
  backgroundColor: "#E8F2FF", // eyeballed from the screenshot, so replace with the exact hex from Figma
  padding: "40px 24px",
  textAlign: "center" as const,
  borderRadius: "8px",
};

const copyright = {
  color: "#9f9f9f",
  fontSize: "12px",
  margin: "24px 0 0",
};