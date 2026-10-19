import { Column, Img, Row, Section, Text } from "@react-email/components";
import { assetUrl } from "./assets";

type EmailHeaderProps = {
  icon: string;
  iconAlt: string;
  title: string;
  subtitle: string;
};

export default function EmailHeader({ icon, iconAlt, title, subtitle }: EmailHeaderProps) {
  return (
    <Section>
      <Img
        src={assetUrl("quant-logo.png")}
        alt="Quant"
        width="120"
        style={{ margin: "0 auto" }}
      />
      <Row style={{ marginTop: "32px" }}>
        <Column align="left" style={{ width: "110px", verticalAlign: "top" }}>
          <Img src={assetUrl("cube-left.png")} alt="" width="96" />
        </Column>
        <Column align="center" style={{ verticalAlign: "top", paddingTop: "40px" }}>
          <Img
            src={assetUrl(icon)}
            alt={iconAlt}
            width="48"
            style={{ margin: "0 auto" }}
          />
          <Text style={titleStyle}>{title}</Text>
          <Text style={subtitleStyle}>{subtitle}</Text>
        </Column>
        <Column align="right" style={{ width: "110px", verticalAlign: "top" }}>
          <Img
            src={assetUrl("cube-right.png")}
            alt=""
            width="96"
            style={{ marginLeft: "auto" }}
          />
        </Column>
      </Row>
    </Section>
  );
}

const titleStyle = {
  color: "#212121",
  fontSize: "24px",
  fontWeight: 700,
  margin: "12px 0 4px",
};

const subtitleStyle = {
  color: "#212121",
  fontSize: "14px",
  margin: "0",
};
