import { Schema } from 'mongoose';

export const GuestSchema = new Schema({
  name: { type: String, required: false },
  phone: { type: String, required: false },
  role: { type: String, required: false },
  company: { type: String, required: false },
  registeredAt: Date,
  ticketType: { type: String, default: 'Standard' },
  sequence: { type: Number, index: true },
  token: { type: String, unique: true, index: true },
  used: { type: Boolean, default: false },
  usedAt: Date,
  scanTime: Date,
});
