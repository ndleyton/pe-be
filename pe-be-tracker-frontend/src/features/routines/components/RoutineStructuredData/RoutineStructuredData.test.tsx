import { render } from "@/test/testUtils";

import { RoutineStructuredData } from "./RoutineStructuredData";

describe("RoutineStructuredData", () => {
  it("renders a JSON-LD script tag", () => {
    const { container } = render(
      <RoutineStructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "ExercisePlan",
          name: "Test Routine",
        }}
      />,
    );

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );

    expect(script).not.toBeNull();
    expect(script).toHaveAttribute("type", "application/ld+json");
    expect(script).toHaveTextContent('"@type":"ExercisePlan"');
  });

  it("renders nothing when data is null", () => {
    const { container } = render(<RoutineStructuredData data={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("escapes HTML-sensitive characters in the JSON-LD payload", () => {
    const { container } = render(
      <RoutineStructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "ExercisePlan",
          name: "Routine </script><script>alert(1)</script>",
        }}
      />,
    );

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );

    expect(script).not.toBeNull();
    expect(script).toHaveTextContent("\\u003c/script\\u003e");
    expect(script).not.toHaveTextContent("</script><script>");
  });
});
