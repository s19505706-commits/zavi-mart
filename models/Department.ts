import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
  image: { type: String, default: "", maxlength: 1000000 },
  description: { type: String, default: "", maxlength: 1000 },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0, min: 0 }
}, { timestamps: true, collection: "departments" });

export type DepartmentRecord = InferSchemaType<typeof departmentSchema>;
export type DepartmentDocument = HydratedDocument<DepartmentRecord>;

const Department = mongoose.models.Department
  ? mongoose.model<DepartmentRecord>("Department")
  : mongoose.model<DepartmentRecord>("Department", departmentSchema);

export default Department;
