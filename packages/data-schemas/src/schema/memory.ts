import { Schema } from 'mongoose';
import type { IMemoryEntry } from '~/types/memory';

const MemoryEntrySchema: Schema<IMemoryEntry> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  key: {
    type: String,
    required: true,
    validate: {
      validator: (v: string) => /^[a-z0-9_-]+$/.test(v),
      message: 'Key must only contain lowercase letters, numbers, underscores, or hyphens',
    },
  },
  value: {
    type: String,
    required: true,
  },
  tokenCount: {
    type: Number,
    default: 0,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

MemoryEntrySchema.index({ userId: 1, key: 1 }, { unique: true });

export default MemoryEntrySchema;
