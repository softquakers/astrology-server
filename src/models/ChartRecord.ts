import mongoose, { Document, Schema, Model } from "mongoose";

export interface IPlanetPosition {
  name: string;
  lon?: number;
  sign: string;
  deg: number;
  house: number;
}

export interface IChartRecord extends Document {
  name?: string;
  email?: string;
  date: string;
  time: string;
  place?: string;
  lat: number;
  lon: number;
  tz: string;
  asc: string;
  planets: IPlanetPosition[];
  aspects: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlanetPositionSchema = new Schema<IPlanetPosition>(
  {
    name: { type: String, required: true },
    lon: { type: Number },
    sign: { type: String, required: true },
    deg: { type: Number, required: true },
    house: { type: Number, required: true },
  },
  { _id: false }
);

const ChartRecordSchema = new Schema<IChartRecord>(
  {
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, index: true, default: "" },
    date: { type: String, required: true },
    time: { type: String, required: true },
    place: { type: String, trim: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    tz: { type: String, required: true },
    asc: { type: String, required: true },
    planets: { type: [PlanetPositionSchema], required: true },
    aspects: { type: [String], default: [] },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

ChartRecordSchema.index({ createdAt: -1 });

export const ChartRecord: Model<IChartRecord> =
  mongoose.models.ChartRecord || mongoose.model<IChartRecord>("ChartRecord", ChartRecordSchema);
