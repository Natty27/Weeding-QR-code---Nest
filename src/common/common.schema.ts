import { Schema } from 'mongoose';

export const CommonSchema = new Schema({
  name: { type: String, required: false },
  token: { type: String, unique: true, index: true },
});
