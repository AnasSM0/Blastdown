/* eslint-disable import/first */
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockShowPrivacyOptions = jest.fn(async () => "shown" as const);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => true,
    replace: jest.fn(),
  }),
}));

jest.mock("../../src/hooks/useEffectiveReducedMotion", () => ({
  useEffectiveReducedMotion: () => false,
}));

jest.mock("../../src/services/ads", () => ({
  useAdService: () => ({ showPrivacyOptions: mockShowPrivacyOptions }),
}));

import PrivacyScreen from "../../app/privacy";

describe("privacy and consent surface", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockShowPrivacyOptions.mockClear();
  });

  it("shows accurate local/ad disclosures and delegates choices to UMP", async () => {
    const result = await render(<PrivacyScreen />);

    expect(result.getByText("ON THIS DEVICE")).toBeTruthy();
    expect(result.getByText("REWARDED ADS")).toBeTruthy();

    await fireEvent.press(result.getByTestId("privacy-options-button"));
    await waitFor(() => expect(mockShowPrivacyOptions).toHaveBeenCalledTimes(1));
    expect(result.getByText("Advertising privacy choices were updated.")).toBeTruthy();
  });

  it("returns through the router", async () => {
    const result = await render(<PrivacyScreen />);

    await fireEvent.press(result.getByTestId("privacy-back-button"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
