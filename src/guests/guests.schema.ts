import { Schema } from 'mongoose';

export const GuestSchema = new Schema({
  name: { type: String, required: false },
  sequence: { type: Number, index: true },
  token: { type: String, unique: true, index: true },
  used: { type: Boolean, default: false },
  scanTime: Date,
});
