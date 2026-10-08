import mongoose, { Document, Schema, Model } from "mongoose";

export type SubscriptionPlanId = "monthly" | "three_month";

export interface ISubscription extends Document {
  subscriptionId: string;
  razorpaySubscriptionId?: string;
  razorpayPaymentId?: string;
  razorpayPlanId?: string;
  razorpaySignature?: string;
  email: string;
  name: string;
  phone?: string;
  planId: SubscriptionPlanId;
  planName: string;
  amount: number;
  currency: string;
  interval: string;
  intervals: number;
  status:
    | "INITIALIZED"
    | "CREATED"
    | "AUTHENTICATED"
    | "BANK_APPROVAL_PENDING"
    | "PENDING"
    | "ACTIVE"
    | "ON_HOLD"
    | "PAUSED"
    | "HALTED"
    | "EXPIRED"
    | "CANCELLED"
    | "COMPLETED"
    | "FAILED";
  paymentMethod: string;
  authLink?: string;
  sessionId?: string;
  isDemo: boolean;
  rawResponse?: Record<string, any>;
  activatedAt?: Date | null;
  nextBillingDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    subscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpaySubscriptionId: {
      type: String,
      default: "",
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: "",
    },
    razorpayPlanId: {
      type: String,
      default: "",
    },
    razorpaySignature: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    planId: {
      type: String,
      enum: ["monthly", "three_month"],
      required: true,
    },
    planName: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    interval: {
      type: String,
      default: "MONTH",
    },
    intervals: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: [
        "INITIALIZED",
        "CREATED",
        "AUTHENTICATED",
        "BANK_APPROVAL_PENDING",
        "PENDING",
        "ACTIVE",
        "ON_HOLD",
        "PAUSED",
        "HALTED",
        "EXPIRED",
        "CANCELLED",
        "COMPLETED",
        "FAILED",
      ],
      default: "INITIALIZED",
      index: true,
    },
    paymentMethod: {
      type: String,
      default: "upi_autopay",
    },
    authLink: {
      type: String,
      default: "",
    },
    sessionId: {
      type: String,
      default: "",
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
    rawResponse: {
      type: Schema.Types.Mixed,
      default: {},
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    nextBillingDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

SubscriptionSchema.index({ createdAt: -1 });

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
