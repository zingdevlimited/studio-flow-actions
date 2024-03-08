import twilio from "twilio";
import { commands } from "./commands";

export const getTwilioClient = () => {
  const apiKey = commands.getInput("TWILIO_API_KEY");
  const apiSecret = commands.getInput("TWILIO_API_SECRET");

  commands.maskValue(apiSecret);

  // Twilio API requests only need an API Key and API Secret in required operations
  return twilio(apiKey, apiSecret, { accountSid: "AC0" });
};
