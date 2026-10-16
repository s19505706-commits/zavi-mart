import DepartmentProductListing from "../../../components/DepartmentProductListing";

export default async function DepartmentByIdPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DepartmentProductListing departmentSlug="" departmentId={decodeURIComponent(id)} />;
}
