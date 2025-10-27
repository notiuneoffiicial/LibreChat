import { Schema } from 'mongoose';
import { conversationPreset } from './defaults';
import { IConversation } from '~/types';

const promptPrefixHistorySchema = new Schema(
  {
    revision: { type: Number, required: true },
    promptPrefix: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
    source: { type: String, default: 'meta-injector' },
    diagnostics: { type: Schema.Types.Mixed },
    guardrailStatus: { type: String },
  },
  { _id: false },
);

const guardrailStateSchema = new Schema(
  {
    lastStatus: { type: String },
    lastStatusAt: { type: Date },
    blocked: { type: Boolean },
    reasons: { type: [String], default: undefined },
    blockedPhrases: { type: [String], default: undefined },
    failureCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const convoSchema: Schema<IConversation> = new Schema(
  {
    conversationId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      meiliIndex: true,
    },
    title: {
      type: String,
      default: 'New Chat',
      meiliIndex: true,
    },
    user: {
      type: String,
      index: true,
      meiliIndex: true,
    },
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    agentOptions: {
      type: Schema.Types.Mixed,
    },
    ...conversationPreset,
    promptPrefixDefault: {
      type: String,
    },
    promptPrefixCurrent: {
      type: String,
    },
    promptPrefixHistory: {
      type: [promptPrefixHistorySchema],
      default: [],
    },
    promptGuardrailState: {
      type: guardrailStateSchema,
      default: undefined,
    },
    agent_id: {
      type: String,
    },
    tags: {
      type: [String],
      default: [],
      meiliIndex: true,
    },
    files: {
      type: [String],
    },
    expiredAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

convoSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });
convoSchema.index({ createdAt: 1, updatedAt: 1 });
convoSchema.index({ conversationId: 1, user: 1 }, { unique: true });

export default convoSchema;
