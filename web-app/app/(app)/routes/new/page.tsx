import RouteForm from "./route-form";

export default async function NewRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const sp = await searchParams;
  return <RouteForm editId={sp.edit} />;
}
