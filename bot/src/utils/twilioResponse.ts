import { Response } from "express";

export const sendEmptyTwiml = (res: Response): void => {
  res.set("Content-Type", "text/xml");
  res.send("<Response></Response>");
};
