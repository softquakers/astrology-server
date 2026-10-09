import mongoose, { Document, Schema, Model } from "mongoose";

export type FunnelStep =
  | "launch"
  | "name"
  | "photo"
  | "dob"
  | "tob"
  | "subscribed"
  | "attached";

export interface IFunnelEvent extends Document {
  step: FunnelStep;
  visitorId: string;
  sessionId?: string;
  email?: string;
  name?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const FunnelEventSchema = new Schema<IFunnelEvent>(
  {
    step: {
      type: String,
      required: true,
      enum: ["launch", "name", "photo", "dob", "tob", "subscribed", "attached"],
      index: true,
    },
    visitorId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

FunnelEventSchema.index({ step: 1, visitorId: 1 });
FunnelEventSchema.index({ createdAt: -1 });

export const FunnelEvent: Model<IFunnelEvent> =
  mongoose.models.FunnelEvent ||
  mongoose.model<IFunnelEvent>("FunnelEvent", FunnelEventSchema);
