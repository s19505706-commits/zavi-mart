import DepartmentProductListing from "../../../components/DepartmentProductListing";

export const dynamic = "force-dynamic";

export default async function DepartmentByIdPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const departmentKey = id;
  return <DepartmentProductListing departmentSlug={departmentKey} departmentId={departmentKey} />;
}
