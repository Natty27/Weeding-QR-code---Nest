import { Schema } from 'mongoose';

export const GuestSchema = new Schema({
  name: { type: String, required: false },
  ticketType: { type: String, default: 'Standard' },
  sequence: { type: Number, index: true },
  token: { type: String, unique: true, index: true },
  used: { type: Boolean, default: false },
  usedAt: Date,
  scanTime: Date,
});

