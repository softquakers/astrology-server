import mongoose, { Document, Schema, Model } from "mongoose";

export interface IAppInstall extends Document {
  email?: string;
  name?: string;
  question?: string;
  platform?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppInstallSchema = new Schema<IAppInstall>(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      default: "",
    },
    name: {
      type: String,
      trim: true,
      default: "Querent",
    },
    question: {
      type: String,
      trim: true,
      default: "",
    },
    platform: {
      type: String,
      trim: true,
      default: "Web",
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

AppInstallSchema.index({ createdAt: -1 });

export const AppInstall: Model<IAppInstall> =
  mongoose.models.AppInstall ||
  mongoose.model<IAppInstall>("AppInstall", AppInstallSchema);
