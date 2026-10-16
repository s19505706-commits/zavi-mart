import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
  image: { type: String, default: "", maxlength: 1000000 },
  description: { type: String, default: "", maxlength: 1000 },
  departmentId: { type: String, required: true, index: true },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0, min: 0 }
}, { timestamps: true, collection: "categories" });

export type CategoryRecord = InferSchemaType<typeof categorySchema>;
export type CategoryDocument = HydratedDocument<CategoryRecord>;

if (mongoose.models.Category && !mongoose.models.Category.schema.path("departmentId")) {
  mongoose.deleteModel("Category");
}
const Category = mongoose.models.Category
  ? mongoose.model<CategoryRecord>("Category")
  : mongoose.model<CategoryRecord>("Category", categorySchema);

export default Category;
