/**
 * OptimismAI - Decision Session Schema
 * MongoDB schema for persisting decision sessions
 */

import { Schema } from 'mongoose';

/**
 * Milestone schema (embedded)
 */
const milestoneSchema = new Schema(
    {
        id: { type: String, required: true },
        type: { type: String, required: true },
        label: { type: String, required: true },
        timestamp: { type: Number, required: true },
        nodeId: { type: String },
        metadata: { type: Schema.Types.Mixed },
    },
    { _id: false },
);

/**
 * Leaning vector schema (embedded)
 */
const leaningVectorSchema = new Schema(
    {
        direction: { type: String, required: true },
        confidence: { type: Number, required: true, min: 0, max: 1 },
    },
    { _id: false },
);

/**
 * Assumption schema (embedded)
 */
const assumptionSchema = new Schema(
    {
        id: { type: String, required: true },
        text: { type: String, required: true },
        resolved: { type: Boolean, default: false },
        resolvedAt: { type: Number },
    },
    { _id: false },
);

/**
 * Decision option schema (embedded)
 */
const decisionOptionSchema = new Schema(
    {
        id: { type: String, required: true },
        text: { type: String, required: true },
        eliminated: { type: Boolean, default: false },
        eliminatedReason: { type: String },
        eliminatedAt: { type: Number },
    },
    { _id: false },
);

/**
 * Decision Session Schema
 */
const decisionSessionSchema = new Schema(
    {
        sessionId: {
            type: String,
            unique: true,
            required: true,
            index: true,
        },
        user: {
            type: String,
            required: true,
            index: true,
        },
        title: {
            type: String,
            default: 'New Decision',
        },
        // The initial decision statement
        statement: {
            type: String,
        },
        // Current phase of the session
        phase: {
            type: String,
            enum: ['IDLE', 'INTAKE', 'EXPLORING', 'SETTLING', 'SILENT'],
            default: 'IDLE',
        },
        // How the session ended
        endingState: {
            type: String,
            enum: ['clarity', 'conditional_clarity', 'rest'],
        },
        // Serialized thought nodes (ThoughtNodeData[])
        nodes: {
            type: Schema.Types.Mixed,
            default: [],
        },
        // Session milestones for trace overlay
        milestones: {
            type: [milestoneSchema],
            default: [],
        },
        // Current leaning direction
        leaning: {
            type: leaningVectorSchema,
        },
        // Discovered constraints
        constraints: {
            type: [String],
            default: [],
        },
        // Tracked assumptions
        assumptions: {
            type: [assumptionSchema],
            default: [],
        },
        // Available options
        options: {
            type: [decisionOptionSchema],
            default: [],
        },
        // Formed insights
        insights: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true },
);

// Indexes for efficient queries
decisionSessionSchema.index({ user: 1, updatedAt: -1 });
decisionSessionSchema.index({ sessionId: 1, user: 1 }, { unique: true });

export default decisionSessionSchema;
