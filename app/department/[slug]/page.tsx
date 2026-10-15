import DepartmentProductListing from "../../../components/DepartmentProductListing";

export default async function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DepartmentProductListing departmentSlug={decodeURIComponent(slug)} />;
}
