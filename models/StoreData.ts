import mongoose, { type InferSchemaType } from "mongoose";

const storeDataSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true, collection: "store_data" });

export type StoreDataRecord = InferSchemaType<typeof storeDataSchema>;

const StoreData = mongoose.models.StoreData
  ? mongoose.model<StoreDataRecord>("StoreData")
  : mongoose.model<StoreDataRecord>("StoreData", storeDataSchema);

export default StoreData;
