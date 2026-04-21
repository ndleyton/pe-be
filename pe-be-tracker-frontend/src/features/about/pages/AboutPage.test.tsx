import { render, screen } from "@/test/testUtils";
import AboutPage from "./AboutPage";

describe("AboutPage", () => {
  it("renders a link back to PersonalBestie", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("link", { name: /back to personalbestie/i }),
    ).toHaveAttribute("href", "/");
  });

  it("renders the about heading", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("heading", { name: /^about$/i }),
    ).toBeInTheDocument();
  });
});
