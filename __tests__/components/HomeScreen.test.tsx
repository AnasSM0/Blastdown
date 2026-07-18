import { render } from "@testing-library/react-native";

import HomeScreen from "../../app/index";

describe("HomeScreen", () => {
  it("renders the logo and a Play link", async () => {
    const result = await render(<HomeScreen />);

    expect(result.getByText("BlastDown")).toBeTruthy();
    expect(result.getByTestId("play-button")).toBeTruthy();
  });
});
