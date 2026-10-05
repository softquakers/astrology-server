import mongoose, { Document, Schema, Model } from "mongoose";

export type SubscriptionStatus = "active" | "unpaid" | "past_due" | "canceled" | "free";
export type SubscriptionPlan = "monthly" | "yearly" | "free";

export interface IUser extends Document {
  email: string;
  name?: string;
  photoUrl?: string;
  isPremium: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan;
  monthlyFee: number;
  lastPaymentDate?: Date | null;
  nextBillingDate?: Date | null;
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    photoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    isPremium: {
      type: Boolean,
      default: false,
      index: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "unpaid", "past_due", "canceled", "free"],
      default: "free",
      index: true,
    },
    subscriptionPlan: {
      type: String,
      enum: ["monthly", "yearly", "free"],
      default: "free",
    },
    monthlyFee: {
      type: Number,
      default: 0,
    },
    lastPaymentDate: {
      type: Date,
      default: null,
    },
    nextBillingDate: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      default: "credit_card",
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ createdAt: -1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
