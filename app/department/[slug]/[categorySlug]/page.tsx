import DepartmentProductListing from "../../../../components/DepartmentProductListing";

export default async function DepartmentCategoryPage({
  params
}: {
  params: Promise<{ slug: string; categorySlug: string }>;
}) {
  const { slug, categorySlug } = await params;
  return (
    <DepartmentProductListing
      departmentSlug={decodeURIComponent(slug)}
      categorySlug={decodeURIComponent(categorySlug)}
    />
  );
}
